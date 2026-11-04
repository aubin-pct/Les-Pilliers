/* Formulaires du profil, un par pilier. Ce qui est déclaré ici nourrit toutes les propositions du Contremaître. */
import { DOMAIN_CHOICES, EQUIPMENT, GOALS, LEVELS, RISKS } from "@/content/profile";
import type { CorpsGoal, Profile } from "@/engine/types";
import { Chips, NumField, Segmented, TextField } from "@/ui/fields";

type P = Profile;
type Up<K extends keyof P> = (v: Partial<P[K]>) => void;

export function CorpsForm({ v, up }: { v: P["corps"]; up: Up<"corps"> }) {
  return (
    <>
      <Chips label="Tes objectifs (un ou plusieurs)" options={GOALS.map((g) => g.label)} value={v.objectifs.map((g) => GOALS.find((x) => x.id === g)!.label)}
        onChange={(labels) => up({ objectifs: labels.map((l) => GOALS.find((g) => g.label === l)!.id as CorpsGoal) })} />
      <Segmented label="Niveau" value={v.niveau} options={LEVELS} onChange={(niveau) => up({ niveau })} />
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <NumField id="p-age" label="Âge" value={v.age} onChange={(age) => up({ age })} />
        <NumField id="p-poids" label="Poids" suffix="kg" value={v.poids} onChange={(poids) => up({ poids })} />
        <NumField id="p-taille" label="Taille" suffix="cm" value={v.taille} onChange={(taille) => up({ taille })} />
      </div>
      <Chips label="Matériel à disposition" options={EQUIPMENT} value={v.materiel} onChange={(materiel) => up({ materiel })} allowCustom />
      <div className="grid2">
        <NumField id="p-spw" label="Séances par semaine" value={v.seancesParSemaine} min={1} max={7} onChange={(n) => up({ seancesParSemaine: Math.max(1, Math.min(7, n ?? 3)) })} />
        <NumField id="p-min" label="Durée d'une séance" suffix="min" value={v.minutes} min={10} max={180} onChange={(n) => up({ minutes: Math.max(10, n ?? 40) })} />
      </div>
      <TextField id="p-contr" label="Blessures, douleurs, contraintes" value={v.contraintes} onChange={(contraintes) => up({ contraintes })} placeholder="Ex. : genou droit fragile, pas de saut" />
      <TextField id="p-act" label="Autres activités physiques" value={v.activites} onChange={(activites) => up({ activites })} placeholder="Ex. : foot le mercredi, vélo pour aller au travail" />
    </>
  );
}

export function CapitalForm({ v, up }: { v: P["capital"]; up: Up<"capital"> }) {
  return (
    <>
      <TextField id="p-sit" label="Ta situation" value={v.situation} onChange={(situation) => up({ situation })} placeholder="Ex. : étudiant ingénieur en alternance, logé chez mes parents" />
      <TextField id="p-comp" area label="Ce que tu sais faire (le plus précis possible)" value={v.competences} onChange={(competences) => up({ competences })}
        placeholder="Ex. : Python, SQL, Power BI, montage vidéo, maths niveau prépa, anglais courant, je sais parler en public" />
      <TextField id="p-res" area label="Tes ressources" value={v.ressources} onChange={(ressources) => up({ ressources })} placeholder="Ex. : un PC puissant, un appareil photo, le réseau de l'école et de l'alternance, une voiture" />
      <div className="grid2">
        <NumField id="p-h" label="Temps par semaine" suffix="h" value={v.heuresParSemaine} onChange={(n) => up({ heuresParSemaine: Math.max(1, n ?? 5) })} />
        <NumField id="p-b" label="Budget à investir" suffix="€" value={v.budget} onChange={(n) => up({ budget: Math.max(0, n ?? 0) })} />
      </div>
      <Segmented label="Rapport au risque" value={v.risque} options={RISKS} onChange={(risque) => up({ risque })} />
      <TextField id="p-int" label="Ce qui t'intéresse" value={v.interets} onChange={(interets) => up({ interets })} placeholder="Ex. : IA, sport, finance, jeux vidéo, immobilier" />
      <TextField id="p-obj" label="Ton objectif" value={v.objectif} onChange={(objectif) => up({ objectif })} placeholder="Ex. : 500 €/mois d'ici l'été, puis une activité qui dépasse mon salaire" />
      <TextField id="p-deja" label="Ce que tu as déjà tenté" value={v.dejaFait} onChange={(dejaFait) => up({ dejaFait })} placeholder="Ex. : revente de vêtements, un site jamais lancé" />
      <TextField id="p-refus" label="Ce que tu refuses de faire" value={v.refus} onChange={(refus) => up({ refus })} placeholder="Ex. : démarchage téléphonique, crypto" />
    </>
  );
}

export function EspritForm({ v, up }: { v: P["esprit"]; up: Up<"esprit"> }) {
  return (
    <>
      <Chips label="Les domaines que tu veux maîtriser" options={DOMAIN_CHOICES} value={v.domaines} onChange={(domaines) => up({ domaines })} allowCustom
        hint="Le Contremaître te proposera chaque jour des sujets dans ces domaines. Tu peux en ajouter d'autres." />
      <Segmented label="Niveau de départ" value={v.niveau} options={LEVELS} onChange={(niveau) => up({ niveau })} />
      <TextField id="p-pq" label="Pourquoi tu veux apprendre" value={v.pourquoi} onChange={(pourquoi) => up({ pourquoi })} placeholder="Ex. : comprendre l'actualité, tenir une conversation avec n'importe qui" />
    </>
  );
}

export function VerbeForm({ v, up }: { v: P["verbe"]; up: Up<"verbe"> }) {
  return (
    <>
      <TextField id="p-ctx" area label="Où tu dois être convaincant" value={v.contexte} onChange={(contexte) => up({ contexte })} placeholder="Ex. : soutenances de projet, réunions d'équipe, entretiens d'embauche, pitchs" />
      <TextField id="p-vobj" label="Ce que tu veux corriger" value={v.objectif} onChange={(objectif) => up({ objectif })} placeholder="Ex. : les « euh », parler trop vite, manquer de structure" />
    </>
  );
}
