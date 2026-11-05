import type { TestId } from "@/content/corps";

export type PillarId = "corps" | "capital" | "esprit" | "verbe";
export type { TestId };

export interface PillarState {
  /** Hauteur, en assises. */
  s: number;
  /** Horodatage de la dernière preuve qui a fait monter le pilier. */
  last: number;
}

export interface Pending { date: string; pillar: PillarId }

export type ExcuseCat = "fatigue" | "temps" | "motivation" | "externe" | "sante" | "autre" | "mise";

export interface Excuse { ts: number; date: string; pillar: PillarId; text: string; cat: ExcuseCat; ok: boolean; verdict: string }

export interface Seance {
  ts: number; type: string; dur: number;
  /** Séries faites / séries prévues (anciennes séances : exercices cochés). */
  done: number; total: number;
  proof: string; timed: boolean;
  /** Ressenti de l'effort, 1 à 10. */
  rpe?: number;
  note?: string;
  /** Détail série par série : ce qui était prévu et ce qui a été fait. */
  logs?: SetLog[];
}

export interface SetLog { exo: string; type: "reps" | "duree"; cible: number; faits: (number | null)[]; charge?: string }

export interface TestRecord { ts: number; kind: TestId; value: number; counted: boolean }

export interface Mission { ts: number; level: number; title: string; proof: string; amount: number; photo: string | null }

/* ---------- Profil : ce que l'utilisateur déclare de lui ---------- */

export type Level = "debutant" | "intermediaire" | "avance";
export type CorpsGoal = "masse" | "force" | "endurance" | "seche" | "souplesse" | "sante";

export interface Profile {
  prenom: string;
  corps: {
    objectifs: CorpsGoal[]; niveau: Level;
    age: number | null; poids: number | null; taille: number | null;
    materiel: string[]; seancesParSemaine: number; minutes: number;
    contraintes: string; activites: string;
  };
  capital: {
    situation: string; competences: string; ressources: string;
    heuresParSemaine: number; budget: number; risque: "faible" | "moyen" | "fort";
    interets: string; objectif: string; dejaFait: string; refus: string;
  };
  esprit: { domaines: string[]; niveau: Level; pourquoi: string };
  verbe: { contexte: string; objectif: string };
  updated: number;
}

/* ---------- Plans générés par le Contremaître ---------- */

export interface Exo {
  nom: string; type: "reps" | "duree"; series: number; cible: number;
  charge: string; repos: number; consigne: string; alternative: string;
}
export interface SeancePlan {
  date: string; titre: string; focus: string; duree: number; pourquoi: string;
  echauffement: string; exos: Exo[]; retourAuCalme: string; ajustement: string;
  /** Saisie en cours, série par série (persistée : survit à une fermeture de l'appli). */
  faits?: (number | null)[][];
}
export interface Programme { ts: number; titre: string; logique: string; semaine: { jour: string; focus: string }[]; progression: string }

export interface Palier { titre: string; pourquoi: string; preuve: string; cash: boolean; jours: number }
export interface Roadmap { ts: number; vision: string; paliers: Palier[]; index: number }
export interface MissionSteps { palier: string; ts: number; items: { t: string; done: boolean }[] }
export interface ConceptPick { date: string; nom: string; pourquoi: string; question: string }

export interface TopicProposal { titre: string; domaine: string; angle: string; difficulte: number }
export interface Fiche { points: string[]; reperes: string[]; aLire: string }
export interface EspritChoice { date: string; titre: string; domaine: string; source: "proposition" | "parcours" | "libre"; parcoursId?: string; fiche: Fiche | null }
export interface Parcours { id: string; theme: string; pourquoi: string; sujets: { titre: string; angle: string }[]; index: number; ts: number }

export interface SubjectAI { texte: string; type: string; pourquoi: string }

export interface Plans {
  programme: Programme | null;
  seance: SeancePlan | null;
  espritProps: { date: string; items: TopicProposal[] } | null;
  verbe: { date: string; items: SubjectAI[]; index: number } | null;
}

/** Mémoire du Contremaître : sa lecture d'un pilier, mise à jour par l'IA à partir des données. */
export interface Memoire { ts: number; synthese: string; forces: string[]; faiblesses: string[]; priorite: string }

export interface CustomMission { titre: string; consigne: string; preuve: string; jours: number }

export interface Stake { amount: number; level: number; title: string; set: number; deadline: number }

export interface ConceptExam { ts: number; c: string; ans: string; note: number; verdict: string }

export interface EspritEntry {
  ts: number; topic: string; ans: string; note: number;
  verdict: string; lacune: string; objection: string; question: string;
  domaine?: string;
  /** Révisions réussies (3 = gravé). */
  stage: number;
  /** Date de la prochaine révision. */
  next: number;
}

export interface Oral {
  ts: number; sujet: string; secs: number; words: number;
  /** Mots par minute (null sans transcription). */
  wpm: number | null;
  /** Tics verbaux par minute. */
  tpm: number;
  /** Blancs (≥ 0,8 s) par minute, null sans enregistrement. */
  ppm: number | null;
  /** Plus long blanc, en secondes. */
  pause: number | null;
  /** Part du temps où la voix est active. */
  speak: number | null;
  ttr: number | null;
  longest: number;
  /** Hésitations par minute : tics + blancs. */
  h: number;
  /** Enveloppe sonore, 72 points entre 0 et 1. */
  env: number[];
  text: string;
  audio: boolean;
  verdict: string;
  structure: number | null;
}

export interface HistRow { d: string; corps: number; capital: number; esprit: number; verbe: number }

export interface Win { ts: number; pillar: PillarId; text: string }

export interface Chantier {
  v: 2;
  created: number;
  /** Dernière modification par l'utilisateur (pas l'érosion) : sert à savoir s'il y a quelque chose à synchroniser. */
  updatedAt: number;
  lastTick: number;
  lastDay: string;
  p: Record<PillarId, PillarState>;
  days: Record<string, Partial<Record<PillarId, true>>>;
  pending: Pending[];
  excuses: Excuse[];
  seances: Seance[];
  seanceStart: number | null;
  tests: TestRecord[];
  missionLevel: number;
  missions: Mission[];
  missionLog: { ts: number; text: string }[];
  euros: number;
  stake: Stake | null;
  stakesLost: number;
  custom: CustomMission | null;
  concepts: ConceptExam[];
  esprit: EspritEntry[];
  orals: Oral[];
  hist: HistRow[];
  wins: Win[];
  skips: number;
  report: { ts: number; text: string } | null;
  /* v2 : profil, plans et mémoire */
  profile: Profile | null;
  plans: Plans;
  roadmap: Roadmap | null;
  missionSteps: MissionSteps | null;
  concept: ConceptPick | null;
  espritChoice: EspritChoice | null;
  parcours: Parcours[];
  parcoursActif: string | null;
  memoire: Partial<Record<PillarId, Memoire>>;
}

export interface GainResult { real: number; halved: boolean }

export interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
  deep: boolean;
  oralMode: "micro" | "clavier";
  lastBackup: string;
  /** Serveur de synchronisation (Docker sur le Mac), vide = pas de synchronisation. */
  syncUrl: string;
  syncToken: string;
}
