/* Actions de la séance en cours, partagées par la vue liste et le mode plein écran. */
import { gain } from "@/engine/core";
import { seanceGain, setsRatio } from "@/engine/scoring";
import type { SeancePlan } from "@/engine/types";
import { useStore } from "@/store";
import { gainToast } from "@/store/ui";

export const emptyFaits = (p: SeancePlan) => p.exos.map((e) => Array<number | null>(e.series).fill(null));
export const faitsOf = (p: SeancePlan) => p.faits ?? emptyFaits(p);

export function setSet(i: number, k: number, v: number | null) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s) return;
    s.faits = s.faits ?? emptyFaits(s);
    s.faits[i][k] = v === null || !Number.isFinite(v) ? null : Math.max(0, Math.round(v));
  });
}
export function fillExo(i: number) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s) return;
    s.faits = s.faits ?? emptyFaits(s);
    s.faits[i] = s.faits[i].map((x) => x ?? s.exos[i].cible);
  });
}

/** Valide la séance. Renvoie un message d'erreur, ou null si c'est enregistré. */
export function finishSession(rpe: number | null, note: string): string | null {
  const st = useStore.getState();
  const c = st.demo ?? st.chantier; const plan = c?.plans.seance;
  if (!c || !plan) return "Aucune séance en cours.";
  const faits = faitsOf(plan);
  const dur = Math.round((Date.now() - (c.seanceStart ?? Date.now())) / 60000);
  const logs = plan.exos.map((e, i) => ({ exo: e.nom, type: e.type, cible: e.cible, faits: faits[i], charge: e.charge || undefined }));
  const { done, total } = setsRatio(logs);
  if (dur < 5) return `${dur} min de chrono. Cinq minimum.`;
  if (done < total / 2) return `${done}/${total} séries. Il en faut au moins la moitié.`;
  if (rpe === null) return "Note l'effort, de 1 à 10.";
  const r = st.act((d) => {
    d.seances.push({ ts: Date.now(), type: plan.titre, dur, done, total, proof: `${done}/${total} séries`, timed: true, rpe, note: note.trim() || undefined, logs });
    d.seanceStart = null;
    return gain(d, "corps", seanceGain(dur, done, total), Date.now());
  });
  gainToast("corps", r);
  return null;
}
