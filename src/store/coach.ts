/* État du Coach : panneau de conversation ouvert, réflexion en cours. */
import { create } from "zustand";
import type { ChatScope } from "@/engine/types";

interface CoachState {
  open: ChatScope | null;
  prefill: string;
  thinking: boolean;
  /** La tête du Coach est visible à l'écran (sinon : bouton flottant). */
  headVisible: boolean;
  openCoach: (scope: ChatScope, prefill?: string) => void;
  closeCoach: () => void;
}
export const useCoach = create<CoachState>()((set) => ({
  open: null, prefill: "", thinking: false, headVisible: false,
  openCoach: (scope, prefill = "") => set({ open: scope, prefill }),
  closeCoach: () => set({ open: null, prefill: "" }),
}));
export const openCoach = (scope: ChatScope, prefill?: string) => useCoach.getState().openCoach(scope, prefill);
