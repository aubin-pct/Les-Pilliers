import { useState } from "react";
import { CORE_TESTS, TESTS, type TestId } from "@/content/corps";
import { bestOf } from "@/engine/scoring";
import { fallbackProgramme } from "@/engine/fallbacks";
import { genProgramme } from "@/ai/contremaitre";
import { DAY, dayIndex, fdate, plural } from "@/lib/format";
import { useChantier, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Fold, PillarHeader, Sparkline, Thinking, useNow } from "@/ui/kit";
import { CoachHead } from "@/features/coach/CoachHead";
import { TestSheet } from "./TestSheet";
import { SessionCard } from "./SessionCard";

export function CorpsView() {
  const c = useChantier()!;
  const now = useNow(1000);
  const [test, setTest] = useState<TestId | null>(null);
  const lastTest = c.tests.length ? c.tests[c.tests.length - 1].ts : 0;
  const surprise = c.tests.length > 0 && (now - lastTest) / DAY > 9;
  const pick = CORE_TESTS[dayIndex(now) % CORE_TESTS.length];
  const shown = TESTS.filter((T) => !T.secondary || c.tests.some((t) => t.kind === T.id));
  const extra = TESTS.filter((T) => !shown.includes(T));
  const records = shown.filter((T) => bestOf(c, T.id) !== null).length;

  return (
    <div className="view">
      <PillarHeader c={c} id="corps" now={now} />
      <CoachHead scope="corps" />

      {surprise && (
        <button type="button" className="alert-row" onClick={() => setTest(pick.id)}>
          <b className="num">{Math.floor((now - lastTest) / DAY)} j</b><span>sans test. Contrôle surprise : {pick.name.toLowerCase()}</span><span className="go">Go ›</span>
        </button>
      )}

      <SessionCard c={c} now={now} />
      <WeekStrip />

      <Fold title="Tests étalons" aside={`${records}/${shown.length} records`}>
        <div className="tlist">
          {shown.map((T) => {
            const all = c.tests.filter((t) => t.kind === T.id);
            const l = all[all.length - 1], b = bestOf(c, T.id);
            const sg = (v: number) => (T.id === "souplesse" && v > 0 ? "+" : "") + v;
            return (
              <div className="trow" key={T.id}>
                <span className="tr-n">{T.name}<i>{l ? `${fdate(l.ts)}${b !== null && b !== l.value ? ` · record ${sg(b)}` : ""}` : "jamais passé"}</i></span>
                {all.length > 1 && <Sparkline values={all.map((t) => t.value)} color="var(--c-corps)" />}
                <b className="tr-v num">{l ? `${sg(l.value)}` : "—"}<small>{l ? T.unit : ""}</small></b>
                <button className="btn small" type="button" onClick={() => setTest(T.id)}>Tester</button>
              </div>
            );
          })}
        </div>
        {extra.length > 0 && <div className="chips">{extra.map((T) => <button key={T.id} type="button" className="chip" onClick={() => setTest(T.id)}>+ {T.name}</button>)}</div>}
      </Fold>

      <ProgrammeFold />
      <Fold title="Journal" aside={`${c.seances.length} ${plural(c.seances.length, "séance")}`}>
        <div className="list">
          {c.seances.length ? c.seances.slice(-8).reverse().map((s) => (
            <div className="li" key={s.ts}>
              <span className="main">{s.type}</span>
              <span className="side muted">{fdate(s.ts)}</span>
              <span className="sub">{s.timed ? `${s.dur} min · ${s.done}/${s.total} ${s.logs ? "séries" : "exercices"}` : "sans chrono"}{s.rpe ? ` · effort ${s.rpe}/10` : ""}{s.note ? ` · « ${s.note} »` : ""}</span>
            </div>
          )) : <p className="muted">Aucune séance.</p>}
        </div>
      </Fold>

      <TestSheet kind={test} onClose={() => setTest(null)} />
    </div>
  );
}

function WeekStrip() {
  const c = useChantier()!;
  const prog = c.plans.programme ?? fallbackProgramme();
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
  return <div className="week">{prog.semaine.map((s, i) => <span key={i} className={s.jour.toLowerCase() === today ? "today" : ""}><b>{s.jour.slice(0, 3)}</b>{s.focus}</span>)}</div>;
}

function ProgrammeFold() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const [open, setOpen] = useState(false);
  const [demande, setDemande] = useState("");
  const [busy, setBusy] = useState(false);
  const prog = c.plans.programme ?? fallbackProgramme();
  const regen = async () => {
    setBusy(true);
    const r = await genProgramme(demande.trim());
    setBusy(false);
    if (r) { act((d) => { d.plans.programme = { ts: Date.now(), ...r }; if (d.seanceStart === null) d.plans.seance = null; }); setOpen(false); setDemande(""); toast("Programme refait."); }
  };
  return (
    <Fold title={"Programme · " + prog.titre} aside={c.plans.programme ? fdate(c.plans.programme.ts) : "de base"}>
      <p className="muted small">{prog.logique}</p>
      <p className="small"><b>Progression.</b> <span className="muted">{prog.progression}</span></p>
      {open ? (
        <>
          <textarea id="pg-ask" aria-label="Ce qui doit changer" style={{ minHeight: 70 }} value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Ce qui doit changer. Ex. : 3 fois le soir ; plus de tractions" />
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={busy} onClick={() => void regen()}>Refaire</button>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annuler</button>
          </div>
          {busy && <Thinking>Il revoit ton programme</Thinking>}
        </>
      ) : (
        <div><button className="btn small" type="button" onClick={() => setOpen(true)}>{c.plans.programme ? "Ajuster" : "Construire mon programme"}</button></div>
      )}
    </Fold>
  );
}
