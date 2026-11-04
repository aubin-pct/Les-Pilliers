/* Barème : ce que rapporte (ou coûte) chaque preuve. Toute modification se reporte dans l'écran « Les règles ». */
import { TESTS, SEANCES, type TestId } from "@/content/corps";
import { LADDER } from "@/content/capital";
import { REVIEW_STEPS } from "@/content/esprit";
import { DAY, dayIndex } from "@/lib/format";
import { gain, win } from "./core";
import type { Chantier, GainResult, Oral } from "./types";

export const POINTS = {
  seanceSansChrono: 1,
  missionAction: 1.5,
  conceptFactor: 0.6,
  missionBase: 12,
  customMission: 10,
  reviewOk: 4,
  reviewKo: -2,
  equalRecord: -2,
  firstTest: 8,
  oralBase: 3,
  oralBetter: 3,
  oralPace: 1,
  skipSubject: -1,
  stakePenalty: 0.1,
};

export function seanceGain(durMin: number, checked: number, total: number) {
  return 3 + Math.min(3, durMin / 15) + checked / total;
}

export function bestOf(c: Chantier, kind: TestId): number | null {
  const a = c.tests.filter((t) => t.kind === kind);
  return a.length ? Math.max(...a.map((t) => t.value)) : null;
}

export interface TestOutcome { g: GainResult; msg: string; record: boolean; first: boolean }

/** Seul un record fait monter. Égaler ou reculer coûte deux assises. */
export function applyTest(c: Chantier, kind: TestId, value: number, ts: number, counted: boolean): TestOutcome {
  const best = bestOf(c, kind);
  let pts: number, msg: string, record = false;
  if (best === null) { pts = POINTS.firstTest; msg = "Référence posée. C'est ton point zéro."; }
  else if (kind === "souplesse") {
    const diff = value - best;
    if (diff > 0) { pts = 6 + diff * 2; record = true; msg = `Record : +${diff} cm.`; }
    else { pts = POINTS.equalRecord; msg = diff === 0 ? "Pareil que ton record. Pareil, c'est déjà reculer." : `${diff} cm sous ton record. Tu as reculé.`; }
  } else {
    const impr = (value - best) / Math.max(1, best);
    if (impr > 0) { pts = Math.min(25, 6 + impr * 60); record = true; msg = `Record : +${Math.round(impr * 100)} %.`; }
    else { pts = POINTS.equalRecord; msg = impr === 0 ? "Égal à ton record. Égal, c'est déjà reculer." : `${Math.round(impr * 100)} % sous ton record. Tu as reculé.`; }
  }
  c.tests.push({ ts, kind, value, counted });
  const g = gain(c, "corps", pts, ts);
  const T = TESTS.find((t) => t.id === kind)!;
  if (record) win(c, "corps", `${T.name} : ${value} ${T.unit}`, ts);
  return { g, msg, record, first: best === null };
}

/** Séance du jour, doses adaptées aux records et à la hauteur du pilier. */
export function todaySeance(c: Chantier, now: number) {
  const S = SEANCES[dayIndex(now) % SEANCES.length];
  const pm = bestOf(c, "pompes") ?? 12, gm = bestOf(c, "gainage") ?? 40, sq = bestOf(c, "squats") ?? 30;
  const k = 1 + c.p.corps.s / 400;
  const map: Record<string, number> = {
    p: Math.max(5, Math.round(pm * 0.6 * k)), d: Math.max(6, Math.round(pm * 0.5 * k)),
    g: Math.max(20, Math.round((gm * 0.55 * k) / 5) * 5), s: Math.max(12, Math.round(sq * 0.55 * k)),
    e: Math.max(4, Math.round(pm * 0.35 * k)),
  };
  return { title: S.title, focus: S.focus, ex: S.ex.map(([n, d]) => [n, d.replace(/\{(\w)\}/g, (_, x: string) => String(map[x]))] as [string, string]) };
}

export function missionPoints(level: number, amount: number, custom: boolean) {
  return (custom ? POINTS.customMission : POINTS.missionBase * (level + 1)) + (amount > 0 ? 6 * Math.log2(1 + amount / 10) : 0);
}

export interface CurrentMission {
  title: string; detail: string; proof: string; cash: boolean; jours: number;
  /** Rang dans la feuille de route (0 = premier palier). */
  index: number; total: number;
  custom: boolean; done: boolean; fromRoadmap: boolean;
}

/** Mission en cours : palier de la feuille de route personnelle, sinon échelle de départ (`LADDER`). */
export function currentMission(c: Chantier): CurrentMission {
  if (c.custom) return { title: c.custom.titre, detail: c.custom.consigne, proof: c.custom.preuve, cash: true, jours: c.custom.jours, index: 0, total: 1, custom: true, done: false, fromRoadmap: false };
  if (c.roadmap) {
    const r = c.roadmap, done = r.index >= r.paliers.length;
    const P = r.paliers[Math.min(r.index, r.paliers.length - 1)];
    return { title: P.titre, detail: P.pourquoi, proof: P.preuve, cash: P.cash, jours: P.jours, index: r.index, total: r.paliers.length, custom: false, done, fromRoadmap: true };
  }
  const done = c.missionLevel >= LADDER.length;
  const L = LADDER[Math.min(c.missionLevel, LADDER.length - 1)];
  return { title: L.title, detail: L.detail, proof: "Ce que tu as fait + montant encaissé", cash: L.cash, jours: 14, index: c.missionLevel, total: LADDER.length, custom: false, done, fromRoadmap: false };
}

/** Passe au palier suivant après une livraison. */
export function advanceMission(c: Chantier) {
  if (c.custom) { c.custom = null; return; }
  if (c.roadmap) c.roadmap.index = Math.min(c.roadmap.paliers.length, c.roadmap.index + 1);
  else c.missionLevel = Math.min(LADDER.length, c.missionLevel + 1);
  c.missionSteps = null;
}

/** Séance planifiée : séries faites / prévues. */
export function setsRatio(logs: { faits: (number | null)[] }[]) {
  const total = logs.reduce((a, l) => a + l.faits.length, 0);
  const done = logs.reduce((a, l) => a + l.faits.filter((x) => x !== null && x > 0).length, 0);
  return { done, total };
}

/** Révision : réussie (≥ 6/10) → étape suivante ; ratée → retour demain. */
export function applyReview(c: Chantier, ts: number, note: number, now: number): GainResult {
  const e = c.esprit.find((x) => x.ts === ts);
  if (!e) return { real: 0, halved: false };
  if (note >= 6) {
    e.stage += 1;
    e.next = now + (REVIEW_STEPS[e.stage] ?? 60) * DAY;
    if (e.stage >= 3) win(c, "esprit", `Gravé : « ${e.topic} »`, now);
    return gain(c, "esprit", POINTS.reviewOk, now);
  }
  e.next = now + DAY;
  return gain(c, "esprit", POINTS.reviewKo, now);
}

export function avgOf(orals: Oral[], key: "h" | "wpm", n = 10): number | null {
  const o = orals.slice(-n).map((x) => x[key]).filter((v): v is number => typeof v === "number");
  return o.length ? o.reduce((a, b) => a + b, 0) / o.length : null;
}

export function oralPoints(prevAvgH: number | null, h: number, wpm: number | null) {
  return POINTS.oralBase + (prevAvgH !== null && h < prevAvgH ? POINTS.oralBetter : 0) + (wpm && wpm >= 120 && wpm <= 170 ? POINTS.oralPace : 0);
}
