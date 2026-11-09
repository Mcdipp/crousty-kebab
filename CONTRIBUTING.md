# Guide de contribution

Merci de vouloir améliorer **Crousty & Kebab** ! 🍗🌯

## Démarrer

1. Forke le dépôt puis crée une branche : `git checkout -b feat/ma-fonctionnalite`.
2. Installe et lance le projet en développement (voir le [README](README.md#-développement-local)).
3. Fais tes modifications **avec des tests**.

## Règles

- **TypeScript strict** partout, pas de `any` sauf dans les tests.
- Toute écriture passe par l'**API REST** (validation Zod → persistance → diffusion Socket.IO). Les sockets ne font que diffuser.
- Ne jamais exposer un jeton ni son empreinte dans une réponse publique.
- Textes de l'interface **en français**.
- Mobile first : vérifie ton changement sur un écran de 375 px de large.

## Avant d'ouvrir une Pull Request

```bash
cd backend  && npm run typecheck && npm test
cd frontend && npm run test:ci && npx ng build
```

## Messages de commit

Format conseillé ([Conventional Commits](https://www.conventionalcommits.org/fr/)) :
`feat: …`, `fix: …`, `docs: …`, `test: …`, `chore: …`.

## Signaler un bug

Ouvre une *issue* avec : étapes pour reproduire, comportement attendu, comportement observé, navigateur / téléphone utilisé.
