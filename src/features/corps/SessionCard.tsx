/*
 * Séance du jour, en quatre temps : préparer (conditions du jour → l'IA construit la séance),
 * relire, faire (chrono + saisie série par série + repos), finir (ressenti) → historique qui nourrit la séance suivante.
 */
import { useEffect, useState } from "react";
import { prepareSeance } from "@/ai/ops";
import { EQUIPMENT } from "@/content/profile";
import { gain } from "@/engine/core";
import { fallbackSeance } from "@/engine/fallbacks";
import { POINTS, setsRatio } from "@/engine/scoring";
import { HoldButton } from "@/ui/HoldButton";
import { FocusSession } from "./FocusSession";
import { addSet, faitsOf, fillExo, finishSession, parseKg, poidsOf, removeSet, setPoids, setSet } from "./session";
import type { Chantier, SeancePlan } from "@/engine/types";
import { beep, buzz, keepAwake } from "@/lib/device";
import { dayKey, fmtDur } from "@/lib/format";
import { useStore } from "@/store";
import { gainToast, toast } from "@/store/ui";
import { Card, Fold, Thinking } from "@/ui/kit";
import { Chips, Segmented } from "@/ui/fields";

const ENERGY = [{ id: "basse", label: "Basse" }, { id: "normale", label: "Normale" }, { id: "haute", label: "Haute" }];

export function SessionCard({ c, now }: { c: Chantier; now: number }) {
  const act = useStore((s) => s.act);
  const today = dayKey(now);
  const done = c.seances.filter((s) => dayKey(s.ts) === today);
  const plan = c.plans.seance?.date === today ? c.plans.seance : null;
  const running = c.seanceStart !== null && !!plan;
  const [adjusting, setAdjusting] = useState(false);

  if (done.length && !running) {
    const s = done[done.length - 1];
    return (
      <Card title="Séance du jour" aside={<span className="tag ok">posé</span>}>
        <p className="h-display" style={{ fontSize: 24 }}>{s.type}</p>
        <div className="kpis">
          <div><b className="num">{s.timed ? s.dur : "—"}</b><span>min</span></div>
          <div><b className="num">{s.done}/{s.total}</b><span>séries</span></div>
          <div><b className="num">{s.rpe ?? "—"}</b><span>effort</span></div>
        </div>
      </Card>
    );
  }
  if (!plan || adjusting) return <Prepare c={c} now={now} onDone={() => setAdjusting(false)} canCancel={!!plan} />;
  if (!running) {
    return (
      <Card title="Séance du jour" aside={<span className="tag">prête</span>}>
        <p className="h-display" style={{ fontSize: 26 }}>{plan.titre}</p>
        <PlanView plan={plan} />
        <div className="btn-row">
          <button className="btn primary" type="button" onClick={() => { act((d) => { d.seanceStart = Date.now(); if (d.plans.seance) d.plans.seance.faits = d.plans.seance.exos.map((e) => Array(e.series).fill(null)); }); buzz(40); }}>Démarrer la séance</button>
          <button className="btn ghost" type="button" onClick={() => setAdjusting(true)}>Changer</button>
        </div>
        <button className="linkish small" type="button" onClick={() => {
          const r = act((d) => { d.seances.push({ ts: Date.now(), type: plan.titre, dur: 0, done: 0, total: 0, proof: "", timed: false }); return gain(d, "corps", POINTS.seanceSansChrono, Date.now()); });
          gainToast("corps", r, "sans chrono, presque rien");
        }}>Faite sans l'appli (+1)</button>
      </Card>
    );
  }
  return <Run c={c} plan={plan} now={now} />;
}

function Prepare({ c, now, onDone, canCancel }: { c: Chantier; now: number; onDone: () => void; canCancel: boolean }) {
  const act = useStore((s) => s.act);
  const prof = c.profile?.corps;
  // Modifier une séance existante : on repart de ses conditions, et seule la nouvelle demande s'ajoute.
  const cur = c.plans.seance?.date === dayKey(now) ? c.plans.seance : null;
  const prev = cur?.conditions;
  const [minutes, setMinutes] = useState(prev?.minutes ?? prof?.minutes ?? 40);
  const [energie, setEnergie] = useState(prev?.energie ?? "normale");
  const [materiel, setMateriel] = useState<string[]>(prev?.materiel ?? prof?.materiel ?? ["Aucun matériel"]);
  const [douleur, setDouleur] = useState(prev?.douleur ?? "");
  const [demande, setDemande] = useState("");
  const [busy, setBusy] = useState(false);
  const durations = [...new Set([15, 30, 45, 60, 90, prof?.minutes ?? 40])].sort((a, b) => a - b).map((m) => ({ id: m, label: `${m}` }));
  const day = c.plans.programme?.semaine.find((s) => s.jour.toLowerCase() === new Date(now).toLocaleDateString("fr-FR", { weekday: "long" }));

  const go = async (neuf = false) => {
    setBusy(true);
    const r = await prepareSeance({ minutes, energie, materiel, douleur: douleur.trim(), demande: demande.trim(), neuf });
    setBusy(false);
    if (r) { if (cur && !neuf) toast(r); onDone(); }
  };
  const ask = <label className="f" htmlFor="sp-ask">{cur ? "Ce qu'il faut changer" : "Envie, contrainte"}<input id="sp-ask" type="text" value={demande} onChange={(e) => setDemande(e.target.value)} placeholder={cur ? "Ex. : ajoute 10 min de cardio à la fin" : "Ex. : hôtel, pas de bruit"} /></label>;
  return (
    <Card title="Séance du jour" aside={cur ? "modifier" : "à préparer"}>
      {cur ? <p className="planned"><span className="eyebrow">Actuelle</span><b>{cur.titre} · {cur.exos.length} exercices</b></p>
        : day && <p className="planned"><span className="eyebrow">Prévu</span><b>{day.focus}</b></p>}
      {cur && ask}
      {cur && (cur.demandes?.length ?? 0) > 0 && <div className="chips">{cur.demandes!.map((d) => <span key={d} className="chip on">✓ {d}</span>)}</div>}
      <Segmented label="Minutes" value={minutes} options={durations} onChange={setMinutes} />
      <Segmented label="Énergie" value={energie} options={ENERGY} onChange={setEnergie} />
      <Fold title={cur ? "Matériel, douleur" : "Matériel, douleur, envie"}>
        <Chips options={EQUIPMENT.slice(0, 7)} value={materiel} onChange={setMateriel} allowCustom />
        <label className="f" htmlFor="sp-pain">Douleur<input id="sp-pain" type="text" value={douleur} onChange={(e) => setDouleur(e.target.value)} placeholder="Ex. : épaule gauche" /></label>
        {!cur && ask}
      </Fold>
      <div className="btn-row">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void go()}>{cur ? "Modifier ma séance" : "Construire ma séance"}</button>
        {canCancel && <button className="btn ghost" type="button" onClick={onDone}>Annuler</button>}
      </div>
      {busy && <Thinking>{cur ? "Il modifie ta séance" : "Il construit ta séance"}</Thinking>}
      {!busy && cur && <button className="linkish small" type="button" onClick={() => void go(true)}>Repartir de zéro</button>}
      {!busy && <button className="linkish small" type="button" onClick={() => { act((d) => { d.plans.seance = fallbackSeance(d, Date.now()); }); onDone(); }}>Séance de secours, sans IA</button>}
    </Card>
  );
}

function PlanView({ plan }: { plan: SeancePlan }) {
  return (
    <>
      <div className="kpis">
        <div><b className="num">{plan.duree}</b><span>min</span></div>
        <div><b className="num">{plan.exos.length}</b><span>exercices</span></div>
        <div><b className="num">{plan.exos.reduce((a, e) => a + e.series, 0)}</b><span>séries</span></div>
      </div>
      <div className="exo-list">
        {plan.exos.map((e, i) => (
          <div className="exo-row" key={i}><span className="exo-n">{e.nom}</span><span className="exo-d num">{e.series}×{e.cible}{e.type === "duree" ? "s" : ""}</span></div>
        ))}
      </div>
      {plan.pourquoi && <Fold title="Pourquoi cette séance"><p className="voice">{plan.pourquoi}{plan.ajustement ? `\n${plan.ajustement}` : ""}</p><p className="small muted">Échauffement : {plan.echauffement}</p></Fold>}
    </>
  );
}

function Run({ c, plan, now }: { c: Chantier; plan: SeancePlan; now: number }) {
  const act = useStore((s) => s.act);
  const [focus, setFocus] = useState(true);
  const [rest, setRest] = useState<{ end: number; nom: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const faits = faitsOf(plan), poids = poidsOf(plan);
  const [withKg, setWithKg] = useState<Set<number>>(new Set());
  const { done, total } = setsRatio(faits.map((f) => ({ faits: f })));

  useEffect(() => { void keepAwake(true); return () => { void keepAwake(false); }; }, []);
  useEffect(() => {
    if (!rest) return;
    const t = setInterval(() => {
      const l = Math.ceil((rest.end - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) { setRest(null); beep(990, 300); buzz([150, 80, 150]); }
    }, 250);
    return () => clearInterval(t);
  }, [rest]);

  const committed = (i: number, k: number) => { if (faits[i][k] !== null && plan.exos[i].repos > 0) setRest({ end: Date.now() + plan.exos[i].repos * 1000, nom: plan.exos[i].nom }); };

  return (
    <Card title="Séance en cours" aside={plan.titre}>
      <div className="run-head">
        <div><span className="eyebrow">Chrono</span><div className="elapsed">{fmtDur(now - (c.seanceStart ?? now))}</div></div>
        <div className="run-progress"><span className="num">{done}/{total}</span><span className="muted">séries</span></div>
      </div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      <button className="btn primary block big" type="button" onClick={() => setFocus(true)}>Plein écran</button>
      <Fold title="Saisie en liste">
      <div>
        {plan.exos.map((e, i) => (
          <div className="exo" key={i}>
            <div className="exo-head"><b>{e.nom}</b><span className="meta">{faits[i].length} × {e.cible}{e.type === "duree" ? " s" : ""}{e.charge ? ` · ${e.charge}` : ""}</span></div>
            {e.consigne && <span className="muted small">{e.consigne}</span>}
            <div className="sets">
              <button className="btn small ghost" type="button" aria-label={`${e.nom} : retirer une série`} disabled={faits[i].length <= 1} onClick={() => removeSet(i)}>−</button>
              {faits[i].map((v, k) => (
                <span className="set-cell" key={k}>
                  <input type="number" inputMode="numeric" aria-label={`${e.nom}, série ${k + 1}`} placeholder={String(e.cible)} value={v ?? ""}
                    className={v === null ? "" : v >= e.cible ? "ok" : "ko"} onChange={(x) => setSet(i, k, x.target.value === "" ? null : Number(x.target.value.replace(",", ".")))} onBlur={() => committed(i, k)} />
                  {(withKg.has(i) || poids[i].some((p) => p !== null) || parseKg(e.charge) !== null) && (
                    <input type="number" inputMode="decimal" className="kg" aria-label={`${e.nom}, série ${k + 1}, poids en kg`} placeholder={String(parseKg(e.charge) ?? "kg")} value={poids[i][k] ?? ""}
                      onChange={(x) => setPoids(i, k, x.target.value === "" ? null : Number(x.target.value.replace(",", ".")))} />
                  )}
                </span>
              ))}
              <button className="btn small ghost" type="button" aria-label={`${e.nom} : ajouter une série`} disabled={faits[i].length >= 12} onClick={() => addSet(i)}>+</button>
              <button className="btn small ghost" type="button" onClick={() => fillExo(i)}>Tout réussi</button>
              {!(withKg.has(i) || poids[i].some((p) => p !== null) || parseKg(e.charge) !== null) && <button className="btn small ghost" type="button" onClick={() => setWithKg((s) => new Set(s).add(i))}>+ kg</button>}
            </div>
            {e.alternative && <span className="muted" style={{ fontSize: 12 }}>Trop dur : {e.alternative}</span>}
          </div>
        ))}
      </div>
      </Fold>
      <span className="muted small">Effort ressenti, 1 à 10</span>
      <div className="rpe">{Array.from({ length: 10 }, (_, k) => k + 1).map((n) => <button key={n} type="button" aria-pressed={rpe === n} onClick={() => { setRpe(n); buzz(10); }}>{n}</button>)}</div>
      <input id="se-note" aria-label="Sensations" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sensations, douleurs (facultatif)" />
      <HoldButton block label="Valider la séance" onConfirm={() => { const err = finishSession(rpe, note); if (err) toast(err); }} />
      <div className="btn-row spread">
        <p className="muted small">5 min et ½ des séries minimum.</p>
        <button className="linkish" type="button" onClick={() => act((d) => { d.seanceStart = null; })}>Abandonner</button>
      </div>
      {rest && <div className="rest" role="status">Repos · {rest.nom} <b className="num">{Math.max(0, left)}</b><button className="btn small ghost" type="button" onClick={() => setRest(null)}>Passer</button></div>}
      {focus && <FocusSession plan={plan} start={c.seanceStart ?? now} onClose={() => setFocus(false)} />}
    </Card>
  );
}
