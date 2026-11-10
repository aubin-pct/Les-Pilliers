/*
 * Mode séance plein écran : un exercice à la fois, une série à la fois.
 * Gros chiffres lisibles à deux mètres, réglage au pouce (− / +), « Série faite » qui lance l'anneau de repos,
 * séries chronométrées avec compte à rebours, balayage pour changer d'exercice, fin avec le ressenti.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SeancePlan } from "@/engine/types";
import { beep, buzz, keepAwake } from "@/lib/device";
import { fmtDur } from "@/lib/format";
import { openLayer } from "@/lib/layers";
import { toast } from "@/store/ui";
import { HoldButton } from "@/ui/HoldButton";
import { SeeExo } from "./ExoViewer";
import { addSet, faitsOf, finishSession, parseKg, poidsOf, removeSet, setPoids, setSet } from "./session";

const fkg = (n: number) => String(n).replace(".", ",");

type Mode = { k: "set" } | { k: "rest"; end: number; total: number } | { k: "timer"; end: number; total: number } | { k: "end" };

export function FocusSession({ plan, start, onClose }: { plan: SeancePlan; start: number; onClose: () => void }) {
  const faits = faitsOf(plan);
  const firstOpen = useMemo(() => { for (let i = 0; i < faits.length; i++) { const k = faits[i].findIndex((x) => x === null); if (k >= 0) return { i, k }; } return null; }, []);
  const [ex, setEx] = useState(firstOpen?.i ?? 0);
  const [mode, setMode] = useState<Mode>(firstOpen ? { k: "set" } : { k: "end" });
  const [now, setNow] = useState(Date.now());
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;

  const E = plan.exos[ex];
  // Série corrigée à la main (on a touché une série déjà faite) : la saisie la remplace, sans repos.
  const [editK, setEditK] = useState<number | null>(null);
  useEffect(() => setEditK(null), [ex]);
  const setIdx = Math.max(0, faits[ex].findIndex((x) => x === null));
  const exoDone = faits[ex].every((x) => x !== null) && editK === null;
  const lastDone = [...faits[ex]].reverse().find((x) => x !== null);
  const [val, setVal] = useState<number>(lastDone ?? E.cible);
  // Poids : celui de la dernière série faite sur cet exercice, sinon celui prévu par la séance ; modifiable à chaque série.
  const poids = poidsOf(plan);
  const kgStart = (i: number) => { const p = poidsOf(plan)[i]; const f = faitsOf(plan)[i]; const last = p.filter((x, k) => x !== null && f[k] !== null).pop(); return last ?? parseKg(plan.exos[i].charge); };
  const [kg, setKg] = useState<number | null>(kgStart(ex));
  useEffect(() => { setVal(([...faitsOf(plan)[ex]].reverse().find((x) => x !== null) ?? plan.exos[ex].cible) as number); setKg(kgStart(ex)); }, [ex]);
  const stepKg = (d: number) => { setKg((x) => Math.max(0, Math.round(((x ?? 0) + d) * 4) / 4)); buzz(6); };

  const totalSets = faits.reduce((a, f) => a + f.length, 0);
  const doneSets = faits.reduce((a, f) => a + f.filter((x) => x !== null).length, 0);

  useEffect(() => {
    void keepAwake(true);
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(t); void keepAwake(false); document.body.style.overflow = ""; release(); };
  }, []);

  // Fin des comptes à rebours (repos, série chronométrée) : traitée une seule fois par compte à rebours.
  // (L'enregistrement de la série met le store à jour, ce qui refait un rendu avant que le mode ne change :
  // sans ce verrou, la fin du minuteur s'exécutait en boucle et validait les séries suivantes.)
  const ended = useRef(0);
  useEffect(() => {
    if ((mode.k !== "rest" && mode.k !== "timer") || now < mode.end || ended.current === mode.end) return;
    ended.current = mode.end;
    beep(990, 350); buzz([180, 80, 180]);
    if (mode.k === "timer") { record(mode.total); return; }
    setMode({ k: "set" });
    if (exoDone) next();
  }, [now, mode]);

  function record(v: number) {
    if (editK !== null) {
      const after = faits[ex].map((x, k) => (k === editK ? v : x));
      setSet(ex, editK, v); if (kg !== null) setPoids(ex, editK, kg); setEditK(null); buzz([25, 40, 25]);
      setVal([...after].reverse().find((x) => x !== null) ?? E.cible); // on revient à la dernière série faite
      return;
    }
    const lastSetOfExo = setIdx >= faits[ex].length - 1;
    const allDone = doneSets + 1 >= totalSets;
    // Le mode change avant l'écriture de la série, pour qu'aucun rendu intermédiaire ne la compte deux fois.
    if (allDone) setMode({ k: "end" });
    else if (E.repos > 0) setMode({ k: "rest", end: Date.now() + E.repos * 1000, total: E.repos });
    else setMode({ k: "set" });
    setSet(ex, setIdx, v);
    if (kg !== null) setPoids(ex, setIdx, kg);
    buzz([25, 40, 25]);
    if (!allDone && E.repos <= 0 && lastSetOfExo) next();
  }
  function next() {
    const f = faitsOf(plan);
    for (let d = 1; d <= plan.exos.length; d++) { const i = (ex + d) % plan.exos.length; if (f[i].some((x) => x === null)) { setEx(i); return; } }
    setMode({ k: "end" });
  }
  const go = (d: number) => { setEx((x) => (x + d + plan.exos.length) % plan.exos.length); setMode((m) => (m.k === "end" ? m : { k: "set" })); buzz(8); };

  const elapsed = fmtDur(now - start);
  const ring = (left: number, total: number) => {
    const k = Math.max(0, Math.min(1, left / total)), C = 2 * Math.PI * 88;
    return (
      <svg className="ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="88" className="ring-bg" />
        <circle cx="100" cy="100" r="88" className="ring-fg" strokeDasharray={`${C * k} ${C}`} transform="rotate(-90 100 100)" />
      </svg>
    );
  };

  return createPortal(
    <div className="focus" role="dialog" aria-modal="true" aria-label="Séance en plein écran"
      onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const s = swipe.current; swipe.current = null;
        if (!s || mode.k !== "set") return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      }}>
      <div className="focus-top">
        <button className="focus-x" type="button" onClick={onClose} aria-label="Revenir à la liste">✕</button>
        <div className="focus-dots" aria-label={`${doneSets} séries sur ${totalSets}`}>
          {plan.exos.map((e, i) => {
            const f = faits[i], full = f.every((x) => x !== null), some = f.some((x) => x !== null);
            return <button key={i} type="button" className={"fd" + (i === ex ? " cur" : "") + (full ? " full" : some ? " some" : "")} onClick={() => { setEx(i); setMode({ k: "set" }); }} aria-label={e.nom} />;
          })}
        </div>
        <span className="focus-clock num">{elapsed}</span>
      </div>

      {mode.k === "end" ? (
        <div className="focus-body end">
          <span className="eyebrow">Séance · {doneSets}/{totalSets} séries · {elapsed}</span>
          <h2 className="focus-name">C'est fait ?</h2>
          {plan.retourAuCalme && <p className="muted">{plan.retourAuCalme}</p>}
          <span className="muted small">Effort ressenti</span>
          <div className="rpe big">{Array.from({ length: 10 }, (_, k) => k + 1).map((n) => <button key={n} type="button" aria-pressed={rpe === n} onClick={() => { setRpe(n); buzz(10); }}>{n}</button>)}</div>
          <input type="text" className="focus-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sensations, douleurs (facultatif)" aria-label="Sensations, douleurs" />
          <HoldButton block label="Valider la séance" onConfirm={() => { const err = finishSession(rpe, note); if (err) toast(err); else onClose(); }} />
          {doneSets < totalSets && <button className="linkish" type="button" onClick={() => { setMode({ k: "set" }); next(); }}>Reprendre les séries restantes</button>}
        </div>
      ) : mode.k === "rest" ? (
        <div className="focus-body center">
          <span className="eyebrow">Repos</span>
          <div className="ring-wrap">{ring((mode.end - now) / 1000, mode.total)}<span className="ring-n num">{Math.max(0, Math.ceil((mode.end - now) / 1000))}</span></div>
          <p className="muted">Ensuite : <b className="fg">{exoDone ? plan.exos[(ex + 1) % plan.exos.length].nom : `${E.nom} · série ${setIdx + 1}/${faits[ex].length}`}</b></p>
          <div className="btn-row center">
            <button className="btn" type="button" onClick={() => setMode({ ...mode, end: mode.end + 15000, total: mode.total + 15 })}>+15 s</button>
            <button className="btn primary" type="button" onClick={() => { setMode({ k: "set" }); if (exoDone) next(); }}>Passer</button>
          </div>
        </div>
      ) : mode.k === "timer" ? (
        <div className="focus-body center">
          <span className="eyebrow">{E.nom} · série {setIdx + 1}/{faits[ex].length}</span>
          <div className="ring-wrap">{ring((mode.end - now) / 1000, mode.total)}<span className="ring-n num">{Math.max(0, Math.ceil((mode.end - now) / 1000))}</span></div>
          <p className="muted">Tiens. Ne lâche pas avant zéro.</p>
          <button className="btn danger" type="button" onClick={() => record(Math.max(0, Math.round(mode.total - (mode.end - now) / 1000)))}>J'ai lâché</button>
        </div>
      ) : (
        <div className="focus-body">
          <span className="eyebrow">Exercice {ex + 1}/{plan.exos.length} · {editK !== null ? `correction de la série ${editK + 1}` : exoDone ? "terminé" : `série ${setIdx + 1}/${faits[ex].length}`}</span>
          <h2 className="focus-name">{E.nom}</h2>
          <SeeExo exo={E} className="see-exo big" label="Voir le mouvement et les muscles" />
          <p className="focus-meta">{faits[ex].length} × {E.cible}{E.type === "duree" ? " s" : ""}{E.charge ? ` · ${E.charge}` : ""}{E.repos ? ` · repos ${E.repos} s` : ""}</p>
          {E.consigne && <p className="muted">{E.consigne}</p>}
          <div className="focus-sets">
            <button type="button" className="fs-mod" aria-label="Retirer une série" disabled={faits[ex].length <= 1} onClick={() => { removeSet(ex); setEditK(null); buzz(10); }}>−</button>
            {faits[ex].map((v, k) => (
              <button type="button" key={k} aria-label={`Série ${k + 1} : ${v ?? "à faire"}`}
                className={"fs" + (v === null ? "" : v >= E.cible ? " ok" : " ko") + ((editK === null ? k === setIdx && !exoDone : k === editK) ? " cur" : "")}
                onClick={() => { if (v === null) return; setEditK(editK === k ? null : k); setVal(v); if (poids[ex][k] !== null) setKg(poids[ex][k]); buzz(6); }}>{v ?? "·"}{poids[ex][k] !== null && <small>{fkg(poids[ex][k]!)}</small>}</button>
            ))}
            <button type="button" className="fs-mod" aria-label="Ajouter une série" disabled={faits[ex].length >= 12} onClick={() => { addSet(ex); setEditK(null); buzz(10); }}>+</button>
          </div>
          <p className="muted small center-t">Touche une série faite pour la corriger.</p>
          {!exoDone && (
            <>
              <div className="stepper">
                <button type="button" aria-label="Moins" onClick={() => { setVal((x) => Math.max(0, x - (E.type === "duree" ? 5 : 1))); buzz(6); }}>−</button>
                <span className="stepper-n num" aria-live="polite">{val}<small>{E.type === "duree" ? "s" : "reps"}</small></span>
                <button type="button" aria-label="Plus" onClick={() => { setVal((x) => x + (E.type === "duree" ? 5 : 1)); buzz(6); }}>+</button>
              </div>
              {kg !== null ? (
                <div className="kg-row">
                  <button type="button" aria-label="Poids moins" onClick={() => stepKg(-2.5)}>−</button>
                  <label className="kg-in"><input type="number" inputMode="decimal" step="0.5" min="0" aria-label="Poids en kg" value={kg} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); setKg(Number.isFinite(n) ? Math.max(0, n) : 0); }} /><small>kg</small></label>
                  <button type="button" aria-label="Poids plus" onClick={() => stepKg(2.5)}>+</button>
                  <button type="button" className="kg-off" aria-label="Sans poids" onClick={() => setKg(null)}>✕</button>
                </div>
              ) : <button className="linkish small center-t" type="button" onClick={() => setKg(parseKg(E.charge) ?? 10)}>+ Ajouter un poids</button>}
              {E.type === "duree" ? (
                editK !== null ? <button className="btn primary big block" type="button" onClick={() => record(val)}>Corriger la série {editK + 1} · {val} s</button> : (
                <div className="btn-row center">
                  <button className="btn primary big" type="button" onClick={() => { beep(660, 150); setMode({ k: "timer", end: Date.now() + val * 1000, total: val }); }}>Lancer {val} s</button>
                  <button className="btn" type="button" onClick={() => record(val)}>Déjà fait</button>
                </div>)
              ) : (
                <button className="btn primary big block" type="button" onClick={() => record(val)}>{editK !== null ? `Corriger la série ${editK + 1} · ${val}` : `Série faite · ${val}`}{kg !== null ? ` × ${fkg(kg)} kg` : ""}</button>
              )}
              {E.alternative && <p className="muted small center-t">Trop dur : {E.alternative}</p>}
            </>
          )}
          {exoDone && <button className="btn primary big block" type="button" onClick={next}>Exercice suivant</button>}
          <div className="focus-nav">
            <button className="btn ghost" type="button" onClick={() => go(-1)}>‹ Précédent</button>
            <button className="btn ghost" type="button" onClick={() => setMode({ k: "end" })}>Terminer</button>
            <button className="btn ghost" type="button" onClick={() => go(1)}>Suivant ›</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
