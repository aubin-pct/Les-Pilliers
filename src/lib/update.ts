/*
 * Mises à jour de l'appli.
 * - Service worker : on lui demande de vérifier à l'ouverture, au retour sur l'appli et toutes les 30 min ;
 *   une nouvelle version s'installe et recharge la page (registerType « autoUpdate »).
 * - Version publiée : version.json de GitHub Pages. Si l'appli vient du Mac (adresse ts.net ou localhost),
 *   elle ne se met à jour que quand le conteneur est reconstruit : on le signale.
 */
import { registerSW } from "virtual:pwa-register";
import { create } from "zustand";

export const PUBLISHED = "https://aubin-pct.github.io/Les-Pilliers/";
export const fromPages = typeof location !== "undefined" && location.hostname.endsWith("github.io");

interface UpdateState { latest: string | null; checking: boolean; checkedAt: number }
export const useUpdate = create<UpdateState>()(() => ({ latest: null, checking: false, checkedAt: 0 }));

/** a > b en version sémantique simple. */
export function newer(a: string, b: string) {
  const p = (v: string) => v.split(".").map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

let reg: ServiceWorkerRegistration | undefined;

export async function checkUpdate() {
  useUpdate.setState({ checking: true });
  try { await reg?.update(); } catch { /* hors ligne */ }
  try {
    const r = await fetch(`${PUBLISHED}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) { const j = (await r.json()) as { version?: string }; if (j.version) useUpdate.setState({ latest: j.version }); }
  } catch { /* hors ligne ou bloqué : on garde la dernière réponse */ }
  useUpdate.setState({ checking: false, checkedAt: Date.now() });
}

export function startUpdates() {
  registerSW({ immediate: true, onRegisteredSW: (_url, r) => { reg = r; } });
  void checkUpdate();
  setInterval(() => void checkUpdate(), 30 * 60_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - useUpdate.getState().checkedAt > 60_000) void checkUpdate(); });
}

/** Recharge en forçant la récupération de la dernière version (vide les caches de l'appli, garde les données). */
export async function forceReload() {
  try { await reg?.update(); } catch { /* rien */ }
  try { const keys = await caches.keys(); await Promise.all(keys.filter((k) => k.startsWith("workbox-precache")).map((k) => caches.delete(k))); } catch { /* rien */ }
  try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((r) => r.unregister())); } catch { /* rien */ }
  location.reload();
}
