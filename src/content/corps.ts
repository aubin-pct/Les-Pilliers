export type TestId = "pompes" | "gainage" | "squats" | "souplesse";

export interface TestDef {
  id: TestId;
  name: string;
  unit: string;
  /** Mode de mesure intégré à l'appli. */
  mode: "nez" | "chrono" | "minuteur" | "saisie";
  timer?: number;
  hint?: string;
}

export const TESTS: TestDef[] = [
  { id: "pompes", name: "Pompes max", unit: "reps", mode: "nez" },
  { id: "gainage", name: "Gainage planche", unit: "s", mode: "chrono" },
  { id: "squats", name: "Squats en 60 s", unit: "reps", mode: "minuteur", timer: 60 },
  { id: "souplesse", name: "Doigts-sol", unit: "cm", mode: "saisie", hint: "+ = au-delà des orteils, − = au-dessus" },
];

/**
 * Séances en rotation. Les doses entre accolades s'adaptent aux records :
 * {p} pompes, {d} dips, {g} gainage (s), {s} squats.
 */
export interface SeanceDef { title: string; focus: string; ex: [string, string][] }

export const SEANCES: SeanceDef[] = [
  { title: "Poussée", focus: "pectoraux, épaules, triceps", ex: [["Pompes", "4 × {p}"], ["Dips sur chaise", "3 × {d}"], ["Pompes piquées", "3 × 8"], ["Gainage planche", "3 × {g} s"], ["Étirement pectoraux et épaules", "2 × 40 s"]] },
  { title: "Jambes", focus: "quadriceps, fessiers, mollets", ex: [["Squats", "4 × {s}"], ["Fentes alternées", "3 × 12 / jambe"], ["Chaise murale", "3 × {g} s"], ["Mollets debout", "3 × 25"], ["Étirement psoas et ischios", "2 × 45 s"]] },
  { title: "Tirage et gainage", focus: "dos, sangle abdominale", ex: [["Tractions ou rowing sous table", "4 × max"], ["Superman", "3 × 15"], ["Gainage latéral", "3 × 30 s / côté"], ["Hollow hold", "3 × 25 s"], ["Chien tête en bas", "2 × 45 s"]] },
  { title: "Cardio et mobilité", focus: "souffle, hanches, colonne", ex: [["Burpees", "5 × 10"], ["Mountain climbers", "4 × 30 s"], ["Posture du pigeon", "2 × 60 s / côté"], ["Fente basse", "2 × 45 s"], ["Rotations thoraciques", "2 × 10"]] },
  { title: "Explosivité", focus: "puissance, vitesse", ex: [["Squats sautés", "4 × 10"], ["Pompes explosives", "4 × {e}"], ["Fentes sautées", "3 × 8 / jambe"], ["Sprints sur place", "6 × 20 s"], ["Étirement quadriceps", "2 × 40 s / jambe"]] },
  { title: "Souplesse complète", focus: "chaîne postérieure, hanches, épaules", ex: [["Pince debout", "3 × 45 s"], ["Grand écart facial progressif", "3 × 45 s"], ["Pont", "3 × 20 s"], ["Ouverture d'épaules au mur", "2 × 45 s"], ["Respiration diaphragmatique", "3 min"]] },
];
