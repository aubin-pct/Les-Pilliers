/* Briques d'interface partagées. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { useRolling } from "./motion";
import { doneToday } from "@/engine/core";
import { splitTics } from "@/engine/analysis";
import type { Chantier, PillarId } from "@/engine/types";
import { DAY, f1 } from "@/lib/format";
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
      {(title || aside) && <div className="card-head">{title && <h2>{title}</h2>}{aside && <span className="card-aside">{aside}</span>}</div>}
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

/** En-tête « monument » d'un pilier : colonne miniature, nom gravé, hauteur qui roule, 30 jours de courbe, état du plancher. */
export function PillarHeader({ c, id, now }: { c: Chantier; id: PillarId; now: number }) {
  const P = PILLAR[id], s = c.p[id].s, loss = s * P.rate;
  const since = Math.floor((now - c.p[id].last) / DAY);
  const done = doneToday(c, id, now);
  const roll = useRolling(s);
  const series = [...c.hist.slice(-29).map((r) => r[id]), s];
  const top = Math.max(60, ...PILLAR_IDS.map((x) => c.p[x].s)) * 1.05;
  const fill = Math.max(0.04, Math.min(1, s / top));
  const W = 300, H = 46;
  const mn = Math.min(...series), mx = Math.max(...series), rg = mx - mn || 1;
  const pts = series.map((v, i) => [series.length === 1 ? W : (W * i) / (series.length - 1), H - 4 - ((H - 10) * (v - mn)) / rg]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const trend = series.length > 7 ? s - series[series.length - 8] : null;
  return (
    <header className="monument" style={{ ["--acc" as string]: P.color }}>
      <div className="m-col" aria-hidden="true"><span className="m-cap" /><span className="m-shaft" style={{ height: `${fill * 100}%` }} />{!done && <span className="m-crack" />}</div>
      <div className="m-body">
        <span className="eyebrow m-eyebrow">{P.roman} · {P.sub}</span>
        <h1 className="m-name">{P.name}</h1>
        <div className="m-chips">
          <span className={"m-chip " + (done ? "ok" : "ko")}>{done ? "Plancher posé" : "Plancher nu"}</span>
          <span className="m-chip">−{f1(loss)}/j</span>
          <span className="m-chip">{since === 0 ? "preuve aujourd'hui" : `sans preuve ${since} j`}</span>
        </div>
      </div>
      <div className="m-score">
        <span className="k num">{f1(roll)}</span>
        <span className="l">assises{trend !== null && <b className={trend >= 0 ? "up" : "down"}> {trend >= 0 ? "▲" : "▼"}{f1(Math.abs(trend))}</b>}</span>
      </div>
      {series.length > 1 && (
        <svg className="m-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: P.color }} stopOpacity=".35" /><stop offset="1" style={{ stopColor: P.color }} stopOpacity="0" /></linearGradient></defs>
          <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#g-${id})`} />
          <path d={d} fill="none" style={{ stroke: P.color }} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </header>
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

/** Panneau du bas : glisse vers le bas pour fermer ; le retour Android le ferme aussi (entrée d'historique dédiée). */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number; id: number } | null>(null);
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
  const onDown = (e: React.PointerEvent) => {
    const el = card.current; if (!el || el.scrollTop > 0) return;
    drag.current = { y0: e.clientY, dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    el.style.transition = "none";
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, el = card.current; if (!d || !el) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const onUp = () => {
    const d = drag.current, el = card.current; drag.current = null; if (!d || !el) return;
    el.style.transition = "";
    if (d.dy > 110) { el.style.transform = "translateY(100%)"; setTimeout(() => closeRef.current(), 180); }
    else el.style.transform = "";
  };
  return createPortal(
    <div className="sheet" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-card" ref={card} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}><div className="grab" /></div>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>{children}</div>
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
