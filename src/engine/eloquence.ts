/* Compétences d'éloquence (0-100) : mesurées sur chaque oral, moyennées sur les 6 derniers. */
import { SKILLS, DRILL, type DrillId } from "@/content/verbe";
import type { Chantier, EloSkill, Oral } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Scores mesurés localement ; la structure et l'impact viennent du Coach (IA). */
export function measuredSkills(o: Pick<Oral, "tpm" | "ppm" | "wpm" | "ttr" | "pitchVar" | "volVar" | "accuracy">): Partial<Record<EloSkill, number>> {
  const out: Partial<Record<EloSkill, number>> = {};
  const h = (o.tpm || 0) + (o.ppm || 0);
  if (o.wpm || o.ppm !== null) out.fluidite = clamp(100 - h * 8.5);
  if (o.wpm) out.rythme = clamp(100 - Math.max(0, Math.abs(o.wpm - 145) - 12) * 1.4 - Math.max(0, (o.ppm ?? 0) - 6) * 8);
  const v: number[] = [];
  if (typeof o.pitchVar === "number") v.push(Math.min(100, (o.pitchVar / 3.5) * 100));
  if (typeof o.volVar === "number") v.push(Math.min(100, (o.volVar / 6) * 100));
  if (typeof o.accuracy === "number") v.push(o.accuracy * 100);
  if (v.length) out.voix = clamp(v.reduce((a, b) => a + b, 0) / v.length);
  if (typeof o.ttr === "number") out.vocabulaire = clamp(((o.ttr - 0.38) / 0.32) * 100);
  return out;
}

/** Moyenne des 6 dernières mesures de chaque compétence. */
export function eloSkills(c: Chantier): Record<EloSkill, number | null> {
  const out = {} as Record<EloSkill, number | null>;
  for (const { id } of SKILLS) {
    const vals = c.orals.map((o) => o.skills?.[id]).filter((x): x is number => typeof x === "number").slice(-6);
    out[id] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  return out;
}

/** Exercice conseillé : celui qui travaille la compétence la plus faible (ou jamais mesurée), sans répéter le dernier. */
export function suggestDrill(c: Chantier): DrillId {
  const s = eloSkills(c);
  const last = c.orals[c.orals.length - 1]?.drill;
  const order = (Object.entries(s) as [EloSkill, number | null][]).sort((a, b) => (a[1] ?? -1) - (b[1] ?? -1));
  for (const [skill] of order) {
    const d = (Object.keys(DRILL) as DrillId[]).find((k) => DRILL[k].skill === skill && k !== last && k !== "redite" && k !== "libre");
    if (d) return d;
  }
  return "sans_filet";
}

/** Score global d'éloquence : moyenne des compétences mesurées. */
export function eloScore(c: Chantier): number | null {
  const v = Object.values(eloSkills(c)).filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/** Précision d'articulation : part des mots du texte cible retrouvés, dans l'ordre. */
export function accuracy(target: string, said: string): number {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z]+/g) ?? ([] as string[]);
  const t = norm(target), w = norm(said);
  if (!t.length) return 0;
  let i = 0, hit = 0;
  for (const word of w) { const k = t.indexOf(word, i); if (k >= 0 && k - i < 4) { hit++; i = k + 1; } }
  return Math.min(1, hit / t.length);
}

/** Variations de la voix : écart-type de la hauteur (demi-tons) et du volume (dB) sur les trames voisées. */
export function voiceVariation(rms: number[], pitch: (number | null)[]) {
  const voiced = rms.filter((r) => r > 0.01);
  const db = voiced.map((r) => 20 * Math.log10(r));
  const std = (a: number[]) => { if (a.length < 8) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  const f = pitch.filter((p): p is number => typeof p === "number" && p > 60 && p < 450);
  let pv: number | null = null;
  if (f.length >= 8) {
    const sorted = f.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    pv = std(f.map((x) => 12 * Math.log2(x / med)));
  }
  return { pitchVar: pv === null ? null : +pv.toFixed(2), volVar: std(db) === null ? null : +std(db)!.toFixed(2) };
}

/** Hauteur fondamentale par autocorrélation (Hz), ou null si non voisé. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length >> 1; // une trame sur deux échantillons : assez précis, deux fois moins de calcul
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i * 2] ** 2;
  if (Math.sqrt(rms / n) < 0.01) return null;
  const sr = sampleRate / 2, minLag = Math.floor(sr / 400), maxLag = Math.min(n - 1, Math.floor(sr / 70));
  let best = -1, bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += buf[i * 2] * buf[(i + lag) * 2];
    if (s > best) { best = s; bestLag = lag; }
  }
  let e = 0;
  for (let i = 0; i < n; i++) e += buf[i * 2] ** 2;
  return best / e > 0.3 && bestLag ? sr / bestLag : null;
}
