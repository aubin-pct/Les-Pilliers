export type SubjectKind = "convaincre" | "raconter" | "expliquer" | "débattre" | "pitcher";

export interface SubjectDef { text: string; kind: SubjectKind }

export const SUBJECTS: SubjectDef[] = [
  { text: "Convaincs-moi de te prêter 1 000 €.", kind: "convaincre" },
  { text: "Défends une idée impopulaire que tu crois vraie.", kind: "débattre" },
  { text: "Explique ton futur métier à un enfant de dix ans.", kind: "expliquer" },
  { text: "Pourquoi la discipline bat la motivation.", kind: "convaincre" },
  { text: "Vends-moi l'objet le plus proche de toi.", kind: "pitcher" },
  { text: "Raconte ton plus gros échec et ce qu'il t'a appris.", kind: "raconter" },
  { text: "Faut-il interdire les réseaux sociaux avant 15 ans ?", kind: "débattre" },
  { text: "Présente-toi à un investisseur en 90 secondes.", kind: "pitcher" },
  { text: "L'argent fait-il le bonheur ?", kind: "débattre" },
  { text: "Que ferais-tu avec dix millions d'euros ?", kind: "raconter" },
  { text: "Pourquoi l'histoire se répète-t-elle ?", kind: "expliquer" },
  { text: "Convaincs un sédentaire de se mettre au sport.", kind: "convaincre" },
  { text: "Le meilleur conseil qu'on t'ait donné.", kind: "raconter" },
  { text: "Annonce une mauvaise nouvelle à ton équipe.", kind: "convaincre" },
  { text: "Pourquoi tu mérites une augmentation.", kind: "convaincre" },
  { text: "Explique l'inflation à ta grand-mère.", kind: "expliquer" },
  { text: "Défends le train face à l'avion.", kind: "débattre" },
  { text: "Fais l'éloge d'un objet banal.", kind: "pitcher" },
  { text: "Le travail le dimanche : pour ou contre ?", kind: "débattre" },
  { text: "Ce que l'école ne t'apprendra jamais.", kind: "expliquer" },
  { text: "Pitche une idée d'entreprise en 90 secondes.", kind: "pitcher" },
  { text: "Pourquoi tu ne seras pas salarié toute ta vie.", kind: "convaincre" },
  { text: "Convaincs ton patron d'adopter un nouvel outil.", kind: "convaincre" },
  { text: "Raconte une journée parfaite dans dix ans.", kind: "raconter" },
  { text: "Explique la guerre froide en 90 secondes.", kind: "expliquer" },
  { text: "La voiture électrique : progrès ou illusion ?", kind: "débattre" },
  { text: "Raconte le moment où tu as été le plus fier de toi.", kind: "raconter" },
  { text: "Vends une formation que tu pourrais donner.", kind: "pitcher" },
];

/** Tics verbaux repérés dans la transcription. */
export const TICS = ["euh", "heu", "hum", "bah", "ben", "genre", "du coup", "en fait", "voilà", "tu vois", "en mode", "bref", "quoi"];

/** Durée d'un oral, en secondes, et seuils de validité. */
export const ORAL_SECONDS = 90;
export const ORAL_MIN_SECONDS = 45;
export const ORAL_MIN_WORDS = 40;
export const ORAL_MIN_VOICE = 25;

/* ======================= v5 : la salle d'entraînement ======================= */
import type { EloSkill } from "@/engine/types";

export type DrillId = "sans_filet" | "structure" | "silence" | "lecture" | "articulation" | "mots" | "question_piege" | "redite" | "libre";

export interface DrillDef {
  id: DrillId; nom: string; skill: EloSkill; secs: number;
  /** Une ligne, affichée sur la carte de l'exercice. */
  but: string;
  /** Description donnée à l'IA pour générer le contenu. */
  ia: string;
  /** Structure guidée : étapes et durées (s). */
  phases?: [string, number][];
}

export const DRILLS: DrillDef[] = [
  { id: "sans_filet", nom: "Zéro tic", skill: "fluidite", secs: 60, but: "60 s. Chaque « euh » sonne.", ia: "parler 60 secondes sans aucun tic verbal ; chaque tic est signalé en direct" },
  { id: "structure", nom: "PREP", skill: "structure", secs: 75, but: "Point, Raison, Exemple, Point. Guidé.", ia: "répondre en suivant la structure PREP (Point, Raison, Exemple, retour au Point), guidée par le minuteur", phases: [["Point", 15], ["Raison", 20], ["Exemple", 25], ["Point", 15]] },
  { id: "silence", nom: "Le silence", skill: "rythme", secs: 60, but: "Place 3 silences voulus de 2 s.", ia: "placer volontairement au moins 3 silences de 2 secondes avant les idées fortes" },
  { id: "lecture", nom: "Lecture", skill: "voix", secs: 75, but: "Lis à voix haute. Fais varier ton et volume.", ia: "lire un texte à voix haute en variant intonation, volume et vitesse" },
  { id: "articulation", nom: "Articulation", skill: "voix", secs: 45, but: "3 virelangues, de plus en plus vite.", ia: "articuler 3 virelangues de plus en plus vite" },
  { id: "mots", nom: "Mots imposés", skill: "vocabulaire", secs: 60, but: "Place 3 mots précis dans ton discours.", ia: "parler en plaçant naturellement 3 mots soutenus imposés (donne-les dans le conseil, séparés par des virgules)" },
  { id: "question_piege", nom: "Question piège", skill: "impact", secs: 60, but: "Une question dure. Réponds sans fuir.", ia: "répondre à une question piège d'entretien ou de soutenance, sans esquive" },
  { id: "libre", nom: "Oral libre", skill: "impact", secs: 90, but: "Le sujet du jour. 90 s.", ia: "oral libre de 90 secondes sur un sujet adapté à son contexte" },
  { id: "redite", nom: "Refais-le", skill: "impact", secs: 75, but: "Ton dernier oral, en mieux.", ia: "refaire le dernier oral en corrigeant le défaut signalé" },
];
export const DRILL: Record<DrillId, DrillDef> = Object.fromEntries(DRILLS.map((d) => [d.id, d])) as Record<DrillId, DrillDef>;

export const SKILLS: { id: EloSkill; nom: string }[] = [
  { id: "structure", nom: "Structure" }, { id: "fluidite", nom: "Fluidité" }, { id: "rythme", nom: "Rythme" },
  { id: "voix", nom: "Voix" }, { id: "vocabulaire", nom: "Vocabulaire" }, { id: "impact", nom: "Impact" },
];

/* Contenus de secours (sans IA). */
export const VIRELANGUES = [
  "Les chaussettes de l'archiduchesse sont-elles sèches, archi-sèches ?",
  "Un chasseur sachant chasser doit savoir chasser sans son chien.",
  "Si six scies scient six cyprès, six cent six scies scient six cent six cyprès.",
  "Ton thé t'a-t-il ôté ta toux ?",
  "Pauvre petit pêcheur, prends patience pour pouvoir prendre plusieurs petits poissons.",
  "Je veux et j'exige d'exquises excuses.",
];
export const LECTURES = [
  "Il y a dix ans, personne ne croyait à ce projet. Personne. On nous disait : trop cher, trop lent, trop risqué. Alors nous avons commencé petit : trois personnes, un garage, quatre mille euros. Aujourd'hui, nous servons deux cent mille clients. Est-ce que nous avons eu de la chance ? Peut-être. Mais la chance n'explique pas cinq cents nuits de travail. Ce qui nous a sauvés, c'est une règle simple : chaque semaine, une preuve. Pas une promesse, une preuve. Et c'est exactement ce que je vous demande aujourd'hui.",
  "Regardez ce chiffre : quarante pour cent. C'est la part des projets qui échouent avant même d'avoir commencé. Pas faute d'argent. Pas faute d'idées. Faute de décision. On attend le bon moment, le bon associé, la bonne saison. Et pendant ce temps, quelqu'un d'autre, moins brillant, moins préparé, se lance. Il se trompe, il corrige, il avance. Six mois plus tard, il a un client. Vous, vous avez un plan. Alors je vous pose la question : qu'est-ce qui vous retient vraiment ?",
  "Le marathon ne se gagne pas au trente-cinquième kilomètre. Il se gagne en janvier, sous la pluie, à six heures du matin, quand personne ne regarde. Ce jour-là, tout en vous réclame le lit. Vous y allez quand même. Un kilomètre. Puis deux. Puis dix. Le jour de la course, la foule voit un athlète. Elle ne voit pas les trois cents matins invisibles. Mais vous, vous les connaissez. Et c'est précisément pour cela que vous ne lâcherez pas.",
];
export const MOTS = [["paradigme", "inéluctable", "corollaire"], ["pragmatique", "levier", "prépondérant"], ["paradoxe", "pérenne", "tangible"], ["arbitrage", "nuance", "déterminant"], ["incontournable", "rigueur", "audace"]];
export const PIEGES = [
  "Quel est ton plus grand défaut, et pourquoi devrais-je te faire confiance malgré lui ?",
  "Pourquoi toi plutôt qu'un candidat plus expérimenté ?",
  "Ton dernier projet a échoué : qu'aurais-tu dû voir avant ?",
  "Tu te dis rigoureux. Donne-moi une preuve chiffrée.",
  "Si je te dis que ton idée existe déjà, tu réponds quoi ?",
];
