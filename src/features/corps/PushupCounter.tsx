/* Compteur de pompes au nez : téléphone au sol, chaque contact du nez avec l'écran compte une pompe. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { beep, buzz, keepAwake } from "@/lib/device";
import { openLayer } from "@/lib/layers";

export function PushupCounter({ onDone }: { onDone: (n: number) => void }) {
  const [n, setN] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [flash, setFlash] = useState(false);
  const last = useRef(0);
  const nRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    void keepAwake(true);
    beep(660, 120);
    const ts = [
      setTimeout(() => { setCountdown(2); beep(660, 120); }, 1000),
      setTimeout(() => { setCountdown(1); beep(660, 120); }, 2000),
      setTimeout(() => { setCountdown(0); beep(990, 250); }, 3000),
    ];
    // Retour Android : termine le comptage.
    const release = openLayer(() => doneRef.current(nRef.current));
    return () => {
      ts.forEach(clearTimeout);
      void keepAwake(false);
      release();
    };
  }, []);

  const hit = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || countdown > 0) return;
    const t = performance.now();
    if (t - last.current < 380) return;
    last.current = t;
    nRef.current += 1;
    setN(nRef.current);
    setFlash(true); setTimeout(() => setFlash(false), 150);
    buzz(20);
  };

  return createPortal(
    <div className="cv" onPointerDown={hit}>
      <div className="cv-top">
        <span className="eyebrow">Pompes · nez sur l'écran</span>
        <button className="btn small" type="button" onClick={() => onDone(nRef.current)}>Terminé</button>
      </div>
      <div className={"cv-n num" + (flash ? " flash" : "")}>{countdown > 0 ? countdown : n}</div>
      <p className="cv-hint">{countdown > 0 ? "Mets-toi en position." : "Touche avec le nez à chaque pompe."}</p>
    </div>,
    document.body,
  );
}
