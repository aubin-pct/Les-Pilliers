/*
 * Couches superposées (panneaux, compteur) et bouton retour d'Android.
 * Chaque couche ouverte pousse une entrée d'historique ; le retour ferme seulement la couche du dessus.
 * Une couche fermée par l'interface retire son entrée sans déclencher la fermeture des autres.
 */
type Layer = { id: number; close: () => void };
const stack: Layer[] = [];
let seq = 0;
let ignore = 0;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (ignore > 0) { ignore--; return; }
    stack.pop()?.close();
  });
}

/** Ouvre une couche ; renvoie la fonction à appeler quand l'interface la ferme. */
export function openLayer(close: () => void): () => void {
  const id = ++seq;
  stack.push({ id, close });
  history.pushState({ layer: id }, "");
  return () => {
    const i = stack.findIndex((l) => l.id === id);
    if (i < 0) return; // déjà fermée par le retour
    stack.splice(i, 1);
    ignore++;
    history.back();
  };
}
