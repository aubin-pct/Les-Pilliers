import { useRef, useState } from "react";
import { LADDER } from "@/content/capital";
import { gain, win } from "@/engine/core";
import { POINTS, currentMission, missionPoints } from "@/engine/scoring";
import { todayConcept } from "@/engine/insights";
import { examineConcept, orderMission, type MissionOrder } from "@/ai/contremaitre";
import { DAY, dayKey, f0, fdate, num, plural, wc } from "@/lib/format";
import { buzz } from "@/lib/device";
import { saveProof, toJpeg } from "@/lib/media";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { Card, Foreman, PillarHeader, Thinking, useNow } from "@/ui/kit";
import { ExamResult, type ExamView } from "@/features/esprit/ExamResult";
import { ProofSheet } from "./ProofSheet";

export function CapitalView() {
  const c = useChantier()!;
  const demo = useIsDemo();
  const settings = useSettings();
  const act = useStore((s) => s.act);
  const now = useNow(30_000);
  const M = currentMission(c);
  const concept = todayConcept(now);
  const conceptDone = c.concepts.find((x) => dayKey(x.ts) === dayKey(now));
  const logToday = c.missionLog.find((l) => dayKey(l.ts) === dayKey(now));
  const stake = c.stake, left = stake ? stake.deadline - now : 0;

  const [logText, setLogText, clearLog] = useDraft("cap-log");
  const [proofText, setProofText, clearProofText] = useDraft("cap-proof");
  const [amount, setAmount, clearAmount] = useDraft("cap-amount");
  const [skills, setSkills, clearSkills] = useDraft("cap-skills");
  const [answer, setAnswer, clearAnswer] = useDraft("cap-concept");
  const [photo, setPhoto] = useState<{ full: string; thumb: string } | null>(null);
  const [stakeForm, setStakeForm] = useState(false);
  const [stakeAmt, setStakeAmt] = useState("20");
  const [stakeDays, setStakeDays] = useState("7");
  const [order, setOrder] = useState<MissionOrder | null>(null);
  const [busy, setBusy] = useState<"" | "order" | "exam">("");
  const [exam, setExam] = useState<ExamView | null>(null);
  const [showProof, setShowProof] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const logAction = () => {
    const t = logText.trim();
    if (t.length < 15) { toast("Une action concrète. Quinze caractères minimum."); return; }
    const r = act((d) => {
      d.missionLog.push({ ts: Date.now(), text: t });
      if (d.missionLog.length > 400) d.missionLog = d.missionLog.slice(-400);
      return gain(d, "capital", POINTS.missionAction, Date.now());
    });
    clearLog(); gainToast("capital", r);
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try { setPhoto({ full: await toJpeg(f, 1100, 0.78), thumb: await toJpeg(f, 200, 0.7) }); }
    catch { toast("Photo illisible. Essaie une autre image."); }
  };

  const deliver = async () => {
    const proof = proofText.trim(), amt = num(amount || "0");
    if (proof.length < 20) { toast("La preuve doit être précise : quoi, à qui, comment."); return; }
    if (!Number.isFinite(amt) || amt < 0) { toast("Montant invalide."); return; }
    if (M.cash && amt <= 0) { toast("Cette mission exige un montant encaissé."); return; }
    if (!photo && !demo) { toast("Sans photo de la preuve, rien ne compte."); return; }
    const ts = Date.now();
    let photoId: string | null = null;
    if (photo && !demo) { photoId = "m-" + ts; try { await saveProof(photoId, photo.full); } catch { photoId = null; } }
    let extra = "";
    const r = act((d) => {
      const lvl = d.missionLevel;
      d.missions.push({ ts, level: M.custom ? -1 : lvl, title: M.title, proof, amount: amt, photo: photoId });
      d.euros += amt;
      if (d.stake) { extra = `mise de ${f0(d.stake.amount)} € récupérée`; d.stake = null; }
      if (M.custom) d.custom = null; else d.missionLevel = Math.min(LADDER.length, lvl + 1);
      win(d, "capital", `${M.title}${amt ? ` : ${f0(amt)} €` : ""}`, ts);
      return gain(d, "capital", missionPoints(lvl, amt, M.custom), ts);
    });
    setPhoto(null); clearProofText(); clearAmount();
    gainToast("capital", r, extra); buzz([60, 40, 120]);
  };

  const engage = () => {
    const a = num(stakeAmt), d = num(stakeDays);
    if (!(a >= 5) || !(d >= 2)) { toast("Cinq euros et deux jours minimum."); return; }
    act((x) => { x.stake = { amount: Math.round(a), level: x.missionLevel, title: M.title, set: Date.now(), deadline: Date.now() + Math.round(d) * DAY }; });
    setStakeForm(false); toast(`${f0(a)} € engagés. Tic-tac.`, "loss"); buzz([100, 60, 100]);
  };

  const askOrder = async () => {
    if (!aiEnabled(settings)) { toast("Branche ta clé DeepSeek dans les réglages."); return; }
    if (demo) { toast("Pas de mission sur mesure en démo."); return; }
    if (skills.trim().length < 20) { toast("Donne-lui de la matière : vingt caractères minimum."); return; }
    setBusy("order");
    const r = await orderMission({
      echelon: Math.min(c.missionLevel + 1, LADDER.length), actuel: LADDER[Math.min(c.missionLevel, LADDER.length - 1)].title,
      euros: c.euros, livrees: c.missions.slice(-5).map((m) => m.title), skills: skills.trim(),
    });
    setBusy(""); setOrder(r);
  };

  const submitConcept = async () => {
    const n = wc(answer);
    if (n < 60) { toast(`${n} ${plural(n, "mot")}. Il en faut 60. Développe.`); return; }
    setBusy("exam");
    const r = await examineConcept(concept.name, M.title, answer.trim());
    const note = r ? Math.max(0, Math.min(10, Math.round(Number(r.note)))) : Math.min(6, Math.floor(n / 25));
    const verdict = r ? `${r.verdict}\nLacune : ${r.lacune}\nÀ appliquer : ${r.application}` : "";
    const g = act((d) => {
      d.concepts.push({ ts: Date.now(), c: concept.name, ans: answer.trim(), note, verdict });
      if (note >= 8) win(d, "capital", `${note}/10 sur « ${concept.name} »`, Date.now());
      return gain(d, "capital", note * POINTS.conceptFactor, Date.now());
    });
    gainToast("capital", g);
    setBusy(""); clearAnswer();
    setExam({ note, ai: !!r, lines: r ? [["Verdict", r.verdict], ["Lacune", r.lacune], ["À appliquer", r.application]] : [] });
  };

  return (
    <div className="view">
      <PillarHeader c={c} id="capital" now={now} />

      <Card>
        <div className="bigmoney">
          <span className="k num">{f0(c.euros)} €</span>
          <span className="l">gagnés de ton propre chef, hors salaire · {c.missions.length} {plural(c.missions.length, "mission")} {plural(c.missions.length, "livrée")}{c.stakesLost ? <> · <span className="down">{f0(c.stakesLost)} € de mises perdues</span></> : null}</span>
        </div>
        <p className="muted small">Le seul chiffre honnête. Obéir à un patron ne compte pas ici. Ce qui compte, c'est l'argent que tu crées en te donnant toi-même les ordres.</p>
      </Card>

      <Card title="Ordre de mission" aside={<span className="tag">{M.custom ? "sur mesure" : M.done ? "échelle terminée" : `échelon ${c.missionLevel + 1} / ${LADDER.length}`}</span>}>
        {M.done ? (
          <><p className="h-display" style={{ fontSize: 28 }}>Échelle gravie.</p><p className="muted">Demande une mission sur mesure au Contremaître. Elles ne s'arrêtent jamais.</p></>
        ) : (
          <>
            <p className="h-display" style={{ fontSize: 28 }}>{M.title}</p>
            <p className="muted">{M.detail}</p>
            {stake && (
              <div className="alert" style={{ padding: "10px 12px" }}>
                <span className="eyebrow">Mise engagée</span>
                <p><b className="num">{f0(stake.amount)} €</b> en jeu · échéance dans <b className="num">{Math.max(0, Math.floor(left / DAY))} j {Math.max(0, Math.floor((left % DAY) / 3600e3))} h</b>. Mission non livrée à temps : mise perdue et −10 % sur le Capital.</p>
              </div>
            )}
            <hr className="sep" />
            <span className="eyebrow">Journal de mission · le plancher quotidien</span>
            {logToday ? (
              <p><b style={{ color: "var(--ok)" }}>Posé.</b> <span className="muted">« {logToday.text} »</span></p>
            ) : (
              <>
                <label className="f" htmlFor="ml-text">Qu'as-tu fait AUJOURD'HUI pour cette mission ?
                  <input type="text" id="ml-text" value={logText} onChange={(e) => setLogText(e.target.value)} placeholder="Une action concrète, vérifiable" />
                </label>
                <div><button className="btn" type="button" onClick={logAction}>Consigner l'action</button></div>
              </>
            )}
            <hr className="sep" />
            <span className="eyebrow">Livraison</span>
            <label className="f" htmlFor="mi-proof">Ce que tu as fait, à qui, comment
              <textarea id="mi-proof" style={{ minHeight: 80 }} value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="Ex. : vendu mon vieux vélo 80 € sur Leboncoin, payé en espèces." />
            </label>
            <label className="f" htmlFor="mi-amount">Montant encaissé (€)
              <input type="number" id="mi-amount" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </label>
            <div className="shot">
              {photo ? (
                <><img className="proof-thumb" src={photo.thumb} alt="Photo de preuve" /><button className="linkish" type="button" onClick={() => setPhoto(null)}>Retirer</button></>
              ) : (
                <><button className="btn" type="button" onClick={() => fileRef.current?.click()}>Photo de la preuve</button><span className="muted small">capture du paiement, du message, du reçu</span></>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={() => void deliver()}>Déclarer la mission livrée</button>
              {!stake && <button className="btn" type="button" onClick={() => setStakeForm((v) => !v)}>Engager une mise</button>}
            </div>
            {stakeForm && !stake && (
              <>
                <div className="grid2">
                  <label className="f" htmlFor="st-amt">Mise (€)<input type="number" id="st-amt" inputMode="numeric" min="5" value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value)} /></label>
                  <label className="f" htmlFor="st-days">Délai (jours)<input type="number" id="st-days" inputMode="numeric" min="2" max="30" value={stakeDays} onChange={(e) => setStakeDays(e.target.value)} /></label>
                </div>
                <p className="muted small">La mise est un engagement d'honneur : l'appli ne touche pas à ton argent. Si tu échoues, verse-la vraiment à une association. Le registre s'en souviendra.</p>
                <div><button className="btn danger" type="button" onClick={engage}>Je m'engage</button></div>
              </>
            )}
          </>
        )}
      </Card>

      <Card title="Mission sur mesure" aside={aiEnabled(settings) ? "IA" : "IA requise"}>
        <p className="muted small">Dis au Contremaître ce que tu sais faire. Il te donne un ordre adapté, avec la preuve exigée et un délai.</p>
        <label className="f" htmlFor="cu-skills">Tes compétences, ton matériel, ton temps libre
          <textarea id="cu-skills" style={{ minHeight: 80 }} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Ex. : je code en Python, je sais monter un PC, j'ai 5 h par semaine, un vélo, un bon niveau en maths." />
        </label>
        <div className="btn-row">
          <button className="btn" type="button" disabled={busy === "order"} onClick={() => void askOrder()}>Demander un ordre de mission</button>
          {c.custom && <button className="btn ghost" type="button" onClick={() => act((d) => { d.custom = null; })}>Revenir à l'échelle</button>}
        </div>
        {busy === "order" && <Thinking>Le Contremaître rédige ton ordre</Thinking>}
        {order && (
          <>
            <Foreman who={`Ordre proposé · ${order.jours} jours`} say={order.titre} sayStyle={{ fontSize: 24 }}>
              <p>{order.consigne}</p>
              <p className="muted">Preuve exigée : {order.preuve}</p>
            </Foreman>
            <div><button className="btn primary" type="button" onClick={() => { act((d) => { d.custom = { titre: String(order.titre), consigne: String(order.consigne), preuve: String(order.preuve), jours: Number(order.jours) || 7 }; }); setOrder(null); clearSkills(); toast("Ordre accepté. Exécution."); }}>J'accepte l'ordre</button></div>
          </>
        )}
      </Card>

      <Card title="Concept du jour" aside="théorie au service de la mission">
        <p className="h-display" style={{ fontSize: 26 }}>{concept.name}</p>
        {exam ? (
          <ExamResult exam={exam} onContinue={() => setExam(null)} />
        ) : conceptDone ? (
          <>
            <p><b style={{ color: conceptDone.note >= 6 ? "var(--ok)" : "var(--blood)" }}>Examiné : {conceptDone.note}/10.</b></p>
            {conceptDone.verdict && <p className="voice">{conceptDone.verdict}</p>}
          </>
        ) : (
          <>
            <p className="muted">Explique-le, puis applique-le à ta mission : « {M.title} ».</p>
            <label className="f" htmlFor="co-ans">Ton explication
              <textarea id="co-ans" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Définition, exemple chiffré, application à ta mission." />
            </label>
            <div className="counter num">{wc(answer)} {plural(wc(answer), "mot")} · 60 minimum</div>
            <div><button className="btn primary" type="button" disabled={busy === "exam"} onClick={() => void submitConcept()}>Soumettre à l'examen</button></div>
            {busy === "exam" && <Thinking>L'Examinateur lit ta copie</Thinking>}
          </>
        )}
      </Card>

      <Card title="L'échelle" aside={`${Math.min(c.missionLevel, LADDER.length)}/${LADDER.length} gravis`}>
        <div className="ladder">
          {LADDER.map((L, i) => {
            const cls = i < c.missionLevel ? "done" : i === c.missionLevel ? "cur" : "lock";
            const m = c.missions.find((x) => x.level === i);
            return (
              <div className={"rung " + cls} key={L.title}>
                <span className="lv">{i + 1}</span>
                <div>
                  <div className="tt">{L.title}</div>
                  <div className="dd">{m ? `Livré le ${fdate(m.ts)} · ${f0(m.amount)} € · ${m.proof}` : L.detail}</div>
                  {m?.photo && <button className="linkish" type="button" onClick={() => setShowProof(m.photo)}>Voir la preuve</button>}
                </div>
              </div>
            );
          })}
        </div>
        {c.missions.some((m) => m.level < 0) && (
          <>
            <hr className="sep" />
            <span className="eyebrow">Missions sur mesure livrées</span>
            <div className="list">
              {c.missions.filter((m) => m.level < 0).slice(-5).reverse().map((m) => (
                <div className="li" key={m.ts}>
                  <span className="main">{m.title}</span><span className="side">{f0(m.amount)} €</span>
                  <span className="sub">{fdate(m.ts)} · {m.proof} {m.photo && <button className="linkish" type="button" onClick={() => setShowProof(m.photo)}>preuve</button>}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      <ProofSheet id={showProof} onClose={() => setShowProof(null)} />
    </div>
  );
}
