/*
 * Schémas de ce que l'IA doit renvoyer. Chaque réponse est validée et nettoyée ici avant d'entrer dans le chantier :
 * nombres convertis, textes coupés, listes bornées, valeurs par défaut. Une réponse invalide est rejetée.
 */
import { z } from "zod";
import { isMovementId, isMuscleId } from "@/content/anatomy";

const str = (v: unknown) => (v === null || v === undefined ? v : typeof v === "object" ? JSON.stringify(v) : String(v));
/**
 * Coupe un texte trop long SANS le tronquer au milieu d'une phrase. Les longueurs passées aux schémas sont
 * des tailles « normales » : on tolère trois fois plus avant de couper, et la coupe se fait à la fin d'une
 * phrase (ou d'un mot, avec « … »). Une réponse de l'IA ne doit jamais s'arrêter net.
 */
export function clip(s: string, max: number): string {
  const lim = max * 3;
  if (s.length <= lim) return s;
  const cut = s.slice(0, lim);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf(".\n"), cut.lastIndexOf("\n"));
  if (end > lim * 0.5) return cut.slice(0, end + 1).trim();
  const sp = cut.lastIndexOf(" ");
  return (sp > lim * 0.5 ? cut.slice(0, sp) : cut).trim() + "…";
}
/** Texte obligatoire (non vide). */
const txt = (max = 600) => z.preprocess(str, z.string().trim().min(1)).transform((s) => clip(s, max));
/** Texte facultatif (vide par défaut). */
const opt = (max = 600) => z.preprocess(str, z.string().optional()).transform((s) => clip((s ?? "").trim(), max));
const int = (min: number, max: number, def: number) => z.coerce.number().catch(def).transform((n) => Math.max(min, Math.min(max, Math.round(n))));
const note10 = int(0, 10, 0);
const bool = (def: boolean) => z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" || v.trim().toLowerCase() === "oui" : v), z.boolean()).catch(def);
const list = <T extends z.ZodTypeAny>(item: T, min: number, max: number) => z.array(item).min(min).transform((a) => a.slice(0, max));

/* ---- Corps ---- */
export const ExoSchema = z.object({
  nom: txt(80),
  type: z.enum(["reps", "duree"]).catch("reps"),
  series: int(1, 30, 3),
  cible: int(1, 600, 10),
  charge: opt(60),
  repos: int(0, 600, 60),
  consigne: opt(240),
  alternative: opt(120),
  /** Mouvement animé dans l'écorché (identifiant du catalogue) ; invalide → déduit du nom à l'affichage. */
  mouvement: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""), z.string()).catch("").transform((v) => (isMovementId(v) ? v : undefined)),
  muscles: z.object({
    principaux: z.array(z.unknown()).catch([]).default([]),
    secondaires: z.array(z.unknown()).catch([]).default([]),
  }).catch({ principaux: [], secondaires: [] }).default({ principaux: [], secondaires: [] }).transform((m) => {
    const ids = (a: unknown[]) => [...new Set(a.map((x) => String(x).trim().toLowerCase()).filter(isMuscleId))].slice(0, 6);
    const principaux = ids(m.principaux);
    const secondaires = ids(m.secondaires).filter((x) => !principaux.includes(x));
    return principaux.length ? { principaux, secondaires } : undefined;
  }),
});
export const SeanceSchema = z.object({
  titre: txt(60), focus: txt(120), duree: int(5, 600, 40), pourquoi: txt(400),
  echauffement: txt(300), exos: list(ExoSchema, 1, 40), retourAuCalme: opt(300), ajustement: opt(300),
});
export const ProgrammeSchema = z.object({
  titre: txt(60), logique: txt(500),
  semaine: list(z.object({ jour: txt(20), focus: txt(80) }), 1, 7),
  progression: txt(400),
});

/* ---- Capital ---- */
export const PalierSchema = z.object({
  titre: txt(90), pourquoi: txt(400), preuve: txt(200),
  cash: bool(true), jours: int(1, 120, 14),
});
export const RoadmapSchema = z.object({ vision: txt(500), paliers: list(PalierSchema, 3, 10) });
export const StepsSchema = z.object({ etapes: list(txt(200), 2, 7) });
export const UnblockSchema = z.object({ diagnostic: txt(400), action: txt(300), phrase: opt(200) });
export const ConceptPickSchema = z.object({ nom: txt(80), pourquoi: txt(300), question: txt(300) });
export const ConceptExamSchema = z.object({ note: note10, verdict: txt(400), lacune: opt(400), application: opt(300) });

/* ---- Esprit ---- */
export const ProposalsSchema = z.object({
  sujets: list(z.object({ titre: txt(100), domaine: txt(40), angle: txt(240), difficulte: int(1, 3, 2) }), 2, 5),
});
export const ParcoursSchema = z.object({ pourquoi: txt(300), sujets: list(z.object({ titre: txt(100), angle: txt(200) }), 4, 12) });
export const FicheSchema = z.object({ points: list(txt(300), 3, 8), reperes: list(txt(160), 0, 8).catch([]), aLire: opt(200) });
export const EspritExamSchema = z.object({
  note: note10, verdict: txt(400), lacune: opt(400), objection: opt(300), question: opt(300), a_lire: opt(200),
});
export const ReviewSchema = z.object({ note: note10, correction: txt(400) });

/* ---- Verbe ---- */
export const SubjectsSchema = z.object({ sujets: list(z.object({ texte: txt(160), type: opt(30), pourquoi: opt(200) }), 2, 5) });
export const OralCoachSchema = z.object({ structure: note10, verdict: txt(400), a_corriger: txt(300), phrase_refaite: txt(300) });

/* ---- Transverse ---- */
export const ExcuseSchema = z.object({
  verdict: txt(600),
  categorie: z.enum(["fatigue", "temps", "motivation", "externe", "sante", "autre"]).catch("autre"),
  recevable: bool(false),
});
export const MemoireSchema = z.object({
  synthese: txt(500), forces: list(txt(160), 0, 4).catch([]), faiblesses: list(txt(160), 0, 4).catch([]), priorite: txt(240),
});
export const TestKeySchema = z.object({ phrase: opt(120) });

/* ---- v5 : le Coach ---- */
export const ActionSchema = z.object({ label: txt(28), type: txt(30), params: z.record(z.unknown()).catch({}).default({}) });
export const ChatSchema = z.object({ reponse: txt(700), actions: z.array(ActionSchema).catch([]).default([]).transform((a) => a.slice(0, 3)) });
export const BriefSchema = z.object({ temple: txt(120), corps: txt(120), capital: txt(120), esprit: txt(120), verbe: txt(120) });

/* ---- v5 : Capital ---- */
export const InterviewSchema = z.object({ question: opt(220), choix: z.array(txt(60)).catch([]).default([]).transform((a) => a.slice(0, 5)), fini: bool(false) });
const score10 = int(1, 10, 5);
export const BizOptionSchema = z.object({
  nom: txt(60), offre: txt(240), cible: txt(160), canal: txt(160), prix: txt(80), pourquoiToi: txt(240),
  premierEuroJours: int(1, 180, 21), potentielMois: int(0, 100000, 500),
  scores: z.object({ marche: score10, competence: score10, vitesse: score10, echelle: score10 }),
});
export const OptionsSchema = z.object({ options: list(BizOptionSchema, 2, 3) });
export const SprintSchema = z.object({
  objectif: txt(160),
  kpis: list(z.object({ label: txt(60), cible: int(1, 500, 5) }), 2, 5),
  script: txt(700),
});

/* ---- v5 : Esprit ---- */
export const MapSchema = z.object({
  domaines: list(z.object({ nom: txt(40), sujets: list(z.object({ titre: txt(90), niveau: int(1, 3, 1) }), 4, 14) }), 1, 10),
});

/* ---- v5 : Verbe ---- */
export const DrillContentSchema = z.object({ sujet: opt(200), texte: opt(900), question: opt(240), conseil: opt(160) });
export const OralCoach2Schema = z.object({
  structure: int(0, 100, 50), impact: int(0, 100, 50), verdict: txt(240), a_corriger: txt(200), phrase_refaite: opt(240),
});
