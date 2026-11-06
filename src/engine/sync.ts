/*
 * Fusion à trois voies de deux chantiers (Mac et téléphone) à partir de leur dernier état commun (`base`).
 *
 * Principe : chaque donnée a sa règle.
 *  - Journaux (séances, tests, missions, actions, excuses, oraux, sujets…) : union par identifiant ; si les deux
 *    appareils ont modifié la même entrée, la version locale gagne, sinon celle qui a changé.
 *  - Planchers du jour : union. Comptes à rendre : union, moins ceux qui ont reçu une excuse.
 *  - Hauteurs des piliers et compteurs (euros, mises perdues, sujets sautés) : les trois versions sont amenées
 *    au même instant (érosion + passage des jours), puis distant + (local − commun) : les gains des deux côtés s'ajoutent.
 *  - Le reste (profil, plans, feuille de route, mémoire…) : la version qui a changé ; si les deux ont changé,
 *    la plus récente quand on peut dater, sinon la locale.
 * Fonction pure : ne modifie aucun de ses arguments.
 */
import { PILLAR_IDS } from "@/content/pillars";
import { normalize, tick } from "./core";
import type { Chantier } from "./types";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Choix à trois voies d'une valeur quelconque. */
function pick<T>(base: T, local: T, remote: T, newer?: (l: T, r: T) => T): T {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  return newer ? newer(local, remote) : local;
}

/** Union de journaux identifiés par une clé, triée par `order`. */
function unionBy<T>(base: T[], local: T[], remote: T[], key: (x: T) => string, order: (x: T) => number | string, cap?: number): T[] {
  const b = new Map(base.map((x) => [key(x), x]));
  const out = new Map<string, T>();
  for (const x of remote) out.set(key(x), x);
  for (const x of local) {
    const k = key(x);
    const r = out.get(k);
    out.set(k, r === undefined ? x : pick(b.get(k) as T, x, r));
  }
  const arr = [...out.values()].sort((x, y) => { const a = order(x), c = order(y); return a < c ? -1 : a > c ? 1 : 0; });
  return cap ? arr.slice(-cap) : arr;
}

const ts = (x: { ts: number }) => x.ts;

export function mergeChantier(baseIn: Chantier, localIn: Chantier, remoteIn: Chantier, now: number): Chantier {
  // Les trois versions au même instant : l'érosion et les pénalités de minuit s'appliquent pareil partout.
  const [base, local, remote] = [baseIn, localIn, remoteIn].map((c) => { const x = normalize(clone(c), now); tick(x, now); return x; });
  const out = clone(local);

  out.created = Math.min(local.created, remote.created);
  out.updatedAt = Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0);
  out.lastDay = local.lastDay > remote.lastDay ? local.lastDay : remote.lastDay;
  out.lastTick = now;

  // Hauteurs : gains des deux côtés additionnés.
  for (const id of PILLAR_IDS) {
    out.p[id] = {
      s: Math.max(0, remote.p[id].s + (local.p[id].s - base.p[id].s)),
      last: Math.max(local.p[id].last, remote.p[id].last),
    };
  }
  out.euros = Math.max(0, remote.euros + (local.euros - base.euros));
  out.stakesLost = Math.max(0, remote.stakesLost + (local.stakesLost - base.stakesLost));
  out.skips = Math.max(0, remote.skips + (local.skips - base.skips));
  out.missionLevel = Math.max(local.missionLevel, remote.missionLevel);

  // Journaux.
  out.excuses = unionBy(base.excuses, local.excuses, remote.excuses, (x) => `${x.ts}|${x.pillar}|${x.date}`, ts, 500);
  out.seances = unionBy(base.seances, local.seances, remote.seances, (x) => String(x.ts), ts);
  out.tests = unionBy(base.tests, local.tests, remote.tests, (x) => `${x.ts}|${x.kind}`, ts);
  out.missions = unionBy(base.missions, local.missions, remote.missions, (x) => String(x.ts), ts);
  out.missionLog = unionBy(base.missionLog, local.missionLog, remote.missionLog, (x) => `${x.ts}|${x.text}`, ts, 400);
  out.concepts = unionBy(base.concepts, local.concepts, remote.concepts, (x) => String(x.ts), ts);
  out.esprit = unionBy(base.esprit, local.esprit, remote.esprit, (x) => String(x.ts), ts);
  out.orals = unionBy(base.orals, local.orals, remote.orals, (x) => String(x.ts), ts, 400);
  out.hist = unionBy(base.hist, local.hist, remote.hist, (x) => x.d, (x) => x.d, 730);
  out.wins = unionBy(base.wins, local.wins, remote.wins, (x) => `${x.ts}|${x.text}`, ts, 200);
  out.parcours = unionBy(base.parcours, local.parcours, remote.parcours, (x) => x.id, (x) => x.ts);

  // Planchers : un plancher posé sur un appareil est posé.
  out.days = clone(remote.days);
  for (const [k, v] of Object.entries(local.days)) out.days[k] = { ...(out.days[k] ?? {}), ...v };

  // Comptes à rendre : union, moins ceux qui ont reçu une excuse sur l'un ou l'autre appareil.
  const answered = new Set(out.excuses.map((e) => `${e.date}|${e.pillar}`));
  const pend = new Map<string, Chantier["pending"][number]>();
  for (const p of [...remote.pending, ...local.pending]) {
    const k = `${p.date}|${p.pillar}`;
    if (!answered.has(k)) pend.set(k, p);
  }
  out.pending = [...pend.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8);

  // Objets datés : le plus récent si les deux ont changé.
  out.profile = pick(base.profile, local.profile, remote.profile, (l, r) => ((l?.updated ?? 0) >= (r?.updated ?? 0) ? l : r));
  out.roadmap = pick(base.roadmap, local.roadmap, remote.roadmap, (l, r) => {
    if (l && r && l.ts === r.ts) return l.index >= r.index ? l : r;
    return (l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r;
  });
  out.plans = {
    programme: pick(base.plans.programme, local.plans.programme, remote.plans.programme, (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r)),
    seance: pick(base.plans.seance, local.plans.seance, remote.plans.seance, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r)),
    espritProps: pick(base.plans.espritProps, local.plans.espritProps, remote.plans.espritProps, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r)),
    verbe: pick(base.plans.verbe, local.plans.verbe, remote.plans.verbe, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r)),
  };
  out.memoire = {};
  for (const id of PILLAR_IDS) {
    const m = pick(base.memoire[id], local.memoire[id], remote.memoire[id], (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r));
    if (m) out.memoire[id] = m;
  }
  out.missionSteps = pick(base.missionSteps, local.missionSteps, remote.missionSteps, (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r));
  out.concept = pick(base.concept, local.concept, remote.concept, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r));
  out.espritChoice = pick(base.espritChoice, local.espritChoice, remote.espritChoice, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r));
  out.report = pick(base.report, local.report, remote.report, (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r));
  out.stake = pick(base.stake, local.stake, remote.stake);
  out.custom = pick(base.custom, local.custom, remote.custom);
  out.parcoursActif = pick(base.parcoursActif, local.parcoursActif, remote.parcoursActif);
  out.seanceStart = pick(base.seanceStart, local.seanceStart, remote.seanceStart);

  // v5 : conversations, brief, Capital v2, carte du savoir.
  out.chats = {}; out.chatReset = {};
  for (const k of ["temple", ...PILLAR_IDS] as const) {
    const cut = Math.max(local.chatReset?.[k] ?? 0, remote.chatReset?.[k] ?? 0);
    if (cut) out.chatReset[k] = cut;
    const m = unionBy(base.chats[k] ?? [], local.chats[k] ?? [], remote.chats[k] ?? [], (x) => `${x.ts}|${x.from}`, ts, 60).filter((x) => x.ts > cut);
    if (m.length) out.chats[k] = m;
  }
  out.brief = pick(base.brief, local.brief, remote.brief, (l, r) => ((l?.date ?? "") >= (r?.date ?? "") ? l : r));
  out.knowledgeMap = pick(base.knowledgeMap, local.knowledgeMap, remote.knowledgeMap, (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r));
  const bc = base.capital, lc = local.capital, rc = remote.capital;
  const longer = <T,>(l: T[], r: T[]) => (l.length >= r.length ? l : r);
  out.capital = {
    interview: pick(bc.interview, lc.interview, rc.interview, longer),
    ask: pick(bc.ask, lc.ask, rc.ask),
    diagDone: lc.diagDone || rc.diagDone,
    options: pick(bc.options, lc.options, rc.options),
    thesis: pick(bc.thesis, lc.thesis, rc.thesis, (l, r) => ((l?.ts ?? 0) >= (r?.ts ?? 0) ? l : r)),
    sprint: pick(bc.sprint, lc.sprint, rc.sprint, (l, r) => {
      if (!l || !r) return l ?? r;
      if (l.semaine !== r.semaine || l.objectif !== r.objectif) return l.semaine >= r.semaine ? l : r;
      // Même sprint modifié des deux côtés : on garde, pour chaque indicateur, le plus avancé.
      return { ...l, kpis: l.kpis.map((k) => ({ ...k, fait: Math.max(k.fait, r.kpis.find((x) => x.id === k.id)?.fait ?? 0) })) };
    }),
    prospects: unionBy(bc.prospects, lc.prospects, rc.prospects, (x) => x.id, ts).map((p) => {
      const l = lc.prospects.find((x) => x.id === p.id), r = rc.prospects.find((x) => x.id === p.id);
      return l && r ? (l.maj >= r.maj ? l : r) : p;
    }),
  };

  return out;
}

/** Nombre de preuves d'un chantier : sert à savoir si un appareil a déjà été utilisé. */
export const proofCount = (c: Chantier) =>
  c.seances.length + c.tests.length + c.missions.length + c.missionLog.length + c.concepts.length + c.esprit.length + c.orals.length;
