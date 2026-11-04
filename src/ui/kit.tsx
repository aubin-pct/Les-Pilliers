/* Briques d'interface partagées. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PILLAR } from "@/content/pillars";
import { doneToday } from "@/engine/core";
import { splitTics } from "@/engine/analysis";
import type { Chantier, PillarId } from "@/engine/types";
import { DAY, f1, plural } from "@/lib/format";
import { togglePlay } from "@/lib/media";
import { openLayer } from "@/lib/layers";
import { useUI, toast } from "@/store/ui";

/** Horloge : re-rend le composant toutes les `ms`. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function Card({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={"card" + (className ? " " + className : "")}>
      {(title || aside) && <div className="card-head">{title && <h2>{title}</h2>}{aside && <span className="mono muted">{aside}</span>}</div>}
      {children}
    </section>
  );
}

export function Foreman({ who = "Le Contremaître", say, sub, tone, children, sayStyle }: { who?: ReactNode; say?: ReactNode; sub?: ReactNode; tone?: "good" | "bad"; children?: ReactNode; sayStyle?: React.CSSProperties }) {
  return (
    <div className={"foreman" + (tone ? " " + tone : "")}>
      <span className="who">{who}</span>
      {say !== undefined && <p className="say" style={sayStyle}>{say}</p>}
      {sub !== undefined && <p className="muted">{sub}</p>}
      {children}
    </div>
  );
}

export const Thinking = ({ children }: { children: ReactNode }) => <span className="thinking">{children}</span>;

export function PillarHeader({ c, id, now }: { c: Chantier; id: PillarId; now: number }) {
  const P = PILLAR[id], s = c.p[id].s, loss = s * P.rate;
  const since = Math.floor((now - c.p[id].last) / DAY);
  return (
    <>
      <div className="phead">
        <span className="rom" aria-hidden="true">{P.roman}</span>
        <div className="t"><span className="eyebrow">{P.sub}</span><h1>{P.name}</h1></div>
        <div className="score"><span className="k num">{f1(s)}</span><span className="l">assises</span></div>
      </div>
      <p className="erode">
        Érosion : −{f1(loss)} {plural(Math.floor(loss), "assise")}/jour · dernière preuve {since === 0 ? "aujourd'hui" : `il y a ${since} j`}
        {doneToday(c, id, now) ? "" : " · plancher NU"}
      </p>
    </>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 100 30" aria-hidden="true"><line x1="0" x2="100" y1="15" y2="15" stroke="var(--line)" /></svg>;
  const mn = Math.min(...values), mx = Math.max(...values), rg = mx - mn || 1;
  const x = (i: number) => 2 + (96 * i) / (values.length - 1), y = (v: number) => 26 - (22 * (v - mn)) / rg;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L98 30 L2 30 Z`} style={{ fill: color }} opacity={0.12} />
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Envelope({ env, color = "var(--c-verbe)" }: { env: number[]; color?: string }) {
  if (!env?.length) return null;
  const w = 100 / env.length;
  return (
    <svg className="env" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      {env.map((e, i) => <rect key={i} x={(i * w + w * 0.15).toFixed(2)} y={(20 - e * 19).toFixed(2)} width={(w * 0.7).toFixed(2)} height={Math.max(0.6, e * 38).toFixed(2)} style={{ fill: color }} opacity={e < 0.1 ? 0.35 : 0.85} />)}
    </svg>
  );
}

export function Transcript({ text }: { text: string }) {
  return <div className="transcript">{splitTics(text).map((p, i) => (p.tic ? <mark key={i} className="tic">{p.t}</mark> : <span key={i}>{p.t}</span>))}</div>;
}

export function PlayButton({ ts, label, className = "btn small" }: { ts: number; label: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { const err = await togglePlay(ts, setPlaying); if (err) toast(err); }}>
      {playing ? "■" : "▶"} {label}
    </button>
  );
}

/** Panneau du bas. Le retour Android le ferme (entrée d'historique dédiée). */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="sheet" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-card" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        <div style={{ display: "grid", gap: 14 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Toast() {
  const t = useUI((s) => s.toast);
  const hide = useUI((s) => s.hide);
  useEffect(() => { if (!t) return; const h = setTimeout(hide, 3600); return () => clearTimeout(h); }, [t, hide]);
  if (!t) return null;
  return <div className={"toast" + (t.kind ? " " + t.kind : "")} role="status" aria-live="polite">{t.msg}</div>;
}
