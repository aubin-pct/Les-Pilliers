/*
 * Le moteur : érosion, planchers, comptes à rendre, gains.
 * Toutes les fonctions qui modifient prennent le chantier en premier argument et le mutent
 * (le store les appelle dans un brouillon immer). `now` est toujours passé pour pouvoir tester.
 */
import { MISS_PENALTY, PILLAR, PILLAR_IDS, START_HEIGHT } from "@/content/pillars";
import { DAY, dayKey, f0, nextKey, startOfDay } from "@/lib/format";
import type { Chantier, GainResult, HistRow, PillarId } from "./types";

export function freshChantier(now: number): Chantier {
  const p = {} as Chantier["p"];
  PILLAR_IDS.forEach((id) => (p[id] = { s: START_HEIGHT, last: now }));
  return {
    v: 2, created: now, updatedAt: now, lastTick: now, lastDay: dayKey(now),
    p, days: {}, pending: [], excuses: [], seances: [], seanceStart: null, tests: [],
    missionLevel: 0, missions: [], missionLog: [], euros: 0, stake: null, stakesLost: 0, custom: null,
    concepts: [], esprit: [], orals: [], hist: [], wins: [], skips: 0, report: null,
    profile: null, plans: emptyPlans(), roadmap: null, missionSteps: null, concept: null,
    espritChoice: null, parcours: [], parcoursActif: null, memoire: {},
  };
}

export const emptyPlans = (): Chantier["plans"] => ({ programme: null, seance: null, espritProps: null, verbe: null });

/**
 * Complète un chantier chargé (sauvegarde, ancienne version) avec les champs manquants.
 * v1 → v2 : ajout du profil, des plans, de la feuille de route et de la mémoire ; rien n'est perdu.
 */
export function normalize(c: Partial<Chantier> | { v?: number }, now = Date.now()): Chantier {
  const f = freshChantier(now) as unknown as Record<string, unknown>;
  const out = { ...f, ...(c as object) } as unknown as Chantier;
  out.v = 2;
  out.plans = { ...emptyPlans(), ...(out.plans ?? {}) };
  out.memoire = out.memoire ?? {};
  PILLAR_IDS.forEach((id) => { if (!out.p[id]) out.p[id] = { s: START_HEIGHT, last: now }; });
  return out;
}

/** Érosion continue et exponentielle : chaque pilier perd `rate` de sa hauteur par jour. */
export function erode(c: Chantier, now: number) {
  const dt = (now - c.lastTick) / DAY;
  if (dt <= 0) return;
  PILLAR_IDS.forEach((id) => { c.p[id].s = Math.max(0, c.p[id].s * Math.exp(-PILLAR[id].rate * dt)); });
  c.lastTick = now;
}

export function snapshot(c: Chantier): Omit<HistRow, "d"> {
  return { corps: +c.p.corps.s.toFixed(2), capital: +c.p.capital.s.toFixed(2), esprit: +c.p.esprit.s.toFixed(2), verbe: +c.p.verbe.s.toFixed(2) };
}

/**
 * Passage des jours : pour chaque jour écoulé, un pilier sans plancher perd MISS_PENALTY et crée un compte à rendre.
 * Le jour de la signature ne compte pas. Une mise dont l'échéance est passée est perdue.
 */
export function rollover(c: Chantier, now: number) {
  const today = dayKey(now);
  const created = dayKey(c.created);
  let d = c.lastDay;
  let guard = 0;
  while (d < today && guard++ < 400) {
    const rec = c.days[d] ?? {};
    if (d !== created) {
      PILLAR_IDS.forEach((id) => {
        if (!rec[id]) { c.p[id].s *= 1 - MISS_PENALTY; c.pending.push({ date: d, pillar: id }); }
      });
    }
    c.hist.push({ d, ...snapshot(c) });
    d = nextKey(d);
  }
  if (c.hist.length > 730) c.hist = c.hist.slice(-730);
  if (c.pending.length > 8) c.pending = c.pending.slice(-8);
  c.lastDay = today;
  if (c.seanceStart && now - c.seanceStart > 6 * 3600e3) c.seanceStart = null;
  if (c.stake && now > c.stake.deadline) {
    c.stakesLost += c.stake.amount;
    c.excuses.push({
      ts: c.stake.deadline, date: dayKey(c.stake.deadline), pillar: "capital", text: "(aucune, échéance dépassée)", cat: "mise", ok: false,
      verdict: `Mise de ${f0(c.stake.amount)} € perdue. Tu avais promis la mission « ${c.stake.title} ». Tu ne l'as pas livrée.`,
    });
    c.p.capital.s *= 0.9;
    c.stake = null;
  }
}

export function tick(c: Chantier, now: number) { erode(c, now); rollover(c, now); }

export function markDay(c: Chantier, id: PillarId, ts: number) {
  const k = dayKey(ts);
  c.days[k] = c.days[k] ?? {};
  c.days[k][id] = true;
}

/**
 * Seul point d'entrée des gains et pertes. Les gains comptent moitié tant qu'il reste des comptes à rendre.
 * Pose le plancher du jour, sauf { floor: false }.
 */
export function gain(c: Chantier, id: PillarId, pts: number, ts: number, opts: { floor?: boolean } = {}): GainResult {
  const halved = c.pending.length > 0 && pts > 0;
  const real = halved ? pts / 2 : pts;
  c.p[id].s = Math.max(0, c.p[id].s + real);
  if (pts > 0) c.p[id].last = ts;
  if (opts.floor !== false) markDay(c, id, ts);
  return { real, halved };
}

export function win(c: Chantier, pillar: PillarId, text: string, ts: number) {
  c.wins.push({ ts, pillar, text });
  if (c.wins.length > 200) c.wins = c.wins.slice(-200);
}

/* ---------- Lectures ---------- */

export function doneToday(c: Chantier, id: PillarId, now: number) { return !!c.days[dayKey(now)]?.[id]; }

export function weekDelta(c: Chantier, id: PillarId): number | null {
  if (c.hist.length < 7) return null;
  return c.p[id].s - c.hist[c.hist.length - 7][id];
}

/** Jours complets (quatre planchers) d'affilée, aujourd'hui compris s'il est complet. */
export function streak(c: Chantier, now: number): number {
  const full = (k: string) => { const r = c.days[k]; return !!r && PILLAR_IDS.every((id) => r[id]); };
  let n = full(dayKey(now)) ? 1 : 0;
  const d = new Date(startOfDay(now));
  for (let i = 0; i < 800; i++) { d.setDate(d.getDate() - 1); if (full(dayKey(d.getTime()))) n++; else break; }
  return n;
}

export function totalHeight(c: Chantier) { return PILLAR_IDS.reduce((a, id) => a + c.p[id].s, 0); }

export function daysSinceStart(c: Chantier, now: number) { return Math.floor((startOfDay(now) - startOfDay(c.created)) / DAY) + 1; }
