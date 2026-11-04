import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { snapshot } from "@/engine/core";
import { dossier, excuseStats } from "@/engine/insights";
import type { Chantier } from "@/engine/types";
import { dayKey, f0, fdate, fdateK } from "@/lib/format";
import { PlayButton } from "@/ui/kit";

export function HistChart({ c, now }: { c: Chantier; now: number }) {
  const h = [...c.hist.slice(-90), { d: dayKey(now), ...snapshot(c) }];
  if (h.length < 3) return <p className="muted">La courbe apparaîtra après trois jours de chantier.</p>;
  const W = 340, H = 150, L = 30, R = 8, T = 8, B = 20;
  const max = Math.max(20, ...h.flatMap((r) => PILLAR_IDS.map((id) => r[id])));
  const nice = Math.ceil(max / 20) * 20;
  const x = (i: number) => L + ((W - L - R) * i) / (h.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const ticks = [0, 1, 2, 3, 4].map((k) => (nice / 4) * k);
  return (
    <>
      <div className="scroll-x">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution des quatre piliers">
          {ticks.map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" /><text x={L - 6} y={y(v) + 3} textAnchor="end">{f0(v)}</text></g>
          ))}
          <text x={L} y={H - 4}>{fdateK(h[0].d)}</text>
          <text x={W - R} y={H - 4} textAnchor="end">auj.</text>
          {PILLAR_IDS.map((id) => (
            <g key={id}>
              <path d={h.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r[id]).toFixed(1)}`).join(" ")} fill="none" style={{ stroke: PILLAR[id].color }} strokeWidth="2" strokeLinejoin="round" />
              <circle cx={x(h.length - 1)} cy={y(h[h.length - 1][id])} r="3" style={{ fill: PILLAR[id].color }} />
            </g>
          ))}
        </svg>
      </div>
      <div className="keyrow">{PILLAR_IDS.map((id) => <span key={id} style={{ ["--k" as string]: PILLAR[id].color }}>{PILLAR[id].name}</span>)}</div>
    </>
  );
}

export function Dossier({ c }: { c: Chantier }) {
  const groups = dossier(c);
  const firstA = c.orals.find((o) => o.audio);
  const lastA = [...c.orals].reverse().find((o) => o.audio && o !== firstA);
  return (
    <>
      <div className="proof">
        <span className="h">Mesure</span><span className="h" style={{ textAlign: "right" }}>Départ</span><span /><span className="h" style={{ textAlign: "right" }}>Maintenant</span>
        {groups.map((g) => (
          <Group key={g.pillar} g={g} />
        ))}
      </div>
      {firstA && (
        <div className="btn-row">
          <PlayButton ts={firstA.ts} label={`Ta voix le ${fdate(firstA.ts)}`} />
          {lastA && <PlayButton ts={lastA.ts} label={`Ta voix le ${fdate(lastA.ts)}`} />}
        </div>
      )}
    </>
  );
}
function Group({ g }: { g: ReturnType<typeof dossier>[number] }) {
  const P = PILLAR[g.pillar];
  return (
    <>
      <span className="grp" style={{ color: P.color }}>{P.roman} · {P.name}</span>
      {g.empty && <span className="pn muted" style={{ gridColumn: "1/-1" }}>{g.empty}</span>}
      {g.rows.map((r) => (
        <Row key={r.label} {...r} />
      ))}
    </>
  );
}
function Row({ label, from, to, better }: { label: string; from: string; to: string; better: boolean | null }) {
  return (
    <>
      <span className="pn">{label}</span>
      <span className="a num">{from}</span>
      <span className="mono muted">→</span>
      <span className={"b num" + (better === true ? " up" : better === false ? " down" : "")}>{to}</span>
    </>
  );
}

export function ExcuseBars({ c, now }: { c: Chantier; now: number }) {
  const st = excuseStats(c, now);
  if (!st.length) return null;
  const max = Math.max(...st.map((s) => s.n));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {st.map((s) => (
        <div key={s.cat} style={{ display: "grid", gridTemplateColumns: "120px 1fr 24px", gap: 8, alignItems: "center", fontSize: 12.5 }}>
          <span className="muted">{s.name}</span>
          <span style={{ height: 8, background: "var(--blood)", opacity: 0.75, borderRadius: 2, width: `${((s.n / max) * 100).toFixed(0)}%` }} />
          <span className="mono num" style={{ textAlign: "right" }}>{s.n}</span>
        </div>
      ))}
    </div>
  );
}
