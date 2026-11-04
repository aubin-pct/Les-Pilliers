import { useEffect, useState } from "react";
import { TESTS, type TestId } from "@/content/corps";
import { gain } from "@/engine/core";
import { POINTS, bestOf, seanceGain, todaySeance } from "@/engine/scoring";
import { DAY, dayIndex, dayKey, fdate, fmtDur, plural } from "@/lib/format";
import { buzz, keepAwake } from "@/lib/device";
import { useChantier, useStore } from "@/store";
import { gainToast, toast, useDraft } from "@/store/ui";
import { Card, PillarHeader, Sparkline, useNow } from "@/ui/kit";
import { TestSheet } from "./TestSheet";

export function CorpsView() {
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const now = useNow(1000);
  const [test, setTest] = useState<TestId | null>(null);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [proof, setProof, clearProof] = useDraft("seance-proof");
  const S = todaySeance(c, now);
  const doneSeance = c.seances.some((s) => dayKey(s.ts) === dayKey(now));
  const lastTest = c.tests.length ? c.tests[c.tests.length - 1].ts : 0;
  const surprise = c.tests.length > 0 && (now - lastTest) / DAY > 9;
  const pick = TESTS[dayIndex(now) % TESTS.length];
  const running = c.seanceStart !== null;

  useEffect(() => { if (!running) return; void keepAwake(true); return () => { void keepAwake(false); }; }, [running]);

  const start = () => { act((d) => { d.seanceStart = Date.now(); }); setChecks([]); buzz(40); };
  const cancel = () => act((d) => { d.seanceStart = null; });
  const forgot = () => {
    const r = act((d) => {
      d.seances.push({ ts: Date.now(), type: S.title, dur: 0, done: 0, total: S.ex.length, proof: "", timed: false });
      return gain(d, "corps", POINTS.seanceSansChrono, Date.now());
    });
    gainToast("corps", r, "sans chrono, presque rien");
  };
  const validate = () => {
    const checked = checks.filter(Boolean).length;
    const dur = Math.round((Date.now() - (c.seanceStart ?? Date.now())) / 60000);
    if (dur < 5) { toast(`${dur} min de chrono. Cinq minimum.`); return; }
    if (checked < 3) { toast("Coche au moins trois exercices faits."); return; }
    if (proof.trim() === "") { toast("Pas de chiffre, pas de preuve."); return; }
    const r = act((d) => {
      d.seances.push({ ts: Date.now(), type: S.title, dur, done: checked, total: S.ex.length, proof: proof.trim(), timed: true });
      d.seanceStart = null;
      return gain(d, "corps", seanceGain(dur, checked, S.ex.length), Date.now());
    });
    clearProof(); gainToast("corps", r);
  };

  return (
    <div className="view">
      <PillarHeader c={c} id="corps" now={now} />

      {surprise && (
        <div className="alert">
          <span className="eyebrow">Contrôle surprise</span>
          <strong>{pick.name}. Maintenant.</strong>
          <p className="muted">Aucun test depuis {Math.floor((now - lastTest) / DAY)} jours. Pas d'échauffement de trois heures. Pas de « demain ».</p>
          <div><button className="btn danger" type="button" onClick={() => setTest(pick.id)}>Passer le test</button></div>
        </div>
      )}

      <Card title="Séance du jour" aside={<span className="tag">{S.title}</span>}>
        {doneSeance ? (
          <p><b style={{ color: "var(--ok)" }}>Posé.</b> <span className="muted">Séance validée. Un test te ferait monter plus vite que la routine.</span></p>
        ) : (
          <>
            <p className="muted small">{S.focus}</p>
            <div>
              {S.ex.map(([n, dose], i) => (
                <label className="ex" htmlFor={"ex-" + i} key={n}>
                  <input type="checkbox" id={"ex-" + i} disabled={!running} checked={!!checks[i]} onChange={(e) => { const x = [...checks]; x[i] = e.target.checked; setChecks(x); }} />
                  <span>{n}</span><span className="dose">{dose}</span>
                </label>
              ))}
            </div>
            {running ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
                  <div><span className="eyebrow">Chrono de séance</span><div className="elapsed">{fmtDur(now - c.seanceStart!)}</div></div>
                  <button className="linkish" type="button" onClick={cancel}>Abandonner</button>
                </div>
                <label className="f" htmlFor="se-proof">Ta dernière série (répétitions)
                  <input type="number" id="se-proof" inputMode="numeric" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Preuve" />
                </label>
                <button className="btn primary block" type="button" onClick={validate}>Valider la séance</button>
                <p className="muted small">Validation possible après 5 minutes de chrono, avec au moins trois exercices cochés.</p>
              </>
            ) : (
              <>
                <button className="btn primary block" type="button" onClick={start}>Démarrer la séance</button>
                <button className="linkish" type="button" onClick={forgot}>J'ai fait ma séance sans lancer le chrono</button>
              </>
            )}
          </>
        )}
      </Card>

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
          {c.seances.length ? c.seances.slice(-6).reverse().map((s) => (
            <div className="li" key={s.ts}>
              <span className="main">{s.type} · {s.done}/{s.total} exercices{s.timed ? "" : " · sans chrono"}</span>
              <span className="side muted">{s.timed ? `${s.dur} min · ` : ""}{fdate(s.ts)}</span>
            </div>
          )) : <p className="muted">Aucune séance. Le pilier attend.</p>}
        </div>
      </Card>

      <TestSheet kind={test} onClose={() => setTest(null)} />
    </div>
  );
}
