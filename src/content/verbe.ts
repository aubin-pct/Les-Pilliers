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
