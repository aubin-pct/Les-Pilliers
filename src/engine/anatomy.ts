/*
 * Ce qu'on montre d'un exercice dans l'écorché : quel mouvement animer, quels muscles allumer et à quelle intensité.
 * L'IA donne `mouvement` et `muscles` ; sinon (séance de secours, exercice ajouté à la main, ancienne séance),
 * on les déduit du nom.
 */
import { MOVEMENT_BY_ID, MOVEMENTS, isMovementId, isMuscleId, type Activation, type MovementId, type MuscleId } from "@/content/anatomy";
import type { Exo } from "./types";

export interface ExoAnatomy {
  mouvement: MovementId;
  /** Muscles triés du plus sollicité au moins sollicité, intensité 0–1. */
  muscles: { id: MuscleId; w: number; principal: boolean }[];
  /** Le mouvement vient-il d'un nom reconnu ou de l'IA (true), ou d'un repli générique (false) ? */
  reconnu: boolean;
}

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

/** Mouvement d'après le nom : le mot-clé le plus long trouvé l'emporte (« squat sauté » avant « squat »). */
export function guessMovement(nom: string): MovementId | null {
  const n = ` ${norm(nom)} `;
  let best: { id: MovementId; len: number } | null = null;
  for (const m of MOVEMENTS) for (const k of m.mots) {
    if (n.includes(k) && (!best || k.length > best.len)) best = { id: m.id, len: k.length };
  }
  return best?.id ?? null;
}

export function exoAnatomy(e: Pick<Exo, "nom"> & Partial<Pick<Exo, "mouvement" | "muscles">>): ExoAnatomy {
  const guessed = guessMovement(e.nom);
  const id: MovementId = isMovementId(e.mouvement) ? e.mouvement : guessed ?? "debout";
  const reconnu = isMovementId(e.mouvement) || guessed !== null;
  const base: Activation = MOVEMENT_BY_ID[id].muscles;
  const p = (e.muscles?.principaux ?? []).filter(isMuscleId);
  const s = (e.muscles?.secondaires ?? []).filter(isMuscleId);
  let act: Activation;
  if (p.length) {
    // L'IA a désigné les muscles : ils priment ; le mouvement garde ses stabilisateurs, atténués.
    act = {};
    for (const [k, v] of Object.entries(base) as [MuscleId, number][]) act[k] = Math.min(0.3, v * 0.4);
    p.forEach((m, i) => { act[m] = Math.max(act[m] ?? 0, 1 - i * 0.06); });
    s.forEach((m, i) => { if (!p.includes(m)) act[m] = Math.max(act[m] ?? 0, 0.55 - i * 0.04); });
  } else act = base;
  const muscles = (Object.entries(act) as [MuscleId, number][])
    .filter(([, w]) => w > 0.05)
    .map(([m, w]) => ({ id: m, w: Math.round(Math.max(0, Math.min(1, w)) * 100) / 100, principal: w >= 0.7 }))
    .sort((a, b) => b.w - a.w);
  return { mouvement: id, muscles, reconnu };
}
