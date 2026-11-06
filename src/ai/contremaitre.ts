/*
 * Façade du Contremaître. Chaque fonction :
 *  1. construit le dossier du pilier (context.ts) à partir du chantier actif,
 *  2. appelle le modèle avec la consigne (prompts.ts),
 *  3. valide et nettoie la réponse (schemas.ts) ; une réponse invalide déclenche un seul nouvel essai,
 *  4. renvoie un résultat typé, ou null (erreur affichée) : l'appelant garde alors l'état précédent ou ses règles locales.
 * Aucun appel en démo ni sans clé.
 */
import type { z } from "zod";
import { useStore } from "@/store";
import { toast } from "@/store/ui";
import type { Chantier, ChatMsg, ChatScope, PillarId } from "@/engine/types";
import { AIError, callModel, type CallOptions } from "./client";
import * as P from "./prompts";
import * as S from "./schemas";
import { capitalContext, corpsContext, espritContext, excuseContext, pillarContext, scopeContext, templeContext, verbeContext } from "./context";

export function aiReady() {
  const s = useStore.getState();
  return !!s.settings.apiKey.trim() && s.demo === null;
}
function chantier(): Chantier | null {
  const s = useStore.getState();
  return s.demo ?? s.chantier;
}

async function ask<T extends z.ZodTypeAny>(prompt: string, schema: T, o: CallOptions = {}, silent = false): Promise<z.infer<T> | null> {
  if (!aiReady()) {
    if (!silent) toast(useStore.getState().demo ? "En démo, le Contremaître IA ne génère rien." : "Branche ta clé DeepSeek dans les réglages.");
    return null;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callModel(useStore.getState().settings, prompt, o);
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      if (import.meta.env.DEV) console.warn("[Contremaître] réponse invalide", parsed.error.issues, raw);
    } catch (e) {
      if (!silent) toast(e instanceof AIError ? e.message : "Le Contremaître n'a pas répondu.", "loss");
      return null;
    }
  }
  if (!silent) toast("Réponse incomplète du Contremaître. Réessaie.", "loss");
  return null;
}

const now = () => Date.now();

/* ---------------- Corps ---------------- */
export const genProgramme = (demande = "") => ask(P.programmePrompt(corpsContext(chantier()!, now()), demande), S.ProgrammeSchema, { deep: true, max: 1500 });
export const genSeance = (ajust: Parameters<typeof P.seancePrompt>[1], actuelle?: Parameters<typeof P.seancePrompt>[2]) => ask(P.seancePrompt(corpsContext(chantier()!, now()), ajust, actuelle), S.SeanceSchema, { max: 2400 });

/* ---------------- Capital ---------------- */
export const genRoadmap = (demande = "") => ask(P.roadmapPrompt(capitalContext(chantier()!, now()), demande), S.RoadmapSchema, { deep: true, max: 2500 });
export const genSteps = () => ask(P.stepsPrompt(capitalContext(chantier()!, now())), S.StepsSchema, { max: 800 });
export const unblock = (blocage: string) => ask(P.unblockPrompt(capitalContext(chantier()!, now()), blocage), S.UnblockSchema, { max: 700 });
export const replacePalier = (raison: string) => ask(P.replacePalierPrompt(capitalContext(chantier()!, now()), raison), S.PalierSchema, { max: 700 });
export const pickConcept = (silent = false) => ask(P.conceptPickPrompt(capitalContext(chantier()!, now())), S.ConceptPickSchema, { max: 600 }, silent);
export const examineConcept = (concept: string, question: string, mission: string, ans: string) =>
  ask(P.conceptExamPrompt(concept, question, mission, ans), S.ConceptExamSchema, { deep: true, max: 900 });

/* ---------------- Esprit ---------------- */
export const genProposals = (envie = "", silent = false) => ask(P.proposalsPrompt(espritContext(chantier()!, now()), envie), S.ProposalsSchema, { max: 1000 }, silent);
export const genParcours = (theme: string) => ask(P.parcoursPrompt(espritContext(chantier()!, now()), theme), S.ParcoursSchema, { deep: true, max: 1800 });
export const genFiche = (titre: string) => ask(P.fichePrompt(espritContext(chantier()!, now()), titre), S.FicheSchema, { max: 1500 });
export const examineEsprit = (topic: string, domain: string, niveau: string, ans: string, fiche: boolean) =>
  ask(P.espritExamPrompt(topic, domain, niveau, ans, fiche), S.EspritExamSchema, { deep: true, max: 900 });
export const examineReview = (topic: string, question: string, first: string, ans: string) =>
  ask(P.reviewPrompt(topic, question, first, ans), S.ReviewSchema, { max: 500 });

/* ---------------- Verbe ---------------- */
export const genSubjects = (silent = false) => ask(P.subjectsPrompt(verbeContext(chantier()!, now())), S.SubjectsSchema, { max: 800 }, silent);
export const coachOral = (p: Parameters<typeof P.oralPrompt>[1]) => ask(P.oralPrompt(verbeContext(chantier()!, now()), p), S.OralCoachSchema, { max: 700 });

/* ---------------- Transverse ---------------- */
export const judgeExcuse = (p: Omit<Parameters<typeof P.excusePrompt>[0], "ctx">) =>
  ask(P.excusePrompt({ ...p, ctx: excuseContext(chantier()!, now()) }), S.ExcuseSchema, { max: 500 });

export const genMemoire = (id: PillarId, nom: string, silent = false) =>
  ask(P.memoirePrompt(nom, pillarContext(chantier()!, id, now())), S.MemoireSchema, { deep: true, max: 900 }, silent);

export async function weeklyReport(data: unknown): Promise<string | null> {
  if (!aiReady()) return null;
  try {
    const r = String(await callModel(useStore.getState().settings, P.reportPrompt(data), { json: false, deep: true, max: 900 }));
    return r.length > 20 ? r : null;
  } catch (e) { toast(e instanceof AIError ? e.message : "Le Contremaître n'a pas répondu.", "loss"); return null; }
}

/** Test de la clé : lève l'erreur au lieu de la convertir en message. */
export async function testKey() {
  const r = S.TestKeySchema.safeParse(await callModel(useStore.getState().settings, P.testKeyPrompt, { max: 200 }));
  return (r.success && r.data.phrase) || "Au travail.";
}

/* ---------------- v5 : le Coach ---------------- */
const SECTION: Record<ChatScope, string> = { temple: "Le Temple (vue d'ensemble)", corps: "Corps", capital: "Capital", esprit: "Esprit", verbe: "Verbe (éloquence)" };
export const chat = (scope: ChatScope, actions: string, history: ChatMsg[], message: string) =>
  ask(P.chatPrompt({ section: SECTION[scope], ctx: scopeContext(chantier()!, scope, now()), actions, history: history.slice(-12).map((m) => ({ from: m.from === "coach" ? "toi" : "lui", text: m.text })), message }), S.ChatSchema, { max: 700 });
export const genBrief = () => {
  const c = chantier()!, t = now();
  return ask(P.briefPrompt({ ensemble: templeContext(c, t), corps: corpsContext(c, t), capital: capitalContext(c, t), esprit: espritContext(c, t), verbe: verbeContext(c, t) }), S.BriefSchema, { max: 500 }, true);
};

/* ---------------- v5 : Capital ---------------- */
export const interviewNext = (qa: { q: string; a: string }[]) => ask(P.interviewPrompt(capitalContext(chantier()!, now()), qa), S.InterviewSchema, { max: 400 });
export const genOptions = (demande = "") => ask(P.optionsPrompt(capitalContext(chantier()!, now()), demande), S.OptionsSchema, { deep: true, max: 2500 });
export const genSprint = () => ask(P.sprintPrompt(capitalContext(chantier()!, now())), S.SprintSchema, { max: 1000 });

/* ---------------- v5 : Esprit ---------------- */
export const genMap = () => ask(P.mapPrompt(espritContext(chantier()!, now())), S.MapSchema, { deep: true, max: 3000 });

/* ---------------- v5 : Verbe ---------------- */
export const genDrill = (type: string, description: string, silent = false) => ask(P.drillPrompt(verbeContext(chantier()!, now()), type, description), S.DrillContentSchema, { max: 700 }, silent);
export const coachOral2 = (p: Parameters<typeof P.oral2Prompt>[1]) => ask(P.oral2Prompt(verbeContext(chantier()!, now()), p), S.OralCoach2Schema, { max: 600 });
