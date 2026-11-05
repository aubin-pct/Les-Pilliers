/*
 * Captation de la Tribune : enregistrement audio (MediaRecorder), niveau sonore toutes les 50 ms (AnalyserNode)
 * et transcription en direct (SpeechRecognition, quand le navigateur l'offre). Indépendant de React.
 */
import { FRAME } from "@/engine/analysis";
import { detectPitch } from "@/engine/eloquence";

type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
const SRClass = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
export const hasSpeechRecognition = !!SRClass;

export interface CaptureEvents {
  onLevel?: (rms: number) => void;
  /** Chaque trame : niveau et hauteur de la voix (Hz, null si silence ou bruit). */
  onFrame?: (rms: number, pitch: number | null) => void;
  onTranscript?: (finals: string, interim: string) => void;
  onRecognitionFailed?: () => void;
}

export interface CaptureResult { blob: Blob | null; rms: number[]; pitch: (number | null)[]; text: string; recognized: boolean }

export class Capture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = "";
  private ctx: AudioContext | null = null;
  private sampler: ReturnType<typeof setInterval> | null = null;
  private recog: SR | null = null;
  private running = false;
  rms: number[] = [];
  pitch: (number | null)[] = [];
  finals = "";
  interim = "";
  recognized = false;
  recogFailed = !SRClass;

  constructor(private ev: CaptureEvents = {}) {}

  /** Demande le micro et démarre tout. Lève une erreur si le micro est refusé ou absent. */
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.running = true;
    const mimes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
    this.mime = (typeof MediaRecorder !== "undefined" && mimes.find((m) => MediaRecorder.isTypeSupported?.(m))) || "";
    try {
      this.recorder = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime, audioBitsPerSecond: 48000 } : undefined);
      this.recorder.ondataavailable = (e) => { if (e.data?.size) this.chunks.push(e.data); };
      this.recorder.start(1000);
    } catch { this.recorder = null; }
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new C();
      await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 2048; src.connect(an);
      const buf = new Float32Array(an.fftSize);
      this.sampler = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const r = Math.sqrt(s / buf.length);
        const f = r > 0.012 ? detectPitch(buf, this.ctx!.sampleRate) : null;
        this.rms.push(r); this.pitch.push(f); this.ev.onLevel?.(r); this.ev.onFrame?.(r, f);
      }, FRAME * 1000);
    } catch { this.ctx = null; }
    if (SRClass) this.startRecognition();
  }

  private startRecognition() {
    try {
      const r = new SRClass!();
      r.lang = "fr-FR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) this.finals += (this.finals && !/\s$/.test(this.finals) ? " " : "") + t.trim();
          else interim += t;
        }
        this.interim = interim; this.recognized = true;
        this.ev.onTranscript?.(this.finals, interim);
      };
      r.onerror = (e) => {
        if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"].includes(e.error)) {
          this.recogFailed = true; this.ev.onRecognitionFailed?.();
        }
      };
      // Chrome coupe la reconnaissance après un silence : on la relance tant que l'oral dure.
      r.onend = () => { if (this.running && !this.recogFailed && this.recog === r) { try { r.start(); } catch { /* déjà relancée */ } } };
      this.recog = r; r.start();
    } catch { this.recogFailed = true; this.recog = null; this.ev.onRecognitionFailed?.(); }
  }

  /** Arrête tout et rend l'audio, les niveaux et la transcription. */
  async stop(): Promise<CaptureResult> {
    this.running = false;
    if (this.recog && !this.recogFailed) {
      try { this.recog.stop(); } catch { /* rien */ }
      await new Promise((r) => setTimeout(r, 600)); // laisse arriver la dernière phrase
    }
    this.recog = null;
    const blob = await new Promise<Blob | null>((res) => {
      const rec = this.recorder; this.recorder = null;
      const make = (type?: string) => (this.chunks.length ? new Blob(this.chunks, { type: type || this.mime || "audio/webm" }) : null);
      if (!rec || rec.state === "inactive") { res(make()); return; }
      rec.onstop = () => res(make(rec.mimeType));
      try { rec.stop(); } catch { res(null); }
    });
    this.release();
    return { blob, rms: this.rms, pitch: this.pitch, text: (this.finals + (this.interim ? " " + this.interim : "")).trim(), recognized: this.recognized };
  }

  /** Libère le micro sans rien garder (abandon). */
  release() {
    this.running = false;
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
    try { this.recog?.stop(); } catch { /* rien */ }
    this.recog = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) { void this.ctx.close().catch(() => undefined); this.ctx = null; }
  }
}
