# CLAUDE.md — Les Piliers

Application de vie personnelle, volontairement dure (style David Goggins). Quatre piliers — Corps, Capital, Esprit, Verbe — dont la hauteur se compte en « assises ». Ils s'érodent en continu, ne montent qu'avec des preuves, et chaque jour sans plancher se paie le lendemain par un compte à rendre jugé par « le Contremaître » (IA DeepSeek). Mono-utilisateur, sur téléphone, installée en PWA. Interface en français, tutoiement.

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
  ai/           # client.ts (appel HTTP), prompts.ts (consignes), contremaitre.ts (fonctions typées avec repli)
  lib/          # format (dates, nombres), device (vibration, bip, écran allumé), media (IndexedDB, photos, lecture), backup, layers (bouton retour)
  ui/kit.tsx    # briques partagées : Card, Foreman, Sheet, Toast, PillarHeader, Sparkline, Envelope, Transcript, PlayButton, useNow
  features/     # une vue par écran : accueil (contrat), temple, corps, capital, esprit, verbe, reglages
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

`useStore` (clé localStorage `les-piliers`) : `chantier` (persisté), `demo` (jamais persisté ; prioritaire à l'affichage), `settings` (persistés), `recording` (oral en cours : la barre d'onglets est bloquée).
- Lire : `useChantier()` (démo si active), `useIsDemo()`, `useSettings()`.
- Modifier : `act(d => …)` exécute la fonction sur le chantier actif dans un brouillon immer et renvoie son résultat (ne jamais renvoyer un objet du brouillon).
- `normalize()` complète un chantier chargé : ajouter un champ ne demande pas de migration. Changement incompatible : passer à `v: 2`, migrer dans `merge` du persist, ne jamais perdre de données.
- Brouillons de saisie : `useDraft(clé)` (store `ui`), conservés en mémoire quand on change d'onglet.
- Médias : `audio` (clé = `ts` de l'oral, Blob) et `proofs` (clé `m-<ts>`, JPEG 1 100 px en data URL) dans la base IndexedDB `les-piliers`.
- Sauvegarde (`lib/backup.ts`) : JSON du chantier et des réglages sans la clé API, ni audio ni photos. Restauration : remplace le chantier ; accepte aussi les exports de la v1 (« quatre-piliers »).

## Interface

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
- `ai/contremaitre.ts` : une fonction par usage (`judgeExcuse`, `examineEsprit`, `examineReview`, `examineConcept`, `orderMission`, `coachOral`, `weeklyReport`, `testKey`). Elles renvoient `null` sans clé, en démo ou en cas d'échec (message affiché) ; l'appelant applique alors les règles locales.

## Tester

1. `npm test` (moteur) et `npm run typecheck`.
2. Parcours complet : `npm run build && npm run preview`, puis Playwright (Chromium avec `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), `page.clock` pour avancer le temps (séance de 5 min, passage de minuit : avancer de 48 h à cause du jour de grâce), `page.route("https://api.deepseek.com/**")` pour simuler l'IA, `window.__tribune` pour la Tribune. Un onglet bloqué pendant l'oral porte `aria-disabled` : cliquer avec `force`.
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
