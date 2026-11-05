/*
 * La carte du savoir, en pseudo-3D : chaque domaine est une constellation, chaque sujet une étoile.
 * Acquis = étoile pleine (plus grande et plus vive selon la note), gravé = anneau de laiton, à réviser = anneau rouge,
 * à acquérir = cercle en pointillés. La carte tourne seule ; on la fait pivoter au doigt, on touche une étoile pour l'ouvrir.
 */
import { useEffect, useMemo, useRef } from "react";
import { DOMAINS, TOPICS } from "@/content/esprit";
import type { Chantier, EspritEntry } from "@/engine/types";
import { dayKey } from "@/lib/format";
import { reduceMotion } from "@/ui/motion";

export type NodeState = "todo" | "acquis" | "grave" | "due" | "today";
export interface KNode { id: string; titre: string; domaine: string; di: number; niveau: number; entry?: EspritEntry; state: NodeState; p: [number, number, number] }
export interface KDomain { nom: string; center: [number, number, number]; total: number; acquis: number; color: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const HUES = ["#8aa9c6", "#c9a54e", "#d08a5a", "#8db089", "#b48ac6", "#c6a08a", "#7fb7b0", "#c68a9b", "#a3b35f", "#9aa0d6"];

function fib(n: number, i: number): [number, number, number] {
  if (n === 1) return [0, 0, 1];
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), t = Math.PI * (3 - Math.sqrt(5)) * i;
  return [Math.cos(t) * r, y, Math.sin(t) * r];
}

/** Assemble la carte : carte générée par l'IA si elle existe, sinon domaines du profil et sujets de base ; plus tout ce qui a été traité. */
export function buildMap(c: Chantier, now: number): { nodes: KNode[]; domains: KDomain[] } {
  const src: { nom: string; sujets: { titre: string; niveau: number }[] }[] = c.knowledgeMap?.domaines.map((d) => ({ nom: d.nom, sujets: [...d.sujets] })) ?? (() => {
    const wanted = c.profile?.esprit.domaines.length ? c.profile.esprit.domaines : DOMAINS.map((d) => d[0].toUpperCase() + d.slice(1));
    return wanted.map((nom) => ({ nom, sujets: TOPICS.filter((t) => norm(t.domain) === norm(nom)).map((t) => ({ titre: t.title, niveau: 1 })) }));
  })();
  const p = c.parcours.find((x) => x.id === c.parcoursActif);
  if (p && !src.some((d) => norm(d.nom) === norm(p.theme))) src.push({ nom: p.theme, sujets: p.sujets.map((s, i) => ({ titre: s.titre, niveau: 1 + Math.floor((i / p.sujets.length) * 3) })) });
  const known = new Set(src.flatMap((d) => d.sujets.map((s) => norm(s.titre))));
  for (const e of c.esprit) {
    if (known.has(norm(e.topic))) continue;
    known.add(norm(e.topic));
    let d = src.find((x) => e.domaine && norm(x.nom) === norm(e.domaine));
    if (!d) { d = src.find((x) => x.nom === "Hors carte") ?? (src.push({ nom: "Hors carte", sujets: [] }), src[src.length - 1]); }
    d.sujets.push({ titre: e.topic, niveau: 1 });
  }
  const doms = src.filter((d) => d.sujets.length);
  const byTopic = new Map<string, EspritEntry>();
  c.esprit.forEach((e) => byTopic.set(norm(e.topic), e));
  const today = c.espritChoice?.date === dayKey(now) ? norm(c.espritChoice.titre) : "";
  const nodes: KNode[] = [];
  const domains: KDomain[] = doms.map((d, di) => {
    const ctr = fib(doms.length, di);
    const k = doms.length === 1 ? 0 : 1, rad = doms.length === 1 ? 0.95 : doms.length < 4 ? 0.5 : 0.36;
    const center: [number, number, number] = [ctr[0] * k, ctr[1] * k, ctr[2] * k];
    let acq = 0;
    d.sujets.forEach((s, i) => {
      const o = fib(d.sujets.length, i), e = byTopic.get(norm(s.titre));
      const state: NodeState = today === norm(s.titre) ? "today" : !e ? "todo" : e.stage < 3 && e.next <= now ? "due" : e.stage >= 3 ? "grave" : "acquis";
      if (e) acq++;
      const r = rad * (1.05 - s.niveau * 0.12);
      nodes.push({ id: `${di}-${i}`, titre: s.titre, domaine: d.nom, di, niveau: s.niveau, entry: e, state, p: [center[0] + o[0] * r, center[1] + o[1] * r, center[2] + o[2] * r] });
    });
    return { nom: d.nom, center, total: d.sujets.length, acquis: acq, color: HUES[di % HUES.length] };
  });
  return { nodes, domains };
}

interface View { yaw: number; pitch: number; vy: number; target: { yaw: number; pitch: number } | null }

export function KnowledgeMap({ c, now, focus, onPick }: { c: Chantier; now: number; focus: number | null; onPick: (n: KNode) => void }) {
  const { nodes, domains } = useMemo(() => buildMap(c, now), [c, now]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ yaw: 0.4, pitch: 0.32, vy: 0, target: null });
  const proj = useRef<{ n: KNode; x: number; y: number; r: number }[]>([]);
  const pick = useRef(onPick); pick.current = onPick;

  // Amène le domaine choisi face à soi.
  useEffect(() => {
    if (focus === null || !domains[focus]) { view.current.target = null; return; }
    const [x, y, z] = domains[focus].center;
    if (x === 0 && z === 0 && y === 0) return;
    const yaw = Math.atan2(-x, z), pitch = Math.max(-1.1, Math.min(1.1, Math.atan2(y, Math.hypot(x, z))));
    const cur = view.current.yaw, d = ((yaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    view.current.target = { yaw: cur + d, pitch };
  }, [focus, domains]);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const col = { acc: css.getPropertyValue("--c-esprit").trim() || "#8aa9c6", brass: css.getPropertyValue("--brass").trim() || "#c9a54e", blood: css.getPropertyValue("--blood").trim() || "#d8493d", fg: css.getPropertyValue("--fg").trim() || "#ebe6dc", muted: css.getPropertyValue("--muted").trim() || "#8f939a" };
    const still = reduceMotion();
    let raf = 0, last = performance.now(), W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const v = view.current;
      if (v.target) {
        v.yaw += (v.target.yaw - v.yaw) * Math.min(1, dt * 5); v.pitch += (v.target.pitch - v.pitch) * Math.min(1, dt * 5);
      } else if (!dragging) {
        v.yaw += (still ? 0 : 0.11) * dt + v.vy * dt; v.vy *= 0.94;
      }
      const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
      const rot = (p: [number, number, number]) => {
        const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
        return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp] as const;
      };
      const S = Math.min(W, H) * 0.42, D = 3.1;
      const P = (p: [number, number, number]) => { const [x, y, z] = rot(p); const k = D / (D - z); return { x: W / 2 + x * S * k, y: H / 2 - y * S * k, z, k }; };
      ctx.clearRect(0, 0, W, H);
      // Halo central.
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, S * 1.3);
      g.addColorStop(0, "rgba(138,169,198,.10)"); g.addColorStop(1, "rgba(138,169,198,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const dp = domains.map((d) => P(d.center));
      const np = nodes.map((n) => ({ n, ...P(n.p) }));
      const depth = (z: number) => Math.max(0.18, Math.min(1, 0.55 + z * 0.45));
      // Liens domaine → sujets.
      ctx.lineWidth = 0.7;
      for (const q of np) {
        const d = dp[q.n.di], dc = domains[q.n.di];
        ctx.strokeStyle = dc.color; ctx.globalAlpha = depth((q.z + d.z) / 2) * (q.n.entry ? 0.35 : 0.12);
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      np.sort((a, b) => a.z - b.z);
      proj.current = [];
      const pulse = 0.5 + 0.5 * Math.sin(t / 380);
      for (const q of np) {
        const n = q.n, a = depth(q.z), dc = domains[n.di].color;
        const base = (2.6 + (n.entry ? 2 + n.entry.note * 0.32 : 1.2)) * q.k;
        ctx.globalAlpha = a;
        if (n.state === "todo") {
          ctx.setLineDash([2, 2.5]); ctx.strokeStyle = dc; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(q.x, q.y, base, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        } else {
          const fill = n.state === "today" ? col.brass : dc;
          if (n.state !== "acquis" || (n.entry?.note ?? 0) >= 8) { ctx.shadowColor = fill; ctx.shadowBlur = 10 * a; }
          ctx.fillStyle = fill; ctx.globalAlpha = a * (n.state === "today" ? 1 : 0.45 + (n.entry?.note ?? 5) * 0.055);
          ctx.beginPath(); ctx.arc(q.x, q.y, base, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
          if (n.state === "grave" || n.state === "due") {
            ctx.globalAlpha = a * (n.state === "due" ? 0.5 + pulse * 0.5 : 0.9);
            ctx.strokeStyle = n.state === "due" ? col.blood : col.brass; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(q.x, q.y, base + 3, 0, Math.PI * 2); ctx.stroke();
          }
        }
        proj.current.push({ n, x: q.x, y: q.y, r: Math.max(12, base + 6) });
        if (q.z > 0.55 && (n.entry || n.state === "today") && W > 0) {
          ctx.globalAlpha = a * 0.85; ctx.fillStyle = col.fg; ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.textAlign = "left";
          const label = n.titre.length > 24 ? n.titre.slice(0, 23) + "…" : n.titre;
          ctx.fillText(label, q.x + base + 4, q.y + 3);
        }
      }
      // Noms des domaines.
      ctx.textAlign = "center"; ctx.font = "600 11px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
      domains.forEach((d, i) => {
        const q = dp[i]; if (domains.length > 1 && q.z < -0.35) return;
        ctx.globalAlpha = domains.length > 1 ? depth(q.z) : 0.6; ctx.fillStyle = d.color;
        ctx.fillText(d.nom.toUpperCase(), q.x, q.y - (domains.length > 1 ? 0 : S * 1.05));
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    let dragging = false, x0 = 0, y0 = 0, moved = 0, lx = 0, ly = 0;
    const down = (e: PointerEvent) => { dragging = true; moved = 0; x0 = lx = e.clientX; y0 = ly = e.clientY; view.current.target = null; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved = Math.max(moved, Math.hypot(e.clientX - x0, e.clientY - y0));
      view.current.yaw += dx * 0.008; view.current.vy = dx * 0.4;
      if (e.pointerType === "mouse") view.current.pitch = Math.max(-1.1, Math.min(1.1, view.current.pitch + dy * 0.006));
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return; dragging = false;
      if (moved > 7) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best: { n: KNode; d: number } | null = null;
      for (const q of proj.current) { const d = Math.hypot(q.x - x, q.y - y); if (d < q.r && (!best || d < best.d)) best = { n: q.n, d }; }
      if (best) pick.current(best.n);
    };
    cv.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", () => { dragging = false; });
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); cv.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [nodes, domains]);

  return <canvas ref={canvas} className="kcanvas" role="img" aria-label={`Carte du savoir : ${nodes.filter((n) => n.entry).length} sujets acquis sur ${nodes.length}`} />;
}
