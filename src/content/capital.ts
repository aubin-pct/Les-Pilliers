export interface Rung {
  title: string;
  detail: string;
  /** La livraison exige un montant encaissé. */
  cash: boolean;
}

/** L'échelle : du premier euro gagné seul jusqu'à donner des ordres. */
export const LADDER: Rung[] = [
  { title: "Vendre un objet dont tu ne te sers plus", detail: "Annonce, négociation, encaissement. Preuve : le montant reçu.", cash: true },
  { title: "Faire payer un service à quelqu'un", detail: "Cours, dépannage informatique, montage, traduction. Tu fixes le prix. Preuve : le paiement.", cash: true },
  { title: "Publier une offre et décrocher une réponse d'un inconnu", detail: "Une offre écrite, publique, avec un prix. Preuve : le message reçu.", cash: false },
  { title: "Trois clients payants pour la même offre", detail: "Tu passes de « coup de chance » à « ça se vend ». Preuve : trois paiements.", cash: true },
  { title: "300 € encaissés en un mois, hors salaire", detail: "Ton propre chiffre d'affaires. Preuve : relevé des encaissements.", cash: true },
  { title: "Une vente sans ta présence", detail: "Produit numérique, modèle, appli, formation : ça se vend pendant que tu dors. Preuve : la vente.", cash: true },
  { title: "1 000 € encaissés en un mois, hors salaire", detail: "Le palier où ça devient sérieux. Preuve : relevé.", cash: true },
  { title: "Déléguer une tâche payante à quelqu'un", detail: "Tu deviens celui qui donne les ordres. Preuve : la facture payée à ton sous-traitant.", cash: false },
];

export interface ConceptDef { name: string; theme: "finance" | "business" | "vente" | "droit" }

export const CONCEPTS: ConceptDef[] = [
  { name: "Les intérêts composés", theme: "finance" },
  { name: "Marge brute et marge nette", theme: "business" },
  { name: "Le coût d'acquisition client (CAC)", theme: "business" },
  { name: "La valeur vie client (LTV)", theme: "business" },
  { name: "La proposition de valeur", theme: "vente" },
  { name: "L'effet de levier", theme: "finance" },
  { name: "Le flux de trésorerie (cash-flow)", theme: "finance" },
  { name: "Le coût d'opportunité", theme: "finance" },
  { name: "Le prix d'ancrage", theme: "vente" },
  { name: "Le point mort (seuil de rentabilité)", theme: "business" },
  { name: "La diversification", theme: "finance" },
  { name: "Un ETF, concrètement", theme: "finance" },
  { name: "Inflation et pouvoir d'achat", theme: "finance" },
  { name: "Les économies d'échelle", theme: "business" },
  { name: "Le produit minimum viable (MVP)", theme: "business" },
  { name: "L'avantage concurrentiel durable", theme: "business" },
  { name: "Le statut de micro-entrepreneur", theme: "droit" },
  { name: "Chiffre d'affaires, bénéfice, trésorerie", theme: "finance" },
  { name: "La négociation : ta meilleure alternative (BATNA)", theme: "vente" },
  { name: "Le prix psychologique", theme: "vente" },
  { name: "La preuve sociale", theme: "vente" },
  { name: "Le PEA et l'assurance-vie", theme: "finance" },
  { name: "Le revenu récurrent", theme: "business" },
  { name: "La facture : mentions obligatoires", theme: "droit" },
];

/** Étapes de l'entonnoir de prospects. */
export const STAGES = ["Contacté", "A répondu", "Rendez-vous", "Devis", "Payé"];
