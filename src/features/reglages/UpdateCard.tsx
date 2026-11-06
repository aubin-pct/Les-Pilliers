/* Version installée, version publiée, et quoi faire si l'appli n'est pas à jour. */
import { checkUpdate, forceReload, fromPages, newer, PUBLISHED, useUpdate } from "@/lib/update";
import { toast } from "@/store/ui";
import { Card } from "@/ui/kit";

export const MAC_CMD = "git pull && docker compose up -d --build";

export function UpdateCard() {
  const { latest, checking } = useUpdate();
  const late = !!latest && newer(latest, __APP_VERSION__);
  return (
    <Card title="Version" aside={<span className={"pill " + (late ? "" : "on")}>{late ? "en retard" : latest ? "à jour" : "?"}</span>}>
      <div className="kpis">
        <div><b className="num">{__APP_VERSION__}</b><span>installée</span></div>
        <div><b className="num" style={late ? { color: "var(--blood)" } : undefined}>{latest ?? "—"}</b><span>publiée</span></div>
      </div>
      {late && !fromPages && (
        <>
          <p className="small">Ton appli vient de ton Mac ({location.host}) : elle ne change que quand tu reconstruis le conteneur. Dans le Terminal du Mac, depuis le dossier du dépôt Les-Pilliers :</p>
          <div className="script">{MAC_CMD}</div>
          <button className="btn small" type="button" onClick={() => { void navigator.clipboard?.writeText(MAC_CMD).then(() => toast("Commande copiée."), () => undefined); }}>Copier la commande</button>
          <p className="small muted">Ou installe l'appli depuis <b>{PUBLISHED.replace("https://", "")}</b> (à jour toute seule) et relie-la au même serveur de synchronisation : tes données reviennent.</p>
        </>
      )}
      <div className="btn-row">
        <button className="btn" type="button" disabled={checking} onClick={() => void checkUpdate()}>Vérifier</button>
        {(late || !latest) && <button className="btn ghost" type="button" onClick={() => void forceReload()}>Forcer le rechargement</button>}
      </div>
    </Card>
  );
}
