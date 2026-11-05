import { MISS_PENALTY } from "@/content/pillars";
import { buzz } from "@/lib/device";
import { useStore } from "@/store";
import { toast } from "@/store/ui";
import { HoldButton } from "@/ui/HoldButton";

export function Contract() {
  const sign = useStore((s) => s.sign);
  const startDemo = useStore((s) => s.startDemo);
  return (
    <div className="view">
      <div className="hero">
        <span className="eyebrow">Le contrat</span>
        <h1>Quatre piliers. Aucune excuse.</h1>
        <p className="muted">Corps, Capital, Esprit, Verbe. Ils s'effritent tous les jours. Toi seul les fais monter, et seulement avec des preuves.</p>
      </div>
      <div className="card">
        <ol className="rules">
          <li><div><b>Tout s'érode, tout le temps.</b><span className="muted small">Chaque pilier perd un pourcentage de sa hauteur chaque jour. Plus il est haut, plus il perd. Faire toujours pareil mène au plateau.</span></div></li>
          <li><div><b>Un plancher par pilier, chaque jour.</b><span className="muted small">Environ cinq minutes. Un pilier nu à minuit perd {MISS_PENALTY * 100} % de plus.</span></div></li>
          <li><div><b>Chaque manquement se justifie.</b><span className="muted small">Le lendemain, tu écris ton excuse. Le Contremaître la juge et l'archive. Tant que tu ne t'es pas expliqué, tes gains comptent moitié.</span></div></li>
          <li><div><b>Sans preuve, rien ne compte.</b><span className="muted small">Chrono, compteur, enregistrement de ta voix, photo du paiement. Égaler ton record ne rapporte rien.</span></div></li>
        </ol>
      </div>
      <div className="btn-row">
        <HoldButton block ms={1400} label="Maintenir pour signer" hint="Tu t'engages" onConfirm={() => { sign(); buzz(80); toast("Contrat signé. Pose ta première pierre."); }} />
        <button className="btn ghost block" type="button" onClick={startDemo}>Voir 47 jours de démo</button>
      </div>
      <p className="muted small" style={{ textAlign: "center" }}>Tes données restent sur ce téléphone.</p>
    </div>
  );
}
