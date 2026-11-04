/*
 * Schémas de ce que l'IA doit renvoyer. Chaque réponse est validée et nettoyée ici avant d'entrer dans le chantier :
 * nombres convertis, textes coupés, listes bornées, valeurs par défaut. Une réponse invalide est rejetée.
 */
import { z } from "zod";

const str = (v: unknown) => (v === null || v === undefined ? v : typeof v === "object" ? JSON.stringify(v) : String(v));
/** Texte obligatoire (non vide). */
const txt = (max = 600) => z.preprocess(str, z.string().trim().min(1)).transform((s) => s.slice(0, max));
/** Texte facultatif (vide par défaut). */
const opt = (max = 600) => z.preprocess(str, z.string().optional()).transform((s) => (s ?? "").trim().slice(0, max));
const int = (min: number, max: number, def: number) => z.coerce.number().catch(def).transform((n) => Math.max(min, Math.min(max, Math.round(n))));
const note10 = int(0, 10, 0);
const bool = (def: boolean) => z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" || v.trim().toLowerCase() === "oui" : v), z.boolean()).catch(def);
const list = <T extends z.ZodTypeAny>(item: T, min: number, max: number) => z.array(item).min(min).transform((a) => a.slice(0, max));

/* ---- Corps ---- */
export const ExoSchema = z.object({
  nom: txt(80),
  type: z.enum(["reps", "duree"]).catch("reps"),
  series: int(1, 10, 3),
  cible: int(1, 600, 10),
  charge: opt(60),
  repos: int(0, 600, 60),
  consigne: opt(240),
  alternative: opt(120),
});
export const SeanceSchema = z.object({
  titre: txt(60), focus: txt(120), duree: int(5, 180, 40), pourquoi: txt(400),
  echauffement: txt(300), exos: list(ExoSchema, 2, 12), retourAuCalme: opt(300), ajustement: opt(300),
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
