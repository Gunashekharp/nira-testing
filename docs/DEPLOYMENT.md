# Deployment Guide

## Recommended hosting path

Use the current frontend as a static app for previews, and keep the final production deployment on a VM or container host.

- `Vercel`: best choice for quick previews and stakeholder reviews
- `GitHub Pages`: acceptable for static demo builds
- `AWS` or `Google Cloud` VM: best final option when you need the local Mongo state API, backend services, or full control over networking

## Important limitation

The frontend can run entirely on demo data, but `server/mongo-state-api.mjs` is a Node process. Static hosts do not run that process for you.

That means:

- `Vercel` and `GitHub Pages` work well for the current dummy-data workflow
- Mongo-backed runtime persistence should move to a real backend or VM-hosted service before final production

## Vercel deployment

This repository now includes a root `vercel.json`, so Vercel can build the frontend directly from the repo root.

Steps:

1. Import the GitHub repository into Vercel.
2. Keep the default root at the repository root.
3. Add any frontend environment variables you need:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GUNA_EMR_BASE_URL`
   - `VITE_CDSS_BASE_URL`
   - `VITE_MONGO_STATE_API_URL` only if that API is hosted elsewhere
4. Deploy.

Vercel will run the root build and serve the SPA with route rewrites enabled.

## GitHub Pages deployment

This repository now includes `.github/workflows/frontend-pages.yml`.

Steps:

1. Push the repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Run the `Deploy Frontend to GitHub Pages` workflow manually.

Notes:

- The workflow is configured for the repository name `Networked-Intelligence-for-Real-time-Ambulatory-Care`.
- If the repository name changes, update `VITE_APP_BASE_PATH` inside `.github/workflows/frontend-pages.yml`.
- GitHub Pages is for static demos only. It should not be the final host for Mongo-backed runtime features.

## VM deployment

For AWS or Google Cloud VMs, keep the frontend in this repository and point it at your backend service URLs through environment variables.

Use Nginx in front of the built frontend and APIs.

This repository already includes:

- `Dockerfile`
- `nginx.conf`

Suggested VM flow:

1. Build the frontend image or run `npm ci && npm run build`.
2. Serve the built `dist` folder through Nginx.
3. Run the Mongo state API as a separate Node service if you still need it.
4. Point `VITE_GUNA_EMR_BASE_URL`, `VITE_CDSS_BASE_URL`, and `VITE_MONGO_STATE_API_URL` to real service URLs.

## Pre-deploy check

Before every deploy:

```powershell
npm ci
npm run build
```
