/* État d'interface non persisté : message flottant et brouillons de saisie (survivent aux changements d'onglet). */
import { create } from "zustand";
import { PILLAR } from "@/content/pillars";
import { f1 } from "@/lib/format";
import { buzz } from "@/lib/device";
import type { GainResult, PillarId } from "@/engine/types";

type ToastKind = "gain" | "loss" | undefined;

interface UIState {
  toast: { id: number; msg: string; kind: ToastKind } | null;
  drafts: Record<string, string>;
  show: (msg: string, kind?: ToastKind) => void;
  hide: () => void;
  setDraft: (k: string, v: string) => void;
  clearDrafts: (...k: string[]) => void;
}

export const useUI = create<UIState>()((set) => ({
  toast: null,
  drafts: {},
  show: (msg, kind) => set({ toast: { id: Date.now() + Math.random(), msg, kind } }),
  hide: () => set({ toast: null }),
  setDraft: (k, v) => set((s) => ({ drafts: { ...s.drafts, [k]: v } })),
  clearDrafts: (...ks) => set((s) => { const d = { ...s.drafts }; ks.forEach((k) => delete d[k]); return { drafts: d }; }),
}));

export const toast = (msg: string, kind?: ToastKind) => useUI.getState().show(msg, kind);

export function gainToast(id: PillarId, r: GainResult, extra?: string) {
  const sign = r.real >= 0 ? "+" : "−";
  toast(`${sign}${f1(Math.abs(r.real))} assises · ${PILLAR[id].name}${r.halved ? " (÷2, comptes en attente)" : ""}${extra ? " · " + extra : ""}`, r.real >= 0 ? "gain" : "loss");
  buzz(r.real >= 0 ? 30 : [60, 60, 60]);
}

/** Champ de saisie dont la valeur survit aux re-rendus et aux changements d'onglet. */
export function useDraft(key: string): [string, (v: string) => void, () => void] {
  const v = useUI((s) => s.drafts[key] ?? "");
  const set = useUI((s) => s.setDraft);
  const clear = useUI((s) => s.clearDrafts);
  return [v, (x: string) => set(key, x), () => clear(key)];
}
