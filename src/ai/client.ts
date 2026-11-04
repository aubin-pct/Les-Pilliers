/*
 * Client du modèle, format OpenAI (POST {baseUrl}/chat/completions) : DeepSeek par défaut, compatible OpenRouter.
 * Sur DeepSeek, la réflexion est désactivée sauf en mode approfondi. Erreur 400 : un seul nouvel essai sans
 * les paramètres propres à DeepSeek ni response_format.
 */
import type { Settings } from "@/engine/types";
import { PERSONA } from "./prompts";

export class AIError extends Error {
  constructor(message: string, public code: "nokey" | "offline" | "network" | "timeout" | "http" | "parse", public status?: number) { super(message); }
}

export interface CallOptions {
  /** false : texte brut au lieu de JSON. */
  json?: boolean;
  /** Utilise la réflexion si le réglage « approfondi » est actif. */
  deep?: boolean;
  max?: number;
}

export async function callModel(settings: Settings, user: string, o: CallOptions = {}): Promise<unknown> {
  if (!settings.apiKey.trim()) throw new AIError("Ajoute ta clé DeepSeek dans les réglages.", "nokey");
  if (!navigator.onLine) throw new AIError("Hors ligne : le Contremaître IA attend le réseau.", "offline");
  const base = (settings.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
  const isDeepSeek = /deepseek\.com/.test(base);
  const deep = !!(o.deep && settings.deep);
  const body: Record<string, unknown> = {
    model: settings.model || "deepseek-flash",
    messages: [{ role: "system", content: PERSONA }, { role: "user", content: user }],
    stream: false,
    max_tokens: deep ? 6000 : o.max ?? 1400,
  };
  if (o.json !== false) body.response_format = { type: "json_object" };
  if (isDeepSeek) body.thinking = { type: deep ? "enabled" : "disabled" };
  if (isDeepSeek && deep) body.reasoning_effort = "high";

  const send = async (b: Record<string, unknown>) => {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), deep ? 120_000 : 60_000);
    let r: Response;
    try {
      r = await fetch(base + "/chat/completions", {
        method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.apiKey.trim() },
        body: JSON.stringify(b),
      });
    } catch (e) {
      throw (e as Error).name === "AbortError"
        ? new AIError("Le Contremaître met trop de temps à répondre. Réessaie.", "timeout")
        : new AIError("Réseau injoignable. Si ça persiste, essaie l'adresse OpenRouter dans les réglages.", "network");
    } finally { clearTimeout(tm); }
    if (!r.ok) {
      const msg = r.status === 401 ? "Clé API refusée. Vérifie-la dans les réglages."
        : r.status === 402 ? "Solde DeepSeek insuffisant. Recharge ton compte sur platform.deepseek.com."
        : r.status === 429 ? "Trop de demandes d'affilée. Attends une minute."
        : r.status >= 500 ? "Le serveur de l'IA est en panne. Réessaie plus tard."
        : `Requête refusée par l'IA (erreur ${r.status}).`;
      throw new AIError(msg, "http", r.status);
    }
    return r.json() as Promise<{ choices?: { message?: { content?: string } }[] }>;
  };

  let data;
  try { data = await send(body); }
  catch (e) {
    if (e instanceof AIError && e.status === 400) {
      delete body.response_format; delete body.thinking; delete body.reasoning_effort;
      data = await send(body);
    } else throw e;
  }
  const txt = String(data?.choices?.[0]?.message?.content ?? "");
  if (o.json === false) return txt.trim();
  const a = txt.indexOf("{"), z = txt.lastIndexOf("}");
  if (a < 0 || z < a) throw new AIError("Réponse illisible du Contremaître. Réessaie.", "parse");
  try { return JSON.parse(txt.slice(a, z + 1)); }
  catch { throw new AIError("Réponse illisible du Contremaître. Réessaie.", "parse"); }
}
