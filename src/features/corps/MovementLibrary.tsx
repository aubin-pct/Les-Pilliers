/*
 * Bibliothèque des mouvements : chaque mouvement de l'écorché, rangé par famille, consultable à tout moment
 * (avant de construire ou de lancer une séance). Un geste l'ouvre en 3D.
 */
import { useState } from "react";
import { FAMILLES, MOVEMENTS, type MovementDef } from "@/content/anatomy";
import type { Exo } from "@/engine/types";
import { Fold } from "@/ui/kit";
import { ExoViewer } from "./ExoViewer";

/** La version de référence en tête de sa famille. */
const FIRST = ["pompe", "traction", "crunch", "squat"];
const asExo = (m: MovementDef): Exo => ({ nom: m.label, type: "reps", series: 0, cible: 0, charge: "", repos: 0, consigne: "", alternative: "", mouvement: m.id });

export function MovementLibrary() {
  const [exo, setExo] = useState<Exo | null>(null);
  const list = MOVEMENTS.filter((m) => m.id !== "debout");
  return (
    <Fold title="Mouvements en 3D" aside={`${list.length}`}>
      {FAMILLES.map((f) => {
        const ms = list.filter((m) => m.famille === f).sort((a, b) => Number(FIRST.includes(b.id)) - Number(FIRST.includes(a.id)));
        return ms.length ? (
          <div className="mv-group" key={f}>
            <span className="eyebrow">{f}</span>
            {[...new Set(ms.map((m) => m.type ?? ""))].map((t) => (
              <div className="anat-vgroup" key={t || "autres"}>
                {t && <span className="anat-vtype">{t}</span>}
                <div className="chips">{ms.filter((m) => (m.type ?? "") === t).map((m) => <button key={m.id} type="button" className="chip" data-mv={m.id} onClick={() => setExo(asExo(m))}>{m.label}</button>)}</div>
              </div>
            ))}
          </div>
        ) : null;
      })}
      {exo && <ExoViewer exo={exo} onClose={() => setExo(null)} />}
    </Fold>
  );
}
