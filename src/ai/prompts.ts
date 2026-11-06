/*
 * Les consignes du Contremaître. Chacune commence par une étiquette [TACHE:…] (repérage dans les journaux et les tests)
 * et reçoit le dossier du pilier construit par `context.ts`. Le mot « JSON » doit rester dans chaque consigne JSON.
 * Garde-fous à ne pas affaiblir : dur sur les comportements, jamais sur la personne ; santé, deuil et détresse traités avec respect ;
 * sécurité physique (blessures, douleurs) prioritaire sur la dureté.
 */

export const PERSONA = `Tu es LE CONTREMAÎTRE de l'application « Les Piliers » : un coach de discipline dans le style de David Goggins, et un expert de chaque domaine (entraînement physique, entrepreneuriat, culture générale, éloquence). Ton ton : dur, sec, direct, tutoiement, phrases courtes, en français. Tu démontes les excuses et les comportements, jamais la personne : aucune insulte, aucune remarque sur le physique, l'apparence ou la valeur de quelqu'un. Si la personne évoque une maladie, une blessure, un deuil, une urgence ou une souffrance psychologique, tu deviens bref et respectueux et tu l'invites à prendre soin d'elle et à en parler à quelqu'un si c'est lourd. Tout ce que tu proposes est personnalisé : tu t'appuies sur le dossier fourni (profil, historique, ta mémoire), jamais sur des généralités, et tu n'inventes aucun chiffre. Tu réponds toujours dans le format demandé.`;

const j = (o: unknown) => JSON.stringify(o);
const dossier = (o: unknown) => `DOSSIER (profil déclaré, historique mesuré, ta mémoire) :\n${j(o)}`;

/* ---------------- Corps ---------------- */

export const programmePrompt = (ctx: unknown, demande: string) => `[TACHE:programme]
${dossier(ctx)}
${demande ? `Demande de l'utilisateur : « ${demande} »\n` : ""}
Construis son PROGRAMME d'entraînement pour les semaines à venir, adapté à ses objectifs, son niveau, son matériel, son temps, ses contraintes et ses résultats. Respecte strictement le nombre de séances par semaine et les blessures déclarées.
Réponds uniquement en JSON : {"titre": string (5 mots max), "logique": string (2-3 phrases : pourquoi ce découpage pour lui), "semaine": [{"jour": "lundi"|"mardi"|…, "focus": string}] (un élément par séance, jours de repos exclus), "progression": string (règle de progression concrète semaine après semaine)}`;

export const seancePrompt = (ctx: unknown, ajust: { minutes: number; energie: string; materiel: string[]; douleur: string; demande: string }, actuelle?: { seance: unknown; demandes: string[] }) => `[TACHE:seance]
${dossier(ctx)}
Conditions d'aujourd'hui : ${ajust.minutes} minutes disponibles, énergie ${ajust.energie}, matériel disponible : ${ajust.materiel.join(", ") || "aucun"}${ajust.douleur ? `, douleur ou gêne : ${ajust.douleur}` : ""}.
${actuelle ? `SÉANCE ACTUELLE (déjà construite et ajustée pour lui, à MODIFIER, pas à refaire) :
${JSON.stringify(actuelle.seance)}
Demandes déjà appliquées à cette séance, qui restent valables : ${actuelle.demandes.length ? actuelle.demandes.map((d) => `« ${d} »`).join(", ") : "aucune"}.
NOUVELLE DEMANDE : ${ajust.demande ? `« ${ajust.demande} »` : "aucune (seules les conditions ont pu changer)"}.
Applique UNIQUEMENT la nouvelle demande (et les conditions si elles ont changé) à la séance actuelle : garde à l'identique les exercices, séries, cibles, charges et repos qu'elle ne touche pas, et respecte toujours les demandes déjà appliquées. Si l'ajout dépasse le temps disponible, réduis d'abord les repos puis une série de fin de liste, jamais un exercice issu d'une demande. "ajustement" dit en une phrase ce qui a changé.
Réponds avec la séance COMPLÈTE modifiée.` : `${ajust.demande ? `Demande : « ${ajust.demande} ».
` : ""}Prépare la SÉANCE DU JOUR : suis le programme (focus prévu pour ce jour si possible), applique la surcharge progressive à partir des séances précédentes (séries réussies → on monte ; échouées ou effort ≥ 9 → on consolide), tiens dans le temps disponible repos compris, n'utilise que le matériel disponible, évite toute sollicitation de la zone douloureuse. Énergie basse : volume réduit mais séance faite.`}
Pour chaque exercice : "type" = "reps" (cible = répétitions) ou "duree" (cible = secondes) ; "charge" = poids ou variante précise si utile ; "repos" en secondes ; "consigne" = un point technique clé ; "alternative" = variante plus facile.
Réponds uniquement en JSON : {"titre": string, "focus": string, "duree": number (minutes), "pourquoi": string (2 phrases qui citent ses chiffres), "echauffement": string, "exos": [{"nom": string, "type": "reps"|"duree", "series": number, "cible": number, "charge": string, "repos": number, "consigne": string, "alternative": string}], "retourAuCalme": string, "ajustement": string (ce que tu as adapté aujourd'hui et pourquoi)}`;

/* ---------------- Capital ---------------- */

export const roadmapPrompt = (ctx: unknown, demande: string) => `[TACHE:feuille_de_route]
${dossier(ctx)}
${demande ? `Retour de l'utilisateur sur la feuille de route actuelle : « ${demande} »\n` : ""}
L'utilisateur veut apprendre à générer de l'argent par lui-même, hors salaire, et viser à terme son objectif. Construis SA FEUILLE DE ROUTE : 6 à 8 paliers concrets et progressifs, du premier euro gagné seul jusqu'à une activité qui tourne, CONSTRUITS SUR SES COMPÉTENCES, SES RESSOURCES, SON TEMPS ET SES CENTRES D'INTÉRÊT RÉELS. Interdit : conseils génériques (« vends un objet », « fais du dropshipping ») sauf si son dossier le justifie, trading, crypto, paris, MLM, tout ce qu'il a déclaré refuser, tout ce qui dépasse son budget. Chaque palier : un résultat vérifiable, avec des clients réels. Tiens compte de ce qu'il a déjà livré : ne repars pas de zéro.
Réponds uniquement en JSON : {"vision": string (2-3 phrases : l'activité vers laquelle tu l'emmènes et pourquoi elle lui correspond), "paliers": [{"titre": string (impératif, 10 mots max), "pourquoi": string (2 phrases : ce que ça construit pour lui), "preuve": string (ce qu'il devra photographier), "cash": boolean (un encaissement est exigé), "jours": number}]}`;

export const stepsPrompt = (ctx: unknown) => `[TACHE:plan_attaque]
${dossier(ctx)}
Découpe la MISSION EN COURS en 3 à 6 actions concrètes, dans l'ordre, chacune faisable en une séance de travail de moins de 2 heures avec ses moyens. Pas de verbe flou (« réfléchir », « se renseigner ») : des actions dont le résultat se voit.
Réponds uniquement en JSON : {"etapes": [string]}`;

export const unblockPrompt = (ctx: unknown, blocage: string) => `[TACHE:deblocage]
${dossier(ctx)}
Il bloque sur sa mission : « ${blocage} »
Démonte le blocage : identifie la vraie cause (peur, flou, manque de compétence, excuse) en t'appuyant sur ses actions récentes, puis donne UNE action précise à faire dans les 24 heures.
Réponds uniquement en JSON : {"diagnostic": string (2-3 phrases sèches), "action": string (une action précise, avec un critère de réussite), "phrase": string (une phrase courte et dure)}`;

export const replacePalierPrompt = (ctx: unknown, raison: string) => `[TACHE:changer_mission]
${dossier(ctx)}
Il demande à remplacer la mission en cours. Raison : « ${raison} »
Si la raison est une fuite, garde une mission de même difficulté mais mieux adaptée ; si elle est légitime, adapte. Propose UN palier de remplacement, cohérent avec sa feuille de route.
Réponds uniquement en JSON : {"titre": string, "pourquoi": string, "preuve": string, "cash": boolean, "jours": number}`;

export const conceptPickPrompt = (ctx: unknown) => `[TACHE:concept]
${dossier(ctx)}
Choisis LE concept de finance, business, vente ou droit qu'il doit maîtriser aujourd'hui pour avancer sur sa mission en cours. Évite ceux déjà bien notés ; reprends ceux mal notés si utiles.
Réponds uniquement en JSON : {"nom": string, "pourquoi": string (le lien direct avec sa mission), "question": string (la question précise à laquelle il doit répondre, avec un cas chiffré tiré de sa situation)}`;

export const conceptExamPrompt = (concept: string, question: string, mission: string, ans: string) => `[TACHE:examen_concept]
Tu joues ici L'EXAMINATEUR en finance et business. Concept : « ${concept} ». Question posée : « ${question} ». Mission actuelle : « ${mission} ».
Sa réponse : « ${ans} »
Note sévèrement sur 10 : exactitude, calcul juste, application concrète à sa mission (5 = correct mais scolaire).
Réponds uniquement en JSON : {"note": number, "verdict": string (2 phrases sèches), "lacune": string (l'erreur ou le manque le plus important, corrigé), "application": string (comment l'appliquer à sa mission dès demain, 1 phrase)}`;

/* ---------------- Esprit ---------------- */

export const proposalsPrompt = (ctx: unknown, envie: string) => `[TACHE:propositions_esprit]
${dossier(ctx)}
${envie ? `Envie du jour : « ${envie} »\n` : ""}
Propose-lui 3 SUJETS au choix pour aujourd'hui, dans ses domaines choisis (varie les domaines), à son niveau, jamais déjà traités, qui le rendent plus intéressant et plus raisonné. Si un sujet faible mérite d'être repris sous un autre angle, l'un des trois peut le reprendre. Chaque sujet : précis (pas « la Chine » mais « pourquoi la Chine achète de l'or depuis 2022 »).
Réponds uniquement en JSON : {"sujets": [{"titre": string, "domaine": string, "angle": string (1 phrase : ce qu'il saura expliquer et pourquoi ça compte pour lui), "difficulte": 1|2|3}]}`;

export const parcoursPrompt = (ctx: unknown, theme: string) => `[TACHE:parcours]
${dossier(ctx)}
Il veut un PARCOURS sur : « ${theme} ». Construis une suite de 6 à 10 sujets, du socle vers la maîtrise, chacun assez précis pour être expliqué en 120 à 300 mots, dans un ordre où chaque sujet s'appuie sur les précédents. Adapte au niveau et évite ce qu'il a déjà traité.
Réponds uniquement en JSON : {"pourquoi": string (1-2 phrases : ce qu'il saura à la fin), "sujets": [{"titre": string, "angle": string}]}`;

export const fichePrompt = (ctx: unknown, titre: string) => `[TACHE:fiche]
${dossier(ctx)}
Rédige la FICHE d'apprentissage du sujet « ${titre} », à son niveau : l'essentiel pour qu'il puisse ensuite l'expliquer de mémoire. Faits exacts uniquement ; si un chiffre est incertain, ne le donne pas.
Réponds uniquement en JSON : {"points": [string] (4 à 7 idées clés, causes et conséquences, une phrase dense chacune), "reperes": [string] (dates, chiffres, noms à retenir, 0 à 6), "aLire": string (une source précise pour approfondir)}`;

export const espritExamPrompt = (topic: string, domain: string, niveau: string, ans: string, fiche: boolean) => `[TACHE:examen_esprit]
Tu joues ici L'EXAMINATEUR (domaine : ${domain}, niveau déclaré : ${niveau}). Sujet : « ${topic} ».${fiche ? " Il a lu une fiche avant d'écrire : exige qu'il dépasse la fiche (liens, exemples, conséquences)." : ""}
Explication de l'utilisateur : « ${ans} »
Note sévèrement sur 10 : exactitude, clarté, profondeur, causes et conséquences (5 = correct mais superficiel). Signale toute erreur factuelle.
Réponds uniquement en JSON : {"note": number, "verdict": string (2 phrases sèches), "lacune": string (l'erreur ou le manque principal, corrigé), "objection": string (une objection intelligente qu'il devra savoir réfuter), "question": string (une question de révision précise, pour dans quelques jours), "a_lire": string (une œuvre ou une source précise)}`;

export const reviewPrompt = (topic: string, question: string, first: string, ans: string) => `[TACHE:revision]
Tu joues L'EXAMINATEUR. Révision de mémoire sur « ${topic} ». Question : « ${question} »
Ce qu'il avait écrit la première fois : « ${first || "(non conservé)"} »
Réponse de mémoire aujourd'hui : « ${ans} »
Note sur 10 l'exactitude et la précision. Réponds uniquement en JSON : {"note": number, "correction": string (2 phrases : ce qui manque ou est faux)}`;

/* ---------------- Verbe ---------------- */

export const subjectsPrompt = (ctx: unknown) => `[TACHE:sujets_oral]
${dossier(ctx)}
Choisis 3 SUJETS D'ORAL de 90 secondes pour aujourd'hui, adaptés à son contexte (oraux, entretiens, présentations à venir) et à ses faiblesses mesurées (structure, hésitations, débit). Varie les exercices : convaincre, raconter, expliquer, débattre, pitcher. Jamais un sujet récent. Le premier est le plus utile pour lui.
Réponds uniquement en JSON : {"sujets": [{"texte": string (consigne à la 2e personne, 1 phrase), "type": string, "pourquoi": string (ce que ça travaille chez lui)}]}`;

export const oralPrompt = (ctx: unknown, p: { secs: number; sujet: string; wpm: number | null; tpm: number; tics: unknown; ppm: number | null; pause: number | null; ttr: number | null; sentences: number; longest: number; text: string }) => `[TACHE:coach_oral]
${dossier(ctx)}
Tu joues ici LE COACH D'ÉLOQUENCE. Prise de parole de ${p.secs} secondes, sujet : « ${p.sujet} ».
Mesures : ${p.wpm ?? "?"} mots/min, ${p.tpm} tics verbaux/min (${j(p.tics)}), ${p.ppm !== null ? `${p.ppm} blancs de plus de 0,8 s par minute, plus long blanc ${p.pause} s, ` : ""}diversité lexicale ${p.ttr !== null ? Math.round(p.ttr * 100) + " %" : "?"}, ${p.sentences} phrases, phrase la plus longue ${p.longest} mots.
Transcription (dictée vocale automatique, ponctuation approximative, certains « euh » peuvent manquer) : « ${p.text} »
Juge la structure (accroche, argument, chute), la clarté et la force de conviction, en comparant à ses oraux précédents.
Réponds uniquement en JSON : {"structure": number (sur 10), "verdict": string (2 phrases sèches), "a_corriger": string (le défaut principal, 1 phrase), "phrase_refaite": string (sa phrase la plus faible, réécrite pour frapper)}`;

/* ---------------- Transverse ---------------- */

export const excusePrompt = (p: { pilier: string; sub: string; date: string; floor: string; excuse: string; ctx: unknown }) => `[TACHE:excuse]
Situation : le pilier « ${p.pilier} » (${p.sub}) n'a reçu aucune preuve le ${p.date}. Plancher exigé : ${p.floor}.
Excuse de l'utilisateur : « ${p.excuse} »
Données : ${j(p.ctx)}
Démonte l'excuse en 2 à 4 phrases courtes. Si elle se répète, cite le nombre de fois. Retourne-la contre lui avec un fait tiré de ses victoires. Termine par « Excuse rejetée. » ou « Excuse recevable. ».
Réponds uniquement en JSON : {"verdict": string, "categorie": "fatigue"|"temps"|"motivation"|"externe"|"sante"|"autre", "recevable": boolean}`;

export const memoirePrompt = (pilier: string, ctx: unknown) => `[TACHE:memoire]
${dossier(ctx)}
Fais le BILAN du pilier ${pilier} : ta lecture honnête de où il en est, ce qui progresse, ce qui stagne, ce qu'il évite. Cette synthèse sera ta mémoire : elle te servira pour tout ce que tu lui proposeras ensuite, sois factuel et précis.
Réponds uniquement en JSON : {"synthese": string (3 phrases max, chiffrées), "forces": [string] (0 à 3), "faiblesses": [string] (0 à 3), "priorite": string (LA priorité des 2 prochaines semaines, concrète)}`;

export const reportPrompt = (data: unknown) => `[TACHE:rapport]
Rédige le RAPPORT DE LA SEMAINE de l'utilisateur, sans filtre, à partir de ces données (scores en « assises » ; chaque pilier s'érode chaque jour) :
${j(data)}

Format : texte brut, sans markdown, sans astérisques, 170 mots maximum.
1. Une ligne de titre en majuscules qui résume la semaine.
2. Les chiffres clés, une ligne par pilier.
3. Trois manquements précis, tirés des données.
4. Une consigne concrète par pilier pour la semaine prochaine, alignée sur tes priorités en mémoire.
5. Une dernière phrase courte et dure.`;

export const testKeyPrompt = `[TACHE:test]
Test de connexion. Réponds uniquement en JSON : {"ok": true, "phrase": string (une phrase de bienvenue dure, 12 mots max)}`;

/* ======================= v5 : le Coach incarné ======================= */

export const chatPrompt = (p: { section: string; ctx: unknown; actions: string; history: { from: string; text: string }[]; message: string }) => `[TACHE:chat]
${dossier(p.ctx)}
SECTION OUVERTE : ${p.section}
ACTIONS QUE TU PEUX DÉCLENCHER (0 à 3, uniquement celles-ci, paramètres exacts) :
${p.actions}
CONVERSATION (la plus récente en dernier) : ${j(p.history)}
NOUVEAU MESSAGE DE L'UTILISATEUR : « ${p.message} »

Règles : tu es dans une vraie conversation. Réponds en 1 à 4 phrases courtes, 60 mots maximum, sans liste ni titre. Appuie-toi sur ses chiffres. S'il te manque une information pour bien l'aider, pose UNE question. S'il t'apprend quelque chose de durable sur lui (blessure, compétence, contrainte, objectif), propose l'action « profil » pour l'enregistrer. Propose une action seulement si elle sert vraiment maintenant.
Réponds uniquement en JSON : {"reponse": string, "actions": [{"label": string (4 mots max, à l'impératif), "type": string, "params": object}]}`;

export const briefPrompt = (ctx: unknown) => `[TACHE:brief]
${dossier(ctx)}
Écris ton BRIEF DU JOUR : une phrase par section, 12 mots maximum chacune, qui dit la chose la plus utile à faire aujourd'hui dans cette section, chiffrée si possible. Ton sec. Pas de salutation.
Réponds uniquement en JSON : {"temple": string, "corps": string, "capital": string, "esprit": string, "verbe": string}`;

/* ======================= v5 : Capital ======================= */

export const interviewPrompt = (ctx: unknown, qa: { q: string; a: string }[]) => `[TACHE:diagnostic]
${dossier(ctx)}
ENTRETIEN JUSQU'ICI : ${j(qa)}
Tu mènes l'entretien de diagnostic qui servira à construire SON activité rentable. Il faut comprendre en profondeur : ce qu'il sait faire de rare (pas les compétences banales), pour qui ça a de la valeur, qui il connaît déjà (école, entreprise, famille, communautés), son temps réel et ses créneaux, ses contraintes (contrat d'alternance, clause d'exclusivité, statut étudiant, matériel), son budget, ce qu'on lui demande déjà spontanément, son ambition chiffrée et son échéance.
Pose UNE question à la fois, précise et concrète ; si la réponse précédente est vague, creuse-la au lieu de passer à autre chose. 6 à 9 questions au total. Quand c'est utile, propose 2 à 5 réponses courtes possibles. Quand tu en sais assez, réponds "fini": true et une question vide.
Réponds uniquement en JSON : {"question": string, "choix": [string], "fini": boolean}`;

export const optionsPrompt = (ctx: unknown, demande: string) => `[TACHE:pistes]
${dossier(ctx)}
${demande ? `Retour de l'utilisateur sur les pistes précédentes : « ${demande} »\n` : ""}
Propose 3 PISTES D'ACTIVITÉ réellement différentes, bâties sur ses atouts RARES révélés par l'entretien. Pour chacune : une cible précise et atteignable par lui (secteur, taille, ville ou communauté, rôle de la personne qui paie), un canal d'acquisition qu'il peut activer CETTE SEMAINE avec son réseau réel, une offre packagée au résultat clair, un prix chiffré, et pourquoi lui précisément peut gagner. Interdits : revente d'objets, dropshipping, trading, crypto, paris, « automatiser une tâche simple », toute formule vague ou générique, tout ce qui contredit ses contraintes (alternance, exclusivité, temps, budget). Notes de 1 à 10, honnêtes et différenciées. premierEuroJours = délai réaliste avant le premier paiement ; potentielMois = revenu mensuel réaliste dans 12 mois, en euros.
Réponds uniquement en JSON : {"options": [{"nom": string (3 mots), "offre": string, "cible": string, "canal": string, "prix": string, "pourquoiToi": string, "premierEuroJours": number, "potentielMois": number, "scores": {"marche": number, "competence": number, "vitesse": number, "echelle": number}}]}`;

export const sprintPrompt = (ctx: unknown) => `[TACHE:sprint]
${dossier(ctx)}
Construis le SPRINT DE CETTE SEMAINE pour sa piste choisie : un objectif chiffré atteignable en 7 jours avec son temps réel, 3 à 5 indicateurs d'action mesurables (des nombres : messages envoyés, appels, rendez-vous, devis, publications…), et le message EXACT à envoyer à un prospect, prêt à copier, adapté au canal, 90 mots maximum, signé de son prénom. Tiens compte du sprint précédent et de l'entonnoir de prospects : objectif atteint → on monte ; raté → on corrige la cause.
Réponds uniquement en JSON : {"objectif": string, "kpis": [{"label": string (5 mots max), "cible": number}], "script": string}`;

/* ======================= v5 : Esprit ======================= */

export const mapPrompt = (ctx: unknown) => `[TACHE:carte_savoir]
${dossier(ctx)}
Construis SA CARTE DU SAVOIR : pour chacun de ses domaines choisis, 8 à 12 sujets essentiels qui structurent le domaine (les notions et événements qui permettent de comprendre tout le reste, pas des anecdotes), formulés précisément (6 à 10 mots), avec un niveau : 1 = socle, 2 = approfondissement, 3 = expert. Reprends à l'identique les sujets déjà traités qui sont essentiels.
Réponds uniquement en JSON : {"domaines": [{"nom": string, "sujets": [{"titre": string, "niveau": 1|2|3}]}]}`;

/* ======================= v5 : Verbe ======================= */

export const drillPrompt = (ctx: unknown, type: string, description: string) => `[TACHE:exercice_oral]
${dossier(ctx)}
Exercice : « ${type} » — ${description}
Donne le contenu de cet exercice, adapté à son contexte (soutenances, entretiens…) et à ses faiblesses mesurées :
- "sujet" : la consigne d'oral (1 phrase, à la 2e personne) si l'exercice en demande une ;
- "texte" : le texte à lire à voix haute (lecture : 90 à 140 mots, avec des ruptures de ton, des chiffres, une question) ou 3 virelangues séparés par des retours à la ligne (articulation) ;
- "question" : une question piège réaliste de son contexte (question piège) ;
- "conseil" : une technique précise à appliquer pendant l'exercice (1 phrase).
Laisse vide ce qui ne s'applique pas. Réponds uniquement en JSON : {"sujet": string, "texte": string, "question": string, "conseil": string}`;

export const oral2Prompt = (ctx: unknown, p: { drill: string; consigne: string; secs: number; mesures: unknown; text: string }) => `[TACHE:coach_oral]
${dossier(ctx)}
Tu joues LE COACH D'ÉLOQUENCE. Exercice « ${p.drill} », consigne : « ${p.consigne} », ${p.secs} secondes.
Mesures objectives : ${j(p.mesures)}
Transcription (dictée automatique, ponctuation approximative, certains « euh » peuvent manquer) : « ${p.text} »
Note sur 100 la structure (accroche, progression, chute) et l'impact (clarté, conviction, images). Compare à ses oraux précédents. Verdict très court.
Réponds uniquement en JSON : {"structure": number, "impact": number, "verdict": string (2 phrases sèches), "a_corriger": string (LE point à corriger au prochain essai, 1 phrase), "phrase_refaite": string (sa phrase la plus faible, réécrite pour frapper)}`;
