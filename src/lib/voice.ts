/*
 * La voix du Coach : synthèse vocale du navigateur (fr-FR) et dictée (reconnaissance vocale, une phrase).
 * Rien ne part sur un serveur tiers en dehors de ce que fait le navigateur lui-même.
 */
import { create } from "zustand";

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

/* ---------------- Dictée ---------------- */
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void;
};
const SRC = typeof window === "undefined" ? undefined
  : (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
export const canDictate = !!SRC;

let current: SR | null = null;
/** Dicte jusqu'au silence (ou `stopDictation`). `onText` reçoit le texte complet à chaque mise à jour. */
export function dictate(onText: (t: string, final: boolean) => void): boolean {
  if (!SRC) return false;
  stopDictation();
  hush();
  const r = new SRC();
  r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
  let finals = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finals += (finals ? " " : "") + t.trim(); else interim += t;
    }
    onText((finals + (interim ? " " + interim : "")).trim(), !interim);
  };
  r.onerror = () => stopDictation();
  r.onend = () => { if (current === r) { current = null; useVoice.setState({ listening: false }); } };
  try { r.start(); current = r; useVoice.setState({ listening: true }); return true; } catch { return false; }
}
export function stopDictation() {
  const r = current; current = null;
  try { r?.stop(); } catch { /* déjà arrêtée */ }
  useVoice.setState({ listening: false });
}
