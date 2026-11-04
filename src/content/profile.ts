/* Options du questionnaire de profil, et profil vide. */
import type { CorpsGoal, Level, Profile } from "@/engine/types";

export const GOALS: { id: CorpsGoal; label: string }[] = [
  { id: "masse", label: "Prendre du muscle" },
  { id: "force", label: "Gagner en force" },
  { id: "endurance", label: "Endurance et cardio" },
  { id: "seche", label: "Perdre du gras" },
  { id: "souplesse", label: "Souplesse et mobilité" },
  { id: "sante", label: "Santé, posture, énergie" },
];

export const LEVELS: { id: Level; label: string }[] = [
  { id: "debutant", label: "Débutant" },
  { id: "intermediaire", label: "Intermédiaire" },
  { id: "avance", label: "Avancé" },
];

export const EQUIPMENT = [
  "Aucun matériel", "Barre de traction", "Haltères", "Kettlebell", "Élastiques", "Banc", "Barre et disques",
  "Anneaux", "Corde à sauter", "Vélo ou home-trainer", "Salle de sport complète", "Piscine",
];

export const RISKS: { id: Profile["capital"]["risque"]; label: string }[] = [
  { id: "faible", label: "Prudent" },
  { id: "moyen", label: "Mesuré" },
  { id: "fort", label: "Joueur" },
];

/** Domaines proposés pour l'Esprit (l'utilisateur peut en ajouter d'autres). */
export const DOMAIN_CHOICES = [
  "Géopolitique", "Économie", "Histoire", "Finance et marchés", "Sciences", "Technologie et IA", "Philosophie",
  "Psychologie", "Stratégie d'entreprise", "Droit", "Art et littérature", "Énergie et climat", "Biologie et santé", "Mathématiques",
];

export function emptyProfile(): Profile {
  return {
    prenom: "",
    corps: { objectifs: [], niveau: "debutant", age: null, poids: null, taille: null, materiel: ["Aucun matériel"], seancesParSemaine: 4, minutes: 40, contraintes: "", activites: "" },
    capital: { situation: "", competences: "", ressources: "", heuresParSemaine: 5, budget: 50, risque: "moyen", interets: "", objectif: "", dejaFait: "", refus: "" },
    esprit: { domaines: [], niveau: "debutant", pourquoi: "" },
    verbe: { contexte: "", objectif: "" },
    updated: 0,
  };
}

/** Le profil a-t-il le minimum pour que l'IA travaille correctement ? */
export function profileGaps(p: Profile | null): string[] {
  if (!p) return ["corps", "capital", "esprit", "verbe"];
  const g: string[] = [];
  if (!p.corps.objectifs.length) g.push("corps");
  if (p.capital.competences.trim().length < 10) g.push("capital");
  if (!p.esprit.domaines.length) g.push("esprit");
  return g;
}
