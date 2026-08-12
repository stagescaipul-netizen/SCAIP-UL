# StagePermit Digital

Base de projet Next.js 15 / TypeScript / TailwindCSS / Supabase.

## Installation

```bash
npm install
```

## Lancer en développement

```bash
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Configuration

Copier le fichier d'exemple puis renseigner les valeurs :

```bash
cp .env.example .env.local
```

Variables requises :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `NEXT_PUBLIC_APP_URL`

## Autres commandes

```bash
npm run build         # build de production
npm run start          # lancer le build de production
npm run lint            # ESLint
npm run format          # Prettier (écrit les fichiers)
npm run format:check    # Prettier (vérification uniquement)
npm run typecheck       # vérification TypeScript
```

## V23 — Signature et cachet

La migration `database/migrations/0024_authentification_documents.sql` ajoute deux modes d'authentification des PDF :

- `Signature + Cachet` : deux images séparées, superposées automatiquement dans le PDF.
- `Image combinée` : une image unique déjà composée.

Appliquer la migration 0024 dans Supabase avant d'utiliser la nouvelle interface d'identité institutionnelle.
