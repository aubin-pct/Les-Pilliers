/* Accueil après la signature : brancher le Contremaître, remplir le profil, laisser l'IA préparer le chantier. */
import { useState } from "react";
import { testKey } from "@/ai/contremaitre";
import { AIError } from "@/ai/client";
import { emptyProfile } from "@/content/profile";
import type { Profile } from "@/engine/types";
import { useChantier, useSettings, useStore } from "@/store";
import { Foreman, Thinking } from "@/ui/kit";
import { TextField } from "@/ui/fields";
import { CapitalForm, CorpsForm, EspritForm, VerbeForm } from "./ProfileForms";
import { PLAN_LABELS, runPlan, type PlanKey } from "./planner";

const STEPS = ["Contremaître", "Corps", "Capital", "Esprit", "Verbe", "Préparation"] as const;

export function Onboarding() {
  const c = useChantier()!;
  const settings = useSettings();
  const setSettings = useStore((s) => s.setSettings);
  const act = useStore((s) => s.act);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(() => c.profile ?? emptyProfile());
  const [key, setKey] = useState(settings.apiKey);
  const [keyState, setKeyState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const [plans, setPlans] = useState<Partial<Record<PlanKey, "run" | "ok" | "ko">>>({});

  const up = <K extends "corps" | "capital" | "esprit" | "verbe">(k: K) => (v: Partial<Profile[K]>) => setP((x) => ({ ...x, [k]: { ...x[k], ...v } }));
  const next = () => { setStep((s) => s + 1); window.scrollTo(0, 0); };
  const back = () => { setStep((s) => Math.max(0, s - 1)); window.scrollTo(0, 0); };

  const check = async () => {
    setSettings({ apiKey: key.trim() });
    setKeyState({ busy: true });
    try { setKeyState({ ok: await testKey() }); }
    catch (e) { setKeyState({ err: e instanceof AIError ? e.message : "Échec inattendu." }); }
  };

  const prepare = async () => {
    // updated = 0 : profil enregistré mais accueil pas terminé (l'IA lit déjà le profil).
    act((d) => { d.profile = { ...p, updated: 0 }; });
    next();
    if (!useStore.getState().settings.apiKey.trim()) return;
    const keys: PlanKey[] = ["programme", "roadmap", "esprit", "verbe"];
    setPlans(Object.fromEntries(keys.map((k) => [k, "run"])));
    await Promise.all(keys.map(async (k) => { const ok = await runPlan(k); setPlans((x) => ({ ...x, [k]: ok ? "ok" : "ko" })); }));
  };
  const finish = () => act((d) => { d.profile = { ...(d.profile ?? p), updated: Date.now() }; });

  return (
    <div className="view">
      <div className="steps-bar" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}</div>
      <span className="eyebrow">Profil · {step + 1}/{STEPS.length} · {STEPS[step]}</span>

      {step === 0 && (
        <>
          <h1 className="h-display" style={{ fontSize: 44 }}>Branche le Contremaître.</h1>
          <p className="muted">Tout ce que l'appli te propose (séances, missions, sujets, verdicts) est construit par l'IA à partir de ton profil et de tes résultats. Sans clé, tu n'as que les règles de base.</p>
          <div className="card">
            <TextField id="o-name" label="Ton prénom" value={p.prenom} onChange={(prenom) => setP((x) => ({ ...x, prenom }))} />
            <label className="f" htmlFor="o-key">Clé API DeepSeek
              <input id="o-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <p className="muted small">À créer sur platform.deepseek.com, avec quelques euros de crédit. Elle reste sur ce téléphone.</p>
            <div className="btn-row"><button className="btn" type="button" disabled={!key.trim() || keyState.busy} onClick={() => void check()}>Tester la clé</button></div>
            {keyState.busy && <Thinking>Appel du Contremaître</Thinking>}
            {keyState.ok && <Foreman who="Branché" tone="good"><p className="voice">{keyState.ok}</p></Foreman>}
            {keyState.err && <p className="down small">{keyState.err}</p>}
          </div>
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={!keyState.ok} onClick={next}>Continuer</button>
            {!keyState.ok && <button className="linkish" type="button" onClick={next}>Plus tard</button>}
          </div>
        </>
      )}

      {step === 1 && <Section title="Ton corps." sub="Objectifs, niveau, matériel, temps : ta séance du jour en dépend."><CorpsForm v={p.corps} up={up("corps")} /></Section>}
      {step === 2 && <Section title="Ton capital." sub="Plus tu es précis, plus tes missions te ressembleront. Le Contremaître ne te proposera rien hors de tes compétences et de tes moyens."><CapitalForm v={p.capital} up={up("capital")} /></Section>}
      {step === 3 && <Section title="Ton esprit." sub="Choisis tes terrains. Chaque jour, tu choisiras ton sujet parmi des propositions."><EspritForm v={p.esprit} up={up("esprit")} /></Section>}
      {step === 4 && <Section title="Ton verbe." sub="Les sujets d'oral seront taillés pour les situations où tu dois convaincre."><VerbeForm v={p.verbe} up={up("verbe")} /></Section>}

      {step >= 1 && step <= 4 && (
        <div className="btn-row">
          <button className="btn primary" type="button" onClick={step === 4 ? () => void prepare() : next}>{step === 4 ? "Préparer mon chantier" : "Continuer"}</button>
          <button className="btn ghost" type="button" onClick={back}>Retour</button>
        </div>
      )}

      {step === 5 && (
        <>
          <h1 className="h-display" style={{ fontSize: 44 }}>Le Contremaître prépare ton chantier.</h1>
          {Object.keys(plans).length ? (
            <div className="card">
              <div className="list">
                {(Object.keys(PLAN_LABELS) as PlanKey[]).map((k) => (
                  <div className="li" key={k}>
                    <span className="main">{PLAN_LABELS[k]}</span>
                    <span className={"side " + (plans[k] === "ok" ? "up" : plans[k] === "ko" ? "down" : "muted")}>{plans[k] === "ok" ? "prêt" : plans[k] === "ko" ? "échec" : "en cours…"}</span>
                  </div>
                ))}
              </div>
              {Object.values(plans).includes("ko") && <p className="muted small">Ce qui a échoué se régénère depuis chaque pilier.</p>}
            </div>
          ) : (
            <p className="muted">Sans clé, ton chantier démarre avec les contenus de base. Branche le Contremaître dans les réglages dès que possible.</p>
          )}
          <button className="btn primary block" type="button" disabled={Object.values(plans).includes("run")} onClick={finish}>Entrer dans le chantier</button>
        </>
      )}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="h-display" style={{ fontSize: 44 }}>{title}</h1>
      <p className="muted">{sub}</p>
      <div className="card">{children}</div>
    </>
  );
}
