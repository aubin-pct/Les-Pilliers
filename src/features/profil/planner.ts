/*
 * Génération des plans à partir du profil : programme du Corps, première question du diagnostic Capital,
 * carte du savoir, propositions d'Esprit. Utilisé à l'accueil et après une modification du profil.
 */
import { genProgramme, genProposals } from "@/ai/contremaitre";
import { interviewStep, makeMap } from "@/ai/ops";
import { dayKey } from "@/lib/format";
import { useStore } from "@/store";

export type PlanKey = "programme" | "diagnostic" | "carte" | "esprit";
export const PLAN_LABELS: Record<PlanKey, string> = {
  programme: "Programme d'entraînement",
  diagnostic: "Diagnostic du Capital",
  carte: "Carte du savoir",
  esprit: "Sujets d'Esprit du jour",
};
export const ALL_PLANS: PlanKey[] = ["programme", "diagnostic", "carte", "esprit"];

export async function runPlan(k: PlanKey): Promise<boolean> {
  const act = useStore.getState().act;
  const now = Date.now();
  if (k === "programme") {
    const r = await genProgramme();
    if (r) act((c) => { c.plans.programme = { ts: now, ...r }; c.plans.seance = null; });
    return !!r;
  }
  if (k === "diagnostic") {
    const c = useStore.getState().chantier;
    if (c?.capital.thesis || c?.capital.ask) return true;
    return !!(await interviewStep());
  }
  if (k === "carte") return !!(await makeMap());
  const r = await genProposals("", true);
  if (r) act((c) => { c.plans.espritProps = { date: dayKey(now), items: r.sujets }; });
  return !!r;
}
