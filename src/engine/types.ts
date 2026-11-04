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

export interface Seance { ts: number; type: string; dur: number; done: number; total: number; proof: string; timed: boolean }

export interface TestRecord { ts: number; kind: TestId; value: number; counted: boolean }

export interface Mission { ts: number; level: number; title: string; proof: string; amount: number; photo: string | null }

export interface CustomMission { titre: string; consigne: string; preuve: string; jours: number }

export interface Stake { amount: number; level: number; title: string; set: number; deadline: number }

export interface ConceptExam { ts: number; c: string; ans: string; note: number; verdict: string }

export interface EspritEntry {
  ts: number; topic: string; ans: string; note: number;
  verdict: string; lacune: string; objection: string; question: string;
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
  v: 1;
  created: number;
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
}

export interface GainResult { real: number; halved: boolean }

export interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
  deep: boolean;
  oralMode: "micro" | "clavier";
  lastBackup: string;
}
