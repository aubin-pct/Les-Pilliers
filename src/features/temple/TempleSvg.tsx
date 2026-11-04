/* Le Temple : quatre colonnes de pierre. Hauteur = assises, un tambour toutes les 10, fissures selon le temps sans preuve,
   poussière et contour rouge tant que le plancher du jour n'est pas posé. */
import { useEffect, useRef, useState } from "react";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { doneToday } from "@/engine/core";
import type { Chantier, PillarId } from "@/engine/types";
import { DAY, f1, mulberry32 } from "@/lib/format";

type Scores = Record<PillarId, number>;

function useAnimated(target: Scores): Scores {
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const key = PILLAR_IDS.map((id) => target[id].toFixed(2)).join("|");
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || PILLAR_IDS.every((id) => Math.abs(start[id] - target[id]) < 0.05)) { from.current = target; setCur(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
      const v = {} as Scores;
      PILLAR_IDS.forEach((id) => (v[id] = start[id] + (target[id] - start[id]) * e));
      from.current = v; setCur(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return cur;
}

export function TempleSvg({ c, now }: { c: Chantier; now: number }) {
  const target = {} as Scores;
  PILLAR_IDS.forEach((id) => (target[id] = c.p[id].s));
  const scores = useAnimated(target);
  const W = 360, H = 292, ground = 258, baseH = 10, capH = 20, top = 22;
  const maxShaft = ground - baseH - capH - top;
  const maxS = Math.max(60, ...PILLAR_IDS.map((id) => Math.max(c.p[id].s, scores[id]))) * 1.08;
  const u = maxShaft / maxS;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={"Les quatre piliers : " + PILLAR_IDS.map((id) => `${PILLAR[id].name} ${f1(c.p[id].s)} assises`).join(", ")}>
      <defs>
        <linearGradient id="shaft" x1="0" x2="1"><stop offset="0" stopColor="#b9b2a4" /><stop offset=".35" stopColor="#e6dfd0" /><stop offset=".7" stopColor="#cfc8b9" /><stop offset="1" stopColor="#9e978a" /></linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2e3238" /><stop offset="1" stopColor="#16181c" /></linearGradient>
      </defs>
      <rect x="6" y={ground} width={W - 12} height="12" fill="url(#ground)" />
      <rect x="0" y={ground + 12} width={W} height="8" fill="#1d2025" />
      <rect x="0" y={ground} width={W} height="1" fill="#3a3f46" />
      {PILLAR_IDS.map((id, i) => {
        const P = PILLAR[id], cx = 63 + i * 78, s = scores[id];
        const h = Math.max(3, s * u), yTop = ground - baseH - h;
        const done = doneToday(c, id, now);
        const rnd = mulberry32(97 + i * 13 + Math.floor(c.p[id].s / 10));
        const drumPx = 10 * u;
        const drums: number[] = [];
        if (drumPx >= 4) for (let y = ground - baseH - drumPx; y > yTop + 1; y -= drumPx) drums.push(y);
        const since = (now - c.p[id].last) / DAY;
        const nCr = h > 20 ? Math.min(7, Math.floor(since * 1.4) + (done ? 0 : 1)) : 0;
        const cracks = Array.from({ length: nCr }, () => {
          const left = rnd() < 0.5;
          let x = left ? cx - 19 : cx + 19, y = yTop + 6 + rnd() * (h - 14);
          let pts = `${x},${y.toFixed(1)}`;
          const segs = 3 + Math.floor(rnd() * 3);
          for (let k = 0; k < segs; k++) { x += (left ? 1 : -1) * (3 + rnd() * 5); y += (rnd() - 0.3) * 7; pts += ` ${x.toFixed(1)},${y.toFixed(1)}`; }
          return pts;
        });
        const dust = done ? [] : Array.from({ length: 4 }, () => ({ dx: (rnd() - 0.5) * 50, r: 0.8 + rnd() * 1.2, delay: (rnd() * 2.4).toFixed(2) }));
        return (
          <g key={id}>
            <rect x={cx - 26} y={ground - baseH} width="52" height={baseH} fill="#8e8779" />
            <rect x={cx - 26} y={ground - baseH} width="52" height="2" fill="#a59e90" />
            <rect x={cx - 19} y={yTop} width="38" height={h} fill="url(#shaft)" />
            {[-11, -4, 4, 11].map((dx) => <rect key={dx} x={cx + dx - 0.6} y={yTop} width="1.2" height={h} fill="#000" opacity=".13" />)}
            {drums.map((y) => <rect key={y} x={cx - 19} y={y.toFixed(1)} width="38" height="1" fill="#000" opacity=".28" />)}
            {cracks.map((pts, k) => <polyline key={k} points={pts} fill="none" stroke="#15171a" strokeWidth="1.1" strokeLinejoin="round" opacity=".85" />)}
            <path d={`M${cx - 19} ${yTop} L${cx - 24} ${yTop - 8} L${cx + 24} ${yTop - 8} L${cx + 19} ${yTop} Z`} fill="#cfc8b9" />
            <rect x={cx - 29} y={yTop - 18} width="58" height="10" fill="#e6dfd0" />
            <rect x={cx - 29} y={yTop - 10} width="58" height="2" fill="#000" opacity=".18" />
            <rect x={cx - 29} y={yTop - 18} width="58" height="2.5" style={{ fill: P.color }} />
            {!done && <rect className="crumble" x={cx - 29} y={yTop - 18} width="58" height="10" fill="none" style={{ stroke: "var(--blood)" }} strokeWidth="1.5" />}
            {dust.map((d, k) => <circle key={k} className="dust" cx={(cx + d.dx).toFixed(1)} cy={(yTop - 4).toFixed(1)} r={d.r.toFixed(1)} fill="#b9b2a4" style={{ animationDelay: `-${d.delay}s` }} />)}
            <text x={cx} y={ground - 2.2} textAnchor="middle" fontFamily="Big Shoulders Display, Impact, sans-serif" fontWeight="800" fontSize="8.5" fill="#4a463f" letterSpacing="1">{P.roman}</text>
          </g>
        );
      })}
    </svg>
  );
}
