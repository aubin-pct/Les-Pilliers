/*
 * La voix du Coach : synthèse vocale du navigateur (fr-FR) et dictée (reconnaissance vocale, une phrase).
 * Rien ne part sur un serveur tiers en dehors de ce que fait le navigateur lui-même.
 */
import { create } from "zustand";
import { toast } from "@/store/ui";

interface VoiceState { speaking: boolean; listening: boolean }
export const useVoice = create<VoiceState>()(() => ({ speaking: false, listening: false }));

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
export const canSpeak = !!synth;

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const all = synth?.getVoices() ?? [];
  const fr = all.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  // Une voix masculine et posée si le système en propose une ; sinon la première voix française.
  voice = fr.find((v) => /thomas|henri|paul|daniel|male|homme/i.test(v.name)) ?? fr.find((v) => v.localService) ?? fr[0] ?? null;
}
if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

/** Lit un texte à voix haute. Renvoie une promesse résolue à la fin (ou tout de suite sans synthèse). */
export function speak(text: string): Promise<void> {
  if (!synth || !text.trim()) return Promise.resolve();
  synth.cancel();
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ""));
    u.lang = "fr-FR"; u.rate = 1.04; u.pitch = 0.82;
    if (voice) u.voice = voice;
    const end = () => { useVoice.setState({ speaking: false }); res(); };
    u.onstart = () => useVoice.setState({ speaking: true });
    u.onend = end; u.onerror = end;
    synth.speak(u);
    // Certains navigateurs ne déclenchent jamais onstart si la voix n'est pas chargée.
    setTimeout(() => { if (!synth.speaking) end(); }, 1500);
  });
}
export function hush() { synth?.cancel(); useVoice.setState({ speaking: false }); }

/* ---------------- Reconnaissance vocale ---------------- */
import { mergeRecognized } from "@/engine/analysis";

type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort?: () => void;
};
const SRC = typeof window === "undefined" ? undefined
  : (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
export const canDictate = !!SRC;
const ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
const FATAL = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"];

/**
 * Reconnaissance vocale fr-FR qui tient la longueur :
 * - le texte est reconstruit à chaque résultat à partir de toute la session (jamais accumulé morceau par morceau),
 *   et les répétitions d'Android sont fusionnées (`mergeRecognized`) ;
 * - sur Android, sessions courtes (`continuous` y duplique le texte) relancées tant qu'on ne l'arrête pas ;
 *   ailleurs, session continue relancée après les coupures de Chrome ;
 * - quatre fins immédiates de suite (micro pris par une autre appli, service muet) : on s'arrête au lieu de boucler.
 */
export class Recognizer {
  committed = ""; final = ""; interim = ""; recognized = false; failed = !SRC; error = "";
  private r: SR | null = null;
  private active = false;
  private quick = 0;
  private t0 = 0;
  constructor(private on: { text?: (final: string, interim: string) => void; fail?: (error: string) => void; end?: () => void; raw?: (line: string) => void } = {}) {}

  get text() { return [this.final, this.interim].filter(Boolean).join(" ").trim(); }

  start() {
    if (!SRC) { this.failed = true; this.on.fail?.("unsupported"); return false; }
    this.active = true;
    return this.session();
  }

  private session() {
    try {
      const r = new SRC!();
      r.lang = "fr-FR"; r.continuous = !ANDROID; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        if (this.r !== r) return;
        // Tous les morceaux, dans l'ordre, provisoires compris : Android laisse traîner d'anciens provisoires
        // qui répètent la phrase finale ; la fusion les absorbe.
        const all: string[] = [];
        for (let i = 0; i < e.results.length; i++) all.push(e.results[i][0].transcript);
        this.on.raw?.(`résultat i=${e.resultIndex} [${Array.from({ length: e.results.length }, (_, i) => `${e.results[i].isFinal ? "F" : "p"}:${e.results[i][0].transcript}`).join(" | ")}]`);
        this.final = [this.committed, mergeRecognized(all)].filter(Boolean).join(" ");
        this.interim = "";
        this.recognized = true; this.quick = 0;
        this.on.text?.(this.final, this.interim);
      };
      r.onerror = (e) => {
        this.on.raw?.(`erreur ${e.error}`);
        if (this.r !== r || !FATAL.includes(e.error)) return;
        this.failed = true; this.error = e.error; this.active = false;
        this.on.fail?.(e.error);
      };
      r.onend = () => {
        this.on.raw?.("fin de session");
        if (this.r !== r) return;
        // Ce qui était encore provisoire à la coupure est gardé.
        this.committed = this.text; this.final = this.committed; this.interim = "";
        const quick = Date.now() - this.t0 < 1200;
        this.quick = quick ? this.quick + 1 : 0;
        if (!this.active || this.failed || this.quick >= 4) { this.r = null; this.active = false; this.on.end?.(); return; }
        this.session();
      };
      this.r = r; this.t0 = Date.now();
      this.on.raw?.(`début de session (${ANDROID ? "Android, sessions courtes" : "continue"})`);
      r.start();
      return true;
    } catch { this.r = null; this.active = false; this.failed = true; this.on.fail?.("start"); return false; }
  }

  /** Arrête en laissant arriver la dernière phrase. */
  stop() { this.active = false; try { this.r?.stop(); } catch { /* déjà arrêtée */ } }
  /** Coupe tout de suite. */
  abort() { this.active = false; const r = this.r; this.r = null; try { (r?.abort ?? r?.stop)?.call(r); } catch { /* rien */ } }
}

/* ---------------- Dictée ---------------- */
let current: Recognizer | null = null;
/** Dicte jusqu'à `stopDictation`. `onText` reçoit le texte complet à chaque mise à jour. */
export function dictate(onText: (t: string, final: boolean) => void): boolean {
  if (!SRC) return false;
  stopDictation();
  hush();
  const r: Recognizer = new Recognizer({
    text: (f) => onText(f.trim(), true),
    end: () => { if (current === r) { current = null; useVoice.setState({ listening: false }); } },
    fail: (err) => { if (current === r) { current = null; useVoice.setState({ listening: false }); } if (err === "not-allowed" || err === "service-not-allowed") failNote("Micro refusé : autorise-le pour ce site dans les réglages du navigateur."); else if (err === "audio-capture") failNote("Le micro est déjà utilisé par une autre application."); else if (err === "network") failNote("Dictée impossible sans réseau."); },
  });
  if (!r.start()) return false;
  current = r; useVoice.setState({ listening: true });
  return true;
}
export function stopDictation() {
  const r = current; current = null;
  r?.stop();
  useVoice.setState({ listening: false });
}
function failNote(msg: string) { toast(msg, "loss"); }
