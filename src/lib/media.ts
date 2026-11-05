/*
 * Stockage local (IndexedDB) : enregistrements audio des oraux, photos de preuve, et « kv » (état commun de synchronisation).
 * Un média absent de l'appareil est récupéré auprès du serveur de synchronisation s'il est configuré, puis gardé en local.
 */
import { openDB, type IDBPDatabase } from "idb";
import { fetchMedia } from "./sync";

let dbp: Promise<IDBPDatabase> | null = null;
export function db() {
  dbp ??= openDB("les-piliers", 2, {
    upgrade(d) {
      if (!d.objectStoreNames.contains("audio")) d.createObjectStore("audio");
      if (!d.objectStoreNames.contains("proofs")) d.createObjectStore("proofs");
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
    },
  });
  return dbp;
}

export const saveAudio = async (ts: number, blob: Blob) => (await db()).put("audio", blob, ts);
export async function loadAudio(ts: number): Promise<Blob | undefined> {
  const local = (await (await db()).get("audio", ts)) as Blob | undefined;
  if (local) return local;
  const r = await fetchMedia("audio", String(ts));
  if (!r) return undefined;
  const b = await r.blob();
  await saveAudio(ts, b).catch(() => undefined);
  return b;
}
export const saveProof = async (id: string, dataUrl: string) => (await db()).put("proofs", dataUrl, id);
export async function loadProof(id: string): Promise<string | undefined> {
  const local = (await (await db()).get("proofs", id)) as string | undefined;
  if (local) return local;
  const r = await fetchMedia("proofs", id);
  if (!r) return undefined;
  const t = await r.text();
  await saveProof(id, t).catch(() => undefined);
  return t;
}
export async function mediaKeys(store: "audio" | "proofs"): Promise<string[]> { return (await (await db()).getAllKeys(store)).map(String); }
export async function mediaBody(store: "audio" | "proofs", key: string): Promise<{ body: Blob | string; type: string } | null> {
  const v = await (await db()).get(store, store === "audio" ? Number(key) : key);
  if (!v) return null;
  return store === "audio" ? { body: v as Blob, type: (v as Blob).type || "audio/webm" } : { body: v as string, type: "text/plain;charset=utf-8" };
}
export async function kvGet<T>(k: string): Promise<T | undefined> { return (await (await db()).get("kv", k)) as T | undefined; }
export async function kvSet(k: string, v: unknown) { await (await db()).put("kv", v, k); }
export async function clearMedia() { const d = await db(); await d.clear("audio"); await d.clear("proofs"); await d.clear("kv"); }

/** Réduit une photo en JPEG (côté le plus long `maxSide`). */
export async function toJpeg(file: File, maxSide: number, q: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  } finally { URL.revokeObjectURL(url); }
}

/** Lecture d'un enregistrement ; un seul à la fois dans l'appli. */
let current: { a: HTMLAudioElement; url: string; ts: number; onEnd: () => void } | null = null;
export async function togglePlay(ts: number, onState: (playing: boolean) => void): Promise<string | null> {
  if (current) {
    const same = current.ts === ts;
    current.a.pause(); URL.revokeObjectURL(current.url); current.onEnd(); current = null;
    if (same) return null;
  }
  const blob = await loadAudio(ts).catch(() => undefined);
  if (!blob) return "Enregistrement introuvable sur cet appareil.";
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  const onEnd = () => onState(false);
  current = { a, url, ts, onEnd };
  a.onended = () => { if (current?.a === a) { URL.revokeObjectURL(url); current = null; } onEnd(); };
  onState(true);
  try { await a.play(); } catch { onEnd(); current = null; return "Lecture impossible sur ce navigateur."; }
  return null;
}
