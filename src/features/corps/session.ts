/* Actions de la séance en cours, partagées par la vue liste et le mode plein écran. */
import { gain } from "@/engine/core";
import { seanceGain, setsRatio } from "@/engine/scoring";
import type { SeancePlan } from "@/engine/types";
import { useStore } from "@/store";
import { gainToast } from "@/store/ui";

export const emptyFaits = (p: SeancePlan) => p.exos.map((e) => Array<number | null>(e.series).fill(null));
export const faitsOf = (p: SeancePlan) => p.faits ?? emptyFaits(p);
/** Poids par série (kg), toujours aligné sur les séries. */
export const poidsOf = (p: SeancePlan) => faitsOf(p).map((f, i) => f.map((_, k) => p.poids?.[i]?.[k] ?? null));
/** Poids prévu par la séance (« 20 kg », « 2 × 12,5 kg »…), ou null. */
export function parseKg(charge?: string): number | null {
  const m = charge?.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}
const alignPoids = (s: SeancePlan) => { s.poids = s.faits!.map((f, i) => f.map((_, k) => s.poids?.[i]?.[k] ?? null)); };

export function setPoids(i: number, k: number, kg: number | null) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s) return;
    s.faits = s.faits ?? emptyFaits(s); alignPoids(s);
    s.poids![i][k] = kg === null || !Number.isFinite(kg) ? null : Math.max(0, Math.round(kg * 4) / 4);
  });
}

export function setSet(i: number, k: number, v: number | null) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s) return;
    s.faits = s.faits ?? emptyFaits(s);
    s.faits[i][k] = v === null || !Number.isFinite(v) ? null : Math.max(0, Math.round(v));
  });
}
/** Ajoute une série à un exercice (pendant la séance). */
export function addSet(i: number) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s || !s.exos[i]) return;
    s.faits = s.faits ?? emptyFaits(s);
    if (s.faits[i].length >= 40) return;
    alignPoids(s);
    s.faits[i].push(null);
    s.poids![i].push(s.poids![i][s.poids![i].length - 1] ?? null);
    s.exos[i].series = s.faits[i].length;
  });
}
/** Ajoute un exercice à la séance (prévue ou en cours). */
export function addExo(e: { nom: string; type?: "reps" | "duree"; series?: number; cible?: number; charge?: string; repos?: number; consigne?: string }) {
  const nom = e.nom.trim();
  if (nom.length < 2) throw new Error("Donne un nom à l'exercice.");
  const type = e.type === "duree" ? "duree" : "reps";
  const series = Math.max(1, Math.min(40, Math.round(e.series ?? 3)));
  const cible = Math.max(1, Math.min(3600, Math.round(e.cible ?? (type === "duree" ? 30 : 10))));
  const ok = useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s) return false;
    s.exos.push({ nom: nom.slice(0, 80), type, series, cible, charge: (e.charge ?? "").slice(0, 60), repos: Math.max(0, Math.min(600, Math.round(e.repos ?? 60))), consigne: (e.consigne ?? "").slice(0, 240), alternative: "" });
    if (d.seanceStart !== null) {
      s.faits = s.faits ?? emptyFaits(s);
      if (s.faits.length < s.exos.length) s.faits.push(Array(series).fill(null));
      alignPoids(s);
    }
    return true;
  });
  if (!ok) throw new Error("Aucune séance aujourd'hui : prépare-la d'abord.");
  return `${nom} ajouté : ${series} × ${cible}${type === "duree" ? " s" : ""}.`;
}
/** Retire un exercice dont aucune série n'est faite. */
export function removeExo(i: number) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s || s.exos.length <= 1) return;
    if (s.faits?.[i]?.some((x) => x !== null)) return;
    s.exos.splice(i, 1); s.faits?.splice(i, 1); s.poids?.splice(i, 1);
  });
}
/** Retire une série : la dernière encore vide, sinon la dernière faite. Jamais en dessous d'une. */
export function removeSet(i: number) {
  useStore.getState().act((d) => {
    const s = d.plans.seance; if (!s || !s.exos[i]) return;
    s.faits = s.faits ?? emptyFaits(s);
    const f = s.faits[i];
    if (f.length <= 1) return;
    alignPoids(s);
    const k = f.lastIndexOf(null), at = k >= 0 ? k : f.length - 1;
    f.splice(at, 1); s.poids![i].splice(at, 1);
    s.exos[i].series = f.length;
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
  const faits = faitsOf(plan), poids = poidsOf(plan);
  const dur = Math.round((Date.now() - (c.seanceStart ?? Date.now())) / 60000);
  const logs = plan.exos.map((e, i) => ({ exo: e.nom, type: e.type, cible: e.cible, faits: faits[i], charge: e.charge || undefined, ...(poids[i].some((x) => x !== null) ? { poids: poids[i] } : {}) }));
  const { done, total } = setsRatio(logs);
  if (dur < 5) return `${dur} min de chrono. Cinq minimum.`;
  if (done < total / 2) return `${done}/${total} séries. Il en faut au moins la moitié.`;
  if (rpe === null) return "Note l'effort, de 1 à 10.";
  const r = st.act((d) => {
    d.seances.push({ ts: Date.now(), type: plan.titre, dur, done, total, proof: `${done}/${total} séries`, timed: true, rpe, note: note.trim() || undefined, logs });
    d.seanceStart = null;
    d.plans.seance = null; // séance terminée : la suivante se prépare à neuf
    return gain(d, "corps", seanceGain(dur, done, total), Date.now());
  });
  gainToast("corps", r);
  return null;
}
