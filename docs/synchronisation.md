# Synchroniser le Mac et le téléphone

Un conteneur Docker sur le Mac garde le chantier et le partage entre tes appareils. Ton téléphone le joint en HTTPS grâce à Tailscale, un réseau privé : rien n'est exposé sur Internet, et ça marche aussi en 4G.

Ce que fait le conteneur :
- il sert l'appli (tu peux l'utiliser sur le Mac à `http://localhost:8787`) ;
- il garde le chantier, les enregistrements audio et les photos de preuve dans le dossier `data/` du dépôt, avec une sauvegarde par jour (14 jours) ;
- il fusionne : si tu as utilisé les deux appareils sans réseau, rien ne se perd.

## Une seule fois : Tailscale

1. Crée un compte sur tailscale.com (gratuit).
2. Installe l'appli **Tailscale** sur ton téléphone et connecte-toi avec ce compte.
3. Dans la console d'administration Tailscale :
   - **DNS** : active **MagicDNS** et **HTTPS Certificates** ;
   - **Settings → Keys → Generate auth key** : garde les options par défaut, copie la clé (`tskey-auth-…`).

## Une seule fois : le conteneur

Dans le Terminal, depuis le dossier du dépôt `Les-Pilliers` :

```bash
cp .env.example .env
openssl rand -hex 24          # copie le résultat : c'est ton jeton de synchronisation
open -e .env                  # colle la clé Tailscale (TS_AUTHKEY) et le jeton (SYNC_TOKEN), enregistre
docker compose up -d --build
```

La première construction prend deux ou trois minutes. Ensuite :

```bash
docker compose ps             # les deux services doivent être « running » (piliers : « healthy »)
docker compose logs tailscale | grep -i "https://"   # affiche l'adresse du type https://piliers.xxxx.ts.net
```

Le conteneur redémarre tout seul avec Docker Desktop. Pense à cocher **Start Docker Desktop when you sign in** dans les réglages de Docker Desktop.

## Relier les appareils

**Sur le Mac, commence par l'appareil qui a tes données.** Le chantier vit dans le navigateur, à l'adresse exacte où tu as utilisé l'appli : `http://localhost:8787` est une autre adresse, donc un chantier vide. Relie d'abord l'onglet qui a ton vrai chantier, sinon tu enverras un chantier vide au serveur.

- **Ton chantier est sur GitHub Pages** (`aubin-pct.github.io`) : dans cet onglet, roue crantée → **Synchronisation**, adresse `http://localhost:8787`, colle le jeton, **Relier cet appareil**. **Safari refuse** qu'une page HTTPS appelle `http://localhost` (« Serveur injoignable ») : prends la voie de la sauvegarde ci-dessous, ou relie depuis Chrome (mais tes données ne sont que dans le navigateur où tu as utilisé l'appli).
- **Ton chantier est sur `npm run dev` ou `npm run preview`** (`localhost:5173` ou `4173`) : pareil, depuis cet onglet.
- **Si ça bloque** : dans l'onglet qui a tes données, Réglages → Sauvegarde → exporte le fichier ; ouvre `http://localhost:8787`, **Restaurer** ce fichier, puis relie cet onglet (l'adresse y est déjà remplie).

Vérifie ensuite que `data/state.json` existe : tes données sont sur le serveur.

**Sur le téléphone** (Tailscale allumé) :
- soit tu ouvres `https://piliers.xxxx.ts.net` dans Safari, puis Partager → Sur l'écran d'accueil (l'appli vient alors directement du Mac) ;
- soit tu gardes l'appli installée depuis GitHub Pages et tu saisis cette adresse dans Réglages → Synchronisation.

Dans les deux cas : colle le jeton, **Relier cet appareil**. Si le téléphone avait déjà un chantier, choisis **Garder le serveur** pour récupérer celui du Mac.

Si les deux appareils ont déjà un chantier, l'appli te demande lequel garder, ou de **fusionner** (tout est additionné : séances, missions, sujets, oraux, gains).

La clé DeepSeek n'a besoin d'être saisie qu'une fois : l'autre appareil la récupère à la synchronisation suivante.

## Au quotidien

Rien à faire. L'appli se synchronise à l'ouverture, 3 secondes après chaque action, et chaque minute. La pastille à gauche de « IA » dans l'en-tête dit où tu en es : verte (à jour), laiton (en cours), rouge (erreur ou choix à faire ; touche-la pour voir le détail).

Hors réseau ou Mac éteint, l'appli marche normalement ; tout part à la reconnexion.

## Mettre à jour

```bash
git pull
docker compose up -d --build
```

## Dépannage

- **`tailscale` redémarre sans cesse, le téléphone ne joint rien** : `docker compose logs tailscale | grep -i invalid`. `invalid key` = `TS_AUTHKEY` est faux, révoqué, expiré, ou encore `tskey-auth-XXXXXXXXXXXX`. Génère une clé, colle-la dans `.env`, puis `docker compose up -d --force-recreate tailscale`. Le Mac, lui, garde `http://localhost:8787` : le serveur ne dépend pas de Tailscale.
- **« Serveur injoignable » sur le Mac alors que `http://localhost:8787` s'ouvre** : l'adresse de la page doit figurer dans `ALLOWED_ORIGINS` (`docker-compose.yml`), puis `docker compose up -d`.
- **« Serveur injoignable »** sur le téléphone : Tailscale est-il activé ? Le Mac est-il allumé, et Docker Desktop lancé ? (`docker compose ps`)
- **« Jeton refusé »** : le jeton saisi doit être exactement celui de `SYNC_TOKEN` dans `.env`.
- **L'adresse ts.net ne répond pas en HTTPS** : vérifie que **HTTPS Certificates** est activé dans la console Tailscale, puis `docker compose restart tailscale`. Le premier certificat peut prendre une minute.
- **Clé Tailscale expirée** : une clé d'authentification ne sert qu'à la première connexion ; ensuite l'état est gardé dans le volume `tailscale-state`. Si tu supprimes ce volume, génère une nouvelle clé.
- **Revenir en arrière** : les sauvegardes quotidiennes sont dans `data/backups/`. L'appli peut en restaurer une (Réglages → Sauvegarde → Restaurer accepte aussi ces fichiers une fois copiés sur l'appareil).
