# Elkchemy

Minimal Firebase Hosting smoke-test app.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build & Preview

```bash
npm run build
npm run preview
```

## Deploy

```bash
firebase deploy --only hosting --project elkchemy
```

## What this verifies

- Vite build pipeline works
- Firebase SDK initializes in the browser
- Browser JavaScript executes (click counter)

**Note:** SDK initialization confirms the config is accepted client-side. It does not verify database connectivity, authentication, or any backend service.
