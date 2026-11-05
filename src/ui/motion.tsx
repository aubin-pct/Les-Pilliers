/* Mouvement : nombres qui roulent, tampon de gain, ciel du moment. Tout respecte « réduire les animations ». */
import { useEffect, useRef, useState } from "react";
import { PILLAR } from "@/content/pillars";
import { f1 } from "@/lib/format";
import { useUI } from "@/store/ui";

export const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Valeur qui roule jusqu'à sa cible (ease-out, 700 ms). */
export function useRolling(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduceMotion() || Math.abs(from.current - target) < 0.01) { from.current = target; setV(target); return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      const x = a + (target - a) * e;
      from.current = x; setV(x);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Tampon plein écran : « +6,2 » dans la couleur du pilier quand on gagne, secousse rouge quand on perd. */
export function Stamp() {
  const s = useUI((x) => x.stampData);
  const [key, setKey] = useState(0);
  const [shown, setShown] = useState<typeof s>(null);
  useEffect(() => {
    if (!s) return;
    setShown(s); setKey((k) => k + 1);
    const t = setTimeout(() => setShown(null), 1500);
    return () => clearTimeout(t);
  }, [s]);
  if (!shown) return null;
  const P = PILLAR[shown.pillar];
  const neg = shown.value < 0;
  return (
    <div key={key} className={"stamp" + (neg ? " neg" : "")} style={{ ["--sc" as string]: neg ? "var(--blood)" : P.color }} role="status" aria-live="polite">
      <span className="stamp-n num">{neg ? "−" : "+"}{f1(Math.abs(shown.value))}</span>
      <span className="stamp-l">{neg ? "assises perdues" : "assises"} · {P.name}</span>
      {shown.caption && <span className="stamp-c">{shown.caption}</span>}
    </div>
  );
}

/** Moment du jour pour le ciel du Temple. */
export function skyPhase(h: number): "nuit" | "aube" | "jour" | "crepuscule" {
  if (h < 6 || h >= 22) return "nuit";
  if (h < 9) return "aube";
  if (h < 18) return "jour";
  return "crepuscule";
}
