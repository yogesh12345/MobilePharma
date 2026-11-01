# PharmaSys Mobile

React mobile interface for PharmaSys. The same source can be built for a phone
browser as an installable PWA or packaged with Capacitor for Android and iOS.

## Browser build

```bash
npm ci
npm run build:web
```

For `mobile.meenaagencies.co.in`, use `npm run build:mobile-domain` and follow
[MOBILE_DOMAIN_DEPLOY.md](MOBILE_DOMAIN_DEPLOY.md). The older `build:web` target
serves the app at `/mobile-app/` on the API host; see [WEB_DEPLOY.md](WEB_DEPLOY.md).

## Local development

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 8082
```

Open `http://localhost:8082/`. Local development sends API requests through
Vite to the Go backend at `http://127.0.0.1:8081`. To use another local backend,
set `MOBILEPHARMA_DEV_API_TARGET` before starting Vite. The standard
`npm run build` still uses `.env` for Capacitor; `npm run build:web` uses
`.env.web` and the `/mobile-app/` base path.
