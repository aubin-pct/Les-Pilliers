/* Sauvegarde : le chantier et les réglages (sans la clé API) dans un fichier JSON. Ni l'audio ni les photos. */
import { normalize } from "@/engine/core";
import type { Chantier, Settings } from "@/engine/types";
import { dayKey } from "./format";
import { useStore } from "@/store";
import { toast } from "@/store/ui";

export interface Backup {
  app: "les-piliers";
  version: string;
  exported: number;
  settings: Pick<Settings, "baseUrl" | "model" | "deep" | "oralMode">;
  state: Chantier;
}

export async function exportBackup() {
  const { chantier, demo, settings, setSettings } = useStore.getState();
  if (!chantier || demo) return;
  const name = `les-piliers-${dayKey(Date.now())}.json`;
  const data: Backup = {
    app: "les-piliers", version: __APP_VERSION__, exported: Date.now(),
    settings: { baseUrl: settings.baseUrl, model: settings.model, deep: settings.deep, oralMode: settings.oralMode },
    state: chantier,
  };
  const file = new File([JSON.stringify(data)], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Les Piliers" }); done(); return; }
  } catch (e) { if ((e as Error).name === "AbortError") return; }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  done();
  function done() { setSettings({ lastBackup: dayKey(Date.now()) }); toast("Sauvegarde exportée."); }
}

/** Lit un fichier de sauvegarde ; lève une erreur lisible s'il n'en est pas un. Accepte aussi les exports de la v1 (« quatre-piliers »). */
export async function readBackup(file: File): Promise<Backup> {
  let d: Partial<Backup> & { app?: string };
  try { d = JSON.parse(await file.text()); } catch { throw new Error("Fichier illisible. Choisis un export des Piliers."); }
  if (!d || (d.app !== "les-piliers" && d.app !== "quatre-piliers") || !d.state || d.state.v !== 1) throw new Error("Ce fichier n'est pas une sauvegarde des Piliers.");
  return { ...(d as Backup), state: normalize(d.state) };
}
