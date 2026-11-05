/*
 * Capital v5 : un vrai plan d'affaires, construit avec le Coach.
 * 1. Diagnostic : le Coach interroge (atouts rares, réseau, temps, contraintes, ambition chiffrée).
 * 2. Trois pistes chiffrées et notées, comparées d'un coup d'œil ; on en choisit une avec un objectif mensuel.
 * 3. Chaque semaine : un sprint (objectif, indicateurs à cocher, message prêt à envoyer), un entonnoir de prospects,
 *    des encaissements prouvés. Le concept du jour n'est plus qu'une carte, au service de la piste.
 */
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/content/capital";
import { gain, win } from "@/engine/core";
import { POINTS, missionPoints } from "@/engine/scoring";
import { monthCash } from "@/engine/coachLines";
import { todayConcept } from "@/engine/insights";
import type { BizOption, Prospect } from "@/engine/types";
import { aiReady, examineConcept, pickConcept } from "@/ai/contremaitre";
import * as O from "@/ai/ops";
import { dayKey, f0, fdate, num, plural, wc } from "@/lib/format";
import { buzz } from "@/lib/device";
import { saveProof, toJpeg } from "@/lib/media";
import { canDictate, dictate, stopDictation, useVoice } from "@/lib/voice";
import { useChantier, useIsDemo, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { openCoach } from "@/store/coach";
import { Card, Fold, PillarHeader, Ring, Sheet, Thinking, useNow } from "@/ui/kit";
import { HoldButton } from "@/ui/HoldButton";
import { CoachHead } from "@/features/coach/CoachHead";
import { ExamResult, type ExamView } from "@/features/esprit/ExamResult";
import { ProofSheet } from "./ProofSheet";

export function CapitalView() {
  const c = useChantier()!;
  const now = useNow(30_000);
  const [proof, setProof] = useState<string | null>(null);
  const [cash, setCash] = useState<{ open: boolean; prospect?: Prospect }>({ open: false });
  const k = c.capital;
  return (
    <div className="view">
      <PillarHeader c={c} id="capital" now={now} />
      <CoachHead scope="capital" />
      {!k.thesis ? (k.options && k.diagDone ? <Options /> : <Diagnostic />) : (
        <>
          <CashHero now={now} onCash={() => setCash({ open: true })} />
          <SprintCard now={now} />
          <Funnel onPaid={(p) => setCash({ open: true, prospect: p })} />
          <ConceptRow now={now} />
          <Fold title={"Ma piste · " + k.thesis.option.nom} aside={fdate(k.thesis.ts)}>
            <OptionDetail o={k.thesis.option} />
            <button className="linkish small" type="button" onClick={() => useStore.getState().act((d) => { d.capital.thesis = null; d.capital.sprint = null; })}>Changer de piste</button>
          </Fold>
        </>
      )}
      {(c.missions.length > 0 || c.euros > 0) && (
        <Fold title="Encaissements" aside={`${f0(c.euros)} €`}>
          <div className="list">
            {c.missions.slice(-12).reverse().map((m) => (
              <div className="li" key={m.ts}>
                <span className="main">{m.title}</span><span className="side num">{f0(m.amount)} €</span>
                <span className="sub">{fdate(m.ts)}{m.photo && <> · <button className="linkish" type="button" onClick={() => setProof(m.photo!)}>preuve</button></>}</span>
              </div>
            ))}
          </div>
        </Fold>
      )}
      <CashSheet open={cash.open} prospect={cash.prospect} onClose={() => setCash({ open: false })} />
      <ProofSheet id={proof} onClose={() => setProof(null)} />
    </div>
  );
}

/* ---------------- 1. Diagnostic ---------------- */

function Diagnostic() {
  const c = useChantier()!;
  const k = c.capital;
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState<"" | "q" | "opt">("");
  const listening = useVoice((s) => s.listening);
  const tried = useRef(false);
  const step = async (a?: string) => { stopDictation(); setBusy("q"); await O.interviewStep(a); setBusy(""); setAns(""); };
  const options = async () => { setBusy("opt"); await O.makeOptions(); setBusy(""); };
  // Diagnostic terminé sans pistes (ou pistes perdues) : on les construit.
  useEffect(() => { if (k.diagDone && !k.options && aiReady() && !tried.current) { tried.current = true; void options(); } }, [k.diagDone, k.options]);

  if (busy === "opt" || (k.diagDone && !k.options)) {
    return <Card title="Tes pistes"><Thinking>Il construit 3 pistes à partir de tes réponses</Thinking>{!busy && <button className="btn" type="button" onClick={() => void options()}>Construire mes pistes</button>}</Card>;
  }
  if (!k.ask) {
    return (
      <Card title="Diagnostic" className="hero-card">
        <div className="steps3">
          <div><b>1</b><span>8 questions</span></div><div><b>2</b><span>3 pistes chiffrées</span></div><div><b>3</b><span>un sprint par semaine</span></div>
        </div>
        <button className="btn primary block big" type="button" disabled={busy === "q"} onClick={() => void step()}>{k.interview.length ? "Reprendre le diagnostic" : "Commencer · 5 min"}</button>
        {busy === "q" && <Thinking>Il prépare sa question</Thinking>}
      </Card>
    );
  }
  const n = k.interview.length;
  return (
    <Card title="Diagnostic" aside={<span className="num">{n + 1} / ~8</span>}>
      <div className="dots" aria-hidden="true">{Array.from({ length: Math.max(8, n + 1) }, (_, i) => <span key={i} className={i < n ? "on" : i === n ? "cur" : ""} />)}</div>
      {busy === "q" ? <Thinking>Il écoute ta réponse</Thinking> : (
        <>
          <p className="question">{k.ask.q}</p>
          {k.ask.choix.length > 0 && <div className="chips">{k.ask.choix.map((ch) => <button key={ch} type="button" className="chip" onClick={() => void step(ch)}>{ch}</button>)}</div>}
          <div className="answer">
            <textarea aria-label="Ta réponse" value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Réponds précisément. Des noms, des chiffres." />
            {canDictate && <button type="button" className={"cp-mic" + (listening ? " on" : "")} aria-label="Dicter" onClick={() => (listening ? stopDictation() : dictate((t) => setAns(t)))}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            </button>}
          </div>
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={ans.trim().length < 2} onClick={() => void step(ans.trim())}>Suivant</button>
            {n >= 4 && <button className="btn ghost" type="button" onClick={() => void options()}>Voir mes pistes</button>}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- 2. Pistes ---------------- */

const SCORES: [keyof BizOption["scores"], string][] = [["marche", "Marché"], ["competence", "Toi"], ["vitesse", "Vitesse"], ["echelle", "Échelle"]];
const avg = (o: BizOption) => (o.scores.marche + o.scores.competence + o.scores.vitesse + o.scores.echelle) / 4;

function ScoreBars({ o }: { o: BizOption }) {
  return (
    <div className="sbars">
      {SCORES.map(([k, l]) => <div key={k}><span>{l}</span><i><b style={{ width: `${o.scores[k] * 10}%` }} /></i><em className="num">{o.scores[k]}</em></div>)}
    </div>
  );
}

function OptionDetail({ o }: { o: BizOption }) {
  return (
    <div className="odetail">
      <p><b>Offre.</b> {o.offre}</p>
      <p><b>Cible.</b> {o.cible}</p>
      <p><b>Canal.</b> {o.canal}</p>
      <p><b>Pourquoi toi.</b> {o.pourquoiToi}</p>
    </div>
  );
}

function Options() {
  const c = useChantier()!;
  const opts = c.capital.options!;
  const best = opts.reduce((a, b) => (avg(b) > avg(a) ? b : a), opts[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [goal, setGoal] = useState<Record<string, string>>({});
  const [fb, setFb] = useState("");
  const [busy, setBusy] = useState(false);
  const again = async () => { setBusy(true); await O.makeOptions(fb.trim()); setBusy(false); setFb(""); };
  return (
    <>
      <div className="opts">
        {opts.map((o) => {
          const on = open === o.id;
          const g = goal[o.id] ?? String(Math.max(100, Math.round((o.potentielMois * 0.4) / 50) * 50));
          return (
            <div key={o.id} className={"opt" + (on ? " on" : "")}>
              <button type="button" className="opt-head" onClick={() => setOpen(on ? null : o.id)} aria-expanded={on}>
                <span className="opt-n">{o.nom}{o.id === best.id && <span className="tag ok">meilleure note</span>}</span>
                <span className="opt-o">{o.offre}</span>
                <span className="opt-k">
                  <span><b className="num">{o.prix}</b><i>prix</i></span>
                  <span><b className="num">J+{o.premierEuroJours}</b><i>1er €</i></span>
                  <span><b className="num">{f0(o.potentielMois)} €</b><i>/mois à 1 an</i></span>
                </span>
                <ScoreBars o={o} />
              </button>
              {on && (
                <div className="opt-body">
                  <OptionDetail o={o} />
                  <label className="f" htmlFor={"goal-" + o.id}>Objectif mensuel (€)
                    <input id={"goal-" + o.id} type="number" inputMode="numeric" value={g} onChange={(e) => setGoal({ ...goal, [o.id]: e.target.value })} />
                  </label>
                  <HoldButton block label="Je choisis cette piste" hint="Engagement" onConfirm={() => { O.chooseThesis(o, num(g) || 0); buzz([40, 30, 80]); }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Fold title="Aucune ne me va">
        <textarea aria-label="Pourquoi" value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Pourquoi ? Ex. : je veux capitaliser sur la data ; pas de démarchage physique" style={{ minHeight: 70 }} />
        <div className="btn-row">
          <button className="btn" type="button" disabled={busy} onClick={() => void again()}>3 autres pistes</button>
          <button className="linkish small" type="button" onClick={() => useStore.getState().act((d) => { d.capital.interview = []; d.capital.ask = null; d.capital.diagDone = false; d.capital.options = null; })}>Refaire le diagnostic</button>
        </div>
        {busy && <Thinking>Il cherche autre chose</Thinking>}
      </Fold>
    </>
  );
}

/* ---------------- 3. Tableau de bord ---------------- */

function CashHero({ now, onCash }: { now: number; onCash: () => void }) {
  const c = useChantier()!;
  const t = c.capital.thesis!;
  const m = monthCash(c, now);
  const d = new Date(now), daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
  return (
    <div className="cash">
      <Ring value={m} max={t.objectifMois} size={128} color="var(--c-capital)">
        <b className="num">{f0(m)} €</b><span>sur {f0(t.objectifMois)}</span>
      </Ring>
      <div className="cash-side">
        <div><b className="num">{f0(c.euros)} €</b><span>gagnés seul, en tout</span></div>
        <div><b className="num">{daysLeft} j</b><span>avant la fin du mois</span></div>
        <button className="btn primary" type="button" onClick={onCash}>+ Encaissement</button>
      </div>
    </div>
  );
}

function SprintCard({ now }: { now: number }) {
  const c = useChantier()!;
  const s = c.capital.sprint;
  const week = O.weekKey(now);
  const [busy, setBusy] = useState(false);
  const tried = useRef("");
  const make = async () => { setBusy(true); await O.makeSprint(); setBusy(false); };
  useEffect(() => { if ((!s || s.semaine !== week) && aiReady() && tried.current !== week) { tried.current = week; void make(); } }, [s?.semaine, week]);
  if (!s || s.semaine !== week) {
    return <Card title="Sprint de la semaine">{busy ? <Thinking>Il fixe les chiffres de ta semaine</Thinking> : <button className="btn primary" type="button" onClick={() => void make()}>Lancer le sprint</button>}</Card>;
  }
  const dow = (new Date(now).getDay() + 6) % 7;
  const done = s.kpis.reduce((a, k) => a + Math.min(k.fait, k.cible), 0), tot = s.kpis.reduce((a, k) => a + k.cible, 0);
  return (
    <Card title="Sprint de la semaine" aside={<span className="num">J{dow + 1}/7 · {tot ? Math.round((done / tot) * 100) : 0} %</span>}>
      <p className="sprint-goal">{s.objectif}</p>
      <div className="kpi-list">
        {s.kpis.map((k) => (
          <div className={"kpi" + (k.fait >= k.cible ? " ok" : "")} key={k.id}>
            <span className="kpi-l">{k.label}</span>
            <span className="kpi-v num">{k.fait}<i>/{k.cible}</i></span>
            <button type="button" className="kpi-minus" aria-label={`Retirer 1 : ${k.label}`} onClick={() => O.bumpKpi(k.id, -1)}>−</button>
            <button type="button" className="kpi-plus" aria-label={`Ajouter 1 : ${k.label}`} onClick={() => { O.bumpKpi(k.id, 1); buzz(15); }}>+1</button>
            <span className="kpi-bar"><b style={{ width: `${Math.min(100, (k.fait / k.cible) * 100)}%` }} /></span>
          </div>
        ))}
      </div>
      <Fold title="Le message à envoyer">
        <div className="script">{s.script}</div>
        <div className="btn-row">
          <button className="btn small" type="button" onClick={() => { void navigator.clipboard?.writeText(s.script).then(() => toast("Copié."), () => toast("Copie impossible : sélectionne le texte.")); }}>Copier</button>
          <button className="btn small ghost" type="button" onClick={() => openCoach("capital", "Réécris mon message de prospection pour ")}>L'adapter</button>
        </div>
      </Fold>
      <div className="btn-row spread">
        <button className="linkish small" type="button" onClick={() => openCoach("capital", "Je bloque sur mon sprint : ")}>Je bloque</button>
        <button className="linkish small" type="button" disabled={busy} onClick={() => void make()}>Refaire le sprint</button>
      </div>
    </Card>
  );
}

function Funnel({ onPaid }: { onPaid: (p: Prospect) => void }) {
  const c = useChantier()!;
  const ps = c.capital.prospects;
  const [nom, setNom] = useState("");
  const [note, setNote] = useState("");
  const counts = STAGES.map((_, i) => ps.filter((p) => p.stage >= i).length);
  const max = Math.max(1, counts[0]);
  const live = ps.filter((p) => p.stage < 4).sort((a, b) => b.maj - a.maj);
  const advance = (p: Prospect) => { if (p.stage === 3) { onPaid(p); return; } O.moveProspect(p.id, p.stage + 1); buzz(10); };
  return (
    <Card title="Entonnoir" aside={`${ps.length} ${plural(ps.length, "prospect")}`}>
      <div className="funnel">
        {STAGES.map((s, i) => (
          <div key={s} className="fun-row"><span>{s}</span><i><b style={{ width: `${(counts[i] / max) * 100}%`, opacity: 1 - i * 0.12 }} /></i><em className="num">{counts[i]}</em></div>
        ))}
      </div>
      {counts[0] > 0 && <p className="mono small muted">Conversion contacté → payé : {Math.round((counts[4] / counts[0]) * 100)} %</p>}
      <div className="pros">
        {live.slice(0, 8).map((p) => (
          <div className="pro" key={p.id}>
            <span className="pro-n">{p.nom}{p.note && <i>{p.note}</i>}</span>
            <button type="button" className="pro-s" onClick={() => advance(p)} aria-label={`${p.nom} : passer à ${STAGES[p.stage + 1]}`}>{STAGES[p.stage]} <b>›</b></button>
          </div>
        ))}
      </div>
      <form className="pro-add" onSubmit={(e) => { e.preventDefault(); if (O.addProspect(nom, note)) { setNom(""); setNote(""); } else toast("Un nom, deux lettres minimum."); }}>
        <input aria-label="Nom du prospect" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nouveau prospect" />
        <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
        <button className="btn" type="submit">+</button>
      </form>
    </Card>
  );
}

function CashSheet({ open, prospect, onClose }: { open: boolean; prospect?: Prospect; onClose: () => void }) {
  const demo = useIsDemo();
  const act = useStore((s) => s.act);
  const [amount, setAmount, clearAmount] = useDraft("cap-amount");
  const [what, setWhat] = useState("");
  const [photo, setPhoto] = useState<{ full: string; thumb: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setWhat(prospect ? `Paiement de ${prospect.nom}` : ""); }, [open, prospect]);
  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try { setPhoto({ full: await toJpeg(f, 1100, 0.78), thumb: await toJpeg(f, 200, 0.7) }); } catch { toast("Photo illisible."); }
  };
  const save = async () => {
    const amt = num(amount || "0");
    if (!(amt > 0)) { toast("Un montant encaissé, supérieur à zéro."); return; }
    if (what.trim().length < 4) { toast("Dis ce qui a été payé."); return; }
    if (!photo && !demo) { toast("Sans capture du paiement, rien ne compte."); return; }
    const ts = Date.now();
    let photoId: string | null = null;
    if (photo && !demo) { photoId = "m-" + ts; try { await saveProof(photoId, photo.full); } catch { photoId = null; } }
    const r = act((d) => {
      d.missions.push({ ts, level: -1, title: what.trim().slice(0, 90), proof: what.trim(), amount: amt, photo: photoId });
      d.euros += amt;
      if (prospect) { const p = d.capital.prospects.find((x) => x.id === prospect.id); if (p) { p.stage = 4; p.maj = ts; } }
      win(d, "capital", `${what.trim()} : ${f0(amt)} €`, ts);
      return gain(d, "capital", missionPoints(0, amt, true), ts);
    });
    gainToast("capital", r, `${f0(amt)} €`); buzz([60, 40, 120]);
    clearAmount(); setPhoto(null); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="Encaissement">
      <span className="eyebrow">Encaissement</span>
      <input className="big-num" type="number" inputMode="decimal" aria-label="Montant en euros" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0 €" />
      <input type="text" aria-label="Ce qui a été payé" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Ce qui a été payé, par qui" />
      <div className="shot">
        {photo ? <><img className="proof-thumb" src={photo.thumb} alt="Preuve" /><button className="linkish" type="button" onClick={() => setPhoto(null)}>Retirer</button></>
          : <button className="btn" type="button" onClick={() => file.current?.click()}>Capture du paiement</button>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <HoldButton block label="Encaisser" hint="Preuve" onConfirm={() => void save()} />
    </Sheet>
  );
}

/* ---------------- Concept du jour : une carte, au service de la piste ---------------- */

function ConceptRow({ now }: { now: number }) {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const today = dayKey(now);
  const pick = c.concept?.date === today ? c.concept : null;
  const piste = c.capital.thesis?.option.nom ?? "ta piste";
  const concept = pick ?? { date: today, nom: todayConcept(now).name, pourquoi: "", question: `Explique-le, puis applique-le à ${piste}, chiffres à l'appui.` };
  const done = c.concepts.find((x) => dayKey(x.ts) === today);
  const [open, setOpen] = useState(false);
  const [answer, setAnswer, clearAnswer] = useDraft("cap-concept");
  const [busy, setBusy] = useState(false);
  const [exam, setExam] = useState<ExamView | null>(null);
  const tried = useRef("");
  useEffect(() => {
    if (pick || done || !aiReady() || tried.current === today) return;
    tried.current = today;
    void pickConcept(true).then((r) => { if (r) act((d) => { d.concept = { date: today, ...r }; }); });
  }, [pick, done, today, act]);
  const submit = async () => {
    const n = wc(answer);
    if (n < 60) { toast(`${n} ${plural(n, "mot")}. 60 minimum.`); return; }
    setBusy(true);
    const r = await examineConcept(concept.nom, concept.question, piste, answer.trim());
    const note = r ? r.note : Math.min(6, Math.floor(n / 25));
    const g = act((d) => {
      d.concepts.push({ ts: Date.now(), c: concept.nom, ans: answer.trim(), note, verdict: r ? `${r.verdict}\nÀ appliquer : ${r.application}` : "" });
      if (note >= 8) win(d, "capital", `${note}/10 sur « ${concept.nom} »`, Date.now());
      return gain(d, "capital", note * POINTS.conceptFactor, Date.now());
    });
    gainToast("capital", g); setBusy(false); clearAnswer();
    setExam({ note, ai: !!r, lines: r ? [["Verdict", r.verdict], ["Lacune", r.lacune], ["À appliquer", r.application]] : [] });
  };
  return (
    <>
      <button type="button" className="mini-row" onClick={() => setOpen(true)}>
        <span className="eyebrow">Concept du jour</span><b>{concept.nom}</b><span className={"mini-s " + (done ? (done.note >= 6 ? "up" : "down") : "")}>{done ? `${done.note}/10` : "›"}</span>
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); setExam(null); }} label="Concept du jour">
        <span className="eyebrow">Concept du jour</span>
        <h2 className="h-display" style={{ fontSize: 28 }}>{concept.nom}</h2>
        {concept.pourquoi && <p className="muted small">{concept.pourquoi}</p>}
        {exam ? <ExamResult exam={exam} onContinue={() => { setExam(null); setOpen(false); }} /> : done ? <p className="voice">{done.note}/10. {done.verdict}</p> : (
          <>
            <p className="voice">{concept.question}</p>
            <textarea aria-label="Ta réponse" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Définition, calcul, application." />
            <div className="counter num">{wc(answer)} / 60 mots</div>
            <button className="btn primary block" type="button" disabled={busy} onClick={() => void submit()}>Soumettre</button>
            {busy && <Thinking>L'Examinateur lit</Thinking>}
          </>
        )}
      </Sheet>
    </>
  );
}

