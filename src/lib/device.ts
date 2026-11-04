/* Retour physique : vibration, bip, écran allumé. Tout échoue en silence si le navigateur refuse. */

export function buzz(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch { /* rien */ }
}

export function beep(freq = 880, ms = 220) {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new C();
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(c.destination); g.gain.value = 0.15;
    o.start();
    setTimeout(() => { o.stop(); void c.close(); }, ms);
  } catch { /* rien */ }
}

let wake: WakeLockSentinel | null = null;
let holders = 0;
/** Garde l'écran allumé tant qu'au moins un demandeur le veut (séance, test, oral). */
export async function keepAwake(on: boolean) {
  holders = Math.max(0, holders + (on ? 1 : -1));
  try {
    if (holders > 0 && !wake && "wakeLock" in navigator) {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => { wake = null; });
    }
    if (holders === 0 && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}
/** Le verrou saute quand la page passe en arrière-plan : à redemander au retour. */
export function reacquireWake() { if (holders > 0 && !wake) { holders--; void keepAwake(true); } }
