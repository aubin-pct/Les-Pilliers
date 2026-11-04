import { useEffect, useRef, useState } from "react";
import { ORAL_MIN_SECONDS, ORAL_MIN_VOICE, ORAL_MIN_WORDS, ORAL_SECONDS } from "@/content/verbe";
import { analyzeAudio, analyzeText, type AudioMetrics, type TextMetrics } from "@/engine/analysis";
import { gain, win } from "@/engine/core";
import { POINTS, avgOf, oralPoints } from "@/engine/scoring";
import { hesit, todaySubject } from "@/engine/insights";
import type { Oral } from "@/engine/types";
import { aiReady, coachOral, genSubjects } from "@/ai/contremaitre";
import type { OralCoachSchema } from "@/ai/schemas";
import type { z } from "zod";
import { MemoryNote } from "@/features/temple/Memory";
import { dayKey } from "@/lib/format";

type OralCoach = z.infer<typeof OralCoachSchema>;
import { f0, f1, fdate, fmtClock, plural, wc } from "@/lib/format";
import { buzz, keepAwake } from "@/lib/device";
import { saveAudio } from "@/lib/media";
import { aiEnabled, useChantier, useIsDemo, useSettings, useStore } from "@/store";
import { gainToast, toast } from "@/store/ui";
import { Card, Envelope, Foreman, PillarHeader, PlayButton, Sheet, Sparkline, Thinking, Transcript, useNow } from "@/ui/kit";
import { Capture, hasSpeechRecognition } from "./recorder";

/** Réglages de test (Playwright) : durée raccourcie, transcription injectée. */
const testHook = ((window as unknown as { __tribune?: { secs?: number; inject?: string } }).__tribune ??= {});

type Result = { a: TextMetrics; audio: AudioMetrics | null; oral: Oral; prev: number | null; coach: OralCoach | null; pending: boolean };

export function VerbeView() {
  const c = useChantier()!;
  const demo = useIsDemo();
  const settings = useSettings();
  const act = useStore((s) => s.act);
  const setRecording = useStore((s) => s.setRecording);
  const setSettings = useStore((s) => s.setSettings);
  const now = useNow(30_000);
  const micMode = settings.oralMode !== "clavier";

  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [subject, setSubject] = useState<string | null>(null);
  const [left, setLeft] = useState(ORAL_SECONDS);
  const [level, setLevel] = useState(0);
  const [blanks, setBlanks] = useState(0);
  const [live, setLive] = useState({ finals: "", interim: "" });
  const [srFailed, setSrFailed] = useState(!hasSpeechRecognition);
  const [typed, setTyped] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [archive, setArchive] = useState<number | null>(null);
  const cap = useRef<Capture | null>(null);
  const t0 = useRef(0);
  const typedRef = useRef("");
  const stopping = useRef(false);
  const secs = testHook.secs ?? ORAL_SECONDS;
  const today = dayKey(now);
  const plan = c.plans.verbe?.date === today && c.plans.verbe.items.length ? c.plans.verbe : null;
  const planned = plan ? plan.items[plan.index % plan.items.length] : null;
  const subj = subject ?? planned?.texte ?? todaySubject(c, now).text;
  const [loadingSubj, setLoadingSubj] = useState(false);
  const triedSubj = useRef("");
  useEffect(() => {
    if (plan || !aiReady() || triedSubj.current === today) return;
    triedSubj.current = today;
    setLoadingSubj(true);
    genSubjects(true).then((r) => { setLoadingSubj(false); if (r) act((d) => { d.plans.verbe = { date: today, items: r.sujets, index: 0 }; }); });
  }, [plan, today, act]);

  // Abandon propre si on quitte la vue (ne devrait pas arriver : la navigation est bloquée pendant l'oral).
  useEffect(() => () => { cap.current?.release(); setRecording(false); }, [setRecording]);

  useEffect(() => {
    if (phase !== "running") return;
    void keepAwake(true);
    let lastLive = 0;
    const t = setInterval(() => {
      const l = secs - (Date.now() - t0.current) / 1000;
      setLeft(Math.max(0, l));
      if (cap.current && Date.now() - lastLive > 700) { lastLive = Date.now(); const a = analyzeAudio(cap.current.rms); if (a) setBlanks(a.pauses); }
      if (l <= 0) void stop(true);
    }, 200);
    return () => { clearInterval(t); void keepAwake(false); };
  }, [phase]);

  const start = async () => {
    const s = subj;
    setSubject(s); setResult(null); setRefused(null); setLive({ finals: "", interim: "" }); setBlanks(0); setLevel(0);
    setTyped(""); typedRef.current = ""; stopping.current = false;
    if (micMode) {
      const capture = new Capture({
        onLevel: (r) => setLevel(r),
        onTranscript: (finals, interim) => setLive({ finals, interim }),
        onRecognitionFailed: () => setSrFailed(true),
      });
      try { await capture.start(); }
      catch {
        setSettings({ oralMode: "clavier" });
        toast("Micro refusé ou absent. Tribune passée en mode clavier (modifiable dans les réglages).", "loss");
        return;
      }
      cap.current = capture;
      setSrFailed(capture.recogFailed);
    }
    t0.current = Date.now(); setLeft(secs);
    setPhase("running"); setRecording(true); buzz(60);
  };

  const stop = async (auto: boolean) => {
    if (stopping.current) return;
    stopping.current = true;
    const elapsed = Math.min(secs, Math.round((Date.now() - t0.current) / 1000));
    let text = typedRef.current.trim(), blob: Blob | null = null, audio: AudioMetrics | null = null, recognized = false;
    const capture = cap.current;
    cap.current = null;
    if (capture) {
      if (testHook.inject) { capture.finals = testHook.inject; capture.recognized = true; }
      const r = await capture.stop();
      blob = r.blob; audio = analyzeAudio(r.rms); text = r.text; recognized = r.recognized;
    }
    setRecording(false);
    const words = wc(text);
    const spoke = audio?.speak ?? 0;
    const viaMic = !!capture;
    const ok = elapsed >= ORAL_MIN_SECONDS && (words >= ORAL_MIN_WORDS || (viaMic && !recognized && spoke >= ORAL_MIN_VOICE));
    if (!ok) {
      setRefused(elapsed < ORAL_MIN_SECONDS ? `${elapsed} secondes. Tu as fui.`
        : viaMic && !recognized ? `${Math.round(spoke)} s de voix sur ${elapsed}. Tu n'as presque rien dit.`
        : `${words} ${plural(words, "mot")}. Ce n'est pas un discours.`);
      setPhase("idle"); setSubject(null);
      return;
    }
    const a = analyzeText(text, elapsed);
    const ts = Date.now();
    const oral: Oral = {
      ts, sujet: subj, secs: elapsed, words: a.words, wpm: a.wpm, tpm: a.tpm, ttr: a.ttr, longest: a.longest,
      ppm: audio ? +(audio.pauses / (elapsed / 60)).toFixed(1) : null, pause: audio ? +audio.longest.toFixed(1) : null, speak: audio ? +audio.ratio.toFixed(2) : null,
      h: 0, env: audio?.env ?? [], text, audio: false, verdict: "", structure: null,
    };
    oral.h = +hesit(oral).toFixed(1);
    if (blob && blob.size > 2000 && !demo) {
      try { await saveAudio(ts, blob); oral.audio = true; } catch { toast("Audio non archivé : stockage du navigateur indisponible."); }
    }
    const prev = avgOf(c.orals, "h");
    const bestH = c.orals.length ? Math.min(...c.orals.map(hesit)) : null;
    const g = act((d) => {
      if (bestH === null || oral.h < bestH) win(d, "verbe", `${f1(oral.h)} hésitations/min sur « ${oral.sujet} »`, ts);
      d.orals.push(oral);
      if (d.orals.length > 400) d.orals = d.orals.slice(-400);
      return gain(d, "verbe", oralPoints(prev, oral.h, oral.wpm), ts);
    });
    gainToast("verbe", g, auto ? "copie ramassée" : "");
    const pending = aiEnabled(settings) && !demo && words >= 20;
    setResult({ a, audio, oral, prev, coach: null, pending });
    setPhase("done"); setSubject(null);
    if (pending) {
      const r = await coachOral({ secs: elapsed, sujet: oral.sujet, wpm: a.wpm, tpm: a.tpm, tics: a.tics, ppm: oral.ppm, pause: oral.pause, ttr: a.ttr, sentences: a.sentences, longest: a.longest, text });
      setResult((x) => (x && x.oral.ts === ts ? { ...x, coach: r, pending: false } : x));
      if (r) {
        const structure = Number.isFinite(Number(r.structure)) ? Number(r.structure) : null;
        const g2 = act((d) => {
          const o = d.orals.find((x) => x.ts === ts);
          if (o) { o.structure = structure; o.verdict = `${r.verdict}\nÀ corriger : ${r.a_corriger}\nRéécrite : ${r.phrase_refaite}`; }
          return structure !== null && structure >= 7 ? gain(d, "verbe", structure / 2 - 2, Date.now()) : null;
        });
        if (g2) gainToast("verbe", g2, "bonus structure");
      }
    }
  };

  const skip = () => {
    const g = act((d) => {
      if (d.plans.verbe?.date === dayKey(Date.now())) d.plans.verbe.index += 1; else d.skips += 1;
      return gain(d, "verbe", POINTS.skipSubject, Date.now(), { floor: false });
    });
    setSubject(null); gainToast("verbe", g, "fuir un sujet a un prix");
  };

  const avgH = avgOf(c.orals, "h"), avgW = avgOf(c.orals, "wpm");
  const running = phase === "running";

  return (
    <div className="view">
      <PillarHeader c={c} id="verbe" now={now} />
      <MemoryNote c={c} id="verbe" />

      <Card title="La Tribune" aside={<span className="tag">{Math.round(secs)} secondes · {micMode ? "micro" : "clavier"}</span>}>
        <span className="eyebrow">Sujet imposé</span>
        {loadingSubj && !subject ? <Thinking>Le Contremaître choisit ton sujet</Thinking> : (
          <>
            <p className="subject">{subj}</p>
            {!subject && planned?.pourquoi && <p className="muted small">{planned.pourquoi}</p>}
          </>
        )}
        <div className="btn-row"><button className="linkish" type="button" disabled={running} onClick={skip}>Changer de sujet (coûte 1 assise)</button></div>
        <div className={"clock num" + (running ? (left <= 10 ? " over" : " live") : "")}>{fmtClock(running ? left : secs)}</div>
        {micMode ? (
          <>
            <div className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, level * 900)}%` }} /></div>
            <div className="livebar"><span>Blancs : {blanks}</span><span>{srFailed ? "Transcription indisponible : voix et blancs seulement" : "Transcription en direct"}</span></div>
            <div className="transcript" aria-live="off">
              {running || live.finals ? <>{live.finals} {live.interim && <span className="interim">{live.interim}</span>}</> : <span className="muted">Ta voix est enregistrée et archivée. Les blancs, le débit et les tics sont mesurés.</span>}
            </div>
          </>
        ) : (
          <>
            <p className="muted small">Lance le chrono, touche le micro de ton clavier et parle à voix haute. À zéro, la copie est ramassée.</p>
            <label className="f" htmlFor="vb-text">Transcription
              <textarea id="vb-text" style={{ minHeight: 150 }} disabled={!running} value={typed} placeholder={running ? "Touche le micro du clavier et parle." : "Lance le chrono d'abord."}
                onChange={(e) => { setTyped(e.target.value); typedRef.current = e.target.value; }} />
            </label>
          </>
        )}
        <div className="btn-row">
          {running ? <button className="btn danger" type="button" onClick={() => void stop(false)}>Terminer</button>
            : <button className="btn primary" type="button" onClick={() => void start()}>Prendre la parole</button>}
        </div>
        {refused && (
          <div className="alert">
            <span className="eyebrow">Copie refusée</span><strong>{refused}</strong>
            <p className="muted">Minimum : {ORAL_MIN_SECONDS} secondes et {ORAL_MIN_WORDS} mots{micMode ? ` (ou ${ORAL_MIN_VOICE} s de voix si la transcription ne marche pas)` : ""}. Recommence.</p>
          </div>
        )}
        {result && phase === "done" && <OralResult r={result} onClose={() => { setResult(null); setPhase("idle"); }} />}
      </Card>

      <Card title="Ta voix, jour après jour" aside={`${c.orals.length} ${plural(c.orals.length, "oral", "oraux")}`}>
        <div className="metrics">
          <div className="metric"><span className="l">Hésitations / min</span><span className="k num">{avgH !== null ? f1(avgH) : "—"}</span><span className="c muted">tics + blancs · objectif &lt; 3</span><Sparkline values={c.orals.slice(-30).map(hesit)} color="var(--blood)" /></div>
          <div className="metric"><span className="l">Mots / min</span><span className="k num">{avgW !== null ? f0(avgW) : "—"}</span><span className="c muted">zone cible 130–160</span><Sparkline values={c.orals.slice(-30).map((o) => o.wpm).filter((v): v is number => !!v)} color="var(--c-verbe)" /></div>
        </div>
        <div className="list">
          {c.orals.length ? c.orals.slice(-8).reverse().map((o) => (
            <button type="button" className="li" key={o.ts} onClick={() => setArchive(o.ts)}>
              <span className="main">{o.sujet}</span><span className="side">{f1(hesit(o))} hés./min</span>
              <span className="sub">{fdate(o.ts)}{o.wpm ? ` · ${o.wpm} mots/min` : ""}{o.ppm !== null ? ` · ${f1(o.ppm)} blancs/min` : ""}{o.audio ? " · ▶ audio" : ""}</span>
            </button>
          )) : <p className="muted">Aucun oral archivé. Le premier sera ton point zéro.</p>}
        </div>
      </Card>

      <ArchiveSheet oral={c.orals.find((o) => o.ts === archive) ?? null} onClose={() => setArchive(null)} />
    </div>
  );
}

function OralResult({ r, onClose }: { r: Result; onClose: () => void }) {
  const { a, oral, prev, coach } = r;
  return (
    <>
      <hr className="sep" style={{ margin: "6px 0 2px" }} />
      <Envelope env={oral.env} />
      <div className="metrics">
        <div className="metric"><span className="l">Hésitations / min</span><span className="k num">{f1(oral.h)}</span>
          {prev !== null ? <span className={"c " + (oral.h < prev ? "up" : "down")}>{oral.h < prev ? "▼" : "▲"} vs moy. {f1(prev)}</span> : <span className="c muted">point zéro</span>}</div>
        <div className="metric"><span className="l">Mots / min</span><span className="k num">{a.wpm ?? "—"}</span>
          <span className={"c " + (a.wpm && a.wpm >= 130 && a.wpm <= 160 ? "up" : "muted")}>{!a.wpm ? "sans transcription" : a.wpm < 120 ? "trop lent" : a.wpm > 170 ? "trop rapide" : "zone correcte"}</span></div>
        {oral.ppm !== null && <div className="metric"><span className="l">Blancs / min</span><span className="k num">{f1(oral.ppm)}</span><span className="c muted">plus long : {f1(oral.pause ?? 0)} s</span></div>}
        <div className="metric">
          <span className="l">{oral.speak !== null ? "Temps de parole" : "Diversité lexicale"}</span>
          <span className="k num">{oral.speak !== null ? `${Math.round(oral.speak * 100)} %` : a.ttr ? `${Math.round(a.ttr * 100)} %` : "—"}</span>
          <span className="c muted">{oral.speak !== null ? "voix active sur la durée" : "mots différents / total"}</span>
        </div>
      </div>
      {oral.text && (Object.keys(a.tics).length
        ? <p className="mono small">Tics relevés : {Object.entries(a.tics).map(([k, v]) => `« ${k} » ×${v}`).join(" · ")}</p>
        : <p className="mono up small">Aucun tic relevé dans la transcription.</p>)}
      {oral.text && <Transcript text={oral.text} />}
      {oral.audio && <div><PlayButton ts={oral.ts} label="Réécouter" /></div>}
      {coach ? (
        <Foreman who={`Le Contremaître · structure ${coach.structure}/10`}>
          <p className="voice">{coach.verdict}</p>
          <p className="voice"><b>À corriger :</b> {coach.a_corriger}</p>
          <p className="voice"><b>Ta phrase la plus faible, réécrite :</b> {coach.phrase_refaite}</p>
        </Foreman>
      ) : r.pending ? <Thinking>Le Contremaître écoute ta prise de parole</Thinking> : null}
      <button className="btn block" type="button" onClick={onClose}>Archiver et fermer</button>
    </>
  );
}

function ArchiveSheet({ oral: o, onClose }: { oral: Oral | null; onClose: () => void }) {
  return (
    <Sheet open={!!o} onClose={onClose} label="Archive d'un oral">
      {o && (
        <>
          <span className="eyebrow">Archive · {fdate(o.ts)}</span>
          <h2 className="h-display" style={{ fontSize: 28 }}>{o.sujet}</h2>
          <Envelope env={o.env} />
          {o.audio && <div><PlayButton ts={o.ts} label="Écouter" className="btn" /></div>}
          <div className="metrics">
            <div className="metric"><span className="l">Hésitations / min</span><span className="k num">{f1(hesit(o))}</span><span className="c muted">{f1(o.tpm || 0)} tics · {f1(o.ppm ?? 0)} blancs</span></div>
            <div className="metric"><span className="l">Mots / min</span><span className="k num">{o.wpm ?? "—"}</span><span className="c muted">{o.ttr ? `diversité ${Math.round(o.ttr * 100)} %` : ""}</span></div>
          </div>
          {o.text && <Transcript text={o.text} />}
          {o.verdict && <p className="voice">{o.verdict}</p>}
          <button className="btn block" type="button" onClick={onClose}>Fermer</button>
        </>
      )}
    </Sheet>
  );
}
