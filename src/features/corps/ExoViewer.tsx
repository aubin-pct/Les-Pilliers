/*
 * L'exercice vu en écorché 3D. La scène prend tout l'écran ; tout le reste tient sur une rangée.
 *
 *  - Rail d'icônes à droite : lecture, ralenti, isoler, vue (face → profil → dos), recentrer.
 *  - Sur le corps : quand un muscle est choisi, une étiquette par portion (haut/milieu/bas du pectoral, chefs du
 *    triceps, vastes du quadriceps…) est épinglée sur la portion elle-même, avec sa couleur et son pourcentage ;
 *    la toucher fait ressortir la portion. Chaque portion est colorée selon sa propre intensité.
 *  - Dock en bas, trois onglets, une seule rangée qui défile de côté : Muscles, Variantes (par type, remplacer dans la
 *    séance d'un geste), Infos (dose, point clé, plus facile, sensation, ajouter à la séance).
 * three.js n'est chargé qu'à l'ouverture (morceau séparé).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MOVEMENT_BY_ID, MOVEMENTS, MUSCLE_BY_ID, PARTS, type MovementId, type MuscleId } from "@/content/anatomy";
import { exoAnatomy, partHeat } from "@/engine/anatomy";
import type { Exo } from "@/engine/types";
import { buzz } from "@/lib/device";
import { dayKey } from "@/lib/format";
import { openLayer } from "@/lib/layers";
import { useChantier } from "@/store";
import { toast } from "@/store/ui";
import type { BodyViewer, View } from "./body3d/viewer";
import { addExo, replaceExo } from "./session";

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
/** Mouvements tenus (l'effort se maintient au lieu de monter et descendre). */
const HOLD = /gainage|chaise|hollow|etirement|chien|fente_basse|debout/;
const VIEWS: View[] = ["face", "profil", "dos"];
const VIEW_LABEL: Record<View, string> = { face: "F", profil: "P", dos: "D" };

type Tab = "muscles" | "variantes" | "infos";

const Ico = {
  play: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>,
  pause: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>,
  slow: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 13V9M12 3.5h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  isolate: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  eye: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /></svg>,
  recenter: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /></svg>,
};

/**
 * `index` : position de l'exercice dans la séance du jour (permet de le remplacer par une variante).
 * Sans dose (`series === 0`), l'exercice vient de la bibliothèque.
 */
export function ExoViewer({ exo, index, onClose }: { exo: Exo; index?: number; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const viewer = useRef<BodyViewer | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const c = useChantier();
  const hasPlan = !!c?.plans.seance && c.plans.seance.date === dayKey(Date.now());
  const fromLibrary = exo.series === 0;

  const base = useMemo(() => exoAnatomy(exo), [exo]);
  // Variante regardée (autre prise, autre style) : on montre ses muscles à elle, sans toucher à la séance.
  const [variant, setVariant] = useState<MovementId | null>(null);
  useEffect(() => setVariant(null), [exo.mouvement, exo.nom]);
  const anat = useMemo(() => (variant ? exoAnatomy({ nom: MOVEMENT_BY_ID[variant].label, mouvement: variant }) : base), [variant, base]);
  const mv = MOVEMENT_BY_ID[anat.mouvement];
  const famille = MOVEMENT_BY_ID[base.mouvement].famille;
  const family = base.reconnu ? MOVEMENTS.filter((m) => m.famille === famille && m.id !== "debout") : [];
  // Le type de l'exercice prévu d'abord, et l'exercice prévu en tête de son type.
  const baseType = MOVEMENT_BY_ID[base.mouvement].type ?? "";
  const types = [...new Set([baseType, ...family.map((m) => m.type ?? "")])].filter((t) => family.some((m) => (m.type ?? "") === t));
  const inType = (t: string) => family.filter((m) => (m.type ?? "") === t).sort((a, b) => Number(b.id === base.mouvement) - Number(a.id === base.mouvement));
  const hold = HOLD.test(anat.mouvement);

  const [status, setStatus] = useState<"load" | "ok" | "err">("load");
  // Muscle choisi : le moteur principal d'emblée, pour que ses portions s'affichent sur le corps dès l'ouverture.
  const [sel, setSel] = useState<{ id: MuscleId; part: string | null; byUser: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("muscles");
  const [playing, setPlaying] = useState(!reduced());
  const [slow, setSlow] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [live, setLive] = useState({ phase: 0, effort: 0 });
  const strip = useRef<HTMLDivElement>(null);

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
          onPick: (id, part) => { setSel(id ? { id, part: part ?? null, byUser: true } : null); if (id) setTab("muscles"); buzz(8); },
          onFrame: (phase, effort) => setLive({ phase, effort }),
        });
        v.setOverlay(pins.current);
        v.setPlaying(!reduced());
        viewer.current = v;
        if (import.meta.env.DEV) (window as unknown as { __anat?: BodyViewer }).__anat = v;
        setStatus("ok");
      } catch (e) { console.error(e); setStatus("err"); }
    }).catch(() => alive && setStatus("err"));
    return () => { alive = false; viewer.current?.dispose(); viewer.current = null; };
  }, []);

  useEffect(() => {
    if (status !== "ok") return;
    viewer.current?.setExercise(anat.mouvement, anat.muscles, anat.parts);
    const top = anat.muscles[0];
    setSel(top ? { id: top.id, part: null, byUser: false } : null);
  }, [status, anat]);
  useEffect(() => {
    viewer.current?.select(sel?.id ?? null, sel?.byUser ?? false, sel?.part ?? null);
    if (sel) requestAnimationFrame(() => strip.current?.querySelector(`[data-muscle="${sel.id}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" }));
  }, [sel, status]);
  useEffect(() => { strip.current?.scrollTo({ left: 0 }); }, [tab]);
  useEffect(() => { viewer.current?.setPlaying(playing); }, [playing, status]);
  useEffect(() => { viewer.current?.setSpeed(slow ? 0.4 : 1); }, [slow, status]);
  useEffect(() => { viewer.current?.setIsolate(isolate); }, [isolate, status]);

  const pickMuscle = (id: MuscleId) => { setSel(sel?.id === id && sel.byUser ? null : { id, part: null, byUser: true }); buzz(6); };
  const pickVariant = (id: MovementId) => { setVariant(id === base.mouvement ? null : id); buzz(8); };
  const run = (f: () => string) => { try { toast(f()); buzz(20); } catch (e) { toast((e as Error).message); } };
  const cycleView = () => { const v = VIEWS[(VIEWS.indexOf(view ?? "dos") + 1) % 3]; setView(v); viewer.current?.setView(v); buzz(6); };
  const shownName = variant ? mv.label : exo.nom;
  const selM = sel ? MUSCLE_BY_ID[sel.id] : null;
  const selParts = sel ? PARTS[sel.id] : undefined;

  return createPortal(
    // Pas de stopPropagation sur les événements de pointeur : React arrêterait aussi l'événement natif, et la caméra
    // (OrbitControls, qui écoute la levée du doigt sur document) croirait le doigt toujours posé. La séance plein écran
    // ignore elle-même les gestes venus de l'écorché (`.anat`).
    <div className="anat" role="dialog" aria-modal="true" aria-label={`${shownName} en 3D`} onClick={stop}>
      <div className="anat-stage">
        <canvas ref={canvas} className="anat-canvas" aria-label="Écorché animé : glisser pour tourner, pincer pour zoomer, toucher un muscle" />
        <div className="anat-pins" ref={pins} />
        {status === "load" && <div className="anat-msg"><span className="thinking">Il taille l'écorché</span></div>}
        {status === "err" && <div className="anat-msg">La 3D ne tourne pas sur cet appareil.</div>}

        <div className="anat-head">
          <button className="anat-x" type="button" aria-label="Fermer" onClick={onClose}>✕</button>
          <div className="anat-title">
            <span className="eyebrow">{variant ? `Variante de : ${exo.nom}` : [mv.famille, mv.type].filter(Boolean).join(" · ")}{!variant && !anat.reconnu ? " · approché" : ""}</span>
            <b>{shownName}</b>
          </div>
          {!fromLibrary && <span className="anat-dose num">{exo.series}×{exo.cible}{exo.type === "duree" ? "s" : ""}</span>}
        </div>

        <div className="anat-rail" role="toolbar" aria-label="Animation et vue">
          <button type="button" aria-label={playing ? "Pause" : "Lecture"} onClick={() => setPlaying((p) => !p)}>{playing ? Ico.pause : Ico.play}</button>
          <button type="button" aria-label="Ralenti" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>{Ico.slow}</button>
          <button type="button" aria-label="Isoler les muscles qui travaillent" aria-pressed={isolate} onClick={() => setIsolate((s) => !s)}>{Ico.isolate}</button>
          <button type="button" aria-label={`Vue suivante (${view ?? "libre"})`} onClick={cycleView}>{Ico.eye}<small>{view ? VIEW_LABEL[view] : ""}</small></button>
          <button type="button" aria-label="Recentrer" onClick={() => { setView(null); viewer.current?.recenter(); setSel(null); }}>{Ico.recenter}</button>
        </div>

        {status === "ok" && (
          <div className="anat-live" aria-hidden="true">
            <span>{hold ? "Tenir" : "Effort"}</span>
            <i><b style={{ width: `${Math.round(live.effort * 100)}%`, background: heatCss(live.effort) }} /></i>
          </div>
        )}
        {status === "ok" && <div className="anat-cycle" aria-hidden="true"><b style={{ width: `${live.phase * 100}%` }} /></div>}
      </div>

      <div className="anat-dock">
        <div className="anat-tabs" role="tablist" aria-label="Informations">
          <TabBtn id="muscles" tab={tab} setTab={setTab} label="Muscles" n={anat.muscles.length} />
          {family.length > 1 && <TabBtn id="variantes" tab={tab} setTab={setTab} label="Variantes" n={family.length} />}
          <TabBtn id="infos" tab={tab} setTab={setTab} label="Infos" />
        </div>

        <div className="anat-strip" ref={strip} role="tabpanel">
          {tab === "muscles" && anat.muscles.map((m) => (
            <button key={m.id} type="button" className="anat-chip" data-muscle={m.id} aria-pressed={sel?.id === m.id} onClick={() => pickMuscle(m.id)}>
              <i style={{ background: heatCss(m.w) }} />{MUSCLE_BY_ID[m.id].nom}<b className="num">{Math.round(m.w * 100)}</b>
            </button>
          ))}

          {tab === "variantes" && types.map((t) => (
            <div className="anat-group" key={t || "autres"}>
              {t && <span className="anat-gl">{t}</span>}
              {inType(t).map((m) => (
                <button key={m.id} type="button" className={"anat-chip" + (m.id === base.mouvement && !fromLibrary ? " planned" : "")} data-mv={m.id} aria-pressed={anat.mouvement === m.id} onClick={() => pickVariant(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          ))}

          {tab === "infos" && (
            <>
              {!fromLibrary && !variant && (
                <div className="anat-stats">
                  <div><b className="num">{exo.series}</b><span>séries</span></div>
                  <div><b className="num">{exo.cible}</b><span>{exo.type === "duree" ? "sec." : "reps"}</span></div>
                  <div><b className="num">{exo.repos}</b><span>repos</span></div>
                  {exo.charge && <div><b className="num">{exo.charge}</b><span>charge</span></div>}
                </div>
              )}
              {!variant && exo.consigne && <Card t="Point clé">{exo.consigne}</Card>}
              {!variant && exo.alternative && <Card t="Trop dur">{exo.alternative}</Card>}
              {anat.muscles[0] && <Card t="Tu dois sentir">{MUSCLE_BY_ID[anat.muscles[0].id].sensation}</Card>}
            </>
          )}
        </div>

        {/* Une ligne de contexte : portions du muscle choisi, action sur la variante, ajout à la séance. */}
        <div className="anat-sub">
          {tab === "muscles" && selM && (
            <>
              {selParts ? selParts.map((p) => {
                const h = partHeat(anat, sel!.id, p.id);
                return (
                  <button key={p.id} type="button" className="anat-part" aria-pressed={sel!.part === p.id} onClick={() => setSel({ id: sel!.id, part: sel!.part === p.id ? null : p.id, byUser: true })}>
                    <i style={{ background: heatCss(h) }} />{p.court}<b className="num">{Math.round(h * 100)}</b>
                  </button>
                );
              }) : <span className="anat-fn">{selM.fonction}</span>}
            </>
          )}
          {tab === "muscles" && !selM && <span className="anat-fn muted">Touche un muscle, ici ou sur le corps.</span>}
          {tab === "variantes" && (variant ? (
            <>
              {index !== undefined && hasPlan && <button type="button" className="anat-act primary" onClick={() => run(() => replaceExo(index, variant, mv.label))}>Faire celle-ci</button>}
              <button type="button" className="anat-act" onClick={() => setVariant(null)}>{fromLibrary ? "Revenir" : "Prévu"}</button>
            </>
          ) : <span className="anat-fn muted">Touche une variante pour la voir.</span>)}
          {tab === "infos" && ((fromLibrary || variant) ? (hasPlan
            ? <button type="button" className="anat-act primary" onClick={() => run(() => addExo({ nom: mv.label, mouvement: anat.mouvement, series: 3, cible: hold ? 30 : 10, type: hold ? "duree" : "reps" }))}>+ Ajouter à ma séance</button>
            : <span className="anat-fn muted">Prépare ta séance du jour pour l'y ajouter.</span>)
            : <span className="anat-fn">{anat.muscles.filter((m) => m.principal).map((m) => MUSCLE_BY_ID[m.id].nom).join(" · ")}</span>)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Card({ t, children }: { t: string; children: React.ReactNode }) {
  return <div className="anat-card"><span className="eyebrow">{t}</span><p>{children}</p></div>;
}

function TabBtn({ id, tab, setTab, label, n }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; label: string; n?: number }) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); buzz(6); }}>
      {label}{n !== undefined && <span className="num">{n}</span>}
    </button>
  );
}

export const FigureIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="4.5" r="2.2" fill="currentColor" /><path d="M12 7.5v6m0 0-3.5 7m3.5-7 3.5 7M6 10.5l6-1.5 6 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>;

/** Bouton qui ouvre l'écorché. Avec `children`, tout le contenu (une ligne d'exercice) devient le bouton. */
export function SeeExo({ exo, index, className, label, children }: { exo: Exo; index?: number; className?: string; label?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "see-exo"} aria-label={children ? undefined : `Voir ${exo.nom} en 3D`} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {children ?? <><FigureIcon />{label && <span>{label}</span>}</>}
      </button>
      {open && <ExoViewer exo={exo} index={index} onClose={() => setOpen(false)} />}
    </>
  );
}
