# 🍗 Crousty & Kebab — Commandes entre amis

Application web (PWA) pour organiser **des commandes groupées de Crousty** et **des sorties Tacos / Kebab** entre amis — **sans compte, sans mot de passe**, avec une synchronisation **en temps réel**.

> Tu entres ton prénom, tu crées une session, tu partages le code à 4 chiffres (`0554`), tout le monde ajoute sa commande et la liste se met à jour en direct sur tous les téléphones. Quand quelqu'un a appelé le restaurant, le créateur clôture la commande.

| Accueil | Session Crousty | Commande clôturée | Sortie Tacos / Kebab |
|---|---|---|---|
| ![Accueil](docs/screenshots/01-home.png) | ![Session](docs/screenshots/04-session-mobile.png) | ![Clôturée](docs/screenshots/06-closed-mobile.png) | ![Tacos](docs/screenshots/07-tacos-mobile.png) |

*(Captures générées automatiquement pendant les tests end-to-end — à remplacer par de vraies captures si tu le souhaites.)*

---

## Sommaire

- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Architecture](#-architecture)
- [Démarrage rapide avec Docker](#-démarrage-rapide-avec-docker)
- [Développement local](#-développement-local)
- [Tests](#-tests)
- [API REST](#-api-rest)
- [Événements temps réel](#-événements-temps-réel)
- [Sécurité et permissions](#-sécurité-et-permissions)
- [PWA](#-progressive-web-app)
- [Déploiement en production (HTTPS)](#-déploiement-en-production-https)
- [Limites connues](#-limites-connues)

---

## ✨ Fonctionnalités

**Accès sans compte**
- Saisie du prénom / pseudo, mémorisé dans le navigateur.
- Création d'une session → code unique à **4 chiffres**, jamais dupliqué parmi les sessions actives.
- Rejoindre via le code (accueil) ou via le **lien partagé** (`/session/0554`).
- Boutons **Copier le code** et **Partager le lien** (partage natif sur mobile).

**Crousty**
- 4 produits : Nature, Piquant, Sucré, Sucré Piquant (cartes illustrées + bouton *Ajouter*).
- « Pour qui est cette commande ? » : *mon nom*, *un autre participant* ou *un nouveau nom*, quantité (1–20) et précision facultative.
- Liste regroupée par personne, total de Crousty, nombre de participants, nombre par type, heure prévue, statut.
- Chacun modifie / supprime **ses** commandes ; le créateur gère **toutes** les commandes.
- Numéro du restaurant à appeler affiché en grand (lien `tel:`), configurable via `CROUSTY_PHONE`.

**Tacos / Kebab**
- Session avec choix du menu : Tacos, Kebab ou les deux.
- « Qui va au tacos / kebab ? » : s'inscrire, modifier son choix, ajouter une précision, se retirer.
- Compteurs (total, tacos, kebab) et liste des participants qui n'ont pas encore répondu.

**Clôture de commande**
- Bouton **« J'AI APPELÉ LE RESTAURANT — FERMER LA COMMANDE »** (réservé au créateur) avec confirmation.
- Statut `OPEN` / `CLOSED`, heure de clôture enregistrée, message « Commande clôturée ! Le restaurant a été contacté. Merci à tous ! » affiché instantanément chez tous.
- Plus aucun ajout / modification / suppression (vérifié côté serveur). Le créateur peut **rouvrir**.

**Temps réel** : chaque action est visible sans recharger la page (Socket.IO), avec indicateur *En direct / Hors ligne* et resynchronisation automatique après reconnexion.

---

## 🧱 Stack technique

| Couche | Technologies |
|---|---|
| Frontend | Angular 22 (standalone components, signals, zoneless), TypeScript strict, SCSS, Angular Service Worker |
| Backend | Node.js 22 LTS, Express 5, TypeScript strict, Socket.IO 4, Zod 4, Helmet, express-rate-limit |
| Base de données | PostgreSQL 17, Prisma ORM 7 (adaptateur `@prisma/adapter-pg`) |
| Infra | Docker multi-stage, Docker Compose, Nginx (statique + reverse proxy API/WebSocket) |
| Tests | Vitest + Supertest + socket.io-client (backend), Vitest via `ng test` (frontend), GitHub Actions |

---

## 🏗 Architecture

```
crousty-kebab/
├── backend/                 API Express + Socket.IO
│   ├── prisma/
│   │   ├── schema.prisma    Modèle de données
│   │   └── migrations/      Migrations SQL versionnées
│   ├── src/
│   │   ├── controllers/     Couche HTTP (req → service → res)
│   │   ├── services/        Logique métier, transactions, permissions
│   │   ├── routes/          Déclaration des routes /api
│   │   ├── middleware/      Validation Zod, erreurs, rate limiting
│   │   ├── sockets/         Rooms Socket.IO + diffusion des événements
│   │   ├── schemas/         Schémas Zod
│   │   ├── utils/           Jetons, codes, erreurs
│   │   ├── app.ts           Application Express (testable)
│   │   └── server.ts        Serveur HTTP + Socket.IO
│   ├── tests/               Tests d'intégration (vraie base PostgreSQL)
│   ├── docker-entrypoint.sh Applique les migrations puis démarre
│   └── Dockerfile
├── frontend/                Application Angular (PWA)
│   ├── src/app/
│   │   ├── core/            API, temps réel, identité locale, toasts, modèles
│   │   ├── shared/          Icônes, modale, partage du code
│   │   └── features/        home · create · session (Crousty / Tacos-Kebab)
│   ├── public/              Manifest, icônes, illustrations
│   ├── ngsw-config.json     Stratégie de cache du service worker
│   └── Dockerfile
├── nginx/nginx.conf         Statique Angular + proxy /api et /socket.io
├── docker-compose.yml
└── .env.example
```

**Flux d'une action** : le client appelle l'API REST → validation **Zod** → vérification des **permissions** (jetons) → écriture **transactionnelle** dans PostgreSQL → lecture de l'état public → **diffusion Socket.IO** à la room `session:<id>`. Les sockets ne servent qu'à écouter : aucune écriture ne passe par eux.

**Modèle de données** : `Session` (code, type, statut, heure prévue, `creatorTokenHash`, `expiresAt`…), `Participant` (nom unique par session, `tokenHash`), `Order` (propriétaire `participantId` + destinataire `targetName`), `Participation` (unique par participant et session). Clés étrangères, index, contraintes `CHECK` (format du code, quantité 1–20, cohérence statut / `closedAt`).

**Unicité des codes** : l'attribution se fait dans une transaction protégée par un verrou PostgreSQL (`pg_advisory_xact_lock`) ; un code n'est réservé que pour les sessions **actives** (`expiresAt`, 48 h par défaut après l'heure prévue). Les sessions expirées restent en base (historique) mais libèrent leur code.

---

## 🐳 Démarrage rapide avec Docker

Prérequis : Docker 24+ avec le plugin Compose.

```bash
# 1. Cloner le dépôt
git clone https://github.com/<ton-compte>/crousty-kebab.git
cd crousty-kebab

# 2. Configurer les variables d'environnement
cp .env.example .env
# ⚠️ Modifie POSTGRES_PASSWORD (ex. : openssl rand -base64 24)

# 3. Construire et démarrer
docker compose up --build -d
```

L'application est disponible sur **http://localhost:8080** (port configurable via `HTTP_PORT`).
Les migrations Prisma sont appliquées automatiquement au démarrage du backend (`prisma migrate deploy`).

Commandes utiles :

```bash
docker compose ps                    # état et healthchecks
docker compose logs -f backend       # logs de l'API
docker compose stop                  # arrêter les conteneurs
docker compose start                 # redémarrer les conteneurs arrêtés
docker compose restart backend       # redémarrer un service
docker compose down                  # arrêter et supprimer les conteneurs (les données sont conservées)
docker compose down -v               # ⚠️ supprime aussi le volume PostgreSQL
docker compose up --build -d         # reconstruire après une mise à jour du code
docker compose exec backend npx prisma migrate deploy   # migrations manuelles
```

Services : `database` (PostgreSQL, volume persistant `pgdata`, non exposé), `backend` (Express, non exposé), `frontend` (Nginx, seul port public). Tous sont sur le réseau interne `internal` avec healthchecks et `restart: unless-stopped`.

---

## 💻 Développement local

Prérequis : Node.js **22.12+**, npm 10+, PostgreSQL 15+ (local ou `docker run`).

```bash
# Base de données (si tu n'as pas PostgreSQL installé)
docker run -d --name crousty-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17-alpine
docker exec crousty-db createdb -U postgres crousty
docker exec crousty-db createdb -U postgres crousty_test
```

**Backend**

```bash
cd backend
cp .env.example .env              # adapte DATABASE_URL si besoin
npm install                       # génère aussi le client Prisma (postinstall)
npx prisma migrate deploy         # applique les migrations
npm run dev                       # API sur http://localhost:3000 (rechargement auto)
```

Pour créer une nouvelle migration après avoir modifié `schema.prisma` : `npx prisma migrate dev --name ma_migration`.

**Frontend** (dans un second terminal)

```bash
cd frontend
npm install
npm start                         # http://localhost:4200 (proxy /api et /socket.io → :3000)
```

> Le service worker n'est actif qu'en build de production (`npx ng build`) ; en développement l'app fonctionne sans cache.

---

## 🧪 Tests

**Backend** — tests d'intégration sur une vraie base PostgreSQL dédiée (le nom doit contenir `test`) :

```bash
cd backend
cp .env.test.example .env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crousty_test npx prisma migrate deploy
npm test                          # Vitest
npm run typecheck                 # vérifie aussi les types des tests
```

Couverture fonctionnelle : création de session, codes uniques (création concurrente + espace de codes saturé), réutilisation après expiration, rejoindre, nom déjà pris / reprise d'identité, commandes pour soi / un autre / un nouveau nom, validation, modification et suppression, permissions (propriétaire / créateur / intrus), clôture et réouverture, refus après clôture, participations Tacos / Kebab, non-exposition des jetons, en-têtes de sécurité, **synchronisation Socket.IO** (diffusion à la room, isolation des rooms, aucune diffusion en cas de refus, récupération après reconnexion).

**Frontend**

```bash
cd frontend
npm run test:ci                   # Vitest (ng test)
```

Le workflow **GitHub Actions** (`.github/workflows/ci.yml`) exécute les deux suites, le build Angular et le build des images Docker à chaque push / PR.

---

## 📡 API REST

Toutes les routes sont préfixées par `/api`. Les jetons sont transmis **uniquement par en-têtes** : `X-Participant-Token` et `X-Creator-Token`.

| Méthode | Route | Description | Autorisation |
|---|---|---|---|
| GET | `/health` | Healthcheck (inclut la base) | — |
| GET | `/config` | Numéro du restaurant Crousty | — |
| POST | `/sessions` | Créer une session → renvoie l'état + `participantToken` + `creatorToken` (une seule fois) | — |
| GET | `/sessions/:code` | État public de la session active | — |
| POST | `/sessions/join` | Rejoindre `{ code, name }` → `participantToken` | — |
| POST | `/sessions/:id/close` | Clôturer | Créateur |
| POST | `/sessions/:id/reopen` | Rouvrir | Créateur |
| GET | `/sessions/:id/orders` | Lister les commandes | — |
| POST | `/sessions/:id/orders` | Ajouter `{ targetName, productType, quantity, notes? }` | Participant |
| PATCH | `/orders/:id` | Modifier | Propriétaire ou créateur |
| DELETE | `/orders/:id` | Supprimer | Propriétaire ou créateur |
| POST | `/sessions/:id/participations` | S'inscrire / changer son choix `{ choice, notes? }` | Participant |
| DELETE | `/sessions/:id/participations/:participantId` | Se retirer / retirer quelqu'un | Soi-même ou créateur |

Erreurs : `{ "error": { "code": "SESSION_CLOSED", "message": "…" } }` avec les statuts 400 / 401 / 403 / 404 / 409 / 429 / 500.

---

## ⚡ Événements temps réel

Le client émet `session:join { sessionId }` (accusé de réception = état complet) puis écoute :

`session:joined` · `session:updated` · `session:closed` · `session:reopened` · `participant:joined` · `participant:left` · `order:created` · `order:updated` · `order:deleted` · `participation:updated`

Chaque événement transporte `{ state, actor, data }` où `state` est l'état public complet (avec un numéro de `revision` pour ignorer un état reçu en retard). À chaque reconnexion (ou retour au premier plan sur mobile), le client rejoint à nouveau la room et récupère l'état à jour.

---

## 🔐 Sécurité et permissions

- **Pas de compte** : à la création, le serveur génère un **jeton de gestion secret** (256 bits) donné uniquement au créateur ; chaque participant reçoit son propre jeton. Seules les **empreintes SHA-256** sont stockées, comparées en temps constant, et **jamais renvoyées** par l'API.
- Les jetons sont conservés dans le `localStorage` du navigateur ; on retrouve donc son identité après un rechargement, mais pas sur un autre appareil.
- Toutes les entrées sont validées par **Zod** (`strict` : champs inconnus refusés) ; Prisma utilise des requêtes paramétrées.
- Clôture vs écriture concurrente : chaque écriture verrouille la ligne de session (`FOR SHARE`), la clôture attend donc la fin des écritures en cours.
- **Helmet**, **CORS** restreint (même origine en production), **rate limiting** global et renforcé sur la création de sessions, corps JSON limité à 10 ko, `trust proxy` configurable.
- Nginx : CSP stricte (`script-src 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

---

## 📱 Progressive Web App

- Manifest (nom, icônes standard + *maskable*, `display: standalone`, couleurs, raccourcis), `apple-touch-icon` et balises iOS.
- Service worker Angular : l'interface (JS, CSS, polices, images) est mise en cache pour un démarrage instantané ; **aucune réponse d'API n'est mise en cache** (les commandes nécessitent Internet).
- **Installation** : Android/Chrome → menu ⋮ → *Installer l'application* ; iPhone/Safari → bouton Partager → *Sur l'écran d'accueil*.
- L'installation PWA exige **HTTPS** en production (localhost est toléré en dev).

---

## 🚀 Déploiement en production (HTTPS)

Le conteneur Nginx écoute en HTTP. Place devant lui un proxy TLS, par exemple **Caddy** (certificats Let's Encrypt automatiques) :

```
# Caddyfile
crousty.mondomaine.fr {
    reverse_proxy localhost:8080
}
```

Dans ce cas, mets `TRUST_PROXY=2` dans `.env` (Caddy + Nginx) pour que le rate limiting voie la vraie IP. Traefik, Cloudflare Tunnel ou un Nginx hôte avec Certbot fonctionnent aussi (penser à transmettre les en-têtes `Upgrade`/`Connection` pour les WebSockets).

---

## ⚠️ Limites connues

- L'identité est liée au navigateur : vider ses données ou changer de téléphone fait perdre ses droits (le créateur perd alors la possibilité de clôturer). Il suffit de rejoindre avec un autre pseudo pour continuer à participer.
- Une seule instance du backend est prévue (Socket.IO sans adaptateur Redis) — largement suffisant pour un usage entre amis.
- Les illustrations sont des SVG originaux ; tu peux les remplacer par de vraies photos dans `frontend/public/images/` (mêmes noms de fichiers).

---

## 🤝 Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licence

[MIT](LICENSE)
