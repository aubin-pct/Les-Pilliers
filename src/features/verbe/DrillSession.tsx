/*
 * Salle d'entraînement d'éloquence, plein écran : préparer → 3-2-1 → parler avec un retour en direct → résultat.
 * En direct : chaque tic sonne et s'affiche, jauge de débit, vivacité de la voix (hauteur et volume), étapes guidées,
 * silences voulus comptés, mots imposés qui s'allument. Après : compétences mesurées, verdict du Coach, « Refais-le ».
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DRILL, LECTURES, MOTS, PIEGES, SKILLS, VIRELANGUES, type DrillId } from "@/content/verbe";
import { analyzeAudio, analyzeText, splitTics } from "@/engine/analysis";
import { accuracy, measuredSkills, voiceVariation } from "@/engine/eloquence";
import { gain, win } from "@/engine/core";
import { avgOf, oralPoints } from "@/engine/scoring";
import { hesit, todaySubject } from "@/engine/insights";
import type { EloSkill, Oral } from "@/engine/types";
import { aiReady, coachOral2, genDrill } from "@/ai/contremaitre";
import { beep, buzz, keepAwake } from "@/lib/device";
import { dayKey, f1, fmtClock, wc } from "@/lib/format";
import { openLayer } from "@/lib/layers";
import { saveAudio } from "@/lib/media";
import { speak } from "@/lib/voice";
import { useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { gainToast, toast } from "@/store/ui";
import { Thinking, Transcript, PlayButton } from "@/ui/kit";
import { Avatar } from "@/features/coach/Avatar";
import { Capture } from "./recorder";

const testHook = ((window as unknown as { __tribune?: { secs?: number; inject?: string } }).__tribune ??= {});

export interface DrillContent { sujet: string; texte: string; question: string; conseil: string; mots: string[] }
type Phase = "prep" | "count" | "live" | "result";
interface Attempt { oral: Oral; tics: Record<string, number>; silences: number; mots: string[]; coach: { verdict: string; a_corriger: string; phrase_refaite: string } | null; pending: boolean }

const pickOf = <T,>(a: T[], k: number) => a[Math.abs(k) % a.length];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function DrillSession({ drill, sujetHint, onClose }: { drill: DrillId; sujetHint?: string; onClose: () => void }) {
  const D = DRILL[drill];
  const c = useChantier()!;
  const demo = useIsDemo();
  const settings = useSettings();
  const act = useStore((s) => s.act);
  const setRecording = useStore((s) => s.setRecording);
  const secs = testHook.secs ?? D.secs;
  const mic = settings.oralMode !== "clavier";

  const [phase, setPhase] = useState<Phase>("prep");
  const [content, setContent] = useState<DrillContent | null>(null);
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(secs);
  const [hud, setHud] = useState({ level: 0, tics: 0, flash: 0, wpm: 0, live: 0, silences: 0, text: "" });
  const [typed, setTyped] = useState("");
  const [noText, setNoText] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [prev, setPrev] = useState<Attempt | null>(null);
  const cap = useRef<Capture | null>(null);
  const t0 = useRef(0);
  const marks = useRef<{ t: number; w: number }[]>([]);
  const ticMax = useRef(0);
  const sil = useRef({ lastVoice: 0, counted: false, n: 0, voiced: false });
  const frames = useRef<{ r: number; f: number | null }[]>([]);
  const typedRef = useRef("");
  const phaseIdx = useRef(0);
  const stopping = useRef(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;

  // Retour Android : ferme (et abandonne l'oral en cours).
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    return () => { document.body.style.overflow = ""; release(); cap.current?.release(); cap.current = null; setRecording(false); void keepAwake(false); };
  }, [setRecording]);

  // Contenu de l'exercice : IA si possible, sinon contenu de secours.
  useEffect(() => {
    if (content) return;
    const k = Date.now() % 997;
    const last = c.orals[c.orals.length - 1];
    const planned = c.plans.verbe?.date === dayKey(Date.now()) ? c.plans.verbe.items[c.plans.verbe.index % c.plans.verbe.items.length]?.texte : undefined;
    const base: DrillContent = {
      sujet: sujetHint || (drill === "redite" && last ? last.sujet : planned ?? todaySubject(c, Date.now()).text),
      texte: drill === "lecture" ? pickOf(LECTURES, k) : drill === "articulation" ? [0, 1, 2].map((i) => pickOf(VIRELANGUES, k + i * 2)).join("\n") : "",
      question: drill === "question_piege" ? pickOf(PIEGES, k) : "",
      conseil: drill === "redite" && last?.verdict ? (last.verdict.split("\n").find((l) => l.startsWith("À corriger")) ?? "Corrige ce qui n'allait pas.") : "",
      mots: drill === "mots" ? pickOf(MOTS, k) : [],
    };
    if (drill === "redite" || drill === "libre" || !aiReady() || sujetHint) { setContent(base); return; }
    let live = true;
    void genDrill(D.nom, D.ia, true).then((r) => {
      if (!live) return;
      if (!r) { setContent(base); return; }
      const mots = drill === "mots" ? (r.conseil.match(/[A-Za-zÀ-ÿ'-]{5,}/g) ?? []).slice(-3) : [];
      setContent({
        sujet: r.sujet || base.sujet, texte: r.texte || base.texte, question: r.question || base.question,
        conseil: drill === "mots" ? "Place ces trois mots, naturellement." : r.conseil, mots: mots.length === 3 ? mots : base.mots,
      });
    });
    return () => { live = false; };
  }, [content]);

  const prompt = content ? (drill === "question_piege" ? content.question : drill === "lecture" || drill === "articulation" ? "" : content.sujet) : "";
  const label = drill === "lecture" ? "Lecture à voix haute" : drill === "articulation" ? "Virelangues" : prompt;

  /* ---------- Compte à rebours puis départ ---------- */
  const go = async () => {
    setAttempt(null); setTyped(""); setNoText(false); typedRef.current = ""; stopping.current = false;
    marks.current = []; ticMax.current = 0; phaseIdx.current = 0; frames.current = []; sil.current = { lastVoice: 0, counted: false, n: 0, voiced: false };
    setHud({ level: 0, tics: 0, flash: 0, wpm: 0, live: 0, silences: 0, text: "" });
    if (mic) {
      const capture = new Capture({
        onFrame: (r, f) => { frames.current.push({ r, f }); if (frames.current.length > 80) frames.current.shift(); },
        onTranscript: (fin, int) => onText((fin + " " + int).trim()),
        onRecognitionFailed: () => setNoText(true),
      });
      try { await capture.start(); }
      catch { toast("Micro refusé ou absent. Passe en mode clavier dans les réglages.", "loss"); return; }
      cap.current = capture;
    }
    setPhase("count"); setCount(3); beep(660, 120);
    let n = 3;
    const t = setInterval(() => {
      n--; setCount(n);
      if (n > 0) beep(660, 120);
      else { clearInterval(t); beep(990, 260); buzz(60); t0.current = Date.now(); setLeft(secs); setPhase("live"); setRecording(true); }
    }, 800);
  };

  const onText = (text: string) => {
    const n = splitTics(text).filter((p) => p.tic).length;
    if (n > ticMax.current) { ticMax.current = n; buzz([70, 40, 70]); beep(240, 160); setHud((h) => ({ ...h, tics: n, flash: Date.now() })); }
    marks.current.push({ t: Date.now(), w: wc(text) });
    setHud((h) => ({ ...h, text }));
  };

  /* ---------- Boucle en direct ---------- */
  useEffect(() => {
    if (phase !== "live") return;
    void keepAwake(true);
    const t = setInterval(() => {
      const now = Date.now(), el = (now - t0.current) / 1000, l = secs - el;
      setLeft(Math.max(0, l));
      // Débit sur les 15 dernières secondes.
      const m = marks.current, w = m.length ? m[m.length - 1].w : wc(typedRef.current);
      const old = m.find((x) => x.t >= now - 15000);
      const span = Math.min(15, el);
      const wpm = span > 3 ? Math.round(((w - (old && el > 15 ? old.w : 0)) / span) * 60) : 0;
      // Vivacité de la voix sur les 3 dernières secondes.
      const fr = frames.current.slice(-60);
      const vv = voiceVariation(fr.map((x) => x.r), fr.map((x) => x.f));
      const liveV = Math.min(1, ((vv.pitchVar ?? 0) / 3.5 + (vv.volVar ?? 0) / 6) / 2);
      const lv = fr.length ? fr[fr.length - 1].r : 0;
      // Silences voulus : au moins 1,6 s sans voix après avoir parlé.
      const s = sil.current;
      if (lv > 0.02) { s.lastVoice = now; s.counted = false; s.voiced = true; }
      else if (s.voiced && !s.counted && now - s.lastVoice > 1600) { s.counted = true; s.n++; if (drill === "silence") buzz(20); }
      // Étapes PREP.
      if (D.phases) {
        let acc = 0, idx = 0;
        D.phases.forEach(([, d], i) => { if (el >= acc) idx = i; acc += d; });
        if (idx !== phaseIdx.current) { phaseIdx.current = idx; beep(880, 140); buzz(30); }
      }
      setHud((h) => ({ ...h, level: lv, wpm, live: liveV, silences: s.n, ...(mic ? {} : { text: typedRef.current }) }));
      if (!mic) onTextTyped(typedRef.current);
      if (l <= 0) void finish(true);
    }, 100);
    return () => { clearInterval(t); void keepAwake(false); };
  }, [phase]);

  const onTextTyped = (text: string) => {
    const n = splitTics(text).filter((p) => p.tic).length;
    if (n > ticMax.current) { ticMax.current = n; buzz([70, 40, 70]); setHud((h) => ({ ...h, tics: n, flash: Date.now() })); }
  };

  /* ---------- Fin, mesures, verdict ---------- */
  const finish = async (auto: boolean) => {
    if (stopping.current || !content) return;
    stopping.current = true;
    const elapsed = Math.min(secs, Math.round((Date.now() - t0.current) / 1000));
    let text = typedRef.current.trim(), blob: Blob | null = null, rms: number[] = [], pitch: (number | null)[] = [], recognized = false;
    const capture = cap.current; cap.current = null;
    if (capture) {
      if (testHook.inject) { capture.finals = testHook.inject; capture.recognized = true; }
      const r = await capture.stop();
      blob = r.blob; rms = r.rms; pitch = r.pitch; text = r.text; recognized = r.recognized;
    }
    setRecording(false);
    const audio = rms.length ? analyzeAudio(rms) : null;
    const words = wc(text), voice = audio?.speak ?? 0;
    const minSecs = Math.min(45, Math.round(secs * 0.6));
    if (elapsed < minSecs || (words < 20 && !(capture && !recognized && voice >= 15))) {
      toast(elapsed < minSecs ? `${elapsed} s. Tu as fui avant la fin.` : "Presque rien dit. Recommence.", "loss");
      setPhase("prep"); return;
    }
    const a = analyzeText(text, elapsed);
    const vv = voiceVariation(rms, pitch);
    const ts = Date.now();
    const used = content.mots.filter((m) => norm(text).includes(norm(m).slice(0, Math.max(5, m.length - 2))));
    const oral: Oral = {
      ts, sujet: label || D.nom, secs: elapsed, words: a.words, wpm: a.wpm, tpm: a.tpm, ttr: a.ttr, longest: a.longest,
      ppm: audio ? +(audio.pauses / (elapsed / 60)).toFixed(1) : null, pause: audio ? +audio.longest.toFixed(1) : null, speak: audio ? +audio.ratio.toFixed(2) : null,
      h: 0, env: audio?.env ?? [], text, audio: false, verdict: "", structure: null,
      drill, pitchVar: vv.pitchVar, volVar: vv.volVar,
      accuracy: (drill === "articulation" || drill === "lecture") && content.texte ? +accuracy(content.texte, text).toFixed(2) : null,
    };
    oral.h = +hesit(oral).toFixed(1);
    oral.skills = measuredSkills(oral);
    if (drill === "mots" && content.mots.length) oral.skills.vocabulaire = Math.max(oral.skills.vocabulaire ?? 0, 40 + used.length * 20);
    if (drill === "silence") oral.skills.rythme = Math.round(((oral.skills.rythme ?? 50) + Math.min(100, sil.current.n * 30)) / 2);
    if (blob && blob.size > 2000 && !demo) { try { await saveAudio(ts, blob); oral.audio = true; } catch { /* stockage indisponible */ } }
    const prevH = avgOf(c.orals, "h");
    const bestH = c.orals.length ? Math.min(...c.orals.map(hesit)) : null;
    const g = act((d) => {
      if (bestH === null || oral.h < bestH) win(d, "verbe", `${f1(oral.h)} hésitations/min (${D.nom})`, ts);
      d.orals.push(oral);
      if (d.orals.length > 400) d.orals = d.orals.slice(-400);
      return gain(d, "verbe", oralPoints(prevH, oral.h, oral.wpm), ts);
    });
    gainToast("verbe", g, auto ? "temps écoulé" : "");
    const pending = aiReady() && words >= 15;
    const at: Attempt = { oral, tics: a.tics, silences: sil.current.n, mots: used, coach: null, pending };
    setAttempt(at); setPhase("result");
    if (!pending) return;
    const consigne = drill === "lecture" || drill === "articulation" ? content.texte : [prompt, content.conseil].filter(Boolean).join(" — ");
    const r = await coachOral2({ drill: D.nom, consigne, secs: elapsed, text, mesures: {
      mots_min: a.wpm, tics_min: a.tpm, tics: a.tics, blancs_min: oral.ppm, plus_long_blanc_s: oral.pause, diversite: a.ttr,
      variation_hauteur_demi_tons: vv.pitchVar, variation_volume_db: vv.volVar, precision_texte: oral.accuracy, silences_voulus: sil.current.n,
      mots_imposes_places: drill === "mots" ? `${used.length}/${content.mots.length}` : undefined,
    } });
    if (!r) { setAttempt((x) => (x && x.oral.ts === ts ? { ...x, pending: false } : x)); return; }
    const g2 = act((d) => {
      const o = d.orals.find((x) => x.ts === ts); if (!o) return null;
      o.structure = Math.round(r.structure / 10);
      o.skills = { ...(o.skills ?? {}), structure: r.structure, impact: r.impact };
      o.verdict = `${r.verdict}\nÀ corriger : ${r.a_corriger}${r.phrase_refaite ? `\nMieux dit : ${r.phrase_refaite}` : ""}`;
      return (r.structure + r.impact) / 2 >= 70 ? gain(d, "verbe", 2, Date.now()) : null;
    });
    if (g2) gainToast("verbe", g2, "bonus du Coach");
    setAttempt((x) => (x && x.oral.ts === ts ? { ...x, pending: false, coach: r, oral: { ...x.oral, skills: { ...x.oral.skills, structure: r.structure, impact: r.impact } } } : x));
    if (settings.voice) void speak(`${r.verdict} ${r.a_corriger}`);
  };

  const again = () => { setPrev(attempt); setPhase("prep"); void go(); };

  /* ---------- Rendu ---------- */
  const ringL = 2 * Math.PI * 46;
  return createPortal(
    <div className="drill" role="dialog" aria-modal="true" aria-label={`Exercice : ${D.nom}`}>
      <div className="dr-top">
        <span className="dr-name">{D.nom}<i>{SKILLS.find((s) => s.id === D.skill)?.nom}</i></span>
        {phase !== "live" && <button type="button" className="cp-icon" aria-label="Fermer" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
      </div>

      {phase === "prep" && (
        <div className="dr-body">
          {!content ? <Thinking>Le Coach prépare l'exercice</Thinking> : (
            <>
              <p className="dr-but">{D.but}</p>
              {prompt && <p className="dr-prompt">{prompt}</p>}
              {content.texte && <div className="dr-text">{content.texte}</div>}
              {content.mots.length > 0 && <div className="dr-mots">{content.mots.map((m) => <span key={m}>{m}</span>)}</div>}
              {D.phases && <div className="dr-phases">{D.phases.map(([n, d]) => <span key={n + d} style={{ flex: d }}>{n}<i>{d} s</i></span>)}</div>}
              {content.conseil && <p className="dr-tip">{content.conseil}</p>}
              <div className="dr-go">
                <button type="button" className="btn primary big block" onClick={() => void go()}>Go · {secs} s</button>
                {!mic && <p className="muted small">Mode clavier : dicte avec le micro du clavier.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {phase === "count" && <div className="dr-count num" key={count}>{count > 0 ? count : "GO"}</div>}

      {phase === "live" && content && (
        <div className="dr-body live">
          <div className="dr-ring" style={{ ["--lvl" as string]: Math.min(1, hud.level * 9).toFixed(3) }}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" className="ring-bg" /><circle cx="50" cy="50" r="46" className="ring-fg" strokeDasharray={`${(ringL * (left / secs)).toFixed(1)} ${ringL.toFixed(1)}`} transform="rotate(-90 50 50)" /></svg>
            <span className="num">{fmtClock(left)}</span>
          </div>
          {D.phases && <PrepPhase phases={D.phases} el={secs - left} />}
          {prompt && <p className="dr-prompt small">{prompt}</p>}
          {content.texte && <div className="dr-text live">{content.texte}</div>}
          {content.mots.length > 0 && <div className="dr-mots">{content.mots.map((m) => <span key={m} className={norm(hud.text).includes(norm(m).slice(0, Math.max(5, m.length - 2))) ? "on" : ""}>{m}</span>)}</div>}
          <div className="hud">
            <div className={"hud-tic" + (Date.now() - hud.flash < 700 ? " flash" : "")}><b className="num">{hud.tics}</b><span>tics</span></div>
            <div className="hud-pace"><Gauge v={hud.wpm} /><span>{hud.wpm || "—"} mots/min</span></div>
            {drill === "silence" ? <div className="hud-tic"><b className="num">{hud.silences}/3</b><span>silences</span></div>
              : <div className="hud-voice"><i><b style={{ width: `${hud.live * 100}%` }} /></i><span>{hud.live < 0.3 ? "voix plate" : hud.live < 0.6 ? "voix correcte" : "voix vivante"}</span></div>}
          </div>
          {mic ? <div className="dr-live-text">{hud.text ? <Transcript text={hud.text.slice(-160)} /> : <span className="muted">{noText ? "Transcription indisponible sur ce téléphone : tu es jugé sur la voix (débit, silences, relief)." : "Parle."}</span>}</div>
            : <textarea className="dr-type" autoFocus value={typed} onChange={(e) => { setTyped(e.target.value); typedRef.current = e.target.value; }} placeholder="Micro du clavier, et parle." />}
          <button type="button" className="btn danger block" onClick={() => void finish(false)}>Terminer</button>
        </div>
      )}

      {phase === "result" && attempt && <Result a={attempt} prev={prev} onAgain={again} onClose={onClose} />}
    </div>,
    document.body,
  );
}

function PrepPhase({ phases, el }: { phases: [string, number][]; el: number }) {
  let acc = 0, cur = 0;
  phases.forEach(([, d], i) => { if (el >= acc) cur = i; acc += d; });
  return (
    <div className="dr-phases live">
      {phases.map(([n, d], i) => <span key={n + i} style={{ flex: d }} className={i === cur ? "cur" : i < cur ? "done" : ""}>{n}</span>)}
    </div>
  );
}

/** Jauge de débit : zone cible 130–160 mots/min. */
function Gauge({ v }: { v: number }) {
  const a = Math.max(0, Math.min(1, v / 220)) * 180 - 90;
  return (
    <svg viewBox="0 0 100 56" className="gauge" aria-hidden="true">
      <path d="M8 50 A42 42 0 0 1 92 50" className="g-bg" />
      <path d="M8 50 A42 42 0 0 1 92 50" className="g-zone" strokeDasharray={`${(Math.PI * 42 * 30) / 220} ${Math.PI * 42}`} strokeDashoffset={`${-(Math.PI * 42 * 130) / 220}`} />
      <line x1="50" y1="50" x2="50" y2="14" className="g-needle" transform={`rotate(${a} 50 50)`} />
    </svg>
  );
}

const SK_SHORT: Record<EloSkill, string> = { structure: "Structure", fluidite: "Fluidité", rythme: "Rythme", voix: "Voix", vocabulaire: "Vocabulaire", impact: "Impact" };

function Result({ a, prev, onAgain, onClose }: { a: Attempt; prev: Attempt | null; onAgain: () => void; onClose: () => void }) {
  const o = a.oral, sk = o.skills ?? {};
  const vals = Object.values(sk).filter((x): x is number => typeof x === "number");
  const score = vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null;
  const pv = prev?.oral.skills ? Object.values(prev.oral.skills).filter((x): x is number => typeof x === "number") : [];
  const pscore = pv.length ? Math.round(pv.reduce((x, y) => x + y, 0) / pv.length) : null;
  const ticsN = Object.values(a.tics).reduce((x, y) => x + y, 0);
  return (
    <div className="dr-body result">
      <div className="dr-score">
        <span className="num">{score ?? "—"}</span><i>/100</i>
        {pscore !== null && score !== null && <b className={score >= pscore ? "up" : "down"}>{score >= pscore ? "▲" : "▼"} {Math.abs(score - pscore)} vs essai 1</b>}
      </div>
      <div className="skchips">
        {(Object.keys(SK_SHORT) as EloSkill[]).filter((k) => typeof sk[k] === "number").map((k) => (
          <span key={k} className="skc"><i>{SK_SHORT[k]}</i><b className="num">{sk[k]}</b>{prev?.oral.skills?.[k] !== undefined && <em className={(sk[k] ?? 0) >= (prev.oral.skills[k] ?? 0) ? "up" : "down"}>{(sk[k] ?? 0) >= (prev.oral.skills[k] ?? 0) ? "+" : ""}{(sk[k] ?? 0) - (prev.oral.skills[k] ?? 0)}</em>}</span>
        ))}
      </div>
      <div className="kpis">
        <div><b className="num">{ticsN}</b><span>tics</span></div>
        <div><b className="num">{o.wpm ?? "—"}</b><span>mots/min</span></div>
        <div><b className="num">{o.ppm !== null ? f1(o.ppm) : "—"}</b><span>blancs/min</span></div>
        {o.accuracy !== null && o.accuracy !== undefined ? <div><b className="num">{Math.round(o.accuracy * 100)} %</b><span>précision</span></div>
          : <div><b className="num">{o.pitchVar !== null && o.pitchVar !== undefined ? f1(o.pitchVar) : "—"}</b><span>relief (dt)</span></div>}
      </div>
      <div className="dr-coach">
        <Avatar state={a.pending ? "think" : a.coach ? "talk" : "idle"} size={44} />
        <div>
          {a.coach ? (
            <>
              <p className="dr-verdict">{a.coach.verdict}</p>
              <p className="dr-fix"><b>À corriger</b> {a.coach.a_corriger}</p>
              {a.coach.phrase_refaite && <p className="dr-better"><b>Mieux dit</b> {a.coach.phrase_refaite}</p>}
            </>
          ) : a.pending ? <Thinking>Il écoute ta prise de parole</Thinking> : <p className="muted small">{ticsN ? `Tics : ${Object.entries(a.tics).map(([k, v]) => `« ${k} » ×${v}`).join(", ")}.` : "Aucun tic relevé."}</p>}
        </div>
      </div>
      {o.text && <details className="fold"><summary><span className="fold-t">Transcription</span><span className="fold-chev" /></summary><div className="fold-body"><Transcript text={o.text} />{o.audio && <PlayButton ts={o.ts} label="Réécouter" />}</div></details>}
      <div className="btn-row">
        <button type="button" className="btn primary big" style={{ flex: 1 }} onClick={onAgain}>Refais-le</button>
        <button type="button" className="btn big" onClick={onClose}>Fini</button>
      </div>
    </div>
  );
}

