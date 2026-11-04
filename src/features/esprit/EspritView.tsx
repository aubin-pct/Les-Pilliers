import { useState } from "react";
import { REVIEW_STEPS, TOPICS } from "@/content/esprit";
import { gain, win } from "@/engine/core";
import { applyReview } from "@/engine/scoring";
import { dueRevisions, todayTopic } from "@/engine/insights";
import type { EspritEntry } from "@/engine/types";
import { examineEsprit, examineReview } from "@/ai/contremaitre";
import { DAY, dayKey, f1, fdate, plural, wc } from "@/lib/format";
import { useChantier, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { Card, Foreman, PillarHeader, Sheet, Thinking, useNow } from "@/ui/kit";
import { ExamResult, type ExamView } from "./ExamResult";

export function EspritView() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const now = useNow(30_000);
  const topic = todayTopic(c, now);
  const today = c.esprit.find((e) => dayKey(e.ts) === dayKey(now));
  const due = dueRevisions(c, now);
  const avg = c.esprit.length ? c.esprit.reduce((a, b) => a + b.note, 0) / c.esprit.length : null;
  const [own, setOwn, clearOwn] = useDraft("esp-own");
  const [ans, setAns, clearAns] = useDraft("esp-ans");
  const [busy, setBusy] = useState(false);
  const [exam, setExam] = useState<ExamView | null>(null);
  const [review, setReview] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);

  const submit = async () => {
    const n = wc(ans);
    if (n < 120) { toast(`${n} ${plural(n, "mot")}. Il en faut 120. Développe.`); return; }
    const title = own.trim().length >= 4 ? own.trim() : topic.title;
    const domain = own.trim().length >= 4 ? "libre" : topic.domain;
    setBusy(true);
    const r = await examineEsprit(title, domain, ans.trim());
    const note = r ? Math.max(0, Math.min(10, Math.round(Number(r.note)))) : Math.min(6, Math.floor(n / 25));
    const ts = Date.now();
    const g = act((d) => {
      d.esprit.push({
        ts, topic: title, ans: ans.trim(), note, verdict: r?.verdict ?? "", lacune: r?.lacune ?? "", objection: r?.objection ?? "",
        question: r?.question || `Réexplique « ${title} » en trois phrases.`, stage: 0, next: ts + REVIEW_STEPS[0] * DAY,
      });
      if (note >= 8) win(d, "esprit", `${note}/10 sur « ${title} »`, ts);
      return gain(d, "esprit", note, ts);
    });
    gainToast("esprit", g);
    setBusy(false); clearAns(); clearOwn();
    setExam({ note, ai: !!r, lines: r ? [["Verdict", r.verdict], ["Lacune", r.lacune], ["Objection à réfuter", r.objection], ["À lire", r.a_lire]] : [] });
  };

  return (
    <div className="view">
      <PillarHeader c={c} id="esprit" now={now} />

      {due.length > 0 && (
        <div className="alert">
          <span className="eyebrow">{plural(due.length, "Révision")} {plural(due.length, "due")} · {due.length}</span>
          <strong>Ce que tu as appris s'efface.</strong>
          <p className="muted">Réussie (6/10 ou plus) : +4 assises et prochaine révision plus tard. Ratée : −2 assises. Le savoir non retenu ne compte pas.</p>
          <div className="list">
            {due.slice(0, 4).map((e) => (
              <div className="li" key={e.ts}><span className="main">{e.topic}</span><button className="btn small" type="button" onClick={() => setReview(e.ts)}>Réviser</button></div>
            ))}
          </div>
        </div>
      )}

      <Card title="Sujet du jour" aside={exam || today ? "l'Examinateur" : topic.domain}>
        {exam ? (
          <ExamResult exam={exam} onContinue={() => setExam(null)} />
        ) : today ? (
          <>
            <p className="h-display" style={{ fontSize: 26 }}>{today.topic}</p>
            <p><b style={{ color: today.note >= 6 ? "var(--ok)" : "var(--blood)" }}>{today.note}/10.</b> <span className="muted">Révision prévue le {fdate(today.next)}.</span></p>
            {today.lacune && <p className="voice"><b>Lacune :</b> {today.lacune}</p>}
            {today.objection && <p className="voice"><b>Objection à réfuter :</b> {today.objection}</p>}
          </>
        ) : (
          <>
            <p className="h-display" style={{ fontSize: 28 }}>{topic.title}</p>
            <label className="f" htmlFor="es-own">Ou impose ton propre sujet
              <input type="text" id="es-own" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Ex. : la politique monétaire de la BCE" />
            </label>
            <p className="muted">Explique-le à quelqu'un d'intelligent qui n'y connaît rien. Faits, causes, conséquences. De mémoire : l'Examinateur te contredira ensuite.</p>
            <label className="f" htmlFor="es-ans">Ton explication
              <textarea id="es-ans" style={{ minHeight: 150 }} value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Commence par l'idée centrale en une phrase." />
            </label>
            <div className="counter num">{wc(ans)} {plural(wc(ans), "mot")} · 120 minimum</div>
            <div><button className="btn primary" type="button" disabled={busy} onClick={() => void submit()}>Soumettre à l'Examinateur</button></div>
            {busy && <Thinking>L'Examinateur lit ta copie</Thinking>}
          </>
        )}
      </Card>

      <Card title="Carte du savoir" aside={`${c.esprit.length} ${plural(c.esprit.length, "sujet")}${avg !== null ? " · moy. " + f1(avg) : ""} · ${TOPICS.length} au programme`}>
        <p className="muted small">Chaque case est un sujet que tu as su expliquer. Plus elle est pleine, mieux tu le maîtrises. Trois révisions réussies et il est gravé.</p>
        <div className="kmap">
          {c.esprit.length ? c.esprit.slice().reverse().slice(0, 30).map((e) => (
            <button type="button" className="ktile" key={e.ts} onClick={() => setDetail(e.ts)}
              style={{ background: `color-mix(in srgb, var(--c-esprit) ${Math.round((0.12 + (e.note / 10) * 0.5) * 100)}%, var(--panel))` }}>
              <span>{e.topic}</span>
              <span className="kn num">{e.note}/10 {"●".repeat(Math.min(3, e.stage))}{"○".repeat(Math.max(0, 3 - e.stage))}</span>
            </button>
          )) : <p className="muted">Vide. Ta culture commence aujourd'hui.</p>}
        </div>
      </Card>

      <ReviewSheet entry={c.esprit.find((e) => e.ts === review) ?? null} onClose={() => setReview(null)} />
      <TopicSheet entry={c.esprit.find((e) => e.ts === detail) ?? null} onClose={() => setDetail(null)} />
    </div>
  );
}

function ReviewSheet({ entry, onClose }: { entry: EspritEntry | null; onClose: () => void }) {
  const act = useStore((s) => s.act);
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ note: number; text: string; ai: boolean } | null>(null);
  const [frozen, setFrozen] = useState<EspritEntry | null>(null);
  const e = frozen ?? entry;
  const close = () => { setAns(""); setRes(null); setFrozen(null); onClose(); };
  const submit = async () => {
    if (!e) return;
    if (wc(ans) < 25) { toast("25 mots minimum. De mémoire."); return; }
    setFrozen(e); setBusy(true);
    const r = await examineReview(e.topic, e.question, e.ans, ans.trim());
    const note = r ? Math.max(0, Math.min(10, Math.round(Number(r.note)))) : Math.min(6, Math.floor(wc(ans) / 10));
    const g = act((d) => applyReview(d, e.ts, note, Date.now()));
    gainToast("esprit", g);
    setBusy(false);
    setRes({ note, ai: !!r, text: r ? r.correction : note >= 6 ? "Retenu." : "Pas retenu. Tu le reverras demain." });
  };
  return (
    <Sheet open={!!e} onClose={close} label="Révision">
      {e && (
        <>
          <span className="eyebrow">Révision · étape {Math.min(3, e.stage + 1)} / 3</span>
          <h2 className="h-display" style={{ fontSize: 30 }}>{e.topic}</h2>
          <p className="voice">{e.question}</p>
          {res ? (
            <>
              <Foreman who={res.ai ? "L'Examinateur" : "Notation automatique (sans IA)"} tone={res.note >= 6 ? "good" : "bad"} say={`${res.note}/10`} sayStyle={{ fontSize: 36 }}>
                <p className="voice">{res.text}</p>
              </Foreman>
              <button className="btn block" type="button" onClick={close}>Fermer</button>
            </>
          ) : (
            <>
              <label className="f" htmlFor="rv-ans">Réponds de mémoire. Pas de recherche.
                <textarea id="rv-ans" value={ans} onChange={(x) => setAns(x.target.value)} placeholder="Ta réponse" />
              </label>
              <button className="btn primary block" type="button" disabled={busy} onClick={() => void submit()}>Soumettre</button>
              {busy && <Thinking>L'Examinateur vérifie ta mémoire</Thinking>}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function TopicSheet({ entry: e, onClose }: { entry: EspritEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!e} onClose={onClose} label="Sujet">
      {e && (
        <>
          <span className="eyebrow">{fdate(e.ts)} · {e.note}/10 · {Math.min(3, e.stage)}/3 révisions</span>
          <h2 className="h-display" style={{ fontSize: 30 }}>{e.topic}</h2>
          {e.ans && <div className="transcript" style={{ maxHeight: 260 }}>{e.ans}</div>}
          {e.verdict && <p className="voice"><b>Verdict :</b> {e.verdict}</p>}
          {e.lacune && <p className="voice"><b>Lacune :</b> {e.lacune}</p>}
          {e.objection && <p className="voice"><b>Objection :</b> {e.objection}</p>}
          <p className="muted small">{e.stage >= 3 ? "Gravé." : `Prochaine révision le ${fdate(e.next)}.`}</p>
          <button className="btn block" type="button" onClick={onClose}>Fermer</button>
        </>
      )}
    </Sheet>
  );
}
