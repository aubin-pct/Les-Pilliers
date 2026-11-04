import { useState } from "react";
import { TESTS, type TestId } from "@/content/corps";
import { bestOf } from "@/engine/scoring";
import { fallbackProgramme } from "@/engine/fallbacks";
import { genProgramme } from "@/ai/contremaitre";
import { DAY, dayIndex, fdate, plural } from "@/lib/format";
import { useChantier, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Card, PillarHeader, Sparkline, Thinking, useNow } from "@/ui/kit";
import { MemoryNote } from "@/features/temple/Memory";
import { TestSheet } from "./TestSheet";
import { SessionCard } from "./SessionCard";

export function CorpsView() {
  const c = useChantier()!;
  const now = useNow(1000);
  const [test, setTest] = useState<TestId | null>(null);
  const lastTest = c.tests.length ? c.tests[c.tests.length - 1].ts : 0;
  const surprise = c.tests.length > 0 && (now - lastTest) / DAY > 9;
  const pick = TESTS[dayIndex(now) % TESTS.length];

  return (
    <div className="view">
      <PillarHeader c={c} id="corps" now={now} />
      <MemoryNote c={c} id="corps" />

      {surprise && (
        <div className="alert">
          <span className="eyebrow">Contrôle surprise</span>
          <strong>{pick.name}. Maintenant.</strong>
          <p className="muted">Aucun test depuis {Math.floor((now - lastTest) / DAY)} jours. Pas d'échauffement de trois heures. Pas de « demain ».</p>
          <div><button className="btn danger" type="button" onClick={() => setTest(pick.id)}>Passer le test</button></div>
        </div>
      )}

      <SessionCard c={c} now={now} />
      <ProgrammeCard />

      <Card title="Tests étalons" aside="ce qui fait vraiment monter">
        <p className="muted small">La séance ralentit l'érosion. Seul un record fait grimper le pilier. Égaler ton record ne rapporte rien : ça te coûte deux assises.</p>
        <div className="tests">
          {TESTS.map((T) => {
            const all = c.tests.filter((t) => t.kind === T.id);
            const l = all[all.length - 1], b = bestOf(c, T.id);
            const sg = (v: number) => (T.id === "souplesse" && v > 0 ? "+" : "") + v;
            return (
              <div className="test" key={T.id}>
                <span className="tn">{T.name}</span>
                <span className="tv num">{l ? `${sg(l.value)} ${T.unit}` : "—"}</span>
                <span className="tb num">{b !== null ? `record ${sg(b)} · ${fdate(l.ts)}` : "jamais passé"}</span>
                <Sparkline values={all.map((t) => t.value)} color="var(--c-corps)" />
                <button className="btn small" type="button" onClick={() => setTest(T.id)}>Passer le test</button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Journal" aside={`${c.seances.length} ${plural(c.seances.length, "séance")}`}>
        <div className="list">
          {c.seances.length ? c.seances.slice(-8).reverse().map((s) => (
            <div className="li" key={s.ts}>
              <span className="main">{s.type}</span>
              <span className="side muted">{fdate(s.ts)}</span>
              <span className="sub">{s.timed ? `${s.dur} min · ${s.done}/${s.total} ${s.logs ? "séries" : "exercices"}` : "sans chrono"}{s.rpe ? ` · effort ${s.rpe}/10` : ""}{s.note ? ` · « ${s.note} »` : ""}</span>
            </div>
          )) : <p className="muted">Aucune séance. Le pilier attend.</p>}
        </div>
      </Card>

      <TestSheet kind={test} onClose={() => setTest(null)} />
    </div>
  );
}

function ProgrammeCard() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const [open, setOpen] = useState(false);
  const [demande, setDemande] = useState("");
  const [busy, setBusy] = useState(false);
  const prog = c.plans.programme ?? fallbackProgramme();
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
  const regen = async () => {
    setBusy(true);
    const r = await genProgramme(demande.trim());
    setBusy(false);
    if (r) { act((d) => { d.plans.programme = { ts: Date.now(), ...r }; if (d.seanceStart === null) d.plans.seance = null; }); setOpen(false); setDemande(""); toast("Programme refait."); }
  };
  return (
    <Card title="Programme" aside={c.plans.programme ? `depuis le ${fdate(c.plans.programme.ts)}` : "de base"}>
      <p className="h-display" style={{ fontSize: 24 }}>{prog.titre}</p>
      <p className="muted small">{prog.logique}</p>
      <div className="week">{prog.semaine.map((s, i) => <span key={i} className={s.jour.toLowerCase() === today ? "today" : ""}><b>{s.jour.slice(0, 3)}</b>{s.focus}</span>)}</div>
      <p className="small"><b>Progression.</b> <span className="muted">{prog.progression}</span></p>
      {open ? (
        <>
          <label className="f" htmlFor="pg-ask">Ce qui doit changer
            <textarea id="pg-ask" style={{ minHeight: 70 }} value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Ex. : je ne peux m'entraîner que le soir, 3 fois ; je veux plus de tractions ; douleur au genou" />
          </label>
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void regen()}>Refaire le programme</button>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annuler</button>
          </div>
          {busy && <Thinking>Le Contremaître revoit ton programme</Thinking>}
        </>
      ) : (
        <div><button className="btn small" type="button" onClick={() => setOpen(true)}>{c.plans.programme ? "Ajuster le programme" : "Construire mon programme"}</button></div>
      )}
    </Card>
  );
}
