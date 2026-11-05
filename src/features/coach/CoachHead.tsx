/*
 * Le Coach en tête de chaque page : son visage, une seule phrase (le brief du jour ou une phrase chiffrée),
 * écrite comme s'il la prononçait. Toucher la bulle ouvre la conversation.
 */
import { useEffect, useRef, useState } from "react";
import { aiReady, genBrief } from "@/ai/contremaitre";
import { coachLine } from "@/engine/coachLines";
import type { ChatScope } from "@/engine/types";
import { dayKey } from "@/lib/format";
import { speak, useVoice } from "@/lib/voice";
import { useChantier, useSettings, useStore } from "@/store";
import { openCoach, useCoach } from "@/store/coach";
import { reduceMotion } from "@/ui/motion";
import { useNow } from "@/ui/kit";
import { Avatar, type AvatarState } from "./Avatar";

const spoken = new Set<string>();

/** Texte qui s'écrit lettre à lettre ; renvoie aussi l'état « en train d'écrire ». */
export function useTyping(text: string, cps = 42): [string, boolean] {
  const [n, setN] = useState(reduceMotion() ? text.length : 0);
  useEffect(() => {
    if (reduceMotion()) { setN(text.length); return; }
    setN(0);
    const t0 = performance.now();
    let raf = 0;
    const step = () => { const k = Math.min(text.length, Math.floor(((performance.now() - t0) / 1000) * cps)); setN(k); if (k < text.length) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, cps]);
  return [text.slice(0, n), n < text.length];
}

/** Brief du jour : une génération par jour, en arrière-plan. */
let briefTried = "";
export function useDailyBrief() {
  const c = useChantier();
  const demo = useStore((s) => s.demo !== null);
  useEffect(() => {
    const today = dayKey(Date.now());
    if (!c || demo || c.brief?.date === today || briefTried === today || !aiReady() || !c.profile?.updated) return;
    briefTried = today;
    void genBrief().then((r) => { if (r) useStore.getState().act((d) => { d.brief = { date: dayKey(Date.now()), lines: r }; }); });
  }, [c, demo]);
}

export function CoachHead({ scope }: { scope: ChatScope }) {
  const c = useChantier()!;
  const now = useNow(60_000);
  const settings = useSettings();
  const speaking = useVoice((s) => s.speaking);
  const thinking = useCoach((s) => s.thinking);
  const line = coachLine(c, scope, now);
  const [shown, typing] = useTyping(line);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settings.voice || spoken.has(line)) return;
    spoken.add(line);
    void speak(line);
  }, [line, settings.voice]);
  // Le bouton flottant n'apparaît que quand cette tête sort de l'écran.
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => useCoach.setState({ headVisible: e.isIntersecting }));
    io.observe(el);
    return () => { io.disconnect(); useCoach.setState({ headVisible: false }); };
  }, []);
  const state: AvatarState = thinking ? "think" : typing || speaking ? "talk" : "idle";
  return (
    <div className="coach-head" ref={ref}>
      <button type="button" className="ch-face" aria-label="Parler au Contremaître" onClick={() => openCoach(scope)}><Avatar state={state} size={58} /></button>
      <button type="button" className="ch-bubble" onClick={() => openCoach(scope)}>
        <span className="ch-say" aria-live="polite">{shown}<span className="ch-caret" aria-hidden="true" /></span>
        <span className="ch-cta">Répondre ›</span>
      </button>
    </div>
  );
}
