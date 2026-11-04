# Les Piliers

Corps, Capital, Esprit, Verbe. Quatre piliers qui s'effritent chaque jour et ne montent qu'avec des preuves. Un Contremaître qui démonte tes excuses.

Application web installable (PWA) en React + TypeScript. Tes données restent sur ton téléphone.

## Mettre en ligne

1. Dans le dépôt GitHub : **Settings → Pages → Source : GitHub Actions**.
2. Pousse sur `main` : le workflow lance les tests, construit l'appli et la publie à `https://<pseudo>.github.io/<depot>/`.

## Installer sur le téléphone

1. Ouvre l'adresse publiée (Safari sur iPhone, Chrome sur Android).
2. « Partager » → « Sur l'écran d'accueil » (iPhone) ou menu ⋮ → « Installer l'application » (Android).
3. Dans l'appli : roue crantée → colle ta clé API DeepSeek (platform.deepseek.com) → « Tester la clé ».

L'accueil te demande ta clé DeepSeek puis ton profil (corps, capital, esprit, verbe) : tout ce que l'appli te propose est construit par l'IA à partir de ce profil, de tes résultats et de sa mémoire de toi. Le profil se modifie à tout moment (réglages → Modifier mon profil).

## Développer

```bash
npm install
npm run dev        # serveur local
npm test           # tests du moteur
npm run build      # build de production dans dist/
```

L'architecture et les règles du jeu sont décrites dans `CLAUDE.md`. Les contenus (sujets, missions, séances…) se modifient dans `src/content/`.
