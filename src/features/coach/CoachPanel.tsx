/*
 * La conversation avec le Contremaître, par section. Il reçoit le dossier de la section ouverte (profil, preuves,
 * mémoire), répond court, et peut agir : préparer une séance, refaire le sprint, fixer un sujet, mettre à jour le profil…
 * L'historique est gardé dans le chantier (40 derniers messages par section) et synchronisé.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { PILLAR, PILLAR_IDS } from "@/content/pillars";
import { actionsDoc, knownAction, runAction } from "@/ai/actions";
import { chat } from "@/ai/contremaitre";
import { coachLine } from "@/engine/coachLines";
import type { ChatMsg, ChatScope, CoachAction } from "@/engine/types";
import { buzz } from "@/lib/device";
import { openLayer } from "@/lib/layers";
import { canDictate, canSpeak, dictate, hush, speak, stopDictation, useVoice } from "@/lib/voice";
import { useChantier, useSettings, useStore } from "@/store";
import { useCoach } from "@/store/coach";
import { toast } from "@/store/ui";
import { Avatar } from "./Avatar";
import { useTyping } from "./CoachHead";

const NAME: Record<ChatScope, string> = { temple: "Vue d'ensemble", corps: "Corps", capital: "Capital", esprit: "Esprit", verbe: "Éloquence" };
const SUGG: Record<ChatScope, string[]> = {
  temple: ["Par quoi je commence ?", "Fais-moi le bilan", "Je n'ai pas envie aujourd'hui"],
  corps: ["Prépare ma séance", "J'ai une douleur", "Ajuste mon programme"],
  capital: ["Je bloque", "Écris mon message de prospection", "Quel prix je fixe ?"],
  esprit: ["Que dois-je apprendre ?", "Crée-moi un parcours", "Explique-moi mon sujet"],
  verbe: ["Quel exercice aujourd'hui ?", "Analyse mes derniers oraux", "Je prépare un entretien"],
};

export const scopeOf = (path: string): ChatScope => { const id = path.slice(1); return (PILLAR_IDS as string[]).includes(id) ? (id as ChatScope) : "temple"; };

function CoachText({ m, fresh }: { m: ChatMsg; fresh: boolean }) {
  const [t] = useTyping(fresh ? m.text : "", 60);
  return <>{fresh ? t : m.text}</>;
}

export function CoachPanel() {
  const scope = useCoach((s) => s.open);
  const prefill = useCoach((s) => s.prefill);
  const close = useCoach((s) => s.closeCoach);
  if (!scope) return null;
  return <Panel scope={scope} prefill={prefill} onClose={close} />;
}

function Panel({ scope, prefill, onClose }: { scope: ChatScope; prefill: string; onClose: () => void }) {
  const c = useChantier()!;
  const settings = useSettings();
  const setSettings = useStore((s) => s.setSettings);
  const act = useStore((s) => s.act);
  const nav = useNavigate();
  const thinking = useCoach((s) => s.thinking);
  const speaking = useVoice((s) => s.speaking);
  const listening = useVoice((s) => s.listening);
  const [text, setText] = useState(prefill);
  const [fresh, setFresh] = useState(0);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const msgs = c.chats[scope] ?? [];
  const opening = coachLine(c, scope, Date.now());
  const color = scope === "temple" ? "var(--brass)" : PILLAR[scope].color;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const release = openLayer(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    if (!canDictate) setTimeout(() => input.current?.focus(), 250);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); release(); stopDictation(); hush(); };
  }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, thinking]);

  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => {
    act((d) => { d.chats[scope] = []; (d.chatReset ??= {})[scope] = Date.now(); });
    setConfirmReset(false); hush(); toast("Conversation effacée. Il garde ton profil et tes données.");
  };
  const push = (m: ChatMsg) => act((d) => { const a = (d.chats[scope] ??= []); a.push(m); if (a.length > 40) d.chats[scope] = a.slice(-40); });

  const send = async (raw?: string) => {
    const t = (raw ?? text).trim();
    if (!t || thinking) return;
    stopDictation(); setText(""); buzz(8);
    const history = msgs.length ? msgs : [{ ts: 0, from: "coach" as const, text: opening }];
    push({ ts: Date.now(), from: "moi", text: t });
    useCoach.setState({ thinking: true });
    const r = await chat(scope, actionsDoc(scope), history, t);
    useCoach.setState({ thinking: false });
    if (!r) return;
    const actions = r.actions.filter((a) => knownAction(a, scope));
    const ts = Date.now();
    push({ ts, from: "coach", text: r.reponse, actions: actions.length ? actions : undefined });
    setFresh(ts);
    if (settings.voice) void speak(r.reponse);
  };

  const run = async (a: CoachAction, key: string) => {
    setUsed((s) => new Set(s).add(key));
    useCoach.setState({ thinking: true });
    let res: string | null = null, err = "";
    try { res = await runAction(a, (to) => nav(to)); } catch (e) { err = (e as Error).message || "erreur inconnue"; }
    useCoach.setState({ thinking: false });
    const ts = Date.now();
    if (res) { push({ ts, from: "coach", text: "✓ " + res }); setFresh(ts); if (settings.voice) void speak(res); }
    else if (a.type !== "ouvrir") { push({ ts, from: "coach", text: `✗ « ${a.label} » n'a pas marché : ${err || "l'IA n'a pas répondu, réessaie."}` }); setFresh(ts); setUsed((s) => { const n = new Set(s); n.delete(key); return n; }); }
    if (a.type === "ouvrir") onClose();
  };

  const mic = () => {
    if (listening) { stopDictation(); return; }
    const base = text ? text + " " : "";
    const ok = dictate((t) => setText(base + t));
    if (!ok) toast("Dictée indisponible sur ce navigateur : utilise le micro du clavier.");
  };

  const state = thinking ? "think" : speaking ? "talk" : listening ? "listen" : "idle";
  const last = msgs[msgs.length - 1];
  return createPortal(
    <div className="cp" role="dialog" aria-modal="true" aria-label="Conversation avec le Contremaître" style={{ ["--acc" as string]: color }}>
      <header className="cp-head">
        <Avatar state={state} size={46} />
        <div className="cp-who"><b>Le Contremaître</b><span>{NAME[scope]} · voit tes données</span></div>
        {msgs.length > 0 && (confirmReset
          ? <button type="button" className="btn small danger" onClick={reset} onBlur={() => setConfirmReset(false)} autoFocus>Effacer ?</button>
          : <button type="button" className="cp-icon" aria-label="Nouvelle conversation" onClick={() => setConfirmReset(true)}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>)}
        {canSpeak && <button type="button" className={"cp-icon" + (settings.voice ? " on" : "")} aria-pressed={settings.voice} aria-label="Voix" onClick={() => { if (settings.voice) hush(); setSettings({ voice: !settings.voice }); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" />{settings.voice ? <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
        </button>}
        <button type="button" className="cp-icon" aria-label="Fermer" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div className="cp-log" ref={log}>
        <div className="msg coach"><p>{opening}</p></div>
        {msgs.map((m) => (
          <div key={m.ts + m.from} className={"msg " + m.from}>
            <p>{m.from === "coach" ? <CoachText m={m} fresh={m.ts === fresh} /> : m.text}</p>
            {m.actions && (
              <div className="msg-acts">
                {m.actions.map((a, i) => { const k = `${m.ts}-${i}`; return <button key={k} type="button" className="btn small primary" disabled={used.has(k) || thinking} onClick={() => void run(a, k)}>{a.label}</button>; })}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="msg coach typing" aria-label="Le Contremaître réfléchit"><span /><span /><span /></div>}
      </div>
      {(!last || last.from === "coach") && !thinking && (
        <div className="cp-sugg">{SUGG[scope].map((s) => <button key={s} type="button" className="chip" onClick={() => void send(s)}>{s}</button>)}</div>
      )}
      <form className="cp-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea ref={input} rows={1} value={text} placeholder={listening ? "Je t'écoute…" : "Parle-lui."} aria-label="Ton message"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        {canDictate && (
          <button type="button" className={"cp-mic" + (listening ? " on" : "")} aria-label={listening ? "Arrêter la dictée" : "Dicter"} onClick={mic}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
        )}
        <button type="submit" className="cp-send" aria-label="Envoyer" disabled={!text.trim() || thinking}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 20l18-8L3 4v6l12 2-12 2z" /></svg>
        </button>
      </form>
    </div>,
    document.body,
  );
}

/** Bouton flottant : le visage du Coach, quand sa tête de page n'est plus visible. */
export function CoachFab() {
  const visible = useCoach((s) => s.headVisible);
  const open = useCoach((s) => s.open);
  const thinking = useCoach((s) => s.thinking);
  const { pathname } = useLocation();
  const recording = useStore((s) => s.recording);
  if (visible || open || recording || pathname === "/reglages") return null;
  return (
    <button type="button" className="coach-fab" aria-label="Parler au Contremaître" onClick={() => useCoach.getState().openCoach(scopeOf(pathname))}>
      <Avatar state={thinking ? "think" : "idle"} size={50} />
    </button>
  );
}
