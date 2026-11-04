/* Verdicts sans IA : les règles de base du Contremaître. */
import { PILLAR } from "@/content/pillars";
import { DAY, f1, fdate } from "@/lib/format";
import type { Chantier, ExcuseCat, PillarId } from "./types";

const CATS: { id: ExcuseCat; ok?: boolean; re: RegExp }[] = [
  { id: "sante", ok: true, re: /malad|bless|fièvre|fievre|grippe|covid|douleur|hôpital|hopital|urgence|décès|deces|enterrement|deuil|médecin|medecin|déprim|deprim|anxi|crise|vomi|migraine/i },
  { id: "fatigue", re: /fatigu|crev|épuis|epuis|sommeil|dormi|dodo|claqu|naze/i },
  { id: "temps", re: /temps|cours|boulot|travail|taf|exam|partiel|alternance|occupé|occupe|charg|réunion|reunion|projet/i },
  { id: "motivation", re: /envie|motiv|flemme|pas le moral|la tête à|la tete a|pas chaud|oubli/i },
  { id: "externe", re: /pluie|pleu|météo|meteo|froid|salle|coloc|ami|pote|famille|soirée|soiree|bruit|wifi|réseau|reseau/i },
];

export const CAT_NAMES: Record<ExcuseCat, string> = {
  fatigue: "Fatigue", temps: "Pas le temps", motivation: "Pas envie", externe: "La faute aux autres", sante: "Santé", autre: "Autre", mise: "Mise perdue",
};

export function categorize(text: string) {
  return CATS.find((c) => c.re.test(text)) ?? { id: "autre" as ExcuseCat, ok: false };
}

export function localVerdict(c: Chantier, pillar: PillarId, text: string, now: number) {
  const cat = categorize(text);
  const P = PILLAR[pillar];
  if (cat.ok) {
    return { cat: cat.id, ok: true, verdict: "Recevable. Soigne-toi d'abord. Le pilier ne te pardonne rien, mais il attend. Si c'est lourd, parles-en à quelqu'un. Reviens dès que tu peux poser une pierre, même petite." };
  }
  const same = c.excuses.filter((e) => e.cat === cat.id && e.ts > now - 30 * DAY).length + 1;
  const w = c.wins.length ? c.wins[Math.floor((c.wins.length * 0.37 + same) % c.wins.length)] : null;
  const rappel = w ? ` Le ${fdate(w.ts)}, tu as fait ça : ${w.text}. Ce type-là existe. Va le chercher.` : "";
  const nth = same === 1 ? "Première fois" : `${same}e fois en 30 jours`;
  const lines: Record<string, string> = {
    fatigue: `« Fatigué ». ${nth}. La fatigue n'a jamais posé une seule pierre. Le plancher du ${P.name}, c'est cinq minutes.${rappel} Excuse rejetée.`,
    temps: `Pas le temps ? Ta journée fait 1 440 minutes. Le plancher en demande cinq. ${nth} que tu me sors l'emploi du temps.${rappel} Excuse rejetée.`,
    motivation: `La motivation, c'est pour ceux qui ont le choix. Toi, tu as un pilier qui s'effrite de ${f1(P.rate * 100)} % par jour. ${nth}.${rappel} Excuse rejetée.`,
    externe: `La météo, les autres, le monde. Rien de tout ça ne t'empêchait de poser ta pierre. ${nth} que c'est la faute de quelqu'un d'autre. Excuse rejetée.`,
    autre: `Je lis une phrase, pas une raison. Le pilier ${P.name} n'a rien reçu, point.${rappel} Excuse rejetée.`,
  };
  return { cat: cat.id, ok: false, verdict: lines[cat.id] ?? lines.autre };
}
