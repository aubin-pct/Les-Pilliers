/*
 * Ce que le Coach peut faire depuis la conversation. Chaque action est décrite pour l'IA (type, paramètres, effet)
 * et exécutée ici avec les mêmes opérations que les boutons des écrans. L'IA ne peut rien déclencher d'autre.
 */
import { DRILLS, type DrillId } from "@/content/verbe";
import type { ChatScope, CoachAction } from "@/engine/types";
import * as O from "./ops";
import { addExo } from "@/features/corps/session";

interface ActionDef { type: string; scopes: ChatScope[] | "all"; doc: string; run: (p: Record<string, unknown>, nav: (to: string) => void) => Promise<string | null> | string | null }

const s = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v));
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
const PAGES = ["temple", "corps", "capital", "esprit", "verbe", "profil"];

const DEFS: ActionDef[] = [
  { type: "ouvrir", scopes: "all", doc: `ouvrir {"page": ${PAGES.map((p) => `"${p}"`).join("|")}} : ouvre une page`,
    run: (p, nav) => { const g = s(p.page); if (!PAGES.includes(g)) return null; nav(g === "temple" ? "/" : "/" + g); return null; } },
  { type: "profil", scopes: "all", doc: `profil {"pilier": "corps"|"capital"|"esprit"|"verbe", "champ": string, "valeur": string|number|string[]} : enregistre une info durable dans son profil. Champs : ${Object.entries(O.EDITABLE).map(([k, v]) => `${k} = ${v.join(", ")}`).join(" ; ")}. Pour un texte, donne la valeur COMPLÈTE (ancienne + nouvelle info).`,
    run: (p) => O.setProfileField(s(p.pilier), s(p.champ), p.valeur) },
  { type: "seance", scopes: ["corps", "temple"], doc: `seance {"demande"?: string, "minutes"?: number, "energie"?: "basse"|"normale"|"haute", "douleur"?: string, "neuf"?: boolean} : prépare la séance du jour, ou MODIFIE celle qui existe (voir seance_du_jour) : seule la demande s'applique, le reste et les demandes précédentes sont gardés. N'indique minutes, énergie ou douleur que s'il les a données. "neuf": true seulement s'il veut une séance entièrement différente`,
    run: (p, nav) => { nav("/corps"); return O.prepareSeance({ minutes: n(p.minutes), energie: s(p.energie) || undefined, douleur: s(p.douleur) || undefined, demande: s(p.demande), neuf: p.neuf === true }); } },
  { type: "test", scopes: ["corps", "temple"], doc: `test {"test": ${"pompes|tractions|gainage|squats|souplesse".split("|").map((t) => `"${t}"`).join("|")}, "valeur": number} : enregistre une performance qu'il vient de te donner sur un test étalon (pompes, tractions en répétitions max ; gainage en secondes ; squats en 60 s ; souplesse en cm). Propose-la dès qu'il te donne un chiffre de ce type`,
    run: (p) => O.recordTest(s(p.test), p.valeur) },
  { type: "ajouter_exercice", scopes: ["corps"], doc: `ajouter_exercice {"nom": string, "type": "reps"|"duree", "series": number, "cible": number, "charge"?: string, "repos"?: number} : ajoute un exercice à la séance du jour, même commencée (sans toucher au reste). Pas de limite au nombre d'exercices`,
    run: (p) => addExo({ nom: s(p.nom), type: s(p.type) === "duree" ? "duree" : "reps", series: n(p.series), cible: n(p.cible), charge: s(p.charge), repos: n(p.repos) }) },
  { type: "programme", scopes: ["corps"], doc: `programme {"demande": string} : refait le programme de la semaine selon la demande`,
    run: (p) => O.remakeProgramme(s(p.demande)) },
  { type: "pistes", scopes: ["capital"], doc: `pistes {"demande"?: string} : génère 3 nouvelles pistes d'activité (tient compte de la demande)`,
    run: (p) => O.makeOptions(s(p.demande)) },
  { type: "sprint", scopes: ["capital"], doc: `sprint {} : refait le sprint de la semaine (objectif, indicateurs, message type)`,
    run: () => O.makeSprint() },
  { type: "prospect", scopes: ["capital"], doc: `prospect {"nom": string, "note"?: string} : ajoute un prospect à son entonnoir`,
    run: (p) => O.addProspect(s(p.nom), s(p.note)) },
  { type: "etudier", scopes: ["esprit", "temple"], doc: `etudier {"titre": string, "domaine": string} : fixe le sujet d'Esprit du jour`,
    run: (p, nav) => { nav("/esprit"); return O.studyTopic(s(p.titre), s(p.domaine)); } },
  { type: "parcours", scopes: ["esprit"], doc: `parcours {"theme": string} : crée un parcours de 6 à 10 sujets sur ce thème`,
    run: (p) => (s(p.theme).length > 3 ? O.makeParcours(s(p.theme)) : null) },
  { type: "carte", scopes: ["esprit"], doc: `carte {} : recompose sa carte du savoir (après un changement de domaines)`,
    run: () => O.makeMap() },
  { type: "exercice", scopes: ["verbe", "temple"], doc: `exercice {"type": ${DRILLS.map((d) => `"${d.id}"`).join("|")}, "sujet"?: string} : lance un exercice d'éloquence (${DRILLS.map((d) => `${d.id} = ${d.nom}`).join(", ")})`,
    run: (p, nav) => { const r = O.requestDrill(s(p.type) as DrillId, s(p.sujet)); if (r) nav("/verbe"); return r; } },
];

/** Liste des actions disponibles dans une section, pour la consigne. */
export function actionsDoc(scope: ChatScope) {
  return DEFS.filter((d) => d.scopes === "all" || d.scopes.includes(scope)).map((d) => "- " + d.doc).join("\n");
}

export function knownAction(a: CoachAction, scope: ChatScope) {
  const d = DEFS.find((x) => x.type === a.type);
  return !!d && (d.scopes === "all" || d.scopes.includes(scope));
}

export async function runAction(a: CoachAction, nav: (to: string) => void): Promise<string | null> {
  const d = DEFS.find((x) => x.type === a.type);
  if (!d) return null;
  return d.run(a.params ?? {}, nav);
}
