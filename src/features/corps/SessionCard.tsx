/*
 * Séance du jour, en quatre temps : préparer (conditions du jour → l'IA construit la séance),
 * relire, faire (chrono + saisie série par série + repos), finir (ressenti) → historique qui nourrit la séance suivante.
 */
import { useEffect, useState } from "react";
import { genSeance } from "@/ai/contremaitre";
import { EQUIPMENT } from "@/content/profile";
import { gain } from "@/engine/core";
import { fallbackSeance } from "@/engine/fallbacks";
import { POINTS, seanceGain, setsRatio } from "@/engine/scoring";
import type { Chantier, SeancePlan } from "@/engine/types";
import { beep, buzz, keepAwake } from "@/lib/device";
import { dayKey, fdate, fmtDur } from "@/lib/format";
import { useStore } from "@/store";
import { gainToast, toast } from "@/store/ui";
import { Card, Foreman, Thinking } from "@/ui/kit";
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
      <Card title="Séance du jour" aside={<span className="tag">posé</span>}>
        <p><b style={{ color: "var(--ok)" }}>Posé.</b> <span className="muted">{s.type} · {s.timed ? `${s.dur} min · ` : ""}{s.done}/{s.total} séries{s.rpe ? ` · effort ${s.rpe}/10` : ""}.</span></p>
        <p className="muted small">La prochaine séance tiendra compte de ce que tu viens de faire. Un test étalon te ferait monter plus vite que la routine.</p>
      </Card>
    );
  }
  if (!plan || adjusting) return <Prepare c={c} now={now} onDone={() => setAdjusting(false)} canCancel={!!plan} />;
  if (!running) {
    return (
      <Card title="Séance du jour" aside={<span className="tag">{plan.titre}</span>}>
        <PlanView plan={plan} />
        <div className="btn-row">
          <button className="btn primary" type="button" onClick={() => { act((d) => { d.seanceStart = Date.now(); if (d.plans.seance) d.plans.seance.faits = d.plans.seance.exos.map((e) => Array(e.series).fill(null)); }); buzz(40); }}>Démarrer la séance</button>
          <button className="btn ghost" type="button" onClick={() => setAdjusting(true)}>Changer les conditions</button>
        </div>
        <button className="linkish" type="button" onClick={() => {
          const r = act((d) => { d.seances.push({ ts: Date.now(), type: plan.titre, dur: 0, done: 0, total: 0, proof: "", timed: false }); return gain(d, "corps", POINTS.seanceSansChrono, Date.now()); });
          gainToast("corps", r, "sans chrono, presque rien");
        }}>J'ai fait ma séance sans l'appli</button>
      </Card>
    );
  }
  return <Run c={c} plan={plan} now={now} />;
}

function Prepare({ c, now, onDone, canCancel }: { c: Chantier; now: number; onDone: () => void; canCancel: boolean }) {
  const act = useStore((s) => s.act);
  const prof = c.profile?.corps;
  const [minutes, setMinutes] = useState(prof?.minutes ?? 40);
  const [energie, setEnergie] = useState("normale");
  const [materiel, setMateriel] = useState<string[]>(prof?.materiel ?? ["Aucun matériel"]);
  const [douleur, setDouleur] = useState("");
  const [demande, setDemande] = useState("");
  const [busy, setBusy] = useState(false);
  const durations = [...new Set([15, 30, 45, 60, 90, prof?.minutes ?? 40])].sort((a, b) => a - b).map((m) => ({ id: m, label: `${m}` }));
  const day = c.plans.programme?.semaine.find((s) => s.jour.toLowerCase() === new Date(now).toLocaleDateString("fr-FR", { weekday: "long" }));

  const go = async () => {
    setBusy(true);
    const r = await genSeance({ minutes, energie, materiel, douleur: douleur.trim(), demande: demande.trim() });
    setBusy(false);
    if (r) { act((d) => { d.plans.seance = { date: dayKey(Date.now()), ...r }; }); onDone(); }
  };
  return (
    <Card title="Séance du jour" aside={day ? <span className="tag">prévu : {day.focus}</span> : <span className="tag">à préparer</span>}>
      <p className="muted small">Dis au Contremaître dans quel état tu es. Il construit la séance à partir de ton programme, de tes dernières séances et de tes records.</p>
      <Segmented label="Temps disponible (minutes)" value={minutes} options={durations} onChange={setMinutes} />
      <Segmented label="Énergie" value={energie} options={ENERGY} onChange={setEnergie} />
      <Chips label="Matériel disponible aujourd'hui" options={EQUIPMENT.slice(0, 7)} value={materiel} onChange={setMateriel} allowCustom />
      <label className="f" htmlFor="sp-pain">Douleur ou gêne (facultatif)<input id="sp-pain" type="text" value={douleur} onChange={(e) => setDouleur(e.target.value)} placeholder="Ex. : épaule gauche, bas du dos" /></label>
      <label className="f" htmlFor="sp-ask">Une envie, une contrainte (facultatif)<input id="sp-ask" type="text" value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Ex. : je suis à l'hôtel, pas de bruit ; je veux insister sur les tractions" /></label>
      <div className="btn-row">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void go()}>Préparer ma séance</button>
        {canCancel && <button className="btn ghost" type="button" onClick={onDone}>Garder la séance actuelle</button>}
      </div>
      {busy && <Thinking>Le Contremaître construit ta séance</Thinking>}
      {!busy && <button className="linkish" type="button" onClick={() => { act((d) => { d.plans.seance = fallbackSeance(d, Date.now()); }); onDone(); }}>Séance de secours, sans IA</button>}
    </Card>
  );
}

function PlanView({ plan }: { plan: SeancePlan }) {
  return (
    <>
      <p className="h-display" style={{ fontSize: 26 }}>{plan.titre}</p>
      <p className="muted small">{plan.focus} · environ {plan.duree} min</p>
      {plan.pourquoi && <Foreman who="Pourquoi cette séance"><p className="voice">{plan.pourquoi}{plan.ajustement ? `\n${plan.ajustement}` : ""}</p></Foreman>}
      <p className="small"><b>Échauffement.</b> <span className="muted">{plan.echauffement}</span></p>
      <div>
        {plan.exos.map((e, i) => (
          <div className="exo" key={i}>
            <div className="exo-head"><b>{e.nom}</b><span className="meta">{e.series} × {e.cible}{e.type === "duree" ? " s" : ""}{e.charge ? ` · ${e.charge}` : ""} · repos {e.repos} s</span></div>
            {e.consigne && <span className="muted small">{e.consigne}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function Run({ c, plan, now }: { c: Chantier; plan: SeancePlan; now: number }) {
  const act = useStore((s) => s.act);
  const [rest, setRest] = useState<{ end: number; nom: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const faits = plan.faits ?? plan.exos.map((e) => Array(e.series).fill(null));

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

  const setVal = (i: number, k: number, raw: string) => {
    const v = raw === "" ? null : Math.max(0, Math.round(Number(raw.replace(",", "."))));
    act((d) => {
      const s = d.plans.seance; if (!s) return;
      s.faits = s.faits ?? s.exos.map((e) => Array(e.series).fill(null));
      s.faits[i][k] = Number.isFinite(v as number) ? v : null;
    });
  };
  const committed = (i: number, k: number) => { if (faits[i][k] !== null && plan.exos[i].repos > 0) setRest({ end: Date.now() + plan.exos[i].repos * 1000, nom: plan.exos[i].nom }); };
  const fillAll = (i: number) => act((d) => { const s = d.plans.seance; if (!s) return; s.faits = s.faits ?? s.exos.map((e) => Array(e.series).fill(null)); s.faits[i] = s.faits[i].map((x) => x ?? s.exos[i].cible); });

  const finish = () => {
    const dur = Math.round((Date.now() - (c.seanceStart ?? Date.now())) / 60000);
    const logs = plan.exos.map((e, i) => ({ exo: e.nom, type: e.type, cible: e.cible, faits: faits[i], charge: e.charge || undefined }));
    const { done, total } = setsRatio(logs);
    if (dur < 5) { toast(`${dur} min de chrono. Cinq minimum.`); return; }
    if (done < total / 2) { toast(`${done}/${total} séries. Il en faut au moins la moitié.`); return; }
    if (rpe === null) { toast("Note l'effort, de 1 à 10."); return; }
    const r = act((d) => {
      d.seances.push({ ts: Date.now(), type: plan.titre, dur, done, total, proof: `${done}/${total} séries`, timed: true, rpe, note: note.trim() || undefined, logs });
      d.seanceStart = null;
      return gain(d, "corps", seanceGain(dur, done, total), Date.now());
    });
    gainToast("corps", r);
  };

  return (
    <Card title="Séance en cours" aside={<span className="tag">{plan.titre}</span>}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div><span className="eyebrow">Chrono</span><div className="elapsed">{fmtDur(now - (c.seanceStart ?? now))}</div></div>
        <button className="linkish" type="button" onClick={() => act((d) => { d.seanceStart = null; })}>Abandonner</button>
      </div>
      <p className="small"><b>Échauffement.</b> <span className="muted">{plan.echauffement}</span></p>
      <div>
        {plan.exos.map((e, i) => (
          <div className="exo" key={i}>
            <div className="exo-head"><b>{e.nom}</b><span className="meta">{e.series} × {e.cible}{e.type === "duree" ? " s" : ""}{e.charge ? ` · ${e.charge}` : ""}</span></div>
            {e.consigne && <span className="muted small">{e.consigne}</span>}
            <div className="sets">
              {faits[i].map((v, k) => (
                <input key={k} type="number" inputMode="numeric" aria-label={`${e.nom}, série ${k + 1}`} placeholder={String(e.cible)} value={v ?? ""}
                  className={v === null ? "" : v >= e.cible ? "ok" : "ko"} onChange={(x) => setVal(i, k, x.target.value)} onBlur={() => committed(i, k)} />
              ))}
              <button className="btn small ghost" type="button" onClick={() => fillAll(i)}>Tout réussi</button>
            </div>
            {e.alternative && <span className="muted" style={{ fontSize: 12 }}>Trop dur : {e.alternative}</span>}
          </div>
        ))}
      </div>
      {plan.retourAuCalme && <p className="small"><b>Retour au calme.</b> <span className="muted">{plan.retourAuCalme}</span></p>}
      <hr className="sep" />
      <span className="muted small">Effort ressenti (1 = facile, 10 = à fond)</span>
      <div className="rpe">{Array.from({ length: 10 }, (_, k) => k + 1).map((n) => <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(n)}>{n}</button>)}</div>
      <label className="f" htmlFor="se-note">Sensations, douleurs (facultatif)<input id="se-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : épaule qui tire sur les dips" /></label>
      <button className="btn primary block" type="button" onClick={finish}>Valider la séance</button>
      <p className="muted small">Validation après 5 minutes de chrono et au moins la moitié des séries. Note ce que tu as vraiment fait : la prochaine séance en dépend.</p>
      {rest && <div className="rest" role="status">Repos · {rest.nom} <b className="num">{Math.max(0, left)}</b><button className="btn small ghost" type="button" onClick={() => setRest(null)}>Passer</button></div>}
      {c.seances.length > 0 && <p className="muted" style={{ fontSize: 12 }}>Dernière séance : {fdate(c.seances[c.seances.length - 1].ts)}</p>}
    </Card>
  );
}
