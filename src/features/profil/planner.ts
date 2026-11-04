/*
 * Génération des plans à partir du profil : programme du Corps, feuille de route du Capital,
 * propositions d'Esprit, sujets d'oral. Utilisé à l'accueil et après une modification du profil.
 */
import { genProgramme, genProposals, genRoadmap, genSubjects } from "@/ai/contremaitre";
import { dayKey } from "@/lib/format";
import { useStore } from "@/store";

export type PlanKey = "programme" | "roadmap" | "esprit" | "verbe";
export const PLAN_LABELS: Record<PlanKey, string> = {
  programme: "Programme d'entraînement",
  roadmap: "Feuille de route du Capital",
  esprit: "Sujets d'Esprit du jour",
  verbe: "Sujets d'oral du jour",
};

export async function runPlan(k: PlanKey): Promise<boolean> {
  const act = useStore.getState().act;
  const now = Date.now();
  if (k === "programme") {
    const r = await genProgramme();
    if (r) act((c) => { c.plans.programme = { ts: now, ...r }; c.plans.seance = null; });
    return !!r;
  }
  if (k === "roadmap") {
    const r = await genRoadmap();
    if (r) act((c) => { c.roadmap = { ts: now, vision: r.vision, paliers: r.paliers, index: 0 }; c.missionSteps = null; c.concept = null; });
    return !!r;
  }
  if (k === "esprit") {
    const r = await genProposals("", true);
    if (r) act((c) => { c.plans.espritProps = { date: dayKey(now), items: r.sujets }; });
    return !!r;
  }
  const r = await genSubjects(true);
  if (r) act((c) => { c.plans.verbe = { date: dayKey(now), items: r.sujets, index: 0 }; });
  return !!r;
}
