/* Compte à rendre : l'excuse du jour manqué, jugée par le Contremaître (ou les règles de base), puis archivée. */
import { useState } from "react";
import { PILLAR } from "@/content/pillars";
import { judgeExcuse } from "@/ai/contremaitre";
import { localVerdict, CAT_NAMES } from "@/engine/verdicts";
import type { ExcuseCat } from "@/engine/types";
import { DAY, dayKey, fdate, fdateK } from "@/lib/format";
import { buzz } from "@/lib/device";
import { useChantier, useStore } from "@/store";
import { toast } from "@/store/ui";
import { Foreman, Sheet, Thinking } from "@/ui/kit";

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useChantier();
  const act = useStore((s) => s.act);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; verdict: string } | null>(null);
  const [jar, setJar] = useState(false);
  if (!c) return null;
  const p = c.pending[c.pending.length - 1];

  const reset = () => { setText(""); setResult(null); setJar(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!p) return;
    const t = text.trim();
    if (t.length < 3) { toast("Écris une vraie phrase."); return; }
    setBusy(true);
    const now = Date.now();
    const P = PILLAR[p.pillar];
    const ai = await judgeExcuse({
      pilier: P.name, sub: P.sub, date: fdateK(p.date), floor: P.floor, excuse: t,
    });
    const v = ai
      ? { cat: (ai.categorie in CAT_NAMES ? ai.categorie : "autre") as ExcuseCat, ok: !!ai.recevable, verdict: ai.verdict }
      : localVerdict(c, p.pillar, t, now);
    act((d) => {
      const pend = d.pending.pop();
      if (!pend) return;
      d.excuses.push({ ts: now, date: pend.date, pillar: pend.pillar, text: t, cat: v.cat, ok: v.ok, verdict: v.verdict });
      if (d.excuses.length > 500) d.excuses = d.excuses.slice(-500);
    });
    buzz(v.ok ? 30 : [80, 50, 80]);
    setResult({ ok: v.ok, verdict: v.verdict });
    setBusy(false);
  };

  const next = () => {
    const s = useStore.getState();
    reset();
    if (!(s.demo ?? s.chantier)?.pending.length) onClose();
  };

  return (
    <Sheet open={open} onClose={close} label="Compte à rendre">
      {result ? (
        <>
          <Foreman who={`Verdict · ${result.ok ? "recevable" : "rejetée"}`} tone={result.ok ? "good" : "bad"}><p className="voice">{result.verdict}</p></Foreman>
          <button className="btn primary block" type="button" onClick={next}>{c.pending.length ? `Compte suivant (${c.pending.length})` : "Retour au chantier"}</button>
        </>
      ) : p ? (
        <>
          <span className="eyebrow" style={{ color: "var(--blood)" }}>Compte à rendre · {c.pending.length} en attente</span>
          <h2 className="h-display" style={{ fontSize: 34 }}>{p.date === dayKey(Date.now() - DAY) ? "Hier" : "Le " + fdateK(p.date)}. {PILLAR[p.pillar].name}. Rien.</h2>
          <p className="muted">Plancher exigé : {PILLAR[p.pillar].floor}. Écris pourquoi. Le Contremaître lit tout et n'oublie rien.</p>
          <label className="f" htmlFor="ex-text">Ton excuse
            <textarea id="ex-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pourquoi ?" style={{ minHeight: 96 }} />
          </label>
          <div className="btn-row">
            <button className="btn primary" type="button" disabled={busy} onClick={submit}>Soumettre</button>
            <button className="btn ghost" type="button" onClick={() => setJar(true)}>Ouvre le bocal</button>
          </div>
          {busy && <Thinking>Le Contremaître lit ton excuse</Thinking>}
          {jar && (
            <Foreman who="Le bocal" sub="Tu as déjà fait plus dur que ce qu'on te demande aujourd'hui.">
              <div className="voice">{c.wins.length ? c.wins.slice(-3).reverse().map((w) => `${fdate(w.ts)} — ${w.text}`).join("\n") : "Vide. Raison de plus pour ne pas lâcher maintenant."}</div>
            </Foreman>
          )}
        </>
      ) : (
        <button className="btn block" type="button" onClick={close}>Fermer</button>
      )}
    </Sheet>
  );
}
