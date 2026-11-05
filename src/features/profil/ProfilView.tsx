/* Page profil : modifier ce que l'on a déclaré, puis faire régénérer les plans concernés. */
import { useState } from "react";
import { emptyProfile } from "@/content/profile";
import type { Profile } from "@/engine/types";
import { useChantier, useIsDemo, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Card } from "@/ui/kit";
import { Segmented } from "@/ui/fields";
import { CapitalForm, CorpsForm, EspritForm, VerbeForm } from "./ProfileForms";
import { PLAN_LABELS, runPlan, type PlanKey } from "./planner";

type Tab = "corps" | "capital" | "esprit" | "verbe";
const REGEN: Record<Tab, PlanKey[]> = { corps: ["programme"], capital: [], esprit: ["carte", "esprit"], verbe: [] };

export function ProfilView() {
  const c = useChantier()!;
  const demo = useIsDemo();
  const act = useStore((s) => s.act);
  const [p, setP] = useState<Profile>(() => structuredClone(c.profile ?? emptyProfile()));
  const [tab, setTab] = useState<Tab>("corps");
  const [dirty, setDirty] = useState<Set<Tab>>(new Set());
  const [regen, setRegen] = useState<Partial<Record<PlanKey, "run" | "ok" | "ko">>>({});
  const [saved, setSaved] = useState<Tab[]>([]);

  const up = <K extends Tab>(k: K) => (v: Partial<Profile[K]>) => { setP((x) => ({ ...x, [k]: { ...x[k], ...v } })); setDirty((d) => new Set(d).add(k)); };
  const save = () => {
    act((d) => { d.profile = { ...p, updated: Date.now() }; });
    setSaved([...dirty]); setDirty(new Set());
    toast("Profil enregistré.");
  };
  const regenerate = async (keys: PlanKey[]) => {
    setRegen((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, "run"])) }));
    await Promise.all(keys.map(async (k) => { const ok = await runPlan(k); setRegen((r) => ({ ...r, [k]: ok ? "ok" : "ko" })); }));
  };
  const toRegen = [...new Set(saved.flatMap((t) => REGEN[t]))];

  return (
    <div className="view">
      <div className="phead"><span className="rom" aria-hidden="true">Ø</span><div className="t"><span className="eyebrow">Ce que le Contremaître sait de toi</span><h1>Profil</h1></div><div /></div>
      {demo && <div className="band"><p>Profil de démonstration : les modifications ne sont pas enregistrées.</p></div>}
      <Segmented value={tab} onChange={setTab} options={[{ id: "corps", label: "Corps" }, { id: "capital", label: "Capital" }, { id: "esprit", label: "Esprit" }, { id: "verbe", label: "Verbe" }]} />
      <Card>
        {tab === "corps" && <CorpsForm v={p.corps} up={up("corps")} />}
        {tab === "capital" && <CapitalForm v={p.capital} up={up("capital")} />}
        {tab === "esprit" && <EspritForm v={p.esprit} up={up("esprit")} />}
        {tab === "verbe" && <VerbeForm v={p.verbe} up={up("verbe")} />}
      </Card>
      <div className="btn-row"><button className="btn primary" type="button" disabled={!dirty.size} onClick={save}>Enregistrer le profil</button></div>
      {toRegen.length > 0 && (
        <Card title="Mettre à jour les plans">
          <p className="muted small">Ton profil a changé. Le Contremaître peut reconstruire ce qui en dépend ; ton historique est conservé.</p>
          <div className="list">
            {toRegen.map((k) => (
              <div className="li" key={k}>
                <span className="main">{PLAN_LABELS[k]}</span>
                <span className={"side " + (regen[k] === "ok" ? "up" : regen[k] === "ko" ? "down" : "muted")}>{regen[k] === "ok" ? "refait" : regen[k] === "ko" ? "échec" : regen[k] === "run" ? "en cours…" : ""}</span>
              </div>
            ))}
          </div>
          <div><button className="btn" type="button" disabled={Object.values(regen).includes("run")} onClick={() => void regenerate(toRegen)}>Régénérer</button></div>
        </Card>
      )}
    </div>
  );
}
