/* Lectures dérivées du chantier : phrase du Contremaître, sujets du jour, rapport, dossier de preuves. */
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { TOPICS, DOMAINS } from "@/content/esprit";
import { SUBJECTS } from "@/content/verbe";
import { TESTS } from "@/content/corps";
import { CONCEPTS, LADDER } from "@/content/capital";
import { DAY, dayIndex, dayKey, f0, f1, fdate, fdateK, pad, plural, startOfDay } from "@/lib/format";
import { doneToday, snapshot, weekDelta } from "./core";
import { CAT_NAMES } from "./verdicts";
import type { Chantier, ExcuseCat, Oral, PillarId } from "./types";

export const hesit = (o: Pick<Oral, "tpm" | "ppm">) => (o.tpm || 0) + (o.ppm || 0);

export function foremanLine(c: Chantier, now: number): { say: string; sub: string } {
  const d = new Date(now), h = d.getHours();
  const left = PILLAR_IDS.filter((id) => !doneToday(c, id, now));
  const hoursLeft = Math.max(0, Math.floor((startOfDay(now) + DAY - now) / 3600e3));
  if (c.pending.length) return { say: "Tu me dois des explications.", sub: "Tant que tu n'as pas rendu de comptes, chaque pierre posée compte moitié." };
  if (h < 5) {
    if (!left.length) return { say: "Quatre pierres posées. Maintenant dors.", sub: "Un corps qui ne dort pas ne construit rien. Demain, on monte." };
    return { say: `Il est ${h} h ${pad(d.getMinutes())}.`, sub: `Si tu ne dors pas, pose tes pierres. Sinon, va dormir : le sommeil fait partie du chantier. Reste : ${left.map((id) => PILLAR[id].name).join(", ")}.` };
  }
  if (!left.length) return { say: "C'était le minimum.", sub: "Quatre planchers posés. Ne te félicite pas. Demain on monte." };
  const worst = left.map((id) => ({ id, loss: c.p[id].s * PILLAR[id].rate })).sort((a, b) => b.loss - a.loss)[0];
  if (h >= 21) return { say: `${hoursLeft + 1} h. ${left.length} ${plural(left.length, "pilier")} ${plural(left.length, "nu")}.`, sub: `Le ${PILLAR[worst.id].name} perd ${f1(worst.loss)} assises par jour à ne rien faire. Bouge.` };
  return { say: `${PILLAR[worst.id].name} : rien posé.`, sub: `Il perd ${f1(worst.loss)} assises par jour pendant que tu lis ça. Plancher : ${PILLAR[worst.id].floor}.` };
}

/** Sujet du jour : jamais traité, en tournant entre les domaines. */
export function todayTopic(c: Chantier, now: number) {
  const studied = new Set(c.esprit.map((e) => e.topic));
  const dom = DOMAINS[dayIndex(now) % DOMAINS.length];
  const free = TOPICS.filter((t) => !studied.has(t.title));
  const pool = free.filter((t) => t.domain === dom);
  const list = pool.length ? pool : free.length ? free : TOPICS;
  return list[dayIndex(now) % list.length];
}

export function todaySubject(c: Chantier, now: number) { return SUBJECTS[(dayIndex(now) + c.skips) % SUBJECTS.length]; }
export function todayConcept(now: number) { return CONCEPTS[dayIndex(now) % CONCEPTS.length]; }
export function dueRevisions(c: Chantier, now: number) { return c.esprit.filter((e) => e.stage < 3 && e.next <= now); }

export function pendingTitle(c: Chantier, now: number) {
  const p = c.pending[c.pending.length - 1];
  const when = p.date === dayKey(now - DAY) ? "Hier" : "Le " + fdateK(p.date);
  return `${when}, le pilier ${PILLAR[p.pillar].name} n'a reçu aucune pierre.`;
}

export function excuseStats(c: Chantier, now: number) {
  const by: Partial<Record<ExcuseCat, number>> = {};
  c.excuses.filter((e) => e.ts > now - 30 * DAY && !e.ok).forEach((e) => (by[e.cat] = (by[e.cat] ?? 0) + 1));
  return (Object.entries(by) as [ExcuseCat, number][]).sort((a, b) => b[1] - a[1]).map(([cat, n]) => ({ cat, name: CAT_NAMES[cat], n }));
}

export function weekData(c: Chantier, now: number) {
  const since = now - 7 * DAY;
  const variation = {} as Record<PillarId, number | null>;
  const missed = {} as Record<PillarId, number>;
  PILLAR_IDS.forEach((id) => { variation[id] = weekDelta(c, id); missed[id] = 0; });
  for (let i = 1; i <= 7; i++) {
    const k = dayKey(now - i * DAY);
    if (k <= dayKey(c.created)) break;
    const r = c.days[k] ?? {};
    PILLAR_IDS.forEach((id) => { if (!r[id]) missed[id]++; });
  }
  return {
    scores: snapshot(c), variation_7j: variation, jours_sans_plancher: missed,
    excuses: c.excuses.filter((e) => e.ts > since).map((e) => ({ pilier: PILLAR[e.pillar].name, excuse: e.text, recevable: e.ok })),
    seances: c.seances.filter((s) => s.ts > since).length,
    tests: c.tests.filter((t) => t.ts > since).map((t) => ({ test: t.kind, valeur: t.value })),
    euros_total_hors_salaire: c.euros, echelon_mission: Math.min(c.missionLevel + 1, LADDER.length), mise_en_cours: c.stake?.amount ?? 0,
    explications: c.esprit.filter((e) => e.ts > since).map((e) => ({ sujet: e.topic, note: e.note })),
    oraux: c.orals.filter((o) => o.ts > since).map((o) => ({ mots_min: o.wpm, tics_min: o.tpm, blancs_min: o.ppm })),
    victoires: c.wins.filter((w) => w.ts > since).map((w) => w.text),
  };
}

export function localReport(c: Chantier, now: number) {
  const w = weekData(c, now);
  const L: string[] = [];
  L.push("SEMAINE " + fdate(now - 7 * DAY).toUpperCase() + " → " + fdate(now).toUpperCase());
  PILLAR_IDS.forEach((id) => {
    const d = w.variation_7j[id], m = w.jours_sans_plancher[id];
    L.push(`${PILLAR[id].name.padEnd(8)} ${f1(w.scores[id]).padStart(6)}  ${d === null ? "   —  " : (d >= 0 ? "▲" : "▼") + f1(Math.abs(d)).padStart(5)}  ${m ? `${m} j ${plural(m, "nu")}` : "7/7"}`);
  });
  L.push("");
  const worst = PILLAR_IDS.slice().sort((a, b) => w.jours_sans_plancher[b] - w.jours_sans_plancher[a])[0];
  const rej = w.excuses.filter((e) => !e.recevable).length;
  L.push(`${w.excuses.length} ${plural(w.excuses.length, "excuse")} cette semaine. ${rej} ${plural(rej, "rejetée")}.`);
  if (w.jours_sans_plancher[worst]) L.push(`Ton point faible : ${PILLAR[worst].name}, ${w.jours_sans_plancher[worst]} ${plural(w.jours_sans_plancher[worst], "jour")} sans rien.`);
  L.push(`Argent gagné seul depuis le début : ${f0(w.euros_total_hors_salaire)} €.`);
  L.push("");
  L.push(`Demain : tu commences par le ${PILLAR[worst].name}. Avant le téléphone, avant le café.`);
  return L.join("\n");
}

export interface DossierRow { label: string; from: string; to: string; better: boolean | null }
export interface DossierGroup { pillar: PillarId; rows: DossierRow[]; empty?: string }

/** Dossier de preuves : premier relevé contre meilleur ou dernier, pilier par pilier. */
export function dossier(c: Chantier): DossierGroup[] {
  const corps: DossierRow[] = [];
  TESTS.forEach((T) => {
    const a = c.tests.filter((t) => t.kind === T.id);
    if (!a.length) return;
    const first = a[0].value, best = Math.max(...a.map((t) => t.value));
    const sg = (v: number) => (T.id === "souplesse" && v > 0 ? "+" : "") + v;
    corps.push({ label: T.name, from: sg(first), to: `${sg(best)} ${T.unit}`, better: best > first ? true : null });
  });
  const esprit: DossierRow[] = [];
  if (c.esprit.length >= 2) {
    const n = Math.min(5, Math.floor(c.esprit.length / 2));
    const a = c.esprit.slice(0, n).reduce((s, e) => s + e.note, 0) / n;
    const b = c.esprit.slice(-n).reduce((s, e) => s + e.note, 0) / n;
    esprit.push({ label: `Note moyenne (${n} premiers / ${n} derniers)`, from: f1(a), to: `${f1(b)}/10`, better: b > a ? true : b < a ? false : null });
  }
  esprit.push({ label: "Sujets gravés (3 révisions)", from: "0", to: String(c.esprit.filter((e) => e.stage >= 3).length), better: null });
  esprit.push({ label: "Sujets expliqués", from: "0", to: String(c.esprit.length), better: null });
  const verbe: DossierRow[] = [];
  if (c.orals.length >= 2) {
    const a = c.orals[0], b = c.orals[c.orals.length - 1];
    verbe.push({ label: "Hésitations / min (tics + blancs)", from: f1(hesit(a)), to: f1(hesit(b)), better: hesit(b) < hesit(a) ? true : hesit(b) > hesit(a) ? false : null });
    if (a.wpm && b.wpm) verbe.push({ label: "Mots / min", from: String(a.wpm), to: String(b.wpm), better: null });
  }
  return [
    { pillar: "corps", rows: corps, empty: corps.length ? undefined : "Aucun test passé." },
    { pillar: "capital", rows: [
      { label: "Gagné seul, hors salaire", from: "0 €", to: `${f0(c.euros)} €`, better: c.euros > 0 ? true : null },
      { label: "Échelon de l'échelle", from: "1", to: String(Math.min(c.missionLevel + 1, LADDER.length)), better: c.missionLevel > 0 ? true : null },
    ] },
    { pillar: "esprit", rows: esprit },
    { pillar: "verbe", rows: verbe, empty: verbe.length ? undefined : "Il faut deux oraux pour comparer." },
  ];
}
