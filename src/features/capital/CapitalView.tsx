import { useEffect, useRef, useState } from "react";
import { doneToday, gain, win } from "@/engine/core";
import { POINTS, advanceMission, currentMission, missionPoints } from "@/engine/scoring";
import { todayConcept } from "@/engine/insights";
import { ladderRoadmap } from "@/engine/fallbacks";
import { aiReady, examineConcept, genRoadmap, genSteps, pickConcept, replacePalier, unblock } from "@/ai/contremaitre";
import { DAY, dayKey, f0, fdate, num, plural, wc } from "@/lib/format";
import { buzz } from "@/lib/device";
import { saveProof, toJpeg } from "@/lib/media";
import { useChantier, useIsDemo, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { Card, Foreman, PillarHeader, Thinking, useNow } from "@/ui/kit";
import { MemoryNote } from "@/features/temple/Memory";
import { ExamResult, type ExamView } from "@/features/esprit/ExamResult";
import { HoldButton } from "@/ui/HoldButton";
import { ProofSheet } from "./ProofSheet";

export function CapitalView() {
  const c = useChantier()!;
  const now = useNow(30_000);
  const [showProof, setShowProof] = useState<string | null>(null);
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
      <MemoryNote c={c} id="capital" />
      <MissionCard now={now} />
      <ConceptCard now={now} />
      <RoadmapCard onProof={setShowProof} />
      <ProofSheet id={showProof} onClose={() => setShowProof(null)} />
    </div>
  );
}

/* ---------------- Mission en cours ---------------- */

function MissionCard({ now }: { now: number }) {
  const c = useChantier()!;
  const demo = useIsDemo();
  const act = useStore((s) => s.act);
  const M = currentMission(c);
  const stake = c.stake, left = stake ? stake.deadline - now : 0;
  const logToday = c.missionLog.filter((l) => dayKey(l.ts) === dayKey(now) && !l.text.startsWith("Blocage"));
  const floorDone = doneToday(c, "capital", now);
  const steps = c.missionSteps?.palier === M.title ? c.missionSteps : null;

  const [logText, setLogText, clearLog] = useDraft("cap-log");
  const [proofText, setProofText, clearProofText] = useDraft("cap-proof");
  const [amount, setAmount, clearAmount] = useDraft("cap-amount");
  const [photo, setPhoto] = useState<{ full: string; thumb: string } | null>(null);
  const [panel, setPanel] = useState<"" | "bloque" | "changer" | "mise">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "steps" | "bloque" | "changer">("");
  const [coach, setCoach] = useState<{ diagnostic: string; action: string; phrase: string } | null>(null);
  const [stakeAmt, setStakeAmt] = useState("20");
  const [stakeDays, setStakeDays] = useState(String(Math.max(2, Math.min(30, M.jours))));
  const fileRef = useRef<HTMLInputElement>(null);
  const tried = useRef("");

  // Plan d'attaque : généré automatiquement à l'ouverture d'une nouvelle mission.
  useEffect(() => {
    if (M.done || steps || !aiReady() || tried.current === M.title) return;
    tried.current = M.title;
    void makeSteps();
  }, [M.title]);

  async function makeSteps() {
    setBusy("steps");
    const r = await genSteps();
    setBusy("");
    if (r) act((d) => { d.missionSteps = { palier: M.title, ts: Date.now(), items: r.etapes.map((t) => ({ t, done: false })) }; });
  }

  const logAction = (t: string) => {
    const r = act((d) => {
      d.missionLog.push({ ts: Date.now(), text: t });
      if (d.missionLog.length > 400) d.missionLog = d.missionLog.slice(-400);
      return gain(d, "capital", POINTS.missionAction, Date.now());
    });
    gainToast("capital", r);
  };
  const toggleStep = (i: number) => {
    if (!steps) return;
    const was = steps.items[i].done;
    act((d) => { if (d.missionSteps) d.missionSteps.items[i].done = !was; });
    if (!was) logAction(`Étape faite : ${steps.items[i].t}`);
  };

  const askUnblock = async () => {
    if (text.trim().length < 10) { toast("Décris ton blocage en une phrase au moins."); return; }
    setBusy("bloque");
    const r = await unblock(text.trim());
    setBusy("");
    if (r) { setCoach(r); act((d) => { d.missionLog.push({ ts: Date.now(), text: `Blocage : ${text.trim()} → ${r.action}` }); }); setText(""); }
  };
  const askChange = async () => {
    if (text.trim().length < 10) { toast("Donne une vraie raison."); return; }
    setBusy("changer");
    const r = await replacePalier(text.trim());
    setBusy("");
    if (r) {
      act((d) => {
        if (!d.roadmap) d.roadmap = ladderRoadmap(d.missionLevel);
        d.roadmap.paliers[Math.min(d.roadmap.index, d.roadmap.paliers.length - 1)] = r;
        d.missionSteps = null; d.custom = null;
      });
      tried.current = ""; setText(""); setPanel(""); toast("Mission remplacée.");
    }
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
      d.missions.push({ ts, level: M.custom ? -1 : M.index, title: M.title, proof, amount: amt, photo: photoId });
      d.euros += amt;
      if (d.stake) { extra = `mise de ${f0(d.stake.amount)} € récupérée`; d.stake = null; }
      advanceMission(d);
      win(d, "capital", `${M.title}${amt ? ` : ${f0(amt)} €` : ""}`, ts);
      return gain(d, "capital", missionPoints(M.index, amt, M.custom), ts);
    });
    setPhoto(null); clearProofText(); clearAmount(); tried.current = "";
    gainToast("capital", r, extra); buzz([60, 40, 120]);
  };
  const engage = () => {
    const a = num(stakeAmt), d = num(stakeDays);
    if (!(a >= 5) || !(d >= 2)) { toast("Cinq euros et deux jours minimum."); return; }
    act((x) => { x.stake = { amount: Math.round(a), level: M.index, title: M.title, set: Date.now(), deadline: Date.now() + Math.round(d) * DAY }; });
    setPanel(""); toast(`${f0(a)} € engagés. Tic-tac.`, "loss"); buzz([100, 60, 100]);
  };

  if (M.done) {
    return (
      <Card title="Mission en cours" aside={<span className="tag">feuille de route terminée</span>}>
        <p className="h-display" style={{ fontSize: 28 }}>Feuille de route gravie.</p>
        <p className="muted">Demande au Contremaître la suivante, plus haute (carte « Feuille de route » plus bas).</p>
      </Card>
    );
  }

  return (
    <Card title="Mission en cours" aside={<span className="tag">palier {M.index + 1} / {M.total}{M.fromRoadmap ? "" : " · échelle de base"}</span>}>
      <p className="h-display" style={{ fontSize: 28 }}>{M.title}</p>
      <p className="muted">{M.detail}</p>
      <p className="small"><b>Preuve exigée.</b> <span className="muted">{M.proof} · délai indicatif {M.jours} j</span></p>
      {stake && (
        <div className="alert" style={{ padding: "10px 12px" }}>
          <span className="eyebrow">Mise engagée</span>
          <p><b className="num">{f0(stake.amount)} €</b> en jeu · échéance dans <b className="num">{Math.max(0, Math.floor(left / DAY))} j {Math.max(0, Math.floor((left % DAY) / 3600e3))} h</b>. Mission non livrée à temps : mise perdue et −10 % sur le Capital.</p>
        </div>
      )}

      <hr className="sep" />
      <span className="eyebrow">Plan d'attaque</span>
      {steps ? (
        <div className="todo">
          {steps.items.map((s, i) => (
            <button key={i} type="button" className={s.done ? "ok" : ""} onClick={() => toggleStep(i)}>
              <span className="box">{s.done ? "✓" : ""}</span><span className="lab">{s.t}</span><span />
            </button>
          ))}
        </div>
      ) : busy === "steps" ? <Thinking>Le Contremaître découpe ta mission</Thinking> : (
        <div><button className="btn small" type="button" onClick={() => void makeSteps()}>Découper la mission en étapes</button></div>
      )}
      {steps && <button className="linkish" type="button" disabled={busy === "steps"} onClick={() => void makeSteps()}>Refaire le plan d'attaque</button>}

      <hr className="sep" />
      <span className="eyebrow">Journal · le plancher quotidien</span>
      {floorDone && logToday.length > 0 && <p><b style={{ color: "var(--ok)" }}>Posé.</b> <span className="muted">« {logToday[logToday.length - 1].text} »</span></p>}
      <label className="f" htmlFor="ml-text">{floorDone ? "Autre chose de fait aujourd'hui ?" : "Qu'as-tu fait AUJOURD'HUI pour cette mission ?"}
        <input type="text" id="ml-text" value={logText} onChange={(e) => setLogText(e.target.value)} placeholder="Une action concrète, vérifiable" />
      </label>
      <div className="btn-row">
        <button className="btn" type="button" onClick={() => { const t = logText.trim(); if (t.length < 15) { toast("Une action concrète. Quinze caractères minimum."); return; } logAction(t); clearLog(); }}>Consigner l'action</button>
        <button className="btn ghost" type="button" onClick={() => { setPanel(panel === "bloque" ? "" : "bloque"); setCoach(null); }}>Je bloque</button>
        <button className="btn ghost" type="button" onClick={() => setPanel(panel === "changer" ? "" : "changer")}>Changer de mission</button>
      </div>
      {panel === "bloque" && (
        <>
          <label className="f" htmlFor="cap-block">Qu'est-ce qui coince, exactement ?<textarea id="cap-block" style={{ minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : je n'ose pas fixer un prix ; je ne sais pas où trouver des clients" /></label>
          <div><button className="btn" type="button" disabled={busy === "bloque"} onClick={() => void askUnblock()}>Demander au Contremaître</button></div>
          {busy === "bloque" && <Thinking>Le Contremaître analyse</Thinking>}
          {coach && <Foreman who="Déblocage" say={coach.phrase || undefined} sayStyle={{ fontSize: 22 }}><p className="voice">{coach.diagnostic}</p><p className="voice"><b>À faire sous 24 h :</b> {coach.action}</p></Foreman>}
        </>
      )}
      {panel === "changer" && (
        <>
          <label className="f" htmlFor="cap-change">Pourquoi cette mission ne te convient pas<textarea id="cap-change" style={{ minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : je n'ai aucun objet à vendre ; ça ne colle pas avec mes compétences" /></label>
          <p className="muted small">Le Contremaître juge ta raison : une fuite donnera une mission aussi dure.</p>
          <div><button className="btn" type="button" disabled={busy === "changer"} onClick={() => void askChange()}>Proposer une autre mission</button></div>
          {busy === "changer" && <Thinking>Le Contremaître cherche une autre mission</Thinking>}
        </>
      )}

      <hr className="sep" />
      <span className="eyebrow">Livraison</span>
      <label className="f" htmlFor="mi-proof">Ce que tu as fait, à qui, comment
        <textarea id="mi-proof" style={{ minHeight: 80 }} value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="Ex. : 3 h de cours de Python à un lycéen, 25 €/h, payé par virement." />
      </label>
      <label className="f" htmlFor="mi-amount">Montant encaissé (€)
        <input type="number" id="mi-amount" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </label>
      <div className="shot">
        {photo ? <><img className="proof-thumb" src={photo.thumb} alt="Photo de preuve" /><button className="linkish" type="button" onClick={() => setPhoto(null)}>Retirer</button></>
          : <><button className="btn" type="button" onClick={() => fileRef.current?.click()}>Photo de la preuve</button><span className="muted small">capture du paiement, du message, du reçu</span></>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className="btn-row">
        <HoldButton label="Déclarer la mission livrée" hint="Livraison" onConfirm={() => void deliver()} />
        {!stake && <button className="btn" type="button" onClick={() => setPanel(panel === "mise" ? "" : "mise")}>Engager une mise</button>}
      </div>
      {panel === "mise" && !stake && (
        <>
          <div className="grid2">
            <label className="f" htmlFor="st-amt">Mise (€)<input type="number" id="st-amt" inputMode="numeric" min="5" value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value)} /></label>
            <label className="f" htmlFor="st-days">Délai (jours)<input type="number" id="st-days" inputMode="numeric" min="2" max="30" value={stakeDays} onChange={(e) => setStakeDays(e.target.value)} /></label>
          </div>
          <p className="muted small">Engagement d'honneur : l'appli ne touche pas à ton argent. Si tu échoues, verse-la vraiment à une association. Le registre s'en souviendra.</p>
          <div><HoldButton tone="danger" ms={1200} label="Je m'engage" hint="Engagement" onConfirm={engage} /></div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Concept du jour ---------------- */

function ConceptCard({ now }: { now: number }) {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const M = currentMission(c);
  const today = dayKey(now);
  const pick = c.concept?.date === today ? c.concept : null;
  const fallback = todayConcept(now);
  const concept = pick ?? { date: today, nom: fallback.name, pourquoi: "", question: `Explique-le, puis applique-le à ta mission : « ${M.title} ».` };
  const done = c.concepts.find((x) => dayKey(x.ts) === today);
  const [answer, setAnswer, clearAnswer] = useDraft("cap-concept");
  const [busy, setBusy] = useState<"" | "pick" | "exam">("");
  const [exam, setExam] = useState<ExamView | null>(null);
  const tried = useRef("");

  useEffect(() => {
    if (pick || done || !aiReady() || tried.current === today) return;
    tried.current = today;
    setBusy("pick");
    pickConcept(true).then((r) => { setBusy(""); if (r) act((d) => { d.concept = { date: today, ...r }; }); });
  }, [pick, done, today, act]);

  const submit = async () => {
    const n = wc(answer);
    if (n < 60) { toast(`${n} ${plural(n, "mot")}. Il en faut 60. Développe.`); return; }
    setBusy("exam");
    const r = await examineConcept(concept.nom, concept.question, M.title, answer.trim());
    const note = r ? r.note : Math.min(6, Math.floor(n / 25));
    const verdict = r ? `${r.verdict}\nLacune : ${r.lacune}\nÀ appliquer : ${r.application}` : "";
    const g = act((d) => {
      d.concepts.push({ ts: Date.now(), c: concept.nom, ans: answer.trim(), note, verdict });
      if (note >= 8) win(d, "capital", `${note}/10 sur « ${concept.nom} »`, Date.now());
      return gain(d, "capital", note * POINTS.conceptFactor, Date.now());
    });
    gainToast("capital", g);
    setBusy(""); clearAnswer();
    setExam({ note, ai: !!r, lines: r ? [["Verdict", r.verdict], ["Lacune", r.lacune], ["À appliquer", r.application]] : [] });
  };

  return (
    <Card title="Concept du jour" aside={pick ? "choisi pour ta mission" : "théorie au service de la mission"}>
      {busy === "pick" ? <Thinking>Le Contremaître choisit ce qu'il te manque</Thinking> : (
        <>
          <p className="h-display" style={{ fontSize: 26 }}>{concept.nom}</p>
          {concept.pourquoi && <p className="muted small">{concept.pourquoi}</p>}
        </>
      )}
      {exam ? <ExamResult exam={exam} onContinue={() => setExam(null)} /> : done ? (
        <>
          <p><b style={{ color: done.note >= 6 ? "var(--ok)" : "var(--blood)" }}>Examiné : {done.note}/10.</b></p>
          {done.verdict && <p className="voice">{done.verdict}</p>}
        </>
      ) : busy !== "pick" && (
        <>
          <p className="voice">{concept.question}</p>
          <label className="f" htmlFor="co-ans">Ta réponse
            <textarea id="co-ans" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Définition, calcul, application à ta mission." />
          </label>
          <div className="counter num">{wc(answer)} {plural(wc(answer), "mot")} · 60 minimum</div>
          <div><button className="btn primary" type="button" disabled={busy === "exam"} onClick={() => void submit()}>Soumettre à l'examen</button></div>
          {busy === "exam" && <Thinking>L'Examinateur lit ta copie</Thinking>}
        </>
      )}
    </Card>
  );
}

/* ---------------- Feuille de route ---------------- */

function RoadmapCard({ onProof }: { onProof: (id: string) => void }) {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const r = c.roadmap ?? ladderRoadmap(c.missionLevel);
  const [open, setOpen] = useState(false);
  const [demande, setDemande] = useState("");
  const [busy, setBusy] = useState(false);
  const regen = async () => {
    setBusy(true);
    const x = await genRoadmap(demande.trim());
    setBusy(false);
    if (x) { act((d) => { d.roadmap = { ts: Date.now(), vision: x.vision, paliers: x.paliers, index: 0 }; d.missionSteps = null; d.concept = null; }); setOpen(false); setDemande(""); toast("Feuille de route refaite."); }
  };
  const delivered = (title: string) => c.missions.find((m) => m.title === title);
  return (
    <Card title="Feuille de route" aside={c.roadmap ? `depuis le ${fdate(c.roadmap.ts)}` : "échelle de base"}>
      <p className="muted small">{r.vision}</p>
      <div className="ladder">
        {r.paliers.map((P, i) => {
          const cls = i < r.index ? "done" : i === r.index ? "cur" : "lock";
          const m = i < r.index ? delivered(P.titre) : undefined;
          return (
            <div className={"rung " + cls} key={i}>
              <span className="lv">{i + 1}</span>
              <div>
                <div className="tt">{P.titre}</div>
                <div className="dd">{m ? `Livré le ${fdate(m.ts)} · ${f0(m.amount)} € · ${m.proof}` : P.pourquoi}</div>
                {m?.photo && <button className="linkish" type="button" onClick={() => onProof(m.photo!)}>Voir la preuve</button>}
              </div>
            </div>
          );
        })}
      </div>
      {open ? (
        <>
          <label className="f" htmlFor="rm-ask">Ce qui ne te correspond pas (facultatif)
            <textarea id="rm-ask" style={{ minHeight: 70 }} value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Ex. : je veux m'appuyer sur la data et l'IA ; pas de vente physique" />
          </label>
          <p className="muted small">Tes missions livrées et tes euros sont conservés ; la nouvelle feuille de route repart de là où tu en es.</p>
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void regen()}>{c.roadmap ? "Refaire la feuille de route" : "Construire ma feuille de route"}</button>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annuler</button>
          </div>
          {busy && <Thinking>Le Contremaître construit ta feuille de route</Thinking>}
        </>
      ) : (
        <div><button className="btn small" type="button" onClick={() => setOpen(true)}>{c.roadmap ? "Ajuster la feuille de route" : "Construire ma feuille de route personnelle"}</button></div>
      )}
    </Card>
  );
}
