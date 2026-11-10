/* Banc d'essai (développement seulement, #/anatomie) : chaque mouvement de l'écorché, un geste pour l'ouvrir. */
import { useState } from "react";
import { MOVEMENTS } from "@/content/anatomy";
import type { Exo } from "@/engine/types";
import { ExoViewer } from "./ExoViewer";

export function AnatomyLab() {
  const [exo, setExo] = useState<Exo | null>(null);
  return (
    <div className="exo-list" style={{ padding: 16 }}>
      {MOVEMENTS.map((m) => (
        <button key={m.id} type="button" className="exo-row" data-mv={m.id}
          onClick={() => setExo({ nom: m.label, type: "reps", series: 3, cible: 10, charge: "", repos: 60, consigne: "", alternative: "", mouvement: m.id })}>
          <span className="exo-n">{m.label}</span><span className="exo-d">{m.id}</span>
        </button>
      ))}
      {exo && <ExoViewer exo={exo} onClose={() => setExo(null)} />}
    </div>
  );
}
