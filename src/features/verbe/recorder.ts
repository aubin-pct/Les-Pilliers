/*
 * Captation de la Tribune : enregistrement audio (MediaRecorder), niveau sonore toutes les 50 ms (AnalyserNode)
 * et transcription en direct (SpeechRecognition, quand le navigateur l'offre). Indépendant de React.
 */
import { FRAME } from "@/engine/analysis";
import { detectPitch } from "@/engine/eloquence";
import { canDictate, Recognizer } from "@/lib/voice";

export const hasSpeechRecognition = canDictate;

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
  private recog: Recognizer | null = null;
  rms: number[] = [];
  pitch: (number | null)[] = [];
  finals = "";
  interim = "";
  recognized = false;
  recogFailed = !canDictate;

  constructor(private ev: CaptureEvents = {}) {}

  /** Demande le micro et démarre tout. Lève une erreur si le micro est refusé ou absent. */
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
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
    if (canDictate) this.startRecognition();
  }

  private startRecognition() {
    const r = new Recognizer({
      text: (f, i) => { this.finals = f; this.interim = i; this.recognized = true; this.ev.onTranscript?.(f, i); },
      fail: () => { this.recogFailed = true; this.ev.onRecognitionFailed?.(); },
    });
    this.recog = r;
    r.start();
  }

  /** Arrête tout et rend l'audio, les niveaux et la transcription. */
  async stop(): Promise<CaptureResult> {
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
    if (this.sampler) clearInterval(this.sampler);
    this.sampler = null;
    this.recog?.abort();
    this.recog = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) { void this.ctx.close().catch(() => undefined); this.ctx = null; }
  }
}
