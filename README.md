# NIRA Frontend

This repository contains the NIRA Vite/React frontend used by patient, doctor, admin, and nurse workflows.

## Structure

- `src` - application routes, UI, feature modules, and tests
- `db` - Mongo setup scripts and seed data used by local tooling
- `server` - optional local Mongo-backed state bridge
- `.github/workflows` - review-build and GitHub Pages deployment workflows
- `docs/DEPLOYMENT.md` - deployment guidance for Vercel, GitHub Pages, and VM hosting

## Local development

```powershell
npm ci
npm run dev
```

Optional local Mongo-backed state bridge:

```powershell
npm run mongo:api
```

The frontend still works with demo data when `VITE_MONGO_STATE_API_URL` is not configured.

## Deployment guidance

- Vercel is the easiest preview path for the current dummy-data frontend.
- GitHub Pages is supported for static demos and review links.
- A VM deployment on AWS or Google Cloud is the right final path when the frontend must talk to the local Mongo state API and external backend services.

Start with [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before connecting production infrastructure.
