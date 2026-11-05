/*
 * Esprit v5 : la carte du savoir en tête (domaines, acquis, à acquérir), un sujet par jour choisi d'un geste,
 * une fiche en cartes courtes, une explication de mémoire jugée par l'Examinateur, des révisions espacées.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { REVIEW_STEPS } from "@/content/esprit";
import { LEVELS } from "@/content/profile";
import { gain, win } from "@/engine/core";
import { applyReview } from "@/engine/scoring";
import { dueRevisions } from "@/engine/insights";
import { fallbackProposals } from "@/engine/fallbacks";
import type { EspritChoice, EspritEntry } from "@/engine/types";
import { aiReady, examineEsprit, examineReview, genFiche, genProposals } from "@/ai/contremaitre";
import * as O from "@/ai/ops";
import { DAY, dayKey, fdate, plural, wc } from "@/lib/format";
import { canDictate, dictate, stopDictation, useVoice } from "@/lib/voice";
import { useChantier, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { openCoach } from "@/store/coach";
import { Card, Fold, Foreman, PillarHeader, Sheet, Thinking, useNow } from "@/ui/kit";
import { CoachHead } from "@/features/coach/CoachHead";
import { ExamResult, type ExamView } from "./ExamResult";
import { buildMap, KnowledgeMap, type KNode } from "./KnowledgeMap";

export function EspritView() {
  const c = useChantier()!;
  const now = useNow(60_000);
  const due = dueRevisions(c, now);
  const [review, setReview] = useState<number | null>(null);
  const [node, setNode] = useState<KNode | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const { nodes, domains } = useMemo(() => buildMap(c, now), [c, now]);
  const acquis = nodes.filter((n) => n.entry).length, graves = nodes.filter((n) => n.state === "grave").length;
  const [busyMap, setBusyMap] = useState(false);
  const tried = useRef(false);
  const remap = async () => { setBusyMap(true); await O.makeMap(); setBusyMap(false); };
  useEffect(() => {
    if (c.knowledgeMap || tried.current || !aiReady() || !c.profile?.esprit.domaines.length) return;
    tried.current = true; void remap();
  }, [c.knowledgeMap]);

  return (
    <div className="view">
      <PillarHeader c={c} id="esprit" now={now} />
      <CoachHead scope="esprit" />

      {due.length > 0 && (
        <button type="button" className="alert-row" onClick={() => setReview(due[0].ts)}>
          <b className="num">{due.length}</b><span>{plural(due.length, "révision")} {plural(due.length, "due")} · « {due[0].topic} »</span><span className="go">Réviser ›</span>
        </button>
      )}

      <TodayCard now={now} />

      <section className="kmap-card">
        <div className="kmap-head">
          <span className="eyebrow">Carte du savoir</span>
          <span className="kmap-stats num"><b>{acquis}</b> acquis · <b>{graves}</b> gravés · <b>{nodes.length - acquis}</b> à acquérir</span>
        </div>
        {busyMap ? <div className="kcanvas wait"><Thinking>Il dessine ta carte</Thinking></div> : <KnowledgeMap c={c} now={now} focus={focus} onPick={setNode} />}
        <div className="klegend"><span className="l-acq">acquis</span><span className="l-grv">gravé</span><span className="l-due">à réviser</span><span className="l-todo">à acquérir</span></div>
        <div className="kdoms">
          {domains.map((d, i) => (
            <button key={d.nom} type="button" className={"kdom" + (focus === i ? " on" : "")} style={{ ["--dc" as string]: d.color }} onClick={() => setFocus(focus === i ? null : i)}>
              <span className="kd-n">{d.nom}</span><span className="kd-v num">{d.acquis}/{d.total}</span>
              <i><b style={{ width: `${(d.acquis / Math.max(1, d.total)) * 100}%` }} /></i>
            </button>
          ))}
        </div>
      </section>

      <ParcoursFold />
      <Fold title="La carte">
        <p className="small muted">{c.knowledgeMap ? `Composée le ${fdate(c.knowledgeMap.ts)} à partir de tes domaines.` : "Carte de base. Le Coach peut la composer pour tes domaines."}</p>
        <button className="btn small" type="button" disabled={busyMap} onClick={() => void remap()}>Recomposer la carte</button>
      </Fold>

      <NodeSheet node={node} onClose={() => setNode(null)} onReview={(ts) => { setNode(null); setReview(ts); }} />
      <ReviewSheet entry={c.esprit.find((e) => e.ts === review) ?? null} onClose={() => setReview(null)} />
    </div>
  );
}

/* ---------------- Sujet du jour ---------------- */

function TodayCard({ now }: { now: number }) {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const today = dayKey(now);
  const entry = c.esprit.find((e) => dayKey(e.ts) === today);
  const choice = c.espritChoice?.date === today ? c.espritChoice : null;
  const props = c.plans.espritProps?.date === today ? c.plans.espritProps.items : null;
  const parcours = c.parcours.find((p) => p.id === c.parcoursActif);
  const next = parcours?.sujets[parcours.index];
  const [envie, setEnvie] = useState("");
  const [busy, setBusy] = useState<"" | "props" | "fiche" | "exam">("");
  const [exam, setExam] = useState<ExamView | null>(null);
  const [ans, setAns, clearAns] = useDraft("esp-ans");
  const listening = useVoice((s) => s.listening);
  const tried = useRef("");

  const loadProps = async (wish = "") => {
    setBusy("props");
    const r = await genProposals(wish, !wish);
    setBusy("");
    if (r) act((d) => { d.plans.espritProps = { date: dayKey(Date.now()), items: r.sujets }; });
  };
  useEffect(() => {
    if (props || choice || entry || !aiReady() || tried.current === today) return;
    tried.current = today; void loadProps();
  }, [today, props, choice, entry]);

  const choose = (ch: Omit<EspritChoice, "date" | "fiche">) => act((d) => { d.espritChoice = { ...ch, date: dayKey(Date.now()), fiche: null }; });
  const loadFiche = async () => {
    if (!choice) return;
    setBusy("fiche");
    const r = await genFiche(choice.titre);
    setBusy("");
    if (r) act((d) => { if (d.espritChoice) d.espritChoice.fiche = r; });
  };
  const submit = async () => {
    if (!choice) return;
    stopDictation();
    const n = wc(ans);
    if (n < 120) { toast(`${n} ${plural(n, "mot")}. 120 minimum.`); return; }
    setBusy("exam");
    const niveau = LEVELS.find((l) => l.id === c.profile?.esprit.niveau)?.label ?? "débutant";
    const r = await examineEsprit(choice.titre, choice.domaine, niveau, ans.trim(), !!choice.fiche);
    const note = r ? r.note : Math.min(6, Math.floor(n / 25));
    const ts = Date.now();
    const g = act((d) => {
      d.esprit.push({
        ts, topic: choice.titre, domaine: choice.domaine, ans: ans.trim(), note, verdict: r?.verdict ?? "", lacune: r?.lacune ?? "", objection: r?.objection ?? "",
        question: r?.question || `Réexplique « ${choice.titre} » en trois phrases.`, stage: 0, next: ts + REVIEW_STEPS[0] * DAY,
      });
      if (choice.source === "parcours") { const p = d.parcours.find((x) => x.id === choice.parcoursId); if (p) p.index = Math.min(p.sujets.length, p.index + 1); }
      if (note >= 8) win(d, "esprit", `${note}/10 sur « ${choice.titre} »`, ts);
      return gain(d, "esprit", note, ts);
    });
    gainToast("esprit", g);
    setBusy(""); clearAns();
    setExam({ note, ai: !!r, lines: r ? [["Verdict", r.verdict], ["Lacune", r.lacune], ["Objection à réfuter", r.objection], ["À lire", r.a_lire]] : [] });
  };

  if (exam) return <Card title="Sujet du jour"><ExamResult exam={exam} onContinue={() => setExam(null)} /></Card>;

  if (entry) {
    return (
      <Card title="Sujet du jour" aside={<span className="tag ok">fait</span>}>
        <div className="done-row">
          <span className={"big-note num " + (entry.note >= 6 ? "up" : "down")}>{entry.note}<i>/10</i></span>
          <div><b>{entry.topic}</b><span className="muted small">révision le {fdate(entry.next)}</span></div>
        </div>
        {entry.lacune && <p className="voice small">Lacune : {entry.lacune}</p>}
      </Card>
    );
  }

  if (choice) {
    const words = wc(ans);
    return (
      <Card title="Sujet du jour" aside={choice.domaine}>
        <p className="h-display" style={{ fontSize: 26 }}>{choice.titre}</p>
        {choice.fiche ? (
          <div className="fiche">
            {choice.fiche.points.map((p, i) => <div className="fi" key={i}><b>{i + 1}</b><span>{p}</span></div>)}
            {choice.fiche.reperes.length > 0 && <div className="reperes">{choice.fiche.reperes.map((r) => <span key={r}>{r}</span>)}</div>}
          </div>
        ) : busy === "fiche" ? <Thinking>Il rédige ta fiche</Thinking> : (
          <div className="btn-row"><button className="btn small" type="button" onClick={() => void loadFiche()}>Lire la fiche d'abord</button><button className="btn small ghost" type="button" onClick={() => openCoach("esprit", `Explique-moi « ${choice.titre} » simplement`)}>Demander au Coach</button></div>
        )}
        <div className="answer">
          <textarea id="es-ans" aria-label="Ton explication, de mémoire" style={{ minHeight: 140 }} value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Explique de mémoire : l'idée centrale, les causes, les conséquences." />
          {canDictate && <button type="button" className={"cp-mic" + (listening ? " on" : "")} aria-label="Dicter" onClick={() => (listening ? stopDictation() : dictate((t) => setAns((ans ? ans + " " : "") + t)))}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>}
        </div>
        <div className="wbar" aria-hidden="true"><b style={{ width: `${Math.min(100, (words / 120) * 100)}%` }} /></div>
        <div className="btn-row spread">
          <span className="counter num">{words} / 120 mots</span>
          <button className="btn primary" type="button" disabled={busy === "exam"} onClick={() => void submit()}>Soumettre</button>
        </div>
        {busy === "exam" && <Thinking>L'Examinateur lit ta copie</Thinking>}
        <button className="linkish small" type="button" onClick={() => act((d) => { d.espritChoice = null; })}>Autre sujet</button>
      </Card>
    );
  }

  const items = props ?? (aiReady() ? null : fallbackProposals(c, now));
  return (
    <Card title="Sujet du jour" aside="choisis">
      <div className="picks">
        {next && parcours && (
          <button type="button" className="pick par" onClick={() => choose({ titre: next.titre, domaine: parcours.theme, source: "parcours", parcoursId: parcours.id })}>
            <span className="pk-d">Parcours · {parcours.index + 1}/{parcours.sujets.length}</span><span className="pk-t">{next.titre}</span>
          </button>
        )}
        {busy === "props" ? <Thinking>Il cherche tes sujets</Thinking> : items?.map((t) => (
          <button type="button" className="pick" key={t.titre} onClick={() => choose({ titre: t.titre, domaine: t.domaine, source: "proposition" })}>
            <span className="pk-d">{t.domaine} · {"●".repeat(t.difficulte)}{"○".repeat(3 - t.difficulte)}</span><span className="pk-t">{t.titre}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Ou touche une étoile sur la carte.</p>
      <Fold title="Autre chose">
        <input type="text" aria-label="Envie ou sujet" value={envie} onChange={(e) => setEnvie(e.target.value)} placeholder="Une envie, ou ton propre sujet" />
        <div className="btn-row">
          <button className="btn small" type="button" disabled={busy === "props" || !aiReady()} onClick={() => { void loadProps(envie.trim() || "d'autres idées, différentes des précédentes"); setEnvie(""); }}>3 propositions</button>
          <button className="btn small ghost" type="button" onClick={() => { if (envie.trim().length < 4) { toast("Quatre caractères minimum."); return; } choose({ titre: envie.trim(), domaine: "libre", source: "libre" }); setEnvie(""); }}>Ce sujet-là</button>
        </div>
      </Fold>
    </Card>
  );
}

/* ---------------- Étoile touchée sur la carte ---------------- */

function NodeSheet({ node: n, onClose, onReview }: { node: KNode | null; onClose: () => void; onReview: (ts: number) => void }) {
  const e = n?.entry;
  return (
    <Sheet open={!!n} onClose={onClose} label="Sujet">
      {n && (
        <>
          <span className="eyebrow">{n.domaine} · niveau {"●".repeat(n.niveau)}{"○".repeat(3 - n.niveau)}</span>
          <h2 className="h-display" style={{ fontSize: 28 }}>{n.titre}</h2>
          {e ? (
            <>
              <div className="kpis">
                <div><b className="num">{e.note}/10</b><span>note</span></div>
                <div><b className="num">{Math.min(3, e.stage)}/3</b><span>révisions</span></div>
                <div><b className="num">{e.stage >= 3 ? "gravé" : fdate(e.next)}</b><span>{e.stage >= 3 ? "" : "prochaine"}</span></div>
              </div>
              {e.lacune && <p className="voice small">Lacune : {e.lacune}</p>}
              <Fold title="Ta copie"><div className="transcript" style={{ maxHeight: 220 }}>{e.ans}</div>{e.verdict && <p className="voice small">{e.verdict}</p>}</Fold>
              {n.state === "due" && <button className="btn primary block" type="button" onClick={() => onReview(e.ts)}>Réviser maintenant</button>}
            </>
          ) : (
            <>
              <button className="btn primary block" type="button" onClick={() => { const r = O.studyTopic(n.titre, n.domaine); if (r) toast(r); onClose(); }}>En faire mon sujet du jour</button>
              <button className="btn block" type="button" onClick={() => { onClose(); openCoach("esprit", `Explique-moi « ${n.titre} » en 3 points`); }}>Demander au Coach</button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ---------------- Parcours ---------------- */

function ParcoursFold() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const active = c.parcours.find((p) => p.id === c.parcoursActif);
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (theme.trim().length < 4) { toast("Un thème, quatre caractères minimum."); return; }
    setBusy(true); const r = await O.makeParcours(theme.trim()); setBusy(false);
    if (r) { setTheme(""); toast(r); }
  };
  return (
    <Fold title={active ? `Parcours · ${active.theme}` : "Parcours"} aside={active ? `${active.index}/${active.sujets.length}` : c.parcours.length || undefined}>
      {active && (
        <div className="track">
          {active.sujets.map((s, i) => <div key={i} className={"tk " + (i < active.index ? "done" : i === active.index ? "cur" : "")}><i />{s.titre}</div>)}
        </div>
      )}
      {c.parcours.length > 1 && <div className="chips">{c.parcours.map((p) => <button key={p.id} type="button" className="chip" aria-pressed={p.id === c.parcoursActif} onClick={() => act((d) => { d.parcoursActif = p.id; })}>{p.theme} · {p.index}/{p.sujets.length}</button>)}</div>}
      <div className="row-input">
        <input type="text" aria-label="Thème du parcours" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Nouveau parcours : un thème" />
        <button className="btn" type="button" disabled={busy} onClick={() => void create()}>Créer</button>
      </div>
      {busy && <Thinking>Il construit ton parcours</Thinking>}
    </Fold>
  );
}

/* ---------------- Révision ---------------- */

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
          <span className="eyebrow">Révision {Math.min(3, e.stage + 1)}/3</span>
          <h2 className="h-display" style={{ fontSize: 28 }}>{e.topic}</h2>
          <p className="voice">{e.question}</p>
          {res ? (
            <>
              <Foreman who={res.ai ? "L'Examinateur" : "Sans IA"} tone={res.note >= 6 ? "good" : "bad"} say={`${res.note}/10`} sayStyle={{ fontSize: 36 }}><p className="voice">{res.text}</p></Foreman>
              <button className="btn block" type="button" onClick={close}>Fermer</button>
            </>
          ) : (
            <>
              <textarea aria-label="Ta réponse, de mémoire" value={ans} onChange={(x) => setAns(x.target.value)} placeholder="De mémoire." />
              <button className="btn primary block" type="button" disabled={busy} onClick={() => void submit()}>Soumettre</button>
              {busy && <Thinking>L'Examinateur vérifie</Thinking>}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
