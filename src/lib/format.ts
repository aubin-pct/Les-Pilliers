/* Dates en heure locale et formats français. Ne jamais utiliser toISOString() pour un jour : décalage autour de minuit. */

export const DAY = 864e5;

export const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function keyToTs(k: string): number {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
export function nextKey(k: string): string {
  const d = new Date(keyToTs(k));
  d.setDate(d.getDate() + 1);
  return dayKey(d.getTime());
}
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** Numéro du jour (stable d'un appel à l'autre dans la journée), pour faire tourner les contenus. */
export function dayIndex(ts: number): number {
  return Math.round(keyToTs(dayKey(ts)) / DAY);
}

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const f1 = (n: number) => nf1.format(n);
export const f0 = (n: number) => nf0.format(n);
export const fdate = (ts: number) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
export const fdateK = (k: string) => fdate(keyToTs(k));
export const plural = (n: number, s: string, p?: string) => (n > 1 ? p ?? s + "s" : s);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function fmtClock(s: number) { s = Math.ceil(s); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }
export function fmtDur(ms: number) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }

/** Accepte la virgule décimale ; NaN si invalide. */
export function num(v: string | number): number {
  const n = parseFloat(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

export function wordsOf(t: string): string[] {
  return String(t).toLowerCase().match(/[a-zàâäçéèêëîïôöùûüÿœæ'-]+/gi) ?? [];
}
export const wc = (t: string) => wordsOf(t).length;

/** Générateur pseudo-aléatoire à graine (démo reproductible, fissures stables). */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semaine ISO, « 2026-W45 ». */
export function weekKey(ts: number) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  const n = 1 + Math.round(((d.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(n).padStart(2, "0")}`;
}
