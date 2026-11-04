/*
 * Contenus de secours, sans IA : pour la démo et quand le Contremaître ne répond pas (réseau, quota).
 * Construits à partir des contenus statiques de src/content/.
 */
import { LADDER } from "@/content/capital";
import { TOPICS } from "@/content/esprit";
import { SUBJECTS } from "@/content/verbe";
import { dayIndex, dayKey } from "@/lib/format";
import { todaySeance } from "./scoring";
import type { Chantier, Exo, Profile, Programme, Roadmap, SeancePlan, SubjectAI, TopicProposal } from "./types";

/** Convertit une dose écrite (« 4 × 12 », « 3 × 30 s / côté », « 3 min ») en exercice structuré. */
export function parseDose(nom: string, dose: string): Exo {
  const m = dose.match(/(\d+)\s*×\s*(\d+|max)\s*(s)?/i);
  if (m) {
    const series = +m[1];
    const max = m[2].toLowerCase() === "max";
    return { nom, type: m[3] ? "duree" : "reps", series, cible: max ? 8 : +m[2], charge: max ? "au maximum" : "", repos: m[3] ? 45 : 75, consigne: /côté|jambe/.test(dose) ? dose.split("/").slice(1).join("/").trim() : "", alternative: "" };
  }
  const min = dose.match(/(\d+)\s*min/);
  return { nom, type: "duree", series: 1, cible: min ? +min[1] * 60 : 60, charge: "", repos: 0, consigne: "", alternative: "" };
}

export function fallbackSeance(c: Chantier, now: number): SeancePlan {
  const S = todaySeance(c, now);
  return {
    date: dayKey(now), titre: S.title, focus: S.focus, duree: 40, pourquoi: "Séance de secours, sans le Contremaître : doses calculées sur tes records.",
    echauffement: "5 minutes : rotations articulaires, 20 jumping jacks, 10 squats lents, 10 pompes faciles.",
    exos: S.ex.map(([n, d]) => parseDose(n, d)), retourAuCalme: "3 minutes d'étirements doux et de respiration lente.", ajustement: "",
  };
}

export const fallbackProgramme = (): Programme => ({
  ts: 0, titre: "Rotation de base", logique: "Six séances en rotation : poussée, jambes, tirage, cardio, explosivité, souplesse.",
  semaine: [{ jour: "lundi", focus: "Poussée" }, { jour: "mardi", focus: "Jambes" }, { jour: "jeudi", focus: "Tirage et gainage" }, { jour: "vendredi", focus: "Cardio et mobilité" }],
  progression: "Une répétition de plus par série chaque semaine tant que l'effort reste sous 8/10.",
});

export const ladderRoadmap = (index = 0): Roadmap => ({
  ts: 0, vision: "Échelle de départ, la même pour tous : du premier euro gagné seul à la délégation.",
  paliers: LADDER.map((L) => ({ titre: L.title, pourquoi: L.detail, preuve: "Photo du paiement ou de l'échange", cash: L.cash, jours: 14 })), index,
});

export function fallbackProposals(c: Chantier, now: number): TopicProposal[] {
  const done = new Set(c.esprit.map((e) => e.topic));
  const free = TOPICS.filter((t) => !done.has(t.title));
  const pool = free.length >= 3 ? free : TOPICS;
  const k = dayIndex(now);
  return [0, 1, 2].map((i) => pool[(k * 3 + i * 7) % pool.length]).map((t) => ({ titre: t.title, domaine: t.domain, angle: "", difficulte: 2 }));
}

export function fallbackSubjects(c: Chantier, now: number): SubjectAI[] {
  const k = dayIndex(now) + c.skips;
  return [0, 1, 2].map((i) => SUBJECTS[(k + i * 5) % SUBJECTS.length]).map((s) => ({ texte: s.text, type: s.kind, pourquoi: "" }));
}

export const demoProfile = (): Profile => ({
  prenom: "Démo",
  corps: { objectifs: ["masse", "force"], niveau: "intermediaire", age: 20, poids: 75, taille: 180, materiel: ["Barre de traction", "Élastiques"], seancesParSemaine: 4, minutes: 45, contraintes: "", activites: "Course le dimanche" },
  capital: { situation: "Étudiant en école d'ingénieurs, en alternance", competences: "Python, analyse de données, maths, montage de PC", ressources: "Un ordinateur portable, le réseau de l'école", heuresParSemaine: 6, budget: 50, risque: "moyen", interets: "Tech, finance, sport", objectif: "Un revenu indépendant qui dépasse le salaire", dejaFait: "Revendu des vêtements", refus: "Pas de vente à domicile" },
  esprit: { domaines: ["Géopolitique", "Économie", "Histoire"], niveau: "debutant", pourquoi: "Avoir des avis argumentés" },
  verbe: { contexte: "Soutenances de projet, entretiens", objectif: "Parler sans « euh », avec une structure claire" },
  updated: 1,
});
