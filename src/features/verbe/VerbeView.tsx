/*
 * Verbe v5 : une salle d'entraînement. En tête, le radar des six compétences (mesurées sur chaque prise de parole).
 * Puis l'exercice conseillé (celui qui travaille la compétence la plus faible) et tous les autres, d'un geste.
 */
import { useEffect, useState } from "react";
import { DRILLS, DRILL, SKILLS, type DrillId } from "@/content/verbe";
import { eloScore, eloSkills, suggestDrill } from "@/engine/eloquence";
import { hesit } from "@/engine/insights";
import type { Chantier, EloSkill, Oral } from "@/engine/types";
import { useDrillRequest } from "@/ai/ops";
import { f1, fdate, plural } from "@/lib/format";
import { useChantier } from "@/store";
import { Envelope, Fold, PillarHeader, PlayButton, Sheet, Sparkline, Transcript, useNow } from "@/ui/kit";
import { CoachHead } from "@/features/coach/CoachHead";
import { DrillSession } from "./DrillSession";

function skillsBefore(c: Chantier): Record<EloSkill, number | null> {
  return eloSkills({ ...c, orals: c.orals.slice(0, Math.max(0, c.orals.length - 6)) });
}

/** Radar hexagonal : maintenant (plein) et il y a six oraux (pointillé). */
function Radar({ now, before }: { now: Record<EloSkill, number | null>; before: Record<EloSkill, number | null> }) {
  const R = 74, C = 100;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [C + Math.cos(a) * R * (v / 100), C + Math.sin(a) * R * (v / 100)]; };
  const poly = (s: Record<EloSkill, number | null>) => SKILLS.map((k, i) => pt(i, s[k.id] ?? 0).map((x) => x.toFixed(1)).join(",")).join(" ");
  const hasBefore = SKILLS.some((k) => before[k.id] !== null);
  return (
    <svg viewBox="0 0 200 200" className="radar" role="img" aria-label={"Compétences : " + SKILLS.map((k) => `${k.nom} ${now[k.id] ?? "non mesurée"}`).join(", ")}>
      {[25, 50, 75, 100].map((l) => <polygon key={l} points={SKILLS.map((_, i) => pt(i, l).join(",")).join(" ")} className="r-grid" />)}
      {SKILLS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={C} y1={C} x2={x} y2={y} className="r-axis" />; })}
      {hasBefore && <polygon points={poly(before)} className="r-before" />}
      <polygon points={poly(now)} className="r-now" />
      {SKILLS.map((k, i) => {
        const [x, y] = pt(i, 122), v = now[k.id];
        return (
          <g key={k.id}>
            <text x={x} y={y - 4} textAnchor="middle" className="r-l">{k.nom}</text>
            <text x={x} y={y + 9} textAnchor="middle" className={"r-v" + (v === null ? " na" : "")}>{v ?? "—"}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function VerbeView() {
  const c = useChantier()!;
  const now = useNow(60_000);
  const req = useDrillRequest();
  const [run, setRun] = useState<{ drill: DrillId; sujet?: string } | null>(null);
  const [archive, setArchive] = useState<number | null>(null);
  const skills = eloSkills(c), before = skillsBefore(c), score = eloScore(c);
  const sug = suggestDrill(c);
  const weak = SKILLS.filter((k) => skills[k.id] !== null).sort((a, b) => (skills[a.id] ?? 0) - (skills[b.id] ?? 0))[0];

  // Exercice demandé par le Coach depuis la conversation.
  useEffect(() => { if (req.drill) { setRun({ drill: req.drill, sujet: req.sujet || undefined }); useDrillRequest.setState({ drill: null, sujet: "" }); } }, [req.drill]);

  return (
    <div className="view">
      <PillarHeader c={c} id="verbe" now={now} />
      <CoachHead scope="verbe" />

      <section className="radar-card">
        <Radar now={skills} before={before} />
        <div className="radar-side">
          <div><b className="num">{score ?? "—"}</b><span>score d'éloquence</span></div>
          {weak && <div><b className="num down">{skills[weak.id]}</b><span>{weak.nom.toLowerCase()} : ton point faible</span></div>}
          <div><b className="num">{c.orals.length}</b><span>{plural(c.orals.length, "prise")} de parole</span></div>
        </div>
      </section>

      <button type="button" className="drill-main" onClick={() => setRun({ drill: sug })}>
        <span className="eyebrow">Exercice conseillé · {SKILLS.find((s) => s.id === DRILL[sug].skill)?.nom}</span>
        <span className="dm-n">{DRILL[sug].nom}</span>
        <span className="dm-b">{DRILL[sug].but}</span>
        <span className="dm-go">Commencer · {DRILL[sug].secs} s ›</span>
      </button>

      <div className="drills">
        {DRILLS.filter((d) => d.id !== sug && (d.id !== "redite" || c.orals.length > 0)).map((d) => (
          <button key={d.id} type="button" className="drill-tile" onClick={() => setRun({ drill: d.id })}>
            <span className="dt-n">{d.nom}</span>
            <span className="dt-s">{SKILLS.find((s) => s.id === d.skill)?.nom} · {d.secs} s</span>
          </button>
        ))}
      </div>

      <Fold title="Courbes" aside={c.orals.length ? `${f1(hesit(c.orals[c.orals.length - 1]))} hés./min` : undefined}>
        <div className="metrics">
          <div className="metric"><span className="l">Hésitations / min</span><Sparkline values={c.orals.slice(-30).map(hesit)} color="var(--blood)" /></div>
          <div className="metric"><span className="l">Mots / min</span><Sparkline values={c.orals.slice(-30).map((o) => o.wpm).filter((v): v is number => !!v)} color="var(--c-verbe)" /></div>
        </div>
      </Fold>
      <Fold title="Archives" aside={c.orals.length}>
        <div className="list">
          {c.orals.slice(-10).reverse().map((o) => (
            <button type="button" className="li" key={o.ts} onClick={() => setArchive(o.ts)}>
              <span className="main">{o.drill ? DRILL[o.drill as DrillId]?.nom ?? o.drill : "Tribune"} · {o.sujet}</span><span className="side">{f1(hesit(o))}</span>
              <span className="sub">{fdate(o.ts)}{o.wpm ? ` · ${o.wpm} mots/min` : ""}{o.audio ? " · ▶" : ""}</span>
            </button>
          ))}
        </div>
      </Fold>

      {run && <DrillSession drill={run.drill} sujetHint={run.sujet} onClose={() => setRun(null)} />}
      <ArchiveSheet oral={c.orals.find((o) => o.ts === archive) ?? null} onClose={() => setArchive(null)} />
    </div>
  );
}

function ArchiveSheet({ oral: o, onClose }: { oral: Oral | null; onClose: () => void }) {
  return (
    <Sheet open={!!o} onClose={onClose} label="Archive d'un oral">
      {o && (
        <>
          <span className="eyebrow">{fdate(o.ts)}{o.drill ? ` · ${DRILL[o.drill as DrillId]?.nom ?? ""}` : ""}</span>
          <h2 className="h-display" style={{ fontSize: 26 }}>{o.sujet}</h2>
          <Envelope env={o.env} />
          {o.audio && <div><PlayButton ts={o.ts} label="Écouter" className="btn" /></div>}
          <div className="kpis">
            <div><b className="num">{f1(hesit(o))}</b><span>hés./min</span></div>
            <div><b className="num">{o.wpm ?? "—"}</b><span>mots/min</span></div>
            <div><b className="num">{o.skills ? Math.round(Object.values(o.skills).reduce((a, b) => a + (b ?? 0), 0) / Math.max(1, Object.values(o.skills).length)) : "—"}</b><span>score</span></div>
          </div>
          {o.verdict && <p className="voice small">{o.verdict}</p>}
          {o.text && <Transcript text={o.text} />}
          <button className="btn block" type="button" onClick={onClose}>Fermer</button>
        </>
      )}
    </Sheet>
  );
}

