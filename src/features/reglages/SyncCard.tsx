/* Réglages de la synchronisation entre appareils (serveur Docker du Mac, via Tailscale). */
import { useEffect, useState } from "react";
import { proofCount } from "@/engine/sync";
import { detectSameOrigin, forgetBase, resolveChoice, syncNow, testConnection, useSync } from "@/lib/sync";
import { f0, fdate } from "@/lib/format";
import { useStore } from "@/store";
import { toast } from "@/store/ui";
import { Card, Sheet, Thinking } from "@/ui/kit";

export function SyncCard() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const local = useStore((s) => s.chantier);
  const status = useSync((s) => s.status);
  const [url, setUrl] = useState(settings.syncUrl);
  const [token, setToken] = useState(settings.syncToken);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const connected = !!settings.syncUrl && !!settings.syncToken;

  useEffect(() => { if (!url) detectSameOrigin().then((o) => { if (o) setUrl(o); }); }, []); // eslint-disable-line

  const connect = async () => {
    setBusy(true); setErr(null);
    const e = await testConnection(url, token);
    if (e) { setErr(e); setBusy(false); return; }
    if (url.trim().replace(/\/+$/, "") !== settings.syncUrl) await forgetBase();
    setSettings({ syncUrl: url.trim().replace(/\/+$/, ""), syncToken: token.trim() });
    await syncNow();
    setBusy(false);
    toast("Appareil relié au serveur.");
  };
  const disconnect = async () => { await forgetBase(); setSettings({ syncUrl: "", syncToken: "" }); useSync.setState({ status: { kind: "off" } }); toast("Synchronisation coupée sur cet appareil."); };

  const line =
    status.kind === "ok" ? <span className="up">À jour · révision {status.rev} · {new Date(status.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
      : status.kind === "error" ? <span className="down">{status.message}</span>
      : status.kind === "syncing" || status.kind === "idle" ? <Thinking>Synchronisation</Thinking>
      : status.kind === "choice" ? <span className="down">Choix à faire : ce téléphone et le serveur ont chacun un chantier.</span>
      : <span className="muted">Pas de synchronisation.</span>;

  const remote = status.kind === "choice" ? status.remote.state : null;

  return (
    <Card title="Synchronisation" aside={connected ? "Mac ↔ téléphone" : "désactivée"}>
      <p className="muted small">Le même chantier sur ton Mac et ton téléphone, via ton serveur Docker. Tout est fusionné : rien ne se perd si tu as utilisé les deux appareils hors ligne.</p>
      <label className="f" htmlFor="sy-url">Adresse du serveur
        <input id="sy-url" type="url" spellCheck={false} autoCapitalize="off" placeholder="https://piliers.ton-reseau.ts.net" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="f" htmlFor="sy-tok">Jeton de synchronisation
        <input id="sy-tok" type="password" autoComplete="off" spellCheck={false} placeholder="SYNC_TOKEN du fichier .env" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <div className="btn-row">
        <button className="btn primary" type="button" disabled={busy || !url.trim() || token.trim().length < 16} onClick={() => void connect()}>{connected ? "Enregistrer" : "Relier cet appareil"}</button>
        {connected && <button className="btn" type="button" disabled={busy} onClick={() => void syncNow()}>Synchroniser maintenant</button>}
        {connected && <button className="linkish" type="button" onClick={() => void disconnect()}>Couper</button>}
      </div>
      {busy && <Thinking>Connexion au serveur</Thinking>}
      {err && <p className="down small">{err}</p>}
      <p className="small">{line}</p>

      <Sheet open={status.kind === "choice"} onClose={() => useSync.setState({ status: { kind: "idle" } })} label="Premier rattachement">
        {remote && (
          <>
            <span className="eyebrow">Premier rattachement</span>
            <h2 className="h-display" style={{ fontSize: 32 }}>Deux chantiers. Lequel garder ?</h2>
            <div className="list">
              <div className="li"><span className="main"><b>Serveur</b> · depuis le {fdate(remote.created)}</span><span className="side">{proofCount(remote)} preuves · {f0(remote.euros)} €</span></div>
              {local && <div className="li"><span className="main"><b>Cet appareil</b> · depuis le {fdate(local.created)}</span><span className="side">{proofCount(local)} preuves · {f0(local.euros)} €</span></div>}
            </div>
            <p className="muted small">Fusionner additionne tout : séances, missions, sujets, oraux, et les gains des deux côtés.</p>
            <button className="btn primary block" type="button" onClick={() => void resolveChoice("merge")}>Fusionner les deux</button>
            <div className="btn-row">
              <button className="btn" type="button" onClick={() => void resolveChoice("server")}>Garder le serveur</button>
              <button className="btn" type="button" onClick={() => void resolveChoice("local")}>Garder cet appareil</button>
            </div>
          </>
        )}
      </Sheet>
    </Card>
  );
}
