/* Mesures de la Tribune : texte (transcription) et voix (niveau sonore échantillonné toutes les 50 ms). */
import { TICS } from "@/content/verbe";
import { wc, wordsOf } from "@/lib/format";

export interface TextMetrics {
  words: number;
  wpm: number | null;
  tpm: number;
  tics: Record<string, number>;
  ttr: number | null;
  sentences: number;
  longest: number;
}

const ticRe = (t: string) =>
  t === "quoi" ? /\bquoi\s*[,.!?;]/g : new RegExp("(^|[\\s,.;!?'])" + t.replace(/ /g, "\\s+") + "(?=[\\s,.;!?]|$)", "g");

export function analyzeText(text: string, secs: number): TextMetrics {
  const lower = " " + text.toLowerCase().replace(/[’]/g, "'") + " ";
  const words = wordsOf(text);
  const n = words.length;
  const tics: Record<string, number> = {};
  let count = 0;
  TICS.forEach((t) => {
    const m = lower.match(ticRe(t));
    if (m?.length) { tics[t] = m.length; count += m.length; }
  });
  const uniq = new Set(words).size;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const mins = Math.max(secs, 10) / 60;
  return {
    words: n,
    wpm: n ? Math.round(n / mins) : null,
    tpm: n ? +(count / mins).toFixed(1) : 0,
    tics,
    ttr: n ? +(uniq / n).toFixed(2) : null,
    sentences: sentences.length,
    longest: sentences.reduce((a, s) => Math.max(a, wc(s)), 0),
  };
}

/** Découpe une transcription en morceaux, en marquant les tics (pour l'affichage). */
export function splitTics(text: string): { t: string; tic: boolean }[] {
  const alts = TICS.slice().sort((a, b) => b.length - a.length).map((t) => t.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp("(^|[\\s,.;!?'])(" + alts + ")(?=[\\s,.;!?]|$)", "gi");
  const out: { t: string; tic: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push({ t: text.slice(last, start), tic: false });
    out.push({ t: m[2], tic: true });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), tic: false });
  return out;
}

export const FRAME = 0.05;

export interface AudioMetrics {
  /** Secondes de voix active. */
  speak: number;
  /** Blancs d'au moins 0,8 s entre deux paroles. */
  pauses: number;
  longest: number;
  /** Part de voix entre la première et la dernière parole. */
  ratio: number;
  env: number[];
}

/**
 * Seuil de voix adaptatif (p10 + 18 % de l'écart p10–p90, plancher 0,006), micro-coupures
 * de moins de 0,2 s comblées, silences de début et de fin ignorés.
 */
export function analyzeAudio(rms: number[]): AudioMetrics | null {
  if (!rms || rms.length < 20) return null;
  const s = rms.slice().sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const p10 = q(0.1), p90 = q(0.9);
  const thr = Math.max(0.006, p10 + (p90 - p10) * 0.18);
  const v = rms.map((x) => x > thr);
  for (let i = 1; i < v.length - 3; i++) if (!v[i] && v[i - 1] && (v[i + 1] || v[i + 2] || v[i + 3])) v[i] = true;
  const first = v.indexOf(true), last = v.lastIndexOf(true);
  if (first < 0) return { speak: 0, pauses: 0, longest: 0, ratio: 0, env: [] };
  const pauses: number[] = [];
  let run = 0, voiced = 0;
  for (let i = first; i <= last; i++) {
    if (v[i]) { voiced++; if (run * FRAME >= 0.8) pauses.push(run * FRAME); run = 0; } else run++;
  }
  const top = q(0.98) || 1, env: number[] = [], B = 72, per = rms.length / B;
  for (let b = 0; b < B; b++) {
    let m = 0;
    for (let i = Math.floor(b * per); i < Math.floor((b + 1) * per); i++) m = Math.max(m, rms[i] || 0);
    env.push(+Math.min(1, m / top).toFixed(2));
  }
  return { speak: voiced * FRAME, pauses: pauses.length, longest: pauses.length ? Math.max(...pauses) : 0, ratio: voiced / (last - first + 1), env };
}
