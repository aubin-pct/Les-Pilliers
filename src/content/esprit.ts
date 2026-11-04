export type Domain = "histoire" | "géopolitique" | "économie" | "sciences" | "philosophie" | "psychologie";

export interface TopicDef { title: string; domain: Domain }

/** Sujets proposés par l'Examinateur, servis en tournant entre les domaines. */
export const TOPICS: TopicDef[] = [
  { title: "Le détroit d'Ormuz et le prix du pétrole", domain: "géopolitique" },
  { title: "Qui détient la dette publique française", domain: "économie" },
  { title: "Le traité de Westphalie (1648)", domain: "histoire" },
  { title: "L'inflation : d'où vient-elle vraiment ?", domain: "économie" },
  { title: "Le dilemme du prisonnier", domain: "psychologie" },
  { title: "Pourquoi Taïwan pèse sur les semi-conducteurs mondiaux", domain: "géopolitique" },
  { title: "La révolution Meiji", domain: "histoire" },
  { title: "Le biais de confirmation", domain: "psychologie" },
  { title: "Le rôle d'une banque centrale", domain: "économie" },
  { title: "La chute de l'Empire romain d'Occident", domain: "histoire" },
  { title: "L'OTAN et son article 5", domain: "géopolitique" },
  { title: "Les limites de la loi de l'offre et de la demande", domain: "économie" },
  { title: "Le plan Marshall", domain: "histoire" },
  { title: "La tectonique des plaques", domain: "sciences" },
  { title: "Le soft power", domain: "géopolitique" },
  { title: "L'idée centrale du Prince de Machiavel", domain: "philosophie" },
  { title: "Les BRICS : bloc réel ou vitrine ?", domain: "géopolitique" },
  { title: "L'effet Dunning-Kruger", domain: "psychologie" },
  { title: "Pourquoi la révolution industrielle naît en Angleterre", domain: "histoire" },
  { title: "La relativité restreinte en une idée", domain: "sciences" },
  { title: "Le Brexit : causes et effets", domain: "géopolitique" },
  { title: "La guerre froide en cinq dates", domain: "histoire" },
  { title: "Ce que propose le stoïcisme", domain: "philosophie" },
  { title: "Le canal de Suez dans l'histoire", domain: "histoire" },
  { title: "La construction européenne, de la CECA à l'euro", domain: "histoire" },
  { title: "Les nouvelles routes de la soie", domain: "géopolitique" },
  { title: "La crise financière de 2008", domain: "économie" },
  { title: "La démographie chinoise", domain: "géopolitique" },
  { title: "Le nucléaire civil en France", domain: "sciences" },
  { title: "La théorie de l'évolution", domain: "sciences" },
  { title: "Le contrat social de Rousseau", domain: "philosophie" },
  { title: "L'allégorie de la caverne", domain: "philosophie" },
  { title: "Les biais de l'aversion à la perte", domain: "psychologie" },
  { title: "La mondialisation et ses perdants", domain: "économie" },
  { title: "Le pétrodollar", domain: "économie" },
  { title: "La guerre de Sécession", domain: "histoire" },
  { title: "L'ADN et le code génétique", domain: "sciences" },
  { title: "L'Arctique, nouvelle zone de rivalités", domain: "géopolitique" },
  { title: "Nietzsche : « Deviens ce que tu es »", domain: "philosophie" },
  { title: "Le marshmallow test et la gratification différée", domain: "psychologie" },
];

export const DOMAINS: Domain[] = ["histoire", "géopolitique", "économie", "sciences", "philosophie", "psychologie"];

/** Intervalles de révision, en jours, après 0, 1 et 2 révisions réussies. Gravé après la 3e. */
export const REVIEW_STEPS = [3, 10, 30];
