# PWA Deployment Setup

This project can run on iOS as a Progressive Web App. iPhone users open the HTTPS site in Safari and choose `Share` -> `Add to Home Screen`.

The workflow at `.github/workflows/pwa-deploy.yml` builds the Vite app and deploys `dist/` to GitHub Pages.

## GitHub Pages Setup

In the GitHub repository:

`Settings` -> `Pages` -> `Build and deployment` -> `Source` -> `GitHub Actions`

Then run:

`Actions` -> `PWA Deploy` -> `Run workflow`

The expected URL is:

`https://yogesh12345.github.io/MobilePharma/`

## Backend CORS Requirement

The PharmaSys backend must allow browser requests from the deployed PWA origin:

`https://yogesh12345.github.io`

At minimum, allow:

- Methods: `GET`, `POST`, `PUT`, `OPTIONS`
- Headers: `Content-Type`, `Authorization`
- Origin: `https://yogesh12345.github.io`

Local preview uses this origin instead:

`http://127.0.0.1:4173`

## Local Build Check

From the repo root:

```bash
npm ci
npm run build
```

## Commit and Push

```bash
git add index.html vite.config.ts src/main.tsx src/registerServiceWorker.ts public/manifest.webmanifest public/sw.js public/pwa-*.png .github/workflows/pwa-deploy.yml .github/PWA_DEPLOY_SETUP.md
git commit -m "Add iOS PWA support"
git push origin main
```

## iOS Install

On iPhone:

1. Open `https://yogesh12345.github.io/MobilePharma/` in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.
4. Launch `PharmaSys` from the Home Screen.

The first launch must be online. After that, the PWA shell and static assets are cached for faster repeat loads.
