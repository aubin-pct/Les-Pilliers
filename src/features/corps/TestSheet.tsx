/* Passage d'un test étalon : compteur au nez, chrono ou minuteur intégrés, puis verdict. */
import { useEffect, useRef, useState } from "react";
import { TESTS, type TestId } from "@/content/corps";
import { applyTest, bestOf, type TestOutcome } from "@/engine/scoring";
import { beep, buzz, keepAwake } from "@/lib/device";
import { num } from "@/lib/format";
import { useChantier, useStore } from "@/store";
import { gainToast, toast } from "@/store/ui";
import { Foreman, Sheet } from "@/ui/kit";
import { PushupCounter } from "./PushupCounter";

export function TestSheet({ kind, onClose }: { kind: TestId | null; onClose: () => void }) {
  return <Sheet open={kind !== null} onClose={onClose} label="Test étalon">{kind && <TestBody kind={kind} onClose={onClose} />}</Sheet>;
}

function TestBody({ kind, onClose }: { kind: TestId; onClose: () => void }) {
  const T = TESTS.find((t) => t.id === kind)!;
  const c = useChantier()!;
  const act = useStore((s) => s.act);
  const [best] = useState(() => bestOf(c, kind));
  const [value, setValue] = useState("");
  const [counted, setCounted] = useState(false);
  const [counter, setCounter] = useState(false);
  const [clock, setClock] = useState<number>(T.mode === "minuteur" ? T.timer! : 0);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<TestOutcome | null>(null);
  const raf = useRef(0);
  const sg = (v: number) => (kind === "souplesse" && v > 0 ? "+" : "") + v;

  useEffect(() => () => { cancelAnimationFrame(raf.current); }, []);
  useEffect(() => { if (!running) return; void keepAwake(true); return () => { void keepAwake(false); }; }, [running]);

  const startChrono = () => {
    if (running) {
      cancelAnimationFrame(raf.current); setRunning(false); setValue(String(clock)); setCounted(true); buzz(60); return;
    }
    const t0 = performance.now(); setRunning(true); buzz(40);
    const loop = (t: number) => { setClock(Math.floor((t - t0) / 1000)); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
  };
  const startTimer = () => {
    if (running) return;
    const end = performance.now() + T.timer! * 1000; setRunning(true); beep(660, 150);
    const loop = (t: number) => {
      const left = Math.ceil((end - t) / 1000);
      setClock(Math.max(0, left));
      if (left <= 0) { setRunning(false); setCounted(true); beep(990, 500); buzz([200, 100, 200]); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const save = () => {
    const v = num(value);
    if (!Number.isFinite(v)) { toast("Un chiffre. Le vrai."); return; }
    if (kind !== "souplesse" && v < 0) { toast("Un résultat ne peut pas être négatif."); return; }
    cancelAnimationFrame(raf.current); setRunning(false);
    const r = act((d) => applyTest(d, kind, Math.round(v), Date.now(), counted));
    gainToast("corps", r.g);
    setOut(r);
  };

  const beaten = T.mode === "chrono" && best !== null && clock > best;

  return (
    <>
      <span className="eyebrow">Test étalon</span>
      <h2 className="h-display" style={{ fontSize: 36 }}>{T.name}</h2>
      <p className="muted">
        {best !== null ? <>Ton record : <b className="num" style={{ color: "var(--fg)" }}>{sg(best)} {T.unit}</b>. Il faut le battre, pas l'approcher.</> : "Premier passage : il fixe ta référence."}
        {T.hint ? ` ${T.hint}.` : ""}
      </p>
      {out ? (
        <>
          <Foreman tone={out.record || out.first ? "good" : "bad"} say={out.msg} sayStyle={{ fontSize: 24 }}
            sub={out.record ? "Rangé dans le bocal à victoires." : out.first ? undefined : "Retravaille et repasse-le dans une semaine."} />
          <button className="btn block" type="button" onClick={onClose}>Fermer</button>
        </>
      ) : (
        <>
          {T.mode === "chrono" && (
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <div className={"clock num" + (running && !beaten ? " live" : "")} style={beaten ? { color: "var(--ok)" } : undefined}>{clock}</div>
              <button className={running ? "btn danger" : "btn primary"} type="button" onClick={startChrono}>{running ? "Je lâche" : value ? "Recommencer" : "Démarrer le chrono"}</button>
            </div>
          )}
          {T.mode === "minuteur" && (
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
              <div className={"clock num" + (running ? (clock <= 10 ? " over" : " live") : "")}>{clock}</div>
              <button className="btn primary" type="button" disabled={running} onClick={startTimer}>{counted ? "Relancer" : `Lancer ${T.timer} s`}</button>
            </div>
          )}
          {T.mode === "nez" && (
            <>
              <button className="btn primary block" type="button" onClick={() => setCounter(true)}>Compter au nez</button>
              <p className="muted small">Téléphone au sol sous ton visage : chaque fois que ton nez touche l'écran, une pompe est comptée. Pas de triche possible sur l'amplitude.</p>
            </>
          )}
          <label className="f" htmlFor="t-val">Résultat ({T.unit})
            <input id="t-val" type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder={best !== null ? String(best + 1) : ""} />
          </label>
          <button className="btn primary block" type="button" onClick={save}>Enregistrer</button>
        </>
      )}
      {counter && <PushupCounter onDone={(n) => { setCounter(false); if (n > 0) { setValue(String(n)); setCounted(true); toast(`${n} pompes comptées.`); } }} />}
    </>
  );
}
