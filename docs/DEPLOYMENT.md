# Deployment Guide

## Recommended hosting path

Use the current frontend as a static app for previews, and keep the final production deployment on a VM or container host.

- `Vercel`: best choice for quick previews and stakeholder reviews
- `GitHub Pages`: acceptable for static demo builds
- `AWS` or `Google Cloud` VM: best final option when you need backend services or full control over networking

## Important limitation

The frontend can run entirely on demo data with localStorage only, or it can mirror the full demo-store snapshot through Supabase when `VITE_SUPABASE_STATE_SNAPSHOT_KEY` is configured.

That means:

- `Vercel` and `GitHub Pages` work well for the current dummy-data workflow
- Supabase-backed snapshot persistence works on static hosts as long as the Supabase frontend vars are set

## Vercel deployment

This repository now includes a root `vercel.json`, so Vercel can build the frontend directly from the repo root.

Steps:

1. Import the GitHub repository into Vercel.
2. Keep the default root at the repository root.
3. Add any frontend environment variables you need:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STATE_SNAPSHOT_KEY` if you want remote demo-state persistence
   - `VITE_GUNA_EMR_BASE_URL` if EMR APIs live on a different origin
   - `VITE_CDSS_BASE_URL` if CDSS APIs live on a different origin
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
- GitHub Pages is for static demos only. It can still use Supabase-backed snapshot persistence when the necessary vars are configured.

## VM deployment

For AWS or Google Cloud VMs, keep the frontend in this repository and point it at your backend service URLs through environment variables.

Use Nginx in front of the built frontend and APIs.

This repository already includes:

- `Dockerfile`
- `nginx.conf`

Suggested VM flow:

1. Build the container image or run `npm ci && npm run build`.
2. Run Nginx together with the bundled converter-agent. This repo now proxies:
   - `/api/*` -> local converter-agent on port `3001`
   - `/cdss/*` -> local converter-agent on port `3001`
3. Point `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_STATE_SNAPSHOT_KEY` to your real Supabase project.
4. Leave `VITE_GUNA_EMR_BASE_URL` and `VITE_CDSS_BASE_URL` empty if you want same-origin proxying through Nginx, or set them only when those services live on a different HTTPS origin.

This same-origin proxy path avoids mixed-protocol errors such as sending `http://` requests to an HTTPS-only Nginx port.

## Supabase edge function

If you want full Supabase sync instead of local-only fallback, also deploy the `care-sync` edge function before using production workflows that persist encounters, prescriptions, interviews, or snapshots.

Typical command:

```powershell
supabase functions deploy care-sync
```

## Pre-deploy check

Before every deploy:

```powershell
npm ci
npm run build
```
