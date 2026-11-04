import { useEffect, useRef, useState } from "react";
import { REVIEW_STEPS } from "@/content/esprit";
import { LEVELS } from "@/content/profile";
import { gain, win } from "@/engine/core";
import { applyReview } from "@/engine/scoring";
import { dueRevisions } from "@/engine/insights";
import { fallbackProposals } from "@/engine/fallbacks";
import type { EspritChoice, EspritEntry } from "@/engine/types";
import { aiReady, examineEsprit, examineReview, genFiche, genParcours, genProposals } from "@/ai/contremaitre";
import { DAY, dayKey, f1, fdate, plural, wc } from "@/lib/format";
import { useChantier, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { Card, Foreman, PillarHeader, Sheet, Thinking, useNow } from "@/ui/kit";
import { Chips } from "@/ui/fields";
import { MemoryNote } from "@/features/temple/Memory";
import { ExamResult, type ExamView } from "./ExamResult";

export function EspritView() {
  const c = useChantier()!;
  const now = useNow(30_000);
  const due = dueRevisions(c, now);
  const avg = c.esprit.length ? c.esprit.reduce((a, b) => a + b.note, 0) / c.esprit.length : null;
  const [review, setReview] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);

  return (
    <div className="view">
      <PillarHeader c={c} id="esprit" now={now} />
      <MemoryNote c={c} id="esprit" />

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

      <TodayCard now={now} />
      <ParcoursCard />

      <Card title="Carte du savoir" aside={`${c.esprit.length} ${plural(c.esprit.length, "sujet")}${avg !== null ? " · moy. " + f1(avg) : ""}`}>
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

/* ---------------- Sujet du jour : choisir, apprendre, expliquer ---------------- */

function TodayCard({ now }: { now: number }) {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const today = dayKey(now);
  const entry = c.esprit.find((e) => dayKey(e.ts) === today);
  const choice = c.espritChoice?.date === today ? c.espritChoice : null;
  const props = c.plans.espritProps?.date === today ? c.plans.espritProps.items : null;
  const parcours = c.parcours.find((p) => p.id === c.parcoursActif);
  const nextInParcours = parcours?.sujets[parcours.index];
  const [envie, setEnvie] = useState("");
  const [libre, setLibre] = useState("");
  const [busy, setBusy] = useState<"" | "props" | "fiche" | "exam">("");
  const [exam, setExam] = useState<ExamView | null>(null);
  const [ans, setAns, clearAns] = useDraft("esp-ans");
  const tried = useRef("");

  const loadProps = async (wish = "") => {
    setBusy("props");
    const r = await genProposals(wish, !wish);
    setBusy("");
    if (r) act((d) => { d.plans.espritProps = { date: dayKey(Date.now()), items: r.sujets }; });
  };
  useEffect(() => {
    if (props || choice || entry || !aiReady() || tried.current === today) return;
    tried.current = today;
    void loadProps();
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
    const n = wc(ans);
    if (n < 120) { toast(`${n} ${plural(n, "mot")}. Il en faut 120. Développe.`); return; }
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

  if (exam) return <Card title="Sujet du jour" aside="l'Examinateur"><ExamResult exam={exam} onContinue={() => setExam(null)} /></Card>;

  if (entry) {
    return (
      <Card title="Sujet du jour" aside={entry.domaine ?? "fait"}>
        <p className="h-display" style={{ fontSize: 26 }}>{entry.topic}</p>
        <p><b style={{ color: entry.note >= 6 ? "var(--ok)" : "var(--blood)" }}>{entry.note}/10.</b> <span className="muted">Révision prévue le {fdate(entry.next)}.</span></p>
        {entry.lacune && <p className="voice"><b>Lacune :</b> {entry.lacune}</p>}
        {entry.objection && <p className="voice"><b>Objection à réfuter :</b> {entry.objection}</p>}
      </Card>
    );
  }

  if (choice) {
    return (
      <Card title="Sujet du jour" aside={choice.domaine}>
        <p className="h-display" style={{ fontSize: 28 }}>{choice.titre}</p>
        {choice.fiche ? (
          <div className="foreman">
            <span className="who">Fiche</span>
            <ul className="bullets">{choice.fiche.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            {choice.fiche.reperes.length > 0 && <p className="voice">{choice.fiche.reperes.join(" · ")}</p>}
            {choice.fiche.aLire && <p className="muted small">Pour aller plus loin : {choice.fiche.aLire}</p>}
            <p className="muted small">Lis, puis explique sans la regarder. L'Examinateur exigera que tu dépasses la fiche.</p>
          </div>
        ) : busy === "fiche" ? <Thinking>Le Contremaître rédige ta fiche</Thinking> : (
          <div className="btn-row"><button className="btn small" type="button" onClick={() => void loadFiche()}>Apprendre d'abord : la fiche</button><span className="muted small">ou explique directement si tu connais</span></div>
        )}
        <label className="f" htmlFor="es-ans">Ton explication, de mémoire
          <textarea id="es-ans" style={{ minHeight: 150 }} value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Commence par l'idée centrale en une phrase. Faits, causes, conséquences." />
        </label>
        <div className="counter num">{wc(ans)} {plural(wc(ans), "mot")} · 120 minimum</div>
        <div className="btn-row">
          <button className="btn primary" type="button" disabled={busy === "exam"} onClick={() => void submit()}>Soumettre à l'Examinateur</button>
          <button className="linkish" type="button" onClick={() => act((d) => { d.espritChoice = null; })}>Choisir un autre sujet</button>
        </div>
        {busy === "exam" && <Thinking>L'Examinateur lit ta copie</Thinking>}
      </Card>
    );
  }

  const items = props ?? (aiReady() ? null : fallbackProposals(c, now));
  return (
    <Card title="Choisis ton sujet" aside="aujourd'hui">
      <p className="muted small">Trois propositions taillées pour toi, la suite de ton parcours, ou ton propre sujet.</p>
      {nextInParcours && parcours && (
        <button type="button" className="choice" onClick={() => choose({ titre: nextInParcours.titre, domaine: parcours.theme, source: "parcours", parcoursId: parcours.id })}>
          <span className="d">Parcours · {parcours.theme} · {parcours.index + 1}/{parcours.sujets.length}</span>
          <span className="t">{nextInParcours.titre}</span>
          {nextInParcours.angle && <span className="s">{nextInParcours.angle}</span>}
        </button>
      )}
      {busy === "props" ? <Thinking>Le Contremaître cherche tes sujets</Thinking> : items ? items.map((t) => (
        <button type="button" className="choice" key={t.titre} onClick={() => choose({ titre: t.titre, domaine: t.domaine, source: "proposition" })}>
          <span className="d">{t.domaine} · {"●".repeat(t.difficulte)}{"○".repeat(3 - t.difficulte)}</span>
          <span className="t">{t.titre}</span>
          {t.angle && <span className="s">{t.angle}</span>}
        </button>
      )) : <div><button className="btn small" type="button" onClick={() => void loadProps()}>Recevoir des propositions</button></div>}
      <hr className="sep" />
      <label className="f" htmlFor="es-envie">Une envie particulière ? Le Contremaître relance trois propositions
        <input id="es-envie" type="text" value={envie} onChange={(e) => setEnvie(e.target.value)} placeholder="Ex. : l'Afrique, l'histoire de la monnaie, quelque chose sur l'IA" />
      </label>
      <div><button className="btn small" type="button" disabled={busy === "props" || !aiReady()} onClick={() => { void loadProps(envie.trim() || "d'autres idées, différentes des précédentes"); setEnvie(""); }}>Nouvelles propositions</button></div>
      <label className="f" htmlFor="es-own">Ou impose ton sujet
        <input id="es-own" type="text" value={libre} onChange={(e) => setLibre(e.target.value)} placeholder="Ex. : la politique monétaire de la BCE" />
      </label>
      <div><button className="btn small" type="button" onClick={() => { if (libre.trim().length < 4) { toast("Un vrai sujet, quatre caractères minimum."); return; } choose({ titre: libre.trim(), domaine: "libre", source: "libre" }); setLibre(""); }}>Choisir ce sujet</button></div>
    </Card>
  );
}

/* ---------------- Parcours ---------------- */

function ParcoursCard() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const active = c.parcours.find((p) => p.id === c.parcoursActif);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (theme.trim().length < 4) { toast("Donne un thème, quatre caractères minimum."); return; }
    setBusy(true);
    const r = await genParcours(theme.trim());
    setBusy(false);
    if (r) {
      const id = "p" + Date.now();
      act((d) => { d.parcours.push({ id, theme: theme.trim(), pourquoi: r.pourquoi, sujets: r.sujets, index: 0, ts: Date.now() }); d.parcoursActif = id; });
      setTheme(""); setOpen(false); toast("Parcours créé. Le premier sujet t'attend.");
    }
  };
  return (
    <Card title="Parcours" aside={`${c.parcours.length} ${plural(c.parcours.length, "parcours", "parcours")}`}>
      {active ? (
        <>
          <p className="h-display" style={{ fontSize: 24 }}>{active.theme}</p>
          <p className="muted small">{active.pourquoi}</p>
          <div className="ladder">
            {active.sujets.map((s, i) => (
              <div className={"rung " + (i < active.index ? "done" : i === active.index ? "cur" : "lock")} key={i}>
                <span className="lv">{i + 1}</span><div><div className="tt">{s.titre}</div>{i === active.index && s.angle && <div className="dd">{s.angle}</div>}</div>
              </div>
            ))}
          </div>
        </>
      ) : <p className="muted small">Un parcours enchaîne 6 à 10 sujets sur un thème, du socle vers la maîtrise. Le prochain sujet apparaît chaque jour parmi tes choix.</p>}
      {c.parcours.length > 1 && (
        <div className="chips">
          {c.parcours.map((p) => <button key={p.id} type="button" className="chip" aria-pressed={p.id === c.parcoursActif} onClick={() => act((d) => { d.parcoursActif = p.id; })}>{p.theme} · {p.index}/{p.sujets.length}</button>)}
        </div>
      )}
      {open ? (
        <>
          <label className="f" htmlFor="pc-theme">Thème du parcours<input id="pc-theme" type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex. : la géopolitique de l'énergie" /></label>
          {c.profile?.esprit.domaines.length ? <Chips options={c.profile.esprit.domaines} value={[]} onChange={(v) => setTheme(v[v.length - 1] ?? "")} /> : null}
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void create()}>Créer le parcours</button>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annuler</button>
          </div>
          {busy && <Thinking>Le Contremaître construit ton parcours</Thinking>}
        </>
      ) : <div><button className="btn small" type="button" onClick={() => setOpen(true)}>Nouveau parcours</button></div>}
    </Card>
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
