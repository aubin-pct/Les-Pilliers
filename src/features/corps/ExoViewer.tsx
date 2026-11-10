/*
 * L'exercice vu en écorché 3D : un humain qui fait le mouvement, les muscles qui travaillent colorés selon leur part
 * de l'effort (vert → rouge). On tourne autour au doigt, on touche un muscle pour savoir lequel c'est et ce qu'il fait.
 *
 * Écran : en haut le titre et la dose ; au milieu la scène (lecture, ralenti, isoler, recentrer, vues, effort en direct) ;
 * en bas trois onglets toujours à un geste : Muscles (fiche dépliée sur place), Variantes (par type, avec « Faire
 * celle-ci » dans la séance), Technique (dose, consigne, plus facile, à ajouter à la séance du jour).
 * three.js n'est chargé qu'à l'ouverture (morceau séparé).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MOVEMENT_BY_ID, MOVEMENTS, MUSCLE_BY_ID, type MovementId, type MuscleId } from "@/content/anatomy";
import { exoAnatomy } from "@/engine/anatomy";
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

type Tab = "muscles" | "variantes" | "technique";

/**
 * `index` : position de l'exercice dans la séance du jour (permet de le remplacer par une variante).
 * Sans dose (`series === 0`), l'exercice vient de la bibliothèque.
 */
export function ExoViewer({ exo, index, onClose }: { exo: Exo; index?: number; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
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
  const [sel, setSel] = useState<MuscleId | null>(null);
  const [tab, setTab] = useState<Tab>("muscles");
  const [playing, setPlaying] = useState(!reduced());
  const [slow, setSlow] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [live, setLive] = useState({ phase: 0, effort: 0 });
  const panel = useRef<HTMLDivElement>(null);

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
          onPick: (id) => { setSel(id); if (id) setTab("muscles"); buzz(8); },
          onFrame: (phase, effort) => setLive({ phase, effort }),
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
  useEffect(() => {
    viewer.current?.select(sel);
    if (sel) requestAnimationFrame(() => panel.current?.querySelector(`[data-muscle="${sel}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [sel, status]);
  useEffect(() => { viewer.current?.setPlaying(playing); }, [playing, status]);
  useEffect(() => { viewer.current?.setSpeed(slow ? 0.4 : 1); }, [slow, status]);
  useEffect(() => { viewer.current?.setIsolate(isolate); }, [isolate, status]);

  const pickVariant = (id: MovementId) => { setVariant(id === base.mouvement ? null : id); setSel(null); buzz(8); };
  const run = (f: () => string) => { try { toast(f()); buzz(20); } catch (e) { toast((e as Error).message); } };
  const princ = anat.muscles.filter((m) => m.principal);
  const sec = anat.muscles.filter((m) => !m.principal);
  const shownName = variant ? mv.label : exo.nom;

  return createPortal(
    // Pas de stopPropagation sur les événements de pointeur : React arrêterait aussi l'événement natif, et la caméra
    // (OrbitControls, qui écoute la levée du doigt sur document) croirait le doigt toujours posé. La séance plein écran
    // ignore elle-même les gestes venus de l'écorché (`.anat`).
    <div className="anat" role="dialog" aria-modal="true" aria-label={`${shownName} en 3D`} onClick={stop}>
      <div className="anat-top">
        <button className="focus-x" type="button" aria-label="Fermer" onClick={onClose}>✕</button>
        <div className="anat-title">
          <span className="eyebrow">{variant ? `Variante de : ${exo.nom}` : [mv.famille, mv.type].filter(Boolean).join(" · ")}{!variant && !anat.reconnu ? " · mouvement approché" : ""}</span>
          <b>{shownName}</b>
        </div>
        {!fromLibrary && <span className="anat-dose num">{exo.series}×{exo.cible}{exo.type === "duree" ? "s" : ""}</span>}
      </div>

      <div className="anat-stage">
        <canvas ref={canvas} className="anat-canvas" aria-label="Écorché animé : glisser pour tourner, pincer pour zoomer, toucher un muscle" />
        {status === "load" && <div className="anat-msg"><span className="thinking">Il taille l'écorché</span></div>}
        {status === "err" && <div className="anat-msg">La 3D ne tourne pas sur cet appareil.</div>}
        <div className="anat-tools" role="toolbar" aria-label="Animation">
          <button type="button" aria-pressed={!playing} aria-label={playing ? "Pause" : "Lecture"} onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" aria-pressed={slow} aria-label="Ralenti" onClick={() => setSlow((s) => !s)}>{slow ? "Lent" : "×1"}</button>
          <button type="button" aria-pressed={isolate} onClick={() => setIsolate((s) => !s)}>Isoler</button>
          <button type="button" aria-label="Recentrer la vue" onClick={() => { setSel(null); setView(null); viewer.current?.recenter(); }}>⟲</button>
        </div>
        <div className="anat-views" role="group" aria-label="Vue">
          {(["face", "profil", "dos"] as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setSel(null); viewer.current?.setView(v); }}>{v === "face" ? "Face" : v === "profil" ? "Profil" : "Dos"}</button>
          ))}
        </div>
        {status === "ok" && (
          <div className="anat-live" aria-hidden="true">
            <span>{hold ? "Tenir" : "Effort"}</span>
            <i><b style={{ width: `${Math.round(live.effort * 100)}%`, background: heatCss(live.effort) }} /></i>
            <span className="num">{Math.round(live.effort * 100)}</span>
          </div>
        )}
        {status === "ok" && <div className="anat-cycle" aria-hidden="true"><b style={{ width: `${live.phase * 100}%` }} /></div>}
      </div>

      <div className="anat-tabs" role="tablist" aria-label="Informations">
        <TabBtn id="muscles" tab={tab} setTab={setTab} label="Muscles" n={anat.muscles.length} />
        {family.length > 1 && <TabBtn id="variantes" tab={tab} setTab={setTab} label="Variantes" n={family.length} />}
        <TabBtn id="technique" tab={tab} setTab={setTab} label={fromLibrary ? "À faire" : "Technique"} />
      </div>

      <div className="anat-panel" ref={panel} role="tabpanel">
        {tab === "muscles" && (
          <>
            <div className="anat-legend"><span>léger</span><i /><span>max</span><span className="muted">· touche un muscle, ici ou sur le corps</span></div>
            {princ.length > 0 && <MuscleList title="Moteurs" items={princ} sel={sel} onPick={(id) => setSel(sel === id ? null : id)} />}
            {sec.length > 0 && <MuscleList title="En soutien" items={sec} sel={sel} onPick={(id) => setSel(sel === id ? null : id)} />}
            {sel && !anat.muscles.some((m) => m.id === sel) && <MuscleList title="Touché" items={[{ id: sel, w: 0 }]} sel={sel} onPick={() => setSel(null)} />}
          </>
        )}

        {tab === "variantes" && (
          <div className="anat-variants">
            {variant ? (
              <div className="anat-vbar">
                {index !== undefined && hasPlan && <button className="btn primary" type="button" onClick={() => run(() => replaceExo(index, variant, mv.label))}>Faire celle-ci dans ma séance</button>}
                <button className="btn ghost" type="button" onClick={() => setVariant(null)}>{fromLibrary ? "Revenir" : "Revenir à l'exercice prévu"}</button>
              </div>
            ) : <p className="muted small">Touche une variante pour la voir et comparer les muscles.</p>}
            {types.map((t) => (
              <div className="anat-vgroup" key={t || "autres"}>
                {t && <span className="anat-vtype">{t}</span>}
                <div className="chips">
                  {inType(t).map((m) => (
                    <button key={m.id} type="button" className="chip" aria-pressed={anat.mouvement === m.id} data-mv={m.id} onClick={() => pickVariant(m.id)}>
                      {m.label}{m.id === base.mouvement && !fromLibrary ? " · prévu" : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "technique" && (
          <div className="anat-cues">
            {!fromLibrary && !variant && (
              <div className="anat-dosegrid">
                <div><b className="num">{exo.series}</b><span>séries</span></div>
                <div><b className="num">{exo.cible}</b><span>{exo.type === "duree" ? "secondes" : "répétitions"}</span></div>
                <div><b className="num">{exo.repos}</b><span>s de repos</span></div>
                {exo.charge && <div><b className="num">{exo.charge}</b><span>charge</span></div>}
              </div>
            )}
            <p><span className="eyebrow">Ce qui travaille</span>{princ.map((m) => MUSCLE_BY_ID[m.id].nom).join(", ") || "—"}{sec.length ? `. En soutien : ${sec.slice(0, 4).map((m) => MUSCLE_BY_ID[m.id].nom.toLowerCase()).join(", ")}.` : "."}</p>
            {!variant && exo.consigne && <p><span className="eyebrow">Point clé</span>{exo.consigne}</p>}
            {!variant && exo.alternative && <p><span className="eyebrow">Trop dur</span>{exo.alternative}</p>}
            {princ[0] && <p><span className="eyebrow">Tu dois sentir</span>{MUSCLE_BY_ID[princ[0].id].sensation}</p>}
            {(fromLibrary || variant) && hasPlan && (
              <button className="btn" type="button" onClick={() => run(() => addExo({ nom: mv.label, mouvement: anat.mouvement, series: 3, cible: hold ? 30 : 10, type: hold ? "duree" : "reps" }))}>+ Ajouter à ma séance du jour</button>
            )}
            {(fromLibrary || variant) && !hasPlan && <p className="muted small">Prépare ta séance du jour pour pouvoir l'y ajouter.</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function TabBtn({ id, tab, setTab, label, n }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; label: string; n?: number }) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); buzz(6); }}>
      {label}{n !== undefined && <span className="num">{n}</span>}
    </button>
  );
}

function MuscleList({ title, items, sel, onPick }: { title: string; items: { id: MuscleId; w: number }[]; sel: MuscleId | null; onPick: (id: MuscleId) => void }) {
  return (
    <div className="anat-list">
      <span className="eyebrow">{title}</span>
      {items.map((m) => {
        const M = MUSCLE_BY_ID[m.id], open = sel === m.id;
        return (
          <div key={m.id} className={"anat-item" + (open ? " open" : "")} data-muscle={m.id}>
            <button type="button" className="anat-row" aria-expanded={open} onClick={() => onPick(m.id)}>
              <span className="anat-dot" style={{ background: heatCss(m.w) }} />
              <span className="anat-row-n">{M.nom}</span>
              <span className="anat-bar"><span style={{ width: `${Math.round(m.w * 100)}%`, background: heatCss(m.w) }} /></span>
              <span className="num anat-pc">{Math.round(m.w * 100)}</span>
            </button>
            {open && (
              <div className="anat-detail">
                <span className="muted small"><i>{M.latin}</i> · {M.groupe}</span>
                <p className="anat-role">{m.w > 0 ? `${m.w >= 0.7 ? "Moteur" : "Soutien"} · ${Math.round(m.w * 100)} % de son effort maximal ici` : "Presque pas sollicité dans cet exercice"}</p>
                <p>{M.fonction}</p>
                <p className="muted">{M.sensation}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
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
