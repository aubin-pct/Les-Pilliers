# CLAUDE.md — Les Piliers

Application de vie personnelle, volontairement dure (style David Goggins). Quatre piliers — Corps, Capital, Esprit, Verbe — dont la hauteur se compte en « assises ». Ils s'érodent en continu, ne montent qu'avec des preuves, et chaque jour sans plancher se paie le lendemain par un compte à rendre jugé par « le Contremaître » (IA DeepSeek). Mono-utilisateur, sur téléphone, installée en PWA. Interface en français, tutoiement.

**L'IA est un prérequis** (clé DeepSeek demandée à l'accueil) : séances, programme, feuille de route, étapes de mission, concepts, sujets d'Esprit, parcours, fiches, sujets d'oral, verdicts et bilans sont générés pour l'utilisateur. Les contenus statiques ne servent plus qu'à la démo et en secours (`engine/fallbacks.ts`).

## Le flux de données (v2)

```
Profil déclaré (accueil, /profil) ─┐
Preuves mesurées (séances série par série, ressenti, tests,   ├─► ai/context.ts : un dossier compact par pilier ─► ai/prompts.ts ─► DeepSeek
  actions, missions, examens, oraux, excuses)                 │                                                    │
Mémoire du Contremaître (bilan IA par pilier) ───────────────┘                                                    ▼
        ▲                                                                                    ai/schemas.ts (zod) : validation, nettoyage
        └────────────── bilan hebdomadaire (Memory.tsx) ◄──── plans stockés dans le chantier ◄──┘ (un seul nouvel essai si invalide)
```

- **Profil** (`chantier.profile`, formulaires `features/profil/ProfileForms.tsx`) : objectifs, niveau, mensurations, matériel, temps (Corps) ; situation, compétences, ressources, heures, budget, risque, intérêts, objectif, déjà tenté, refus (Capital) ; domaines, niveau, motivation (Esprit) ; contexte et défauts (Verbe). `profile.updated === 0` = accueil inachevé : l'appli affiche `Onboarding` (clé → 4 formulaires → génération des 4 plans en parallèle par `planner.ts`).
- **Preuves** : la séance garde chaque série faite face à la cible (`Seance.logs`), le ressenti (`rpe` 1–10) et une note ; le Capital garde chaque action, étape cochée, blocage ; l'Esprit garde le domaine de chaque sujet.
- **Mémoire** (`chantier.memoire[pilier]` : synthèse, forces, faiblesses, priorité) : régénérée automatiquement en arrière-plan quand elle a plus de 7 jours et qu'au moins 3 nouvelles preuves sont arrivées (`useAutoMemory`, un essai par heure au plus), ou via « Faire le bilan maintenant ». Elle entre dans tous les dossiers et s'affiche en tête de chaque pilier (`MemoryNote`).
- **Plans** (`chantier.plans`, `roadmap`, `missionSteps`, `concept`, `espritChoice`, `parcours`) : stockés avec leur date, régénérés à la demande ou au premier affichage du jour (sujets d'Esprit et d'oral, concept, plan d'attaque).
- **Ajouter une donnée** : la stocker dans le chantier (type dans `engine/types.ts`, valeur par défaut dans `freshChantier`), puis l'exposer dans la fonction de contexte du pilier (`ai/context.ts`). Toutes les consignes en profitent.
- **Ajouter une génération** : schéma dans `schemas.ts`, consigne dans `prompts.ts` (étiquette `[TACHE:nom]` en première ligne, mot « JSON »), fonction dans `contremaitre.ts` via `ask(prompt, schema)`.

## Ce que fait chaque pilier

- **Corps** : programme hebdomadaire (`genProgramme`, ajustable par une demande libre) ; séance du jour préparée selon les conditions (temps, énergie, matériel du jour, douleur, envie) et l'historique (surcharge progressive, séries échouées, effort ≥ 9) ; exécution guidée : saisie série par série (persistée dans `plans.seance.faits`), minuteur de repos, « Tout réussi », alternative plus facile, ressenti final ; validation à 5 min de chrono et la moitié des séries. Tests étalons inchangés. Séance de secours sans IA.
- **Capital** : feuille de route personnelle de 6 à 8 paliers (`genRoadmap`, refaisable avec un retour libre ; l'index repart à 0, l'historique reste) ; plan d'attaque de la mission (étapes cochables, chaque étape = action du jour) ; « Je bloque » (diagnostic + action sous 24 h, consigné au journal) ; « Changer de mission » (le Contremaître juge la raison et remplace le palier) ; concept du jour choisi pour la mission, avec une question chiffrée ; livraison avec photo, mise d'honneur.
- **Esprit** : chaque jour, choix entre 3 propositions adaptées (domaines, niveau, sujets faibles, jamais déjà traités), la suite du parcours actif, de nouvelles propositions selon une envie, ou un sujet libre ; fiche d'apprentissage facultative avant d'expliquer (l'Examinateur exige alors d'aller au-delà) ; parcours thématiques de 6 à 10 sujets (plusieurs possibles, un actif) ; révisions espacées inchangées.
- **Verbe** : 3 sujets d'oral du jour choisis selon le contexte déclaré et les faiblesses mesurées ; « Changer de sujet » passe au suivant (coûte 1 assise) ; le coaching compare aux oraux précédents.

## Pile technique

- **React 18 + TypeScript 5 (strict) + Vite 6.** Pas de framework CSS : une feuille `src/styles/app.css` fondée sur des variables.
- **État** : Zustand 5 avec immer (mutations dans des brouillons) et persist (localStorage).
- **Navigation** : React Router 6 en `HashRouter` (`#/corps`…), compatible GitHub Pages sans réécriture d'URL.
- **Médias** : IndexedDB via `idb` (audio des oraux, photos de preuve).
- **PWA** : `vite-plugin-pwa` (Workbox, `generateSW`, mise à jour automatique), hors ligne sauf l'IA.
- **Tests** : Vitest sur le moteur (`src/engine/*.test.ts`).
- **Déploiement** : GitHub Actions (`.github/workflows/deploy.yml`) → tests, build, GitHub Pages. Dans le dépôt : Settings → Pages → Source « GitHub Actions ». `base: "./"` : l'appli marche dans n'importe quel sous-dossier.

Versions figées dans `package.json` (pas de `^`). Commandes : `npm run dev`, `npm test`, `npm run build`, `npm run preview`, `npm run typecheck`.

## Arborescence

```
src/
  content/      # contenus éditables : piliers et taux, tests et séances, échelle et concepts, sujets d'Esprit, sujets de Tribune
  engine/       # moteur pur, sans React : types, érosion, barème, analyse audio/texte, verdicts locaux, démo, lectures dérivées
  store/        # index.ts (chantier, démo, réglages, persistance) ; ui.ts (messages, brouillons de saisie)
  ai/           # client.ts (HTTP), context.ts (dossiers par pilier), prompts.ts (consignes), schemas.ts (validation zod), contremaitre.ts (une fonction par génération)
  lib/          # format (dates, nombres), device (vibration, bip, écran allumé), media (IndexedDB, photos, lecture), backup, layers (bouton retour)
  ui/kit.tsx    # briques partagées : Card, Foreman, Sheet, Toast, PillarHeader, Sparkline, Envelope, Transcript, PlayButton, useNow
  features/     # une vue par écran : accueil (contrat), profil (accueil guidé, page profil, planner), temple (+ mémoire), corps, capital, esprit, verbe, reglages
  App.tsx       # en-tête, barre d'onglets, routes, horloge du moteur
```

Règle : le moteur (`engine/`) ne dépend ni de React ni du navigateur (sauf types), et reçoit toujours `now` en argument. Toute règle du jeu y vit et y est testée. Les vues ne calculent pas de points elles-mêmes.

## Ajouter du contenu

Tout se fait dans `src/content/`, sans toucher au moteur :
- `esprit.ts` : `TOPICS` (titre + domaine). Le sujet du jour tourne entre les domaines (`DOMAINS`) et ne repropose jamais un sujet déjà traité.
- `verbe.ts` : `SUBJECTS` (texte + type), `TICS`, durées et seuils de la Tribune.
- `capital.ts` : `LADDER` (échelle de 8 missions, `cash` = montant exigé) et `CONCEPTS`.
- `corps.ts` : `TESTS` (mode de mesure : `nez`, `chrono`, `minuteur`, `saisie`) et `SEANCES` (doses `{p}` pompes, `{d}` dips, `{g}` gainage, `{s}` squats, `{e}` pompes explosives, calculées dans `todaySeance`).
- `pillars.ts` : taux d'érosion, planchers, pénalité de minuit.

## Règles du jeu (moteur)

- `erode` : érosion exponentielle continue, `rate` par jour (Corps 2,5 %, Capital 1,2 %, Esprit 0,8 %, Verbe 1,8 %). Plus un pilier est haut, plus il perd : faire toujours pareil mène au plateau.
- `rollover` : chaque jour passé, un pilier sans plancher (`days[jour][pilier]`) perd `MISS_PENALTY` (4 %) et crée un compte à rendre (`pending`, 8 au plus). Le jour de la signature est épargné. Une mise échue est perdue (−10 % Capital, ligne « mise » au registre).
- `gain` : seul point d'entrée des points. Gains ÷ 2 tant que `pending` n'est pas vide. Pose le plancher sauf `{ floor: false }`.
- `scoring.ts` : barème (`POINTS`, `seanceGain`, `applyTest`, `missionPoints`, `applyReview`, `oralPoints`). Un test étalon ne fait monter qu'en cas de record ; égaler ou reculer coûte 2 assises.
- `verdicts.ts` : verdicts sans IA par catégories. La santé est toujours recevable, sur un ton respectueux.
- `demo.ts` : 47 jours simulés, graine fixe, deux missions livrées aux jours 11 et 29.

Si on change un barème : mettre à jour `POINTS`, l'écran « Les règles » (`ReglagesView`), le contrat (`Contract`) et les tests.

## État et persistance

`useStore` (clé localStorage `les-piliers`, chantier `v: 2`) : `chantier` (persisté), `demo` (jamais persisté ; prioritaire à l'affichage), `settings` (persistés), `recording` (oral en cours : la barre d'onglets est bloquée).
- Lire : `useChantier()` (démo si active), `useIsDemo()`, `useSettings()`.
- Modifier : `act(d => …)` exécute la fonction sur le chantier actif dans un brouillon immer et renvoie son résultat (ne jamais renvoyer un objet du brouillon).
- `normalize()` complète un chantier chargé et migre v1 → v2 (profil, plans, mémoire ajoutés ; sans profil, l'utilisateur repasse par l'accueil) : ajouter un champ ne demande pas de migration. Changement incompatible : passer à `v: 3`, migrer dans `normalize`, ne jamais perdre de données.
- Brouillons de saisie : `useDraft(clé)` (store `ui`), conservés en mémoire quand on change d'onglet.
- Médias : `audio` (clé = `ts` de l'oral, Blob) et `proofs` (clé `m-<ts>`, JPEG 1 100 px en data URL) dans la base IndexedDB `les-piliers`.
- Sauvegarde (`lib/backup.ts`) : JSON du chantier et des réglages sans la clé API, ni audio ni photos. Restauration : remplace le chantier ; accepte aussi les exports de la v1 (« quatre-piliers »).

## Interface

### Direction visuelle (v4)
Carrière de pierre la nuit, temple en construction. Matières : granit (grain SVG en surimpression, `body::after`), dalles taillées (`.card` : dégradé, arête claire en haut, ombre en bas, rayon 12 px), gravure (titres avec ombre portée claire/sombre), laiton martelé (`.btn.primary`). La couleur d'accent `--acc` suit le pilier ouvert (`html[data-pillar]`, posé par `useAccent` dans `App.tsx`) : filets, focus, titres de cartes, puces, barre d'onglets.

### Composants de geste
- `ui/HoldButton.tsx` : maintenir pour confirmer (signer le contrat 1,4 s, valider une séance, livrer une mission, engager une mise 1,2 s, tout effacer 2 s). Vibre à chaque quart. À utiliser pour tout engagement ; jamais pour une action courante.
- `ui/motion.tsx` : `useRolling` (nombres qui roulent), `<Stamp />` (tampon plein écran « +6,2 » dans la couleur du pilier, secousse rouge pour une perte ; alimenté par `gainToast`), `skyPhase` (ciel du Temple : nuit étoilée, aube, jour, crépuscule).
- `PillarHeader` (kit) : en-tête « monument » de chaque pilier (colonne miniature, nom gravé, hauteur qui roule, tendance 7 j, puces d'état, courbe de 30 jours).
- `Sheet` : panneau qui se ferme en le faisant glisser vers le bas (zone de préhension), ou avec le retour.
- Barre d'onglets : chaque pilier porte une jauge de hauteur et un point rouge si le plancher est nu.
- Temple : piliers cliquables (ouvrent leur chantier).
- `features/corps/FocusSession.tsx` : séance plein écran, un exercice et une série à la fois (− / + au pouce, « Série faite », anneau de repos +15 s, séries chronométrées, balayage gauche/droite, fin avec ressenti et validation maintenue). Actions partagées avec la vue liste dans `features/corps/session.ts`.
- Tribune : anneau de temps restant et halo qui réagit au volume de la voix (`--lvl`).

### Mouvement
Entrées de page et de cartes par translation seule (jamais d'opacité de départ : le contenu reste lisible si l'animation ne tourne pas). Tout est coupé sous `prefers-reduced-motion`.

- Thème sombre unique. Couleurs uniquement via les variables de `:root` : `--c-corps`, `--c-capital`, `--c-esprit`, `--c-verbe`, `--brass` (ce qui se gagne), `--blood` (ce qui se perd). Polices : Big Shoulders Display (titres), Archivo (texte), IBM Plex Mono (chiffres, voix du Contremaître).
- Gouttière de 16 px, zones sûres `env(safe-area-inset-*)`, champs en 16 px contre le zoom d'iOS, colonne max 520 px.
- Panneaux : `<Sheet>` ; le bouton retour d'Android ferme la couche du dessus grâce à `lib/layers.ts` (le compteur de pompes l'utilise aussi). Ne pas manipuler `history` ailleurs.
- Pas de `alert`/`confirm`/`prompt`. Action massive (« Tout effacer ») : confirmation en deux temps.
- Le Contremaître parle sec et court. Les erreurs disent quoi faire, en une phrase.

## La Tribune (Verbe)

- `features/verbe/recorder.ts` (`Capture`) : `getUserMedia` → `MediaRecorder` (archive), `AnalyserNode` échantillonné toutes les 50 ms, `SpeechRecognition` fr-FR continue relancée à chaque `end`. Si la reconnaissance échoue, l'oral est jugé sur la voix seule (25 s de voix au lieu de 40 mots).
- `engine/analysis.ts` : `analyzeAudio` (seuil adaptatif, blancs ≥ 0,8 s, enveloppe de 72 points) et `analyzeText` (mots/min, tics, diversité). Métrique principale : hésitations/min = tics/min + blancs/min.
- Mode clavier : dictée du clavier dans une zone de texte, sans enregistrement ; bascule automatique si le micro est refusé.
- Crochet de test : `window.__tribune = { secs, inject }` raccourcit l'oral et injecte une transcription.

## Le Contremaître IA

- `ai/client.ts` : `POST {baseUrl}/chat/completions`, format OpenAI (DeepSeek par défaut, OpenRouter possible). `response_format: json_object` sauf pour le rapport ; sur DeepSeek `thinking` désactivé sauf mode approfondi (examens, rapport). Erreur 400 : un seul nouvel essai sans ces paramètres. JSON lu entre le premier `{` et le dernier `}`.
- `ai/prompts.ts` : `PERSONA` et une consigne par usage. Le mot « JSON » doit rester dans chaque consigne JSON. Garde-fous à ne pas affaiblir : dur sur les comportements, jamais sur la personne ; santé, deuil, détresse traités avec respect.
- `ai/contremaitre.ts` : une fonction par génération, toutes via `ask(prompt, schema, options, silent)`. Elles renvoient `null` sans clé, en démo ou en cas d'échec (message affiché, sauf `silent` pour les générations automatiques) ; l'appelant garde l'état précédent ou applique les règles locales. Mode approfondi (réflexion DeepSeek) pour programme, feuille de route, parcours, examens, mémoire et rapport.

## Synchronisation entre appareils

- **Serveur** (`server/server.mjs`, Node 22, aucune dépendance) : sert `dist/` et l'API. `GET /api/health` (sans jeton) ; `GET /api/state?since=rev` (204 si inchangé) ; `PUT /api/state {baseRev, state, shared}` (409 + état courant si `baseRev` est périmé, écritures en file) ; `GET /api/media`, `GET|PUT /api/media/{audio|proofs}/{clé}`. Jeton `SYNC_TOKEN` (≥ 16 caractères, comparaison à temps constant). CORS limité à `ALLOWED_ORIGINS` (GitHub Pages, localhost) avec l'en-tête Private Network Access. Données dans `DATA_DIR` : `state.json` (écriture atomique), `backups/state-AAAA-MM-JJ.json` (14 jours), `media/`. Tests : `server/server.test.mjs`.
- **Docker** : `Dockerfile` (construit l'appli puis l'image `node:22-alpine` non-root), `docker-compose.yml` (service `tailscale` en espace utilisateur avec `docker/tailscale/serve.json` → HTTPS `https://piliers.<tailnet>.ts.net`, mandataire vers l'alias `piliers-app:8787` (le nom `piliers` désigne le conteneur Tailscale lui-même) ; service `piliers` autonome qui publie `127.0.0.1:8787` sur le Mac, donc joignable même si Tailscale est en panne ; `./data` monté). Secrets dans `.env` (`TS_AUTHKEY`, `SYNC_TOKEN`), jamais commité. La CI construit l'image et vérifie qu'elle répond. Guide utilisateur : `docs/synchronisation.md`.
- **Client** (`src/lib/sync.ts`) : état commun (révision + chantier) dans IndexedDB (`kv`), pas dans localStorage (taille). Algorithme : GET depuis la révision commune → rien n'a changé ici : on adopte le serveur ; rien là-bas : on pousse ; les deux : `mergeChantier` puis on pousse ; 409 : on recommence (4 essais). Une modification locale = `chantier.updatedAt` (mis à jour par `act`, pas par l'érosion). Premier rattachement d'un appareil déjà utilisé à un serveur non vide : statut `choice` → `SyncCard` propose serveur / cet appareil / fusionner. Synchro auto : démarrage, retour sur l'appli, 3 s après une modification, chaque minute, retour du réseau. Médias : envoyés après chaque synchro (liste des envois dans `kv`), récupérés à la demande par `loadAudio`/`loadProof`. Réglages partagés : la clé IA saisie sur un appareil est reprise par l'autre s'il n'en a pas. Jamais de synchro en démo.
- **Fusion** (`src/engine/sync.ts`, `sync.test.ts`) : les trois versions (commune, locale, distante) sont d'abord amenées au même instant (`tick`) pour que l'érosion et les pénalités de minuit ne comptent qu'une fois. Journaux : union par identifiant (version locale si les deux ont modifié la même entrée). Planchers : union. Comptes à rendre : union moins ceux excusés. Hauteurs et compteurs : distant + (local − commun). Objets : celui qui a changé ; si les deux, le plus récent (dates `updated`, `ts`, `date`), sinon le local. **Tout nouveau champ du chantier doit recevoir sa règle dans `mergeChantier`** (sinon il suit la version locale).

## Tester

1. `npm test` (moteur) et `npm run typecheck`.
2. Parcours complet : `npm run build && npm run preview`, puis Playwright. Simuler l'IA en répondant selon l'étiquette `[TACHE:…]` du message utilisateur ; vérifier dans les consignes capturées que les données circulent (poids, douleur, compétences, étapes cochées, ressenti). (Chromium avec `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), `page.clock` pour avancer le temps (séance de 5 min, passage de minuit : avancer de 48 h à cause du jour de grâce), `page.route("https://api.deepseek.com/**")` pour simuler l'IA, `window.__tribune` pour la Tribune. Un onglet bloqué pendant l'oral porte `aria-disabled` : cliquer avec `force`.
3. Micro, reconnaissance vocale, vibration et compteur au nez ne se vérifient vraiment que sur téléphone, en HTTPS.

## Points connus

- CORS de `api.deepseek.com` depuis un navigateur non vérifié. En cas d'échec réseau : OpenRouter (`https://openrouter.ai/api/v1`) ou un petit proxy (Cloudflare Worker) qui garde la clé.
- Enregistrement et reconnaissance vocale simultanés non vérifiés sur iOS.
- Pas de notifications push (pas de serveur) : le rappel se fait à l'ouverture.
- Clé API en clair dans le localStorage du téléphone (usage personnel). Données sur un seul appareil : sauvegarde manuelle, rappel après 14 jours.
- La mise d'engagement est déclarative.

## Pistes

- Notifications push (Cloudflare Worker + Web Push) pour le rappel de 21 h.
- Transcription serveur (Whisper) de l'audio archivé, pour compter les vrais « euh ».
- Rapport annuel exportable (« l'article scientifique » de l'année).
- Synchronisation chiffrée entre appareils.
