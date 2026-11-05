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
import { faitsOf, finishSession, setSet } from "./session";

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
  const setIdx = Math.max(0, faits[ex].findIndex((x) => x === null));
  const exoDone = faits[ex].every((x) => x !== null);
  const lastDone = [...faits[ex]].reverse().find((x) => x !== null);
  const [val, setVal] = useState<number>(lastDone ?? E.cible);
  useEffect(() => { setVal(([...faitsOf(plan)[ex]].reverse().find((x) => x !== null) ?? plan.exos[ex].cible) as number); }, [ex]);

  const totalSets = faits.reduce((a, f) => a + f.length, 0);
  const doneSets = faits.reduce((a, f) => a + f.filter((x) => x !== null).length, 0);

  useEffect(() => {
    void keepAwake(true);
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(t); void keepAwake(false); document.body.style.overflow = ""; release(); };
  }, []);

  // Fin des comptes à rebours (repos, série chronométrée).
  useEffect(() => {
    if ((mode.k === "rest" || mode.k === "timer") && now >= mode.end) {
      beep(990, 350); buzz([180, 80, 180]);
      if (mode.k === "timer") { record(mode.total); return; }
      setMode({ k: "set" });
      if (exoDone) next();
    }
  });

  function record(v: number) {
    setSet(ex, setIdx, v);
    buzz([25, 40, 25]);
    const lastSetOfExo = setIdx >= E.series - 1;
    const allDone = doneSets + 1 >= totalSets;
    if (allDone) { setMode({ k: "end" }); return; }
    if (E.repos > 0) setMode({ k: "rest", end: Date.now() + E.repos * 1000, total: E.repos });
    else { setMode({ k: "set" }); if (lastSetOfExo) next(); }
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
          <p className="muted">Ensuite : <b className="fg">{exoDone ? plan.exos[(ex + 1) % plan.exos.length].nom : `${E.nom} · série ${setIdx + 1}/${E.series}`}</b></p>
          <div className="btn-row center">
            <button className="btn" type="button" onClick={() => setMode({ ...mode, end: mode.end + 15000, total: mode.total + 15 })}>+15 s</button>
            <button className="btn primary" type="button" onClick={() => { setMode({ k: "set" }); if (exoDone) next(); }}>Passer</button>
          </div>
        </div>
      ) : mode.k === "timer" ? (
        <div className="focus-body center">
          <span className="eyebrow">{E.nom} · série {setIdx + 1}/{E.series}</span>
          <div className="ring-wrap">{ring((mode.end - now) / 1000, mode.total)}<span className="ring-n num">{Math.max(0, Math.ceil((mode.end - now) / 1000))}</span></div>
          <p className="muted">Tiens. Ne lâche pas avant zéro.</p>
          <button className="btn danger" type="button" onClick={() => record(Math.max(0, Math.round(mode.total - (mode.end - now) / 1000)))}>J'ai lâché</button>
        </div>
      ) : (
        <div className="focus-body">
          <span className="eyebrow">Exercice {ex + 1}/{plan.exos.length} · {exoDone ? "terminé" : `série ${setIdx + 1}/${E.series}`}</span>
          <h2 className="focus-name">{E.nom}</h2>
          <p className="focus-meta">{E.series} × {E.cible}{E.type === "duree" ? " s" : ""}{E.charge ? ` · ${E.charge}` : ""}{E.repos ? ` · repos ${E.repos} s` : ""}</p>
          {E.consigne && <p className="muted">{E.consigne}</p>}
          <div className="focus-sets">
            {faits[ex].map((v, k) => (
              <span key={k} className={"fs" + (v === null ? "" : v >= E.cible ? " ok" : " ko") + (k === setIdx && !exoDone ? " cur" : "")}>{v ?? "·"}</span>
            ))}
          </div>
          {!exoDone && (
            <>
              <div className="stepper">
                <button type="button" aria-label="Moins" onClick={() => { setVal((x) => Math.max(0, x - (E.type === "duree" ? 5 : 1))); buzz(6); }}>−</button>
                <span className="stepper-n num" aria-live="polite">{val}<small>{E.type === "duree" ? "s" : "reps"}</small></span>
                <button type="button" aria-label="Plus" onClick={() => { setVal((x) => x + (E.type === "duree" ? 5 : 1)); buzz(6); }}>+</button>
              </div>
              {E.type === "duree" ? (
                <div className="btn-row center">
                  <button className="btn primary big" type="button" onClick={() => { beep(660, 150); setMode({ k: "timer", end: Date.now() + val * 1000, total: val }); }}>Lancer {val} s</button>
                  <button className="btn" type="button" onClick={() => record(val)}>Déjà fait</button>
                </div>
              ) : (
                <button className="btn primary big block" type="button" onClick={() => record(val)}>Série faite · {val}</button>
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
