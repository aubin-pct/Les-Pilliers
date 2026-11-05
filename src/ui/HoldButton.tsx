/*
 * Bouton à maintenir : les engagements (signer, valider une séance, livrer une mission, engager une mise, tout effacer)
 * ne se font pas d'un tap distrait. La plaque se remplit pendant l'appui, vibre à chaque quart, et confirme au bout.
 * Clavier : maintenir Espace ou Entrée.
 */
import { useEffect, useRef, useState } from "react";
import { buzz } from "@/lib/device";

export function HoldButton({ label, onConfirm, ms = 900, tone = "primary", block, disabled, hint = "Maintiens" }: {
  label: string; onConfirm: () => void; ms?: number; tone?: "primary" | "danger"; block?: boolean; disabled?: boolean; hint?: string;
}) {
  const [p, setP] = useState(0);
  const [released, setReleased] = useState(false);
  const raf = useRef(0);
  const t0 = useRef(0);
  const ticks = useRef(0);
  const done = useRef(false);

  const stop = (early: boolean) => {
    cancelAnimationFrame(raf.current);
    if (early && !done.current && p > 0.05) { setReleased(true); setTimeout(() => setReleased(false), 1200); }
    if (!done.current) setP(0);
  };
  const start = () => {
    if (disabled) return;
    done.current = false; ticks.current = 0; t0.current = performance.now();
    const loop = (t: number) => {
      const k = Math.min(1, (t - t0.current) / ms);
      setP(k);
      const q = Math.floor(k * 4);
      if (q > ticks.current && q < 4) { ticks.current = q; buzz(10); }
      if (k >= 1) { done.current = true; buzz([30, 40, 80]); setTimeout(() => { setP(0); onConfirm(); }, 120); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <button type="button" disabled={disabled}
      className={`btn hold ${tone}${block ? " block" : ""}${p > 0 ? " holding" : ""}`}
      style={{ ["--p" as string]: p }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); start(); }}
      onPointerUp={() => stop(true)} onPointerCancel={() => stop(false)} onPointerLeave={() => stop(true)}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(true); }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label} (maintenir)`}>
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-label">{released ? "Tiens jusqu'au bout." : p > 0 ? `${hint}…` : label}</span>
      <svg className="hold-ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" /><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={`${40.8 * p} 40.8`} transform="rotate(-90 8 8)" /></svg>
    </button>
  );
}
