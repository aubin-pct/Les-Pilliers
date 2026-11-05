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

**Sur le Mac** : ouvre `http://localhost:8787`, va dans la roue crantée → **Synchronisation** : l'adresse est déjà remplie, colle le jeton, **Relier cet appareil**.

**Sur le téléphone** (Tailscale allumé) :
- soit tu ouvres `https://piliers.xxxx.ts.net` dans Safari, puis Partager → Sur l'écran d'accueil (l'appli vient alors directement du Mac) ;
- soit tu gardes l'appli installée depuis GitHub Pages et tu saisis cette adresse dans Réglages → Synchronisation.

Dans les deux cas : colle le jeton, **Relier cet appareil**.

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

- **« Serveur injoignable »** sur le téléphone : Tailscale est-il activé ? Le Mac est-il allumé, et Docker Desktop lancé ? (`docker compose ps`)
- **« Jeton refusé »** : le jeton saisi doit être exactement celui de `SYNC_TOKEN` dans `.env`.
- **L'adresse ts.net ne répond pas en HTTPS** : vérifie que **HTTPS Certificates** est activé dans la console Tailscale, puis `docker compose restart tailscale`. Le premier certificat peut prendre une minute.
- **Clé Tailscale expirée** : une clé d'authentification ne sert qu'à la première connexion ; ensuite l'état est gardé dans le volume `tailscale-state`. Si tu supprimes ce volume, génère une nouvelle clé.
- **Revenir en arrière** : les sauvegardes quotidiennes sont dans `data/backups/`. L'appli peut en restaurer une (Réglages → Sauvegarde → Restaurer accepte aussi ces fichiers une fois copiés sur l'appareil).
