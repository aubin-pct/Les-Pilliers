/*
 * Façade du Contremaître : chaque fonction renvoie un résultat typé, ou null si l'IA est absente ou a échoué
 * (l'erreur est affichée) ; l'appelant retombe alors sur les règles locales. En démo, aucun appel.
 */
import { useStore } from "@/store";
import { toast } from "@/store/ui";
import { AIError, callModel, type CallOptions } from "./client";
import * as P from "./prompts";

function available() {
  const s = useStore.getState();
  return !!s.settings.apiKey.trim() && s.demo === null;
}

async function ask<T>(prompt: string, o: CallOptions, check: (r: T) => boolean): Promise<T | null> {
  if (!available()) return null;
  try {
    const r = (await callModel(useStore.getState().settings, prompt, o)) as T;
    if (!check(r)) { toast("Réponse incomplète du Contremaître. Règles de base appliquées.", "loss"); return null; }
    return r;
  } catch (e) {
    toast(e instanceof AIError ? e.message : "Le Contremaître n'a pas répondu.", "loss");
    return null;
  }
}
const isNum = (v: unknown) => Number.isFinite(Number(v));

export interface ExcuseVerdict { verdict: string; categorie: string; recevable: boolean }
export const judgeExcuse = (p: Parameters<typeof P.excusePrompt>[0]) =>
  ask<ExcuseVerdict>(P.excusePrompt(p), { max: 500 }, (r) => typeof r?.verdict === "string");

export interface EspritExam { note: number; verdict: string; lacune: string; objection: string; question: string; a_lire?: string }
export const examineEsprit = (topic: string, domain: string, ans: string) =>
  ask<EspritExam>(P.espritPrompt(topic, domain, ans), { deep: true, max: 900 }, (r) => isNum(r?.note));

export interface Review { note: number; correction: string }
export const examineReview = (topic: string, question: string, first: string, ans: string) =>
  ask<Review>(P.reviewPrompt(topic, question, first, ans), { max: 500 }, (r) => isNum(r?.note));

export interface ConceptExamAI { note: number; verdict: string; lacune: string; application: string }
export const examineConcept = (concept: string, mission: string, ans: string) =>
  ask<ConceptExamAI>(P.conceptPrompt(concept, mission, ans), { deep: true, max: 900 }, (r) => isNum(r?.note));

export interface MissionOrder { titre: string; consigne: string; preuve: string; jours: number }
export const orderMission = (p: Parameters<typeof P.missionPrompt>[0]) =>
  ask<MissionOrder>(P.missionPrompt(p), { max: 700 }, (r) => typeof r?.titre === "string" && typeof r?.consigne === "string");

export interface OralCoach { structure: number; verdict: string; a_corriger: string; phrase_refaite: string }
export const coachOral = (p: Parameters<typeof P.oralPrompt>[0]) =>
  ask<OralCoach>(P.oralPrompt(p), { max: 700 }, (r) => typeof r?.verdict === "string");

export const weeklyReport = (data: unknown) =>
  ask<string>(P.reportPrompt(data), { json: false, deep: true, max: 900 }, (r) => typeof r === "string" && r.length > 20);

/** Test de la clé : lève l'erreur au lieu de la convertir en message. */
export async function testKey() {
  const r = (await callModel(useStore.getState().settings, P.testKeyPrompt, { max: 200 })) as { phrase?: string };
  return r?.phrase || "Au travail.";
}
