/*
 * L'exercice vu en écorché 3D : un humain qui fait le mouvement, les muscles qui travaillent allumés selon leur part
 * de l'effort. On tourne autour au doigt, on touche un muscle pour savoir lequel c'est et ce qu'il fait.
 * three.js n'est chargé qu'à l'ouverture (morceau séparé).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MOVEMENT_BY_ID, MUSCLE_BY_ID, type MuscleId } from "@/content/anatomy";
import { exoAnatomy } from "@/engine/anatomy";
import type { Exo } from "@/engine/types";
import { buzz } from "@/lib/device";
import { openLayer } from "@/lib/layers";
import type { BodyViewer, View } from "./body3d/viewer";

/** Même rampe que le shader : repos (neutre) → vert → jaune → orange → rouge. */
export function heatCss(h: number) {
  const stops: [number, number[]][] = [[0, [122, 111, 104]], [0.08, [56, 158, 77]], [0.45, [230, 204, 46]], [0.72, [247, 122, 31]], [0.95, [224, 26, 20]], [1, [224, 26, 20]]];
  let i = 0; while (i < stops.length - 2 && h > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const u = Math.max(0, Math.min(1, (h - a) / (b - a)));
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * u)).join(",")})`;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ExoViewer({ exo, onClose }: { exo: Exo; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<BodyViewer | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const anat = useMemo(() => exoAnatomy(exo), [exo]);
  const [status, setStatus] = useState<"load" | "ok" | "err">("load");
  const [sel, setSel] = useState<MuscleId | null>(null);
  const [playing, setPlaying] = useState(!reduced());
  const [slow, setSlow] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const info = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); release(); };
  }, []);

  useEffect(() => {
    let alive = true;
    void import("./body3d/viewer").then(({ BodyViewer, hasWebGL }) => {
      if (!alive || !canvas.current) return;
      if (!hasWebGL()) { setStatus("err"); return; }
      const css = getComputedStyle(document.documentElement);
      try {
        const v = new BodyViewer(canvas.current, {
          accent: css.getPropertyValue("--c-corps").trim() || "#d08a5a",
          bg: css.getPropertyValue("--bg").trim() || "#101215",
          reducedMotion: false,
          onPick: (id) => { setSel(id); buzz(8); },
        });
        v.setPlaying(!reduced());
        viewer.current = v;
        if (import.meta.env.DEV) (window as unknown as { __anat?: BodyViewer }).__anat = v;
        setStatus("ok");
      } catch (e) { console.error(e); setStatus("err"); }
    }).catch(() => alive && setStatus("err"));
    return () => { alive = false; viewer.current?.dispose(); viewer.current = null; };
  }, []);

  useEffect(() => { if (status === "ok") viewer.current?.setExercise(anat.mouvement, anat.muscles); }, [status, anat]);
  useEffect(() => { viewer.current?.select(sel); if (sel) info.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [sel, status]);
  useEffect(() => { viewer.current?.setPlaying(playing); }, [playing, status]);
  useEffect(() => { viewer.current?.setSpeed(slow ? 0.4 : 1); }, [slow, status]);
  useEffect(() => { viewer.current?.setIsolate(isolate); }, [isolate, status]);

  const selW = sel ? anat.muscles.find((m) => m.id === sel) : undefined;
  const M = sel ? MUSCLE_BY_ID[sel] : null;
  const princ = anat.muscles.filter((m) => m.principal);
  const sec = anat.muscles.filter((m) => !m.principal);

  return createPortal(
    // Un portail propage ses événements à ses parents React : la séance plein écran ne doit pas prendre un glissé pour un balayage.
    <div className="anat" role="dialog" aria-modal="true" aria-label={`${exo.nom} en 3D`} onPointerDown={stop} onPointerUp={stop} onClick={stop}>
      <div className="anat-top">
        <button className="focus-x" type="button" aria-label="Fermer" onClick={onClose}>✕</button>
        <div className="anat-title">
          <span className="eyebrow">{(() => { const M = MOVEMENT_BY_ID[anat.mouvement]; return M.label === exo.nom ? M.famille : M.label; })()}{anat.reconnu ? "" : " · mouvement approché"}</span>
          <b>{exo.nom}</b>
        </div>
        {exo.series > 0 ? <span className="anat-dose num">{exo.series}×{exo.cible}{exo.type === "duree" ? "s" : ""}</span> : <span />}
      </div>

      <div className="anat-stage">
        <canvas ref={canvas} className="anat-canvas" aria-label="Écorché animé : glisser pour tourner, pincer pour zoomer, toucher un muscle" />
        {status === "load" && <div className="anat-msg"><span className="thinking">Il taille l'écorché</span></div>}
        {status === "err" && <div className="anat-msg">La 3D ne tourne pas sur cet appareil.</div>}
        <div className="anat-tools">
          <button type="button" aria-pressed={!playing} aria-label={playing ? "Pause" : "Lecture"} onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>{slow ? "×0,4" : "×1"}</button>
          <button type="button" aria-pressed={isolate} onClick={() => setIsolate((s) => !s)}>Isoler</button>
        </div>
        <div className="anat-views" role="group" aria-label="Vue">
          {(["face", "profil", "dos"] as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setSel(null); viewer.current?.setView(v); }}>{v === "face" ? "Face" : v === "profil" ? "Profil" : "Dos"}</button>
          ))}
        </div>
        <div className="anat-legend" aria-hidden="true"><span>léger</span><i /><span>max</span></div>
      </div>

      <div className="anat-panel">
        {M ? (
          <div className="anat-info" ref={info}>
            <div className="anat-info-h">
              <span className="anat-dot" style={{ background: heatCss(selW?.w ?? 0) }} />
              <div><b>{M.nom}</b><span className="muted small"><i>{M.latin}</i> · {M.groupe}</span></div>
              <button className="focus-x small" type="button" aria-label="Fermer la fiche du muscle" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="anat-meter"><span style={{ width: `${Math.round((selW?.w ?? 0) * 100)}%`, background: heatCss(selW?.w ?? 0) }} /></div>
            <p className="anat-role">{selW ? (selW.principal ? "Moteur principal" : "Soutien") + ` · ${Math.round(selW.w * 100)} % de son effort maximal ici` : "Presque pas sollicité dans cet exercice"}</p>
            <p>{M.fonction}</p>
            <p className="muted">{M.sensation}</p>
          </div>
        ) : <p className="muted small anat-hint">Touche un muscle pour savoir lequel c'est.</p>}

        {princ.length > 0 && <MuscleList title="Principaux" items={princ} sel={sel} onPick={(id) => setSel(sel === id ? null : id)} />}
        {sec.length > 0 && <MuscleList title="En soutien" items={sec} sel={sel} onPick={(id) => setSel(sel === id ? null : id)} />}
        {(exo.consigne || exo.alternative) && (
          <div className="anat-cues">
            {exo.consigne && <p><span className="eyebrow">Technique</span>{exo.consigne}</p>}
            {exo.alternative && <p><span className="eyebrow">Trop dur</span>{exo.alternative}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function MuscleList({ title, items, sel, onPick }: { title: string; items: { id: MuscleId; w: number }[]; sel: MuscleId | null; onPick: (id: MuscleId) => void }) {
  return (
    <div className="anat-list">
      <span className="eyebrow">{title}</span>
      {items.map((m) => (
        <button key={m.id} type="button" className="anat-row" aria-pressed={sel === m.id} onClick={() => onPick(m.id)}>
          <span className="anat-dot" style={{ background: heatCss(m.w) }} />
          <span className="anat-row-n">{MUSCLE_BY_ID[m.id].nom}</span>
          <span className="anat-bar"><span style={{ width: `${Math.round(m.w * 100)}%`, background: heatCss(m.w) }} /></span>
          <span className="num anat-pc">{Math.round(m.w * 100)}</span>
        </button>
      ))}
    </div>
  );
}

/** Bouton « voir l'exercice » : ouvre l'écorché. */
export const FigureIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="4.5" r="2.2" fill="currentColor" /><path d="M12 7.5v6m0 0-3.5 7m3.5-7 3.5 7M6 10.5l6-1.5 6 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>;

/** Bouton qui ouvre l'écorché. Avec `children`, tout le contenu (une ligne d'exercice) devient le bouton. */
export function SeeExo({ exo, className, label, children }: { exo: Exo; className?: string; label?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "see-exo"} aria-label={children ? undefined : `Voir ${exo.nom} en 3D`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {children ?? <><FigureIcon />{label && <span>{label}</span>}</>}
      </button>
      {open && <ExoViewer exo={exo} onClose={() => setOpen(false)} />}
    </>
  );
}
