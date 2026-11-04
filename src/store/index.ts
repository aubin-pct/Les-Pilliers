/*
 * Store unique (Zustand + immer + persist).
 * - `chantier` : le vrai chantier, enregistré dans localStorage.
 * - `demo` : chantier simulé, jamais enregistré ; quand il existe, c'est lui qu'on affiche et qu'on modifie.
 * - `settings` : réglages, enregistrés à part du chantier (survivent à l'effacement et à la démo).
 * Les modifications passent par `act(fn)`, qui exécute `fn` sur le chantier actif dans un brouillon immer.
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { freshChantier, normalize, tick } from "@/engine/core";
import { buildDemo } from "@/engine/demo";
import type { Chantier, Settings } from "@/engine/types";

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-flash", deep: false, oralMode: "micro", lastBackup: "",
};

interface AppState {
  chantier: Chantier | null;
  demo: Chantier | null;
  settings: Settings;
  /** Un oral est en cours : la navigation est bloquée. */
  recording: boolean;
  sign: () => void;
  startDemo: () => void;
  quitDemo: () => void;
  wipe: () => void;
  replace: (c: Chantier) => void;
  tick: () => boolean;
  act: <T>(fn: (c: Chantier) => T) => T;
  setSettings: (p: Partial<Settings>) => void;
  setRecording: (v: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      chantier: null,
      demo: null,
      settings: DEFAULT_SETTINGS,
      recording: false,
      sign: () => set((s) => { s.chantier = freshChantier(Date.now()); s.demo = null; }),
      startDemo: () => set((s) => { s.demo = buildDemo(Date.now()); }),
      quitDemo: () => set((s) => { s.demo = null; }),
      wipe: () => set((s) => { s.chantier = null; s.demo = null; }),
      replace: (c) => set((s) => { s.chantier = c; s.demo = null; }),
      /** Érosion + passage des jours. Renvoie true si le jour a changé. */
      tick: () => {
        const before = (get().demo ?? get().chantier)?.lastDay;
        set((s) => { const c = s.demo ?? s.chantier; if (c) tick(c, Date.now()); });
        return before !== (get().demo ?? get().chantier)?.lastDay;
      },
      act: <T,>(fn: (c: Chantier) => T): T => {
        let out: T | undefined;
        set((s) => { const c = s.demo ?? s.chantier; if (c) out = fn(c as Chantier); });
        return out as T;
      },
      setSettings: (p) => set((s) => { Object.assign(s.settings, p); }),
      setRecording: (v) => set((s) => { s.recording = v; }),
    })),
    {
      name: "les-piliers",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ chantier: s.chantier, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<AppState, "chantier" | "settings">>;
        return {
          ...current,
          chantier: p.chantier ? normalize(p.chantier) : null,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

/** Le chantier affiché (démo si active). */
export const useChantier = () => useStore((s) => s.demo ?? s.chantier);
export const useIsDemo = () => useStore((s) => s.demo !== null);
export const useSettings = () => useStore((s) => s.settings);
export const aiEnabled = (s: Settings = useStore.getState().settings) => !!s.apiKey.trim();
