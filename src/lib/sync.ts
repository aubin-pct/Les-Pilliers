/*
 * Synchronisation avec le serveur Docker du Mac.
 *
 * Chaque appareil garde, en IndexedDB, l'« état commun » : la dernière version échangée avec le serveur et son numéro
 * de révision. Une synchronisation :
 *  1. demande l'état du serveur (204 s'il n'a pas changé depuis la révision commune) ;
 *  2. rien n'a changé ici → on prend la version du serveur ; rien n'a changé là-bas → on pousse la nôtre ;
 *     les deux ont changé → fusion à trois voies (engine/sync.ts), puis on pousse le résultat ;
 *  3. si le serveur a bougé entre-temps (409), on recommence ;
 *  4. envoie les médias (audio, photos) que le serveur n'a pas encore.
 * Premier rattachement d'un appareil déjà utilisé à un serveur qui a déjà des données : l'utilisateur choisit
 * (garder le serveur, garder cet appareil, fusionner).
 */
import { create } from "zustand";
import { freshChantier, normalize, tick } from "@/engine/core";
import { mergeChantier, proofCount } from "@/engine/sync";
import type { Chantier } from "@/engine/types";
import { useStore } from "@/store";
import { kvGet, kvSet, mediaBody, mediaKeys } from "./media";

type Remote = { rev: number; savedAt: number; state: Chantier | null; shared: Shared | null };
type Shared = { apiKey?: string; baseUrl?: string; model?: string; deep?: boolean };
type Base = { url: string; rev: number; state: Chantier | null };

export type SyncStatus =
  | { kind: "off" }
  | { kind: "idle" | "syncing" }
  | { kind: "ok"; at: number; rev: number }
  | { kind: "error"; at: number; message: string }
  | { kind: "choice"; remote: Remote };

export const useSync = create<{ status: SyncStatus }>()(() => ({ status: { kind: "off" } }));
const setStatus = (status: SyncStatus) => useSync.setState({ status });

const BASE_KEY = "sync-base";
const SENT_KEY = "sync-media-sent";

function config() {
  const s = useStore.getState().settings;
  const url = s.syncUrl.trim().replace(/\/+$/, "");
  return url && s.syncToken.trim() ? { url, token: s.syncToken.trim() } : null;
}
export const syncConfigured = () => !!config();

const device = () => (/iPhone|Android/i.test(navigator.userAgent) ? "téléphone" : "ordinateur");

/** Distingue « Mac injoignable » de « Mac joint mais qui refuse cette adresse » (CORS). */
async function whyUnreachable(url: string) {
  try {
    await fetch(url + "/api/health", { mode: "no-cors", cache: "no-store" });
    return `Le Mac répond mais refuse cette adresse (${location.origin}). Mets-le à jour : git pull && docker compose up -d --build.`;
  } catch {
    return "Serveur injoignable. Tailscale est-il actif sur ce téléphone, et le Mac allumé ?";
  }
}

async function api(path: string, init: RequestInit = {}, cfg = config()): Promise<Response> {
  if (!cfg) throw new Error("Synchronisation non configurée.");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    // Depuis une autre origine (GitHub Pages), seuls les en-têtes standard : un serveur pas encore mis à jour
    // refuserait l'en-tête X-Device et le navigateur bloquerait toute la requête.
    const same = new URL(cfg.url, location.href).origin === location.origin;
    return await fetch(cfg.url + path, {
      ...init, signal: ctl.signal, cache: "no-store",
      headers: { Authorization: `Bearer ${cfg.token}`, ...(same ? { "X-Device": device() } : {}), ...(init.headers ?? {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Le serveur ne répond pas.");
    throw new Error(await whyUnreachable(cfg.url));
  } finally { clearTimeout(t); }
}

/** Vérifie l'adresse et le jeton. Renvoie un message d'erreur, ou null si tout va bien. */
export async function testConnection(url: string, token: string): Promise<string | null> {
  const cfg = { url: url.trim().replace(/\/+$/, ""), token: token.trim() };
  try {
    const h = await api("/api/health", {}, cfg);
    const j = await h.json().catch(() => ({}));
    if (!h.ok || j.app !== "les-piliers") return "Ce n'est pas un serveur des Piliers.";
    const s = await api("/api/state?since=-2", {}, cfg);
    if (s.status === 401) return "Jeton refusé.";
    if (!s.ok && s.status !== 204) return `Erreur du serveur (${s.status}).`;
    return null;
  } catch (e) { return (e as Error).message; }
}

/** Le serveur de cette page, si l'appli est servie par le conteneur Docker. */
export async function detectSameOrigin(): Promise<string | null> {
  if (/github\.io$/.test(location.hostname)) return null;
  try {
    const r = await fetch(`${location.origin}/api/health`, { cache: "no-store" });
    const j = await r.json();
    return j.app === "les-piliers" ? location.origin : null;
  } catch { return null; }
}

const loadBase = async () => { const b = await kvGet<Base>(BASE_KEY).catch(() => undefined); const cfg = config(); return b && cfg && b.url === cfg.url ? b : null; };
const saveBase = (rev: number, state: Chantier | null) => kvSet(BASE_KEY, { url: config()!.url, rev, state: state && JSON.parse(JSON.stringify(state)) });
export const forgetBase = () => kvSet(BASE_KEY, null);

function sharedSettings(): Shared {
  const s = useStore.getState().settings;
  return { apiKey: s.apiKey, baseUrl: s.baseUrl, model: s.model, deep: s.deep };
}
/** La clé IA saisie sur un appareil arrive sur l'autre s'il n'en a pas. */
function applyShared(sh: Shared | null) {
  const st = useStore.getState();
  if (sh?.apiKey && !st.settings.apiKey.trim()) st.setSettings({ apiKey: sh.apiKey, baseUrl: sh.baseUrl || st.settings.baseUrl, model: sh.model || st.settings.model, deep: !!sh.deep });
}

function adopt(state: Chantier) {
  const c = normalize(JSON.parse(JSON.stringify(state)));
  tick(c, Date.now());
  c.updatedAt = state.updatedAt; // pas une modification locale
  useStore.getState().replace(c);
}

let running = false;
let again = false;

export async function syncNow(): Promise<void> {
  if (!config()) { setStatus({ kind: "off" }); return; }
  if (useStore.getState().demo) return;
  if (running) { again = true; return; }
  running = true;
  if (useSync.getState().status.kind !== "choice") setStatus({ kind: "syncing" });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const base = await loadBase();
      const r = await api(`/api/state?since=${base?.rev ?? -1}`);
      if (r.status === 401) throw new Error("Jeton refusé. Vérifie-le dans les réglages.");
      if (!r.ok && r.status !== 204) throw new Error(`Erreur du serveur (${r.status}).`);
      const remote: Remote | null = r.status === 204 ? null : await r.json();
      if (remote) applyShared(remote.shared);
      const serverRev = remote ? remote.rev : base!.rev;
      const serverState = remote ? remote.state : base!.state;
      const local = useStore.getState().chantier;

      let push: Chantier | null = null;
      if (!local) {
        if (serverState) { adopt(serverState); await saveBase(serverRev, serverState); }
        setStatus({ kind: "ok", at: Date.now(), rev: serverRev });
        return;
      }
      if (!serverState) push = local;
      else if (!base) {
        if (proofCount(local) === 0 && !local.profile?.updated) { adopt(serverState); await saveBase(serverRev, serverState); setStatus({ kind: "ok", at: Date.now(), rev: serverRev }); return; }
        if (proofCount(serverState) === 0 && !serverState.profile?.updated) push = local;
        else { setStatus({ kind: "choice", remote: { ...(remote as Remote), state: serverState } }); return; }
      } else if (serverRev === base.rev) {
        const dirty = !base.state || local.updatedAt !== base.state.updatedAt || local.lastDay !== base.state.lastDay;
        if (!dirty) { setStatus({ kind: "ok", at: Date.now(), rev: serverRev }); break; }
        push = local;
      } else {
        const localChanged = !base.state || local.updatedAt !== base.state.updatedAt;
        if (!localChanged) { adopt(serverState); await saveBase(serverRev, serverState); setStatus({ kind: "ok", at: Date.now(), rev: serverRev }); break; }
        push = mergeChantier(base.state ?? freshChantier(local.created), local, serverState, Date.now());
        useStore.getState().replace(push);
      }

      const put = await api("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseRev: serverRev, state: push, shared: sharedSettings() }) });
      if (put.status === 409) continue; // le serveur a bougé : on refusionne
      if (!put.ok) throw new Error(put.status === 413 ? "Chantier trop volumineux pour le serveur." : `Erreur du serveur (${put.status}).`);
      const { rev } = await put.json();
      await saveBase(rev, push);
      setStatus({ kind: "ok", at: Date.now(), rev });
      break;
    }
    await pushMedia();
  } catch (e) {
    setStatus({ kind: "error", at: Date.now(), message: (e as Error).message });
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}

/** Réponse au premier rattachement d'un appareil déjà utilisé. */
export async function resolveChoice(choice: "server" | "local" | "merge") {
  const s = useSync.getState().status;
  if (s.kind !== "choice" || !s.remote.state) return;
  const { rev, state } = s.remote;
  const local = useStore.getState().chantier;
  if (choice === "server" || !local) { adopt(state); await saveBase(rev, state); setStatus({ kind: "ok", at: Date.now(), rev }); return; }
  const merged = choice === "local" ? local : mergeChantier(freshChantier(Math.min(local.created, state.created)), local, state, Date.now());
  if (choice === "merge") useStore.getState().replace(merged);
  await saveBase(rev, state); // base = serveur : la synchro suivante pousse la version gardée
  useStore.getState().act(() => undefined); // marque une modification locale, pour qu'elle soit poussée
  setStatus({ kind: "idle" });
  await syncNow();
}

/** Envoie au serveur les médias qu'il n'a pas encore. */
async function pushMedia() {
  const sent = new Set((await kvGet<string[]>(SENT_KEY).catch(() => undefined)) ?? []);
  let list: Record<string, string[]> | null = null;
  for (const store of ["audio", "proofs"] as const) {
    const keys = (await mediaKeys(store).catch(() => [])).filter((k) => !sent.has(`${store}/${k}`));
    if (!keys.length) continue;
    if (!list) { const r = await api("/api/media"); list = r.ok ? await r.json() : { audio: [], proofs: [] }; }
    for (const k of keys) {
      if (!list![store]?.includes(k)) {
        const m = await mediaBody(store, k);
        if (!m) continue;
        const r = await api(`/api/media/${store}/${encodeURIComponent(k)}`, { method: "PUT", headers: { "Content-Type": m.type }, body: m.body });
        if (!r.ok) continue;
      }
      sent.add(`${store}/${k}`);
    }
  }
  await kvSet(SENT_KEY, [...sent]);
}

/** Récupère un média depuis le serveur (null si absent ou pas de synchronisation). */
export async function fetchMedia(store: "audio" | "proofs", key: string): Promise<Response | null> {
  if (!config()) return null;
  try { const r = await api(`/api/media/${store}/${encodeURIComponent(key)}`); return r.ok ? r : null; } catch { return null; }
}

/** Synchronisation automatique : au démarrage, au retour sur l'appli, 3 s après une modification, et chaque minute. */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = useStore.getState().chantier?.updatedAt;
  const soon = (ms: number) => { if (timer) clearTimeout(timer); timer = setTimeout(() => { if (!useStore.getState().recording) void syncNow(); }, ms); };
  const unsub = useStore.subscribe((s) => {
    const u = s.chantier?.updatedAt;
    if (u !== last) { last = u; if (config()) soon(3000); }
  });
  const onVis = () => { if (document.visibilityState === "visible" && config()) soon(300); };
  const onOnline = () => { if (config()) soon(500); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", onOnline);
  const iv = setInterval(() => { if (document.visibilityState === "visible" && config()) void syncNow(); }, 60_000);
  if (config()) soon(800); else setStatus({ kind: "off" });
  return () => { unsub(); clearInterval(iv); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); };
}
