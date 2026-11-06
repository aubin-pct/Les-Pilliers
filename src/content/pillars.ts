import type { PillarId } from "@/engine/types";

export interface PillarDef {
  id: PillarId;
  name: string;
  sub: string;
  roman: string;
  /** Érosion quotidienne, en fraction de la hauteur (0,025 = 2,5 % par jour). */
  rate: number;
  /** Variable CSS de la couleur du pilier. */
  color: string;
  /** Ce qui suffit à poser le plancher du jour. */
  floor: string;
}

export const PILLARS: PillarDef[] = [
  { id: "corps", name: "Corps", sub: "Physique", roman: "I", rate: 0.025, color: "var(--c-corps)", floor: "1 séance chronométrée ou 1 test" },
  { id: "capital", name: "Capital", sub: "Financier", roman: "II", rate: 0.012, color: "var(--c-capital)", floor: "1 action de mission ou 1 concept examiné" },
  { id: "esprit", name: "Esprit", sub: "Intellect", roman: "III", rate: 0.008, color: "var(--c-esprit)", floor: "1 explication ou 1 révision" },
  { id: "verbe", name: "Verbe", sub: "Éloquence", roman: "IV", rate: 0.018, color: "var(--c-verbe)", floor: "1 exercice d'éloquence" },
];

export const PILLAR_IDS: PillarId[] = PILLARS.map((p) => p.id);
export const PILLAR: Record<PillarId, PillarDef> = Object.fromEntries(PILLARS.map((p) => [p.id, p])) as Record<PillarId, PillarDef>;

/** Perte supplémentaire d'un pilier resté sans plancher à minuit. */
export const MISS_PENALTY = 0.04;
/** Hauteur de départ de chaque pilier. */
export const START_HEIGHT = 10;
