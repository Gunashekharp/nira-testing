# NIRA Frontend

This repository contains the NIRA Vite/React frontend used by patient, doctor, admin, and nurse workflows.

## Structure

- `src` - application routes, UI, feature modules, and tests
- `supabase` - database migrations and edge functions used by care-sync and snapshot persistence
- `.github/workflows` - review-build and GitHub Pages deployment workflows
- `docs/DEPLOYMENT.md` - deployment guidance for Vercel, GitHub Pages, and VM hosting

## Local development

```powershell
npm ci
npm run dev
```

Optional remote Supabase snapshot sync:

- set `VITE_SUPABASE_STATE_SNAPSHOT_KEY` to mirror the demo store into Supabase
- leave it empty to stay localStorage-only

## Deployment guidance

- Vercel is the easiest preview path for the current dummy-data frontend.
- GitHub Pages is supported for static demos and review links.
- A VM deployment on AWS or Google Cloud is the right final path when the frontend must talk to external backend services and you want full networking control.

Start with [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before connecting production infrastructure.
