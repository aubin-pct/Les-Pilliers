/* Stockage des médias (IndexedDB) : enregistrements audio des oraux et photos de preuve. */
import { openDB, type IDBPDatabase } from "idb";

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB("les-piliers", 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains("audio")) d.createObjectStore("audio");
      if (!d.objectStoreNames.contains("proofs")) d.createObjectStore("proofs");
    },
  });
  return dbp;
}

export const saveAudio = async (ts: number, blob: Blob) => (await db()).put("audio", blob, ts);
export const loadAudio = async (ts: number) => (await db()).get("audio", ts) as Promise<Blob | undefined>;
export const saveProof = async (id: string, dataUrl: string) => (await db()).put("proofs", dataUrl, id);
export const loadProof = async (id: string) => (await db()).get("proofs", id) as Promise<string | undefined>;
export async function clearMedia() { const d = await db(); await d.clear("audio"); await d.clear("proofs"); }

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
