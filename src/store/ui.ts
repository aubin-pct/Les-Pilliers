/* État d'interface non persisté : message flottant et brouillons de saisie (survivent aux changements d'onglet). */
import { create } from "zustand";
import { PILLAR } from "@/content/pillars";
import { f1 } from "@/lib/format";
import { buzz } from "@/lib/device";
import type { GainResult, PillarId } from "@/engine/types";

type ToastKind = "gain" | "loss" | undefined;

interface UIState {
  toast: { id: number; msg: string; kind: ToastKind } | null;
  /** Tampon de gain ou de perte (affiché par <Stamp />). */
  stampData: { id: number; pillar: PillarId; value: number; caption?: string } | null;
  stamp: (pillar: PillarId, value: number, caption?: string) => void;
  drafts: Record<string, string>;
  show: (msg: string, kind?: ToastKind) => void;
  hide: () => void;
  setDraft: (k: string, v: string) => void;
  clearDrafts: (...k: string[]) => void;
}

export const useUI = create<UIState>()((set) => ({
  toast: null,
  stampData: null,
  stamp: (pillar, value, caption) => set({ stampData: { id: Date.now() + Math.random(), pillar, value, caption } }),
  drafts: {},
  show: (msg, kind) => set({ toast: { id: Date.now() + Math.random(), msg, kind } }),
  hide: () => set({ toast: null }),
  setDraft: (k, v) => set((s) => ({ drafts: { ...s.drafts, [k]: v } })),
  clearDrafts: (...ks) => set((s) => { const d = { ...s.drafts }; ks.forEach((k) => delete d[k]); return { drafts: d }; }),
}));

export const toast = (msg: string, kind?: ToastKind) => useUI.getState().show(msg, kind);

/** Gain ou perte d'assises : tampon plein écran dans la couleur du pilier, et retour haptique. */
export function gainToast(id: PillarId, r: GainResult, extra?: string) {
  const caption = [r.halved ? "÷2 : comptes en attente" : "", extra ?? ""].filter(Boolean).join(" · ");
  useUI.getState().stamp(id, r.real, caption || undefined);
  buzz(r.real >= 0 ? [20, 30, 40] : [80, 60, 80]);
}
/** Texte du gain, pour les lecteurs d'écran et les tests. */
export const gainText = (id: PillarId, r: GainResult) => `${r.real >= 0 ? "+" : "−"}${f1(Math.abs(r.real))} assises · ${PILLAR[id].name}`;

/** Champ de saisie dont la valeur survit aux re-rendus et aux changements d'onglet. */
export function useDraft(key: string): [string, (v: string) => void, () => void] {
  const v = useUI((s) => s.drafts[key] ?? "");
  const set = useUI((s) => s.setDraft);
  const clear = useUI((s) => s.clearDrafts);
  return [v, (x: string) => set(key, x), () => clear(key)];
}
