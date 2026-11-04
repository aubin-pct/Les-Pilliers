/*
 * Mémoire du Contremaître : sa lecture de chaque pilier (synthèse, forces, faiblesses, priorité),
 * régénérée à la demande ou automatiquement quand elle a plus de 7 jours et que de nouvelles preuves sont arrivées.
 */
import { useEffect, useRef, useState } from "react";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { aiReady, genMemoire } from "@/ai/contremaitre";
import type { Chantier, PillarId } from "@/engine/types";
import { DAY, fdate } from "@/lib/format";
import { useStore } from "@/store";
import { Card, Thinking } from "@/ui/kit";

/** Nombre de preuves enregistrées sur un pilier depuis une date. */
export function proofsSince(c: Chantier, id: PillarId, ts: number) {
  switch (id) {
    case "corps": return c.seances.filter((x) => x.ts > ts).length + c.tests.filter((x) => x.ts > ts).length;
    case "capital": return c.missionLog.filter((x) => x.ts > ts).length + c.missions.filter((x) => x.ts > ts).length + c.concepts.filter((x) => x.ts > ts).length;
    case "esprit": return c.esprit.filter((x) => x.ts > ts).length;
    case "verbe": return c.orals.filter((x) => x.ts > ts).length;
  }
}
const stale = (c: Chantier, id: PillarId, now: number) => {
  const m = c.memoire[id];
  return m ? now - m.ts > 7 * DAY && proofsSince(c, id, m.ts) >= 3 : proofsSince(c, id, 0) >= 3;
};

const lastTry: Partial<Record<PillarId, number>> = {};

export async function refreshMemory(id: PillarId, silent = false) {
  lastTry[id] = Date.now();
  const r = await genMemoire(id, PILLAR[id].name, silent);
  if (r) useStore.getState().act((d) => { d.memoire[id] = { ts: Date.now(), ...r }; });
  return !!r;
}

/** Rafraîchit en arrière-plan, un pilier à la fois, les mémoires périmées. */
export function useAutoMemory(c: Chantier) {
  const running = useRef(false);
  useEffect(() => {
    if (running.current || !aiReady()) return;
    const todo = PILLAR_IDS.filter((id) => stale(c, id, Date.now()) && Date.now() - (lastTry[id] ?? 0) > 3600e3);
    if (!todo.length) return;
    running.current = true;
    (async () => { for (const id of todo) await refreshMemory(id, true); running.current = false; })();
  }, [c]);
}

export function MemoryCard({ c }: { c: Chantier }) {
  const [busy, setBusy] = useState(false);
  useAutoMemory(c);
  const all = async () => { setBusy(true); for (const id of PILLAR_IDS) await refreshMemory(id); setBusy(false); };
  return (
    <Card title="Mémoire du Contremaître" aside="sa lecture de toi">
      <p className="muted small">Ce que le Contremaître retient de tes données. Tout ce qu'il te propose part de là. Mise à jour chaque semaine.</p>
      <div>
        {PILLAR_IDS.map((id) => {
          const m = c.memoire[id];
          return (
            <div className="mem" key={id}>
              <span className="n" style={{ color: PILLAR[id].color }}>{PILLAR[id].roman} · {PILLAR[id].name}{m && <span className="mono muted" style={{ fontSize: 11, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>{fdate(m.ts)}</span>}</span>
              {m ? (
                <>
                  <span className="p">{m.synthese}</span>
                  <span className="p"><b>Priorité :</b> {m.priorite}</span>
                </>
              ) : <span className="p muted">Pas encore assez de preuves (3 minimum).</span>}
            </div>
          );
        })}
      </div>
      <div className="btn-row"><button className="btn" type="button" disabled={busy} onClick={() => void all()}>Faire le bilan maintenant</button></div>
      {busy && <Thinking>Le Contremaître relit tes quatre piliers</Thinking>}
    </Card>
  );
}

/** Rappel de la priorité du pilier, en tête de chaque chantier. */
export function MemoryNote({ c, id }: { c: Chantier; id: PillarId }) {
  const m = c.memoire[id];
  if (!m) return null;
  return (
    <div className="foreman">
      <span className="who">Priorité du Contremaître</span>
      <p className="voice">{m.priorite}</p>
      {m.faiblesses.length > 0 && <p className="muted small">À travailler : {m.faiblesses.join(" · ")}</p>}
    </div>
  );
}
