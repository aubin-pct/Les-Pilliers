/*
 * Catalogue des muscles montrés dans l'écorché 3D (features/corps/body3d).
 * L'identifiant est celui que l'IA emploie dans « muscles » de chaque exercice : ne jamais le renommer
 * (des séances stockées s'en servent). Le nom, la fonction et la sensation s'affichent quand on touche le muscle.
 */

export type MuscleId =
  | "pectoraux" | "deltoide_ant" | "deltoide_lat" | "deltoide_post" | "biceps" | "brachial" | "triceps"
  | "avant_bras" | "trapezes" | "rhomboides" | "coiffe" | "grand_dorsal" | "lombaires" | "abdos"
  | "obliques" | "dentele" | "cou" | "fessiers" | "moyen_fessier" | "quadriceps" | "ischios"
  | "adducteurs" | "flechisseurs_hanche" | "mollets" | "tibial";

export type MuscleGroup = "Poitrine" | "Épaules" | "Bras" | "Dos" | "Tronc" | "Hanches" | "Cuisses" | "Jambes" | "Cou";

export interface MuscleDef {
  id: MuscleId;
  nom: string;
  latin: string;
  groupe: MuscleGroup;
  /** Face où il se voit le mieux : sert à tourner la caméra vers lui. */
  face: "avant" | "arriere" | "cote";
  fonction: string;
  /** Où et comment on le sent travailler. */
  sensation: string;
}

export const MUSCLES: MuscleDef[] = [
  { id: "pectoraux", nom: "Grand pectoral", latin: "Pectoralis major", groupe: "Poitrine", face: "avant", fonction: "Rapproche le bras du corps et le pousse vers l'avant.", sensation: "Étirement en bas du mouvement, serrage au centre de la poitrine en haut." },
  { id: "deltoide_ant", nom: "Deltoïde antérieur", latin: "Deltoideus, pars clavicularis", groupe: "Épaules", face: "avant", fonction: "Lève le bras devant soi, aide à pousser.", sensation: "Devant de l'épaule, sous la clavicule." },
  { id: "deltoide_lat", nom: "Deltoïde moyen", latin: "Deltoideus, pars acromialis", groupe: "Épaules", face: "cote", fonction: "Écarte le bras sur le côté : c'est lui qui fait la largeur d'épaules.", sensation: "Pointe de l'épaule, qui brûle vite." },
  { id: "deltoide_post", nom: "Deltoïde postérieur", latin: "Deltoideus, pars spinalis", groupe: "Épaules", face: "arriere", fonction: "Tire le bras vers l'arrière, tient l'épaule en place.", sensation: "Arrière de l'épaule, quand on tire les coudes." },
  { id: "biceps", nom: "Biceps brachial", latin: "Biceps brachii", groupe: "Bras", face: "avant", fonction: "Plie le coude et tourne la paume vers le haut.", sensation: "Devant du bras, qui se gonfle en haut du mouvement." },
  { id: "brachial", nom: "Brachial", latin: "Brachialis", groupe: "Bras", face: "cote", fonction: "Fléchisseur pur du coude, sous le biceps : la force de tirage.", sensation: "Bas du bras, côté extérieur, juste au-dessus du coude." },
  { id: "triceps", nom: "Triceps brachial", latin: "Triceps brachii", groupe: "Bras", face: "arriere", fonction: "Tend le coude : il finit chaque poussée.", sensation: "Arrière du bras, en verrouillant les coudes." },
  { id: "avant_bras", nom: "Avant-bras", latin: "Flexores et extensores antebrachii", groupe: "Bras", face: "avant", fonction: "Serrent la prise, tiennent le poignet.", sensation: "La prise qui lâche avant le reste." },
  { id: "trapezes", nom: "Trapèze", latin: "Trapezius", groupe: "Dos", face: "arriere", fonction: "Hausse, serre et abaisse les omoplates, porte la tête.", sensation: "Haut du dos et base de la nuque." },
  { id: "rhomboides", nom: "Rhomboïdes", latin: "Rhomboideus major et minor", groupe: "Dos", face: "arriere", fonction: "Rapprochent les omoplates de la colonne.", sensation: "Entre les omoplates, en les serrant." },
  { id: "coiffe", nom: "Coiffe des rotateurs", latin: "Infraspinatus, teres major et minor", groupe: "Épaules", face: "arriere", fonction: "Tournent le bras et tiennent la tête de l'humérus dans l'épaule.", sensation: "Sur l'omoplate : discrète, mais c'est elle qui protège l'épaule." },
  { id: "grand_dorsal", nom: "Grand dorsal", latin: "Latissimus dorsi", groupe: "Dos", face: "arriere", fonction: "Ramène le bras vers le bas et l'arrière : le muscle des tractions.", sensation: "Sous l'aisselle et sur les flancs du dos." },
  { id: "lombaires", nom: "Érecteurs du rachis", latin: "Erector spinae", groupe: "Dos", face: "arriere", fonction: "Tiennent la colonne droite et redressent le buste.", sensation: "Deux cordes de chaque côté de la colonne, en bas du dos." },
  { id: "abdos", nom: "Grand droit de l'abdomen", latin: "Rectus abdominis", groupe: "Tronc", face: "avant", fonction: "Enroule le buste et empêche le dos de se creuser.", sensation: "Devant du ventre, des côtes au pubis." },
  { id: "obliques", nom: "Obliques", latin: "Obliquus externus et internus", groupe: "Tronc", face: "cote", fonction: "Tournent et inclinent le buste, résistent à la rotation.", sensation: "Les flancs, entre les côtes et la hanche." },
  { id: "dentele", nom: "Dentelé antérieur", latin: "Serratus anterior", groupe: "Tronc", face: "cote", fonction: "Plaque l'omoplate contre les côtes et l'avance.", sensation: "Sur les côtes, sous l'aisselle, en poussant loin." },
  { id: "cou", nom: "Sterno-cléido-mastoïdien", latin: "Sternocleidomastoideus", groupe: "Cou", face: "avant", fonction: "Fléchit et tourne la tête.", sensation: "Les côtés du cou, en relevant la tête." },
  { id: "fessiers", nom: "Grand fessier", latin: "Gluteus maximus", groupe: "Hanches", face: "arriere", fonction: "Tend la hanche : se relever, sauter, pousser le sol.", sensation: "Serrer les fesses en haut du mouvement." },
  { id: "moyen_fessier", nom: "Moyen fessier", latin: "Gluteus medius", groupe: "Hanches", face: "cote", fonction: "Écarte la jambe et tient le bassin droit sur un pied.", sensation: "Haut et côté de la fesse, quand le genou ne doit pas rentrer." },
  { id: "quadriceps", nom: "Quadriceps", latin: "Quadriceps femoris", groupe: "Cuisses", face: "avant", fonction: "Tend le genou : se relever, monter, sauter.", sensation: "Devant de la cuisse, la brûlure des squats." },
  { id: "ischios", nom: "Ischio-jambiers", latin: "Biceps femoris, semitendinosus, semimembranosus", groupe: "Cuisses", face: "arriere", fonction: "Plient le genou et tendent la hanche, freinent la descente.", sensation: "Arrière de la cuisse, qui tire en se penchant jambes tendues." },
  { id: "adducteurs", nom: "Adducteurs", latin: "Adductor magnus, longus et brevis", groupe: "Cuisses", face: "avant", fonction: "Serrent les jambes, stabilisent le bassin en bas du squat.", sensation: "Intérieur de la cuisse." },
  { id: "flechisseurs_hanche", nom: "Fléchisseurs de hanche", latin: "Iliopsoas, sartorius, tensor fasciae latae", groupe: "Hanches", face: "avant", fonction: "Montent le genou vers la poitrine.", sensation: "Pli de l'aine, devant de la hanche." },
  { id: "mollets", nom: "Triceps sural (mollets)", latin: "Gastrocnemius et soleus", groupe: "Jambes", face: "arriere", fonction: "Tend la cheville : monter sur la pointe, propulser chaque saut.", sensation: "Arrière de la jambe, jusqu'au tendon d'Achille." },
  { id: "tibial", nom: "Tibial antérieur", latin: "Tibialis anterior", groupe: "Jambes", face: "avant", fonction: "Relève le pied, amortit l'appui.", sensation: "Devant du tibia, côté extérieur." },
];

export const MUSCLE_BY_ID: Record<MuscleId, MuscleDef> = Object.fromEntries(MUSCLES.map((m) => [m.id, m])) as Record<MuscleId, MuscleDef>;
export const MUSCLE_IDS = MUSCLES.map((m) => m.id);
export const isMuscleId = (s: unknown): s is MuscleId => typeof s === "string" && s in MUSCLE_BY_ID;

/* ---------------- Mouvements : ce que l'écorché sait animer ---------------- */

export type MovementId =
  | "pompe" | "pompe_diamant" | "pompe_piquee" | "pompe_large" | "pompe_inclinee" | "pompe_declinee"
  | "traction_large" | "traction_supination" | "traction_neutre" | "traction_serree"
  | "releve_genoux_suspendu" | "releve_jambes_suspendu" | "toes_to_bar" | "genoux_obliques_suspendu" | "dips" | "developpe_epaules" | "developpe_couche" | "elevation_laterale"
  | "curl" | "extension_triceps" | "traction" | "rowing" | "souleve_de_terre" | "squat" | "squat_saute" | "fente"
  | "chaise_murale" | "mollets" | "pont_fessier" | "gainage" | "gainage_lateral" | "crunch" | "releve_jambes"
  | "hollow" | "superman" | "mountain_climber" | "burpee" | "jumping_jack" | "course" | "rotation_tronc"
  | "etirement_ischios" | "etirement_quadriceps" | "etirement_pectoraux" | "chien_tete_en_bas" | "fente_basse" | "debout";

/** Poids d'activation 0–1 (1 = moteur principal). */
export type Activation = Partial<Record<MuscleId, number>>;

export type Famille = "Pompes" | "Tractions" | "Abdos" | "Jambes" | "Épaules et bras" | "Dos" | "Cardio" | "Souplesse";
export const FAMILLES: Famille[] = ["Pompes", "Tractions", "Abdos", "Jambes", "Épaules et bras", "Dos", "Cardio", "Souplesse"];

export interface MovementDef {
  id: MovementId;
  label: string;
  /** Rangement dans la bibliothèque des mouvements. */
  famille: Famille;
  /** Mots du nom de l'exercice qui le désignent (sans accents, minuscules). Le plus précis l'emporte. */
  mots: string[];
  muscles: Activation;
}

export const MOVEMENTS: MovementDef[] = [
  { id: "pompe_diamant", label: "Pompe serrée", famille: "Pompes", mots: ["diamant", "pompe serree", "pompes serrees", "pompe prise serree", "pompes prise serree", "close grip push"], muscles: { triceps: 1, pectoraux: 0.75, deltoide_ant: 0.55, abdos: 0.35, dentele: 0.3 } },
  { id: "pompe_piquee", label: "Pompe piquée", famille: "Pompes", mots: ["piquee", "pike push", "pompe en v", "handstand", "pompe verticale"], muscles: { deltoide_ant: 1, deltoide_lat: 0.55, triceps: 0.8, trapezes: 0.45, pectoraux: 0.35, dentele: 0.4 } },
  { id: "pompe", label: "Pompe classique", famille: "Pompes", mots: ["pompe", "push-up", "push up", "pushup", "bench push"], muscles: { pectoraux: 1, triceps: 0.7, deltoide_ant: 0.65, dentele: 0.4, abdos: 0.4, obliques: 0.2, quadriceps: 0.15 } },
  { id: "dips", label: "Dips", famille: "Épaules et bras", mots: ["dips", "dip ", "dip sur", "dips sur chaise", "dips sur banc", "dips au banc", "triceps sur chaise", "triceps au banc"], muscles: { triceps: 1, pectoraux: 0.7, deltoide_ant: 0.6, trapezes: 0.25, rhomboides: 0.2 } },
  { id: "developpe_couche", label: "Développé couché", famille: "Pompes", mots: ["developpe couche", "bench press", "developpe incline", "developpe decline", "ecarte couche", "ecartes"], muscles: { pectoraux: 1, triceps: 0.65, deltoide_ant: 0.6, dentele: 0.2 } },
  { id: "developpe_epaules", label: "Développé épaules", famille: "Épaules et bras", mots: ["developpe militaire", "developpe epaule", "developpe arnold", "overhead press", "military press", "presse epaule", "developpe halteres assis", "developpe debout"], muscles: { deltoide_ant: 1, deltoide_lat: 0.7, triceps: 0.65, trapezes: 0.45, dentele: 0.35, abdos: 0.3 } },
  { id: "elevation_laterale", label: "Élévation latérale", famille: "Épaules et bras", mots: ["elevation laterale", "elevations laterales", "lateral raise", "oiseau", "elevation frontale", "y-raise", "face pull"], muscles: { deltoide_lat: 1, deltoide_ant: 0.45, deltoide_post: 0.4, trapezes: 0.5, coiffe: 0.35 } },
  { id: "curl", label: "Curl", famille: "Épaules et bras", mots: ["curl", "biceps", "flexion des bras", "chin curl", "marteau"], muscles: { biceps: 1, brachial: 0.85, avant_bras: 0.6, deltoide_ant: 0.15 } },
  { id: "extension_triceps", label: "Extension triceps", famille: "Épaules et bras", mots: ["extension triceps", "extensions triceps", "barre au front", "skull", "kickback", "french press", "extension nuque", "extension au dessus"], muscles: { triceps: 1, avant_bras: 0.25, deltoide_ant: 0.15 } },
  { id: "traction", label: "Traction pronation", famille: "Tractions", mots: ["traction", "pull-up", "pull up", "pullup", "pronation", "tirage vertical", "tirage poitrine", "suspension", "dead hang", "scapula pull"], muscles: { grand_dorsal: 1, biceps: 0.75, brachial: 0.6, rhomboides: 0.55, trapezes: 0.45, deltoide_post: 0.45, avant_bras: 0.65, coiffe: 0.4, abdos: 0.3 } },
  { id: "rowing", label: "Rowing", famille: "Dos", mots: ["rowing", "row", "tirage horizontal", "tirage buste", "sous table", "rowing inverse", "inverted row", "australian"], muscles: { grand_dorsal: 0.9, rhomboides: 0.9, trapezes: 0.7, deltoide_post: 0.75, biceps: 0.6, brachial: 0.5, avant_bras: 0.45, lombaires: 0.35, coiffe: 0.35 } },
  { id: "souleve_de_terre", label: "Soulevé de terre", famille: "Dos", mots: ["souleve de terre", "deadlift", "good morning", "kettlebell swing", "swing", "hip hinge", "charniere", "souleve roumain", "romanian"], muscles: { ischios: 1, fessiers: 0.95, lombaires: 0.85, trapezes: 0.4, avant_bras: 0.5, grand_dorsal: 0.35, quadriceps: 0.3, adducteurs: 0.3, abdos: 0.3 } },
  { id: "squat_saute", label: "Squat sauté", famille: "Jambes", mots: ["squat saute", "squats sautes", "jump squat", "saut vertical", "box jump", "saut sur", "sauts"], muscles: { quadriceps: 1, fessiers: 0.85, mollets: 0.8, ischios: 0.35, adducteurs: 0.35, abdos: 0.3, lombaires: 0.25 } },
  { id: "chaise_murale", label: "Chaise murale", famille: "Jambes", mots: ["chaise", "wall sit", "isometrique cuisses"], muscles: { quadriceps: 1, fessiers: 0.5, adducteurs: 0.35, mollets: 0.15, abdos: 0.2 } },
  { id: "fente", label: "Fente", famille: "Jambes", mots: ["fente", "lunge", "split squat", "bulgare", "step up", "montee sur", "pistol", "squat sur une jambe"], muscles: { quadriceps: 1, fessiers: 0.85, moyen_fessier: 0.5, ischios: 0.35, adducteurs: 0.4, mollets: 0.25, abdos: 0.2 } },
  { id: "squat", label: "Squat", famille: "Jambes", mots: ["squat", "flexion de jambes", "goblet", "sumo", "presse a cuisses", "leg press", "accroupi"], muscles: { quadriceps: 1, fessiers: 0.8, adducteurs: 0.5, ischios: 0.3, lombaires: 0.35, mollets: 0.2, abdos: 0.3 } },
  { id: "mollets", label: "Mollets", famille: "Jambes", mots: ["mollet", "calf", "pointe de pied", "pointes de pieds", "extension cheville"], muscles: { mollets: 1, tibial: 0.15, quadriceps: 0.1 } },
  { id: "pont_fessier", label: "Pont fessier", famille: "Jambes", mots: ["pont fessier", "hip thrust", "glute bridge", "releve de bassin", "pont sur une jambe", "pont"], muscles: { fessiers: 1, ischios: 0.6, lombaires: 0.35, moyen_fessier: 0.4, abdos: 0.2, adducteurs: 0.25 } },
  { id: "gainage_lateral", label: "Gainage latéral", famille: "Abdos", mots: ["gainage lateral", "planche laterale", "side plank", "gainage de cote"], muscles: { obliques: 1, moyen_fessier: 0.7, abdos: 0.45, deltoide_lat: 0.4, lombaires: 0.35, adducteurs: 0.3 } },
  { id: "gainage", label: "Gainage", famille: "Abdos", mots: ["gainage", "planche", "plank", "gainage ventral", "gainage dynamique"], muscles: { abdos: 1, obliques: 0.7, dentele: 0.45, deltoide_ant: 0.45, quadriceps: 0.35, fessiers: 0.35, pectoraux: 0.25, lombaires: 0.2 } },
  { id: "hollow", label: "Hollow hold", famille: "Abdos", mots: ["hollow", "banane", "dish", "v-up", "v up", "jackknife"], muscles: { abdos: 1, flechisseurs_hanche: 0.75, obliques: 0.6, quadriceps: 0.25, adducteurs: 0.2 } },
  { id: "releve_jambes", label: "Relevé de jambes au sol", famille: "Abdos", mots: ["releve de jambes", "releves de jambes", "leg raise", "relevé de genoux", "releve de genoux", "flutter", "ciseaux"], muscles: { abdos: 1, flechisseurs_hanche: 0.9, obliques: 0.5, adducteurs: 0.3, quadriceps: 0.3 } },
  { id: "rotation_tronc", label: "Rotation du tronc", famille: "Abdos", mots: ["russian twist", "rotation du buste", "rotation du tronc", "bucheron", "woodchop", "velo", "bicycle", "crunch oblique", "rotations thoraciques", "rotation thoracique"], muscles: { obliques: 1, abdos: 0.65, flechisseurs_hanche: 0.4, lombaires: 0.25, dentele: 0.25 } },
  { id: "crunch", label: "Crunch", famille: "Abdos", mots: ["crunch", "sit-up", "sit up", "redressement assis", "enroulement", "abdos"], muscles: { abdos: 1, obliques: 0.55, flechisseurs_hanche: 0.3, cou: 0.25 } },
  { id: "superman", label: "Superman", famille: "Dos", mots: ["superman", "extension lombaire", "extensions lombaires", "nageur", "swimmer", "back extension", "hyperextension"], muscles: { lombaires: 1, fessiers: 0.7, ischios: 0.45, trapezes: 0.45, deltoide_post: 0.35, rhomboides: 0.35 } },
  { id: "mountain_climber", label: "Mountain climber", famille: "Cardio", mots: ["mountain climber", "grimpeur", "montee de genoux au sol"], muscles: { abdos: 0.9, flechisseurs_hanche: 0.9, quadriceps: 0.6, deltoide_ant: 0.5, obliques: 0.55, pectoraux: 0.3, triceps: 0.3, fessiers: 0.35 } },
  { id: "burpee", label: "Burpee", famille: "Cardio", mots: ["burpee", "sprawl"], muscles: { quadriceps: 0.95, pectoraux: 0.75, fessiers: 0.75, triceps: 0.55, deltoide_ant: 0.6, mollets: 0.6, abdos: 0.6, flechisseurs_hanche: 0.45 } },
  { id: "jumping_jack", label: "Jumping jack", famille: "Cardio", mots: ["jumping jack", "jumping-jack", "pas chasse", "saut ecart", "corde a sauter", "corde", "skipping rope", "sauts sur place"], muscles: { mollets: 1, deltoide_lat: 0.6, moyen_fessier: 0.6, adducteurs: 0.5, quadriceps: 0.45, trapezes: 0.3 } },
  { id: "course", label: "Course", famille: "Cardio", mots: ["course", "sprint", "footing", "montees de genoux", "montee de genoux", "high knees", "talons fesses", "talon fesse", "jogging", "marche", "fractionne", "cardio"], muscles: { quadriceps: 0.85, ischios: 0.75, mollets: 0.9, fessiers: 0.75, flechisseurs_hanche: 0.85, abdos: 0.35, deltoide_ant: 0.3, tibial: 0.4 } },
  { id: "etirement_ischios", label: "Étirement des ischios", famille: "Souplesse", mots: ["pince", "toucher les pieds", "etirement ischio", "etirement des ischio", "flexion avant", "forward fold", "souplesse"], muscles: { ischios: 0.9, lombaires: 0.6, mollets: 0.5, fessiers: 0.4 } },
  { id: "etirement_quadriceps", label: "Étirement des quadriceps", famille: "Souplesse", mots: ["etirement quadriceps", "etirement du quadriceps", "etirement des quadriceps", "quadri"], muscles: { quadriceps: 0.9, flechisseurs_hanche: 0.55, tibial: 0.2 } },
  { id: "etirement_pectoraux", label: "Ouverture d'épaules", famille: "Souplesse", mots: ["etirement pectoraux", "etirement des pectoraux", "etirement epaule", "etirement des epaules", "ouverture d'epaules", "ouverture des epaules", "ouverture d epaules", "epaules au mur", "pectoraux et epaules"], muscles: { pectoraux: 0.9, deltoide_ant: 0.7, biceps: 0.4, dentele: 0.25 } },
  { id: "chien_tete_en_bas", label: "Chien tête en bas", famille: "Souplesse", mots: ["chien tete en bas", "chien tete", "downward dog", "chien", "pose de l'enfant", "posture de l'enfant", "child pose"], muscles: { ischios: 0.85, mollets: 0.8, grand_dorsal: 0.6, deltoide_ant: 0.45, lombaires: 0.45, triceps: 0.3 } },
  { id: "fente_basse", label: "Fente basse (hanches)", famille: "Souplesse", mots: ["fente basse", "pigeon", "psoas", "etirement des hanches", "etirement hanche", "grand ecart", "papillon", "ouverture de hanche", "90/90", "mobilite hanche", "mobilite"], muscles: { flechisseurs_hanche: 0.95, quadriceps: 0.5, adducteurs: 0.6, fessiers: 0.45, ischios: 0.35 } },
  { id: "debout", label: "Respiration, posture", famille: "Souplesse", mots: ["respiration", "souffle", "marche lente", "retour au calme", "relachement", "debout"], muscles: { abdos: 0.4, obliques: 0.3, lombaires: 0.3, trapezes: 0.2 } },

  /* Variantes */
  { id: "pompe_large", label: "Pompe prise large", famille: "Pompes", mots: ["pompe large", "pompes larges", "pompe prise large", "pompes prise large", "pompes ecartees", "pompe ecartee", "wide push"], muscles: { pectoraux: 1, deltoide_ant: 0.6, triceps: 0.45, dentele: 0.35, abdos: 0.4, obliques: 0.2 } },
  { id: "pompe_inclinee", label: "Pompe inclinée (mains surélevées)", famille: "Pompes", mots: ["pompe inclinee", "pompes inclinees", "mains surelevees", "incline push", "pompes sur banc", "pompe sur banc"], muscles: { pectoraux: 0.9, triceps: 0.6, deltoide_ant: 0.5, dentele: 0.35, abdos: 0.3 } },
  { id: "pompe_declinee", label: "Pompe déclinée (pieds surélevés)", famille: "Pompes", mots: ["pompe declinee", "pompes declinees", "pieds sureleves", "pieds en hauteur", "decline push"], muscles: { pectoraux: 1, deltoide_ant: 0.8, triceps: 0.65, dentele: 0.45, abdos: 0.45, trapezes: 0.2 } },
  { id: "traction_large", label: "Traction prise large", famille: "Tractions", mots: ["prise large", "traction large", "tractions larges", "prise ecartee", "prises ecartees", "traction ecartee", "tractions ecartees", "wide grip"], muscles: { grand_dorsal: 1, deltoide_post: 0.55, rhomboides: 0.55, trapezes: 0.5, coiffe: 0.5, biceps: 0.5, brachial: 0.55, avant_bras: 0.6, abdos: 0.3 } },
  { id: "traction_supination", label: "Traction supination", famille: "Tractions", mots: ["supination", "chin-up", "chin up", "chinup", "traction inversee", "tractions inversees", "paumes vers soi", "traction prise inversee"], muscles: { biceps: 1, grand_dorsal: 0.9, brachial: 0.75, avant_bras: 0.55, rhomboides: 0.45, pectoraux: 0.35, trapezes: 0.35, abdos: 0.35 } },
  { id: "traction_neutre", label: "Traction prise neutre", famille: "Tractions", mots: ["prise neutre", "traction neutre", "tractions neutres", "neutral grip", "prise marteau", "traction marteau", "poignees paralleles"], muscles: { grand_dorsal: 0.95, brachial: 1, avant_bras: 0.8, biceps: 0.8, rhomboides: 0.5, trapezes: 0.4, deltoide_post: 0.4, abdos: 0.3 } },
  { id: "traction_serree", label: "Traction prise serrée", famille: "Tractions", mots: ["traction serree", "tractions serrees", "traction prise serree", "tractions prise serree", "close grip pull"], muscles: { grand_dorsal: 0.9, biceps: 0.85, brachial: 0.75, avant_bras: 0.6, pectoraux: 0.3, rhomboides: 0.4, abdos: 0.3 } },
  { id: "releve_genoux_suspendu", label: "Relevé de genoux suspendu", famille: "Abdos", mots: ["releve de genoux suspendu", "releves de genoux suspendu", "genoux poitrine suspendu", "genoux a la poitrine suspendu", "hanging knee", "knee raise", "abdos suspendu", "abdos a la barre", "abdos barre", "suspendu"], muscles: { abdos: 1, flechisseurs_hanche: 0.9, obliques: 0.55, avant_bras: 0.55, grand_dorsal: 0.4, adducteurs: 0.2 } },
  { id: "releve_jambes_suspendu", label: "Relevé de jambes tendues suspendu", famille: "Abdos", mots: ["releve de jambes suspendu", "releves de jambes suspendu", "releve de jambes a la barre", "releves de jambes a la barre", "jambes tendues suspendu", "hanging leg raise"], muscles: { abdos: 1, flechisseurs_hanche: 1, obliques: 0.6, quadriceps: 0.45, avant_bras: 0.6, grand_dorsal: 0.45, adducteurs: 0.3 } },
  { id: "toes_to_bar", label: "Pieds à la barre", famille: "Abdos", mots: ["toes to bar", "toes-to-bar", "pieds a la barre", "orteils a la barre", "pieds barre"], muscles: { abdos: 1, flechisseurs_hanche: 0.95, grand_dorsal: 0.7, obliques: 0.6, avant_bras: 0.7, quadriceps: 0.4, triceps: 0.25 } },
  { id: "genoux_obliques_suspendu", label: "Genoux obliques suspendu", famille: "Abdos", mots: ["obliques suspendu", "genoux obliques", "releve de genoux oblique", "releves de genoux obliques", "essuie-glace", "essuie glace", "windshield"], muscles: { obliques: 1, abdos: 0.8, flechisseurs_hanche: 0.75, avant_bras: 0.55, grand_dorsal: 0.45 } },
];

export const MOVEMENT_BY_ID: Record<MovementId, MovementDef> = Object.fromEntries(MOVEMENTS.map((m) => [m.id, m])) as Record<MovementId, MovementDef>;
export const isMovementId = (s: unknown): s is MovementId => typeof s === "string" && s in MOVEMENT_BY_ID;
