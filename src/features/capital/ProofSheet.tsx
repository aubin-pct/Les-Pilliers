import { useEffect, useState } from "react";
import { loadProof } from "@/lib/media";
import { Sheet } from "@/ui/kit";

export function ProofSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!id) { setSrc(undefined); return; }
    let live = true;
    loadProof(id).then((s) => live && setSrc(s ?? null)).catch(() => live && setSrc(null));
    return () => { live = false; };
  }, [id]);
  return (
    <Sheet open={id !== null} onClose={onClose} label="Preuve">
      <span className="eyebrow">Preuve</span>
      <h2 className="h-display" style={{ fontSize: 28 }}>Pièce au dossier</h2>
      {src ? <img src={src} alt="Photo de preuve" style={{ borderRadius: 4, border: "1px solid var(--line)" }} /> : src === null ? <p className="muted">Photo introuvable sur cet appareil.</p> : null}
      <button className="btn block" type="button" onClick={onClose}>Fermer</button>
    </Sheet>
  );
}
