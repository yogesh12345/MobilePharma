# Deploy to mobile.meenaagencies.co.in

This hostname serves the mobile app at `/`. The existing `build:web` target is
for the older `/mobile-app/` path on the API host; use the dedicated target here.

The deployment ZIP in `release/MobilePharma-mobile-domain-2026-11-01-item-search.zip`
contains a ready-built `dist/` plus a `source/` directory. On Linux, extract it
first. Run `npm` only from `source/`, where `package.json` is located; the top
level of the extracted bundle has no `package.json`.

The ZIP contains the frontend only. The customer name and address come from the
authenticated `GET /mobile/profile` response and, for linked registrations,
`GET /mobile/customer-portal/customer`. The latter reads the linked customer
record directly and supplies the header even when profile fields are blank.
For a linked registration, the
Go backend must include the current `customerProfileResponse` implementation
from `D:/Backend/controllers/customerProfileSync.go`, which projects those
fields from the linked customer row. Deploy and restart the Go backend using
its existing server procedure before checking the header. A frontend build
alone cannot fill a customer name absent from the API response.

The Companies item list requests current closing stock from
`GET /mobile/stock/current/:itemId`, with a fallback to the existing
`GET /stock/current/:itemId` route when the mobile route is absent. Deploy
the current Go backend `routes/protected.go` and
`middleware/customer_portal.go` to enable the protected mobile route, or add
`stock` to the API proxy location in the live Nginx configuration so the
fallback reaches the existing Go route. The `deploy/` examples include this
proxy change. The production route must return JSON; a 200 HTML app page
means Nginx is still serving the SPA instead of forwarding the request.

For the currently deployed frontend, the fastest stock fix is the dedicated
`/mobile/stock/current/` rewrite in `deploy/nginx-pharma-server-8082.conf`.
Place it before the general `/mobile/` API location in the live Nginx server
block, test the configuration, and reload Nginx. This forwards the current
frontend's request to the already running Go `/stock/current/` handler, so a
frontend rebuild is not required for this specific stock fix.

## Account-access API requirement

The current app requires `GET /mobile/access`. If the app opens but shows an
account-access error, check the public endpoint without a token:

```bash
curl -i https://mobile.meenaagencies.co.in/mobile/access
curl -i https://back.meenaagencies.co.in/mobile/access
```

An existing protected route returns **401 with JSON** (`Token required`).
A **404 on both hosts**, while `/me` returns 401 JSON, means the running API
has no account-access route. Updating Nginx or clearing the phone cache will
not add that route. A 200 HTML response indicates the API request is reaching
the SPA fallback instead of Go.

Before publishing this frontend:

1. Deploy the complete current Go backend source, including the mobile access
   models, services, migrations, controllers, middleware, routes, and updated
   `config/database.go`. Copying only `routes/protected.go` is insufficient.
2. Follow the existing backend release procedure to rebuild and restart the
   configured Go service. Its startup runs `MigrateMobileAccess`; confirm it
   completes successfully. See `D:/Backend/docs/mobile-account-access.md`
   for the migration and rollout requirements, including the database backup.
3. Confirm `/mobile/access` now returns 401 JSON without a token on both hosts.
   From this frontend source directory, run `npm run check:backend`.
4. Use **Our Organization > Mobile User Review** in the updated main web app
   to review existing external accounts and assign their customer access.
5. Have the user sign in again and verify the authenticated `/mobile/access`
   request returns 200 JSON with `account`, `user`, and `customers`.

`scripts/deploy-mobile-domain.sh` checks this required protected route before
building or copying app files. This check detects a missing route; it does not
replace authenticated verification of database migrations and assignments.
The deployment bundle is frontend-only and cannot update the Go service.

## Build

```bash
npm ci
npm run build:mobile-domain
```

Copy the **contents** of `dist/` to `/var/www/mobilepharma/` on the HTTPS host.
The generated `index.html` must refer to `/assets/...`, `/manifest.webmanifest`,
and `/sw.js`, with no `/mobile-app/` prefix.

## Current pharma-server setup

The public HTTPS proxy forwards the mobile hostname to the existing Nginx
listener on port 8082. That listener is configured in
`/etc/nginx/sites-enabled/mobile-app`; use
`deploy/nginx-pharma-server-8082.conf` as its server block. Its document root is
`/var/www/mobilepharma`, and its API routes proxy to the local Go backend on
port 8081. From the extracted `source/` directory, deploy the build with:

```bash
sh scripts/deploy-mobile-domain.sh
```

The script runs `npm ci`, TypeScript, and Vite directly with the `/` base path,
then copies `dist/` to
`/var/www/mobilepharma/`. Nginx does not need a reload when only the static app
files change.

If using the existing Go backend without the new mobile stock route, update
`/etc/nginx/sites-enabled/mobile-app` so its API location regex includes
`stock` (as in `deploy/nginx-pharma-server-8082.conf`). Then run
`sudo nginx -t` and `sudo systemctl reload nginx`. This configuration change
is required for current stock; copying `dist/` alone cannot fix it.

The browser uses the mobile hostname for both app files and API requests, so
browser CORS is not needed for the current proxy route. A test POST to `/login`
with invalid credentials returned the expected JSON HTTP 401 on 31 October
2026. If a later proxy change forwards an Origin header that the backend denies,
add `https://mobile.meenaagencies.co.in` to the backend's `CORS_ALLOW_ORIGINS`.

## Alternative direct HTTPS Nginx setup

1. Point the `mobile.meenaagencies.co.in` DNS record at the HTTPS web server and
   ensure its TLS certificate covers this hostname.
2. Add the locations in `deploy/nginx-mobile-domain.conf` to that hostname's
   HTTPS Nginx/OpenResty server block. Adapt the `root` path if needed. The API
   routes proxy to the existing `back.meenaagencies.co.in` service; the app files
   are served locally. If the web server and Go backend are on the same machine,
   `http://127.0.0.1:8081` can be used as the API proxy target instead.
3. Add `https://mobile.meenaagencies.co.in` to the backend's
   `CORS_ALLOW_ORIGINS` alongside existing origins, then restart the backend.
   Keep `REQUIRE_DESKTOP_SHELL_PROOF` disabled for ordinary browser access.
4. Check the server configuration and reload it:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If using a hosting control panel instead of editing Nginx directly, configure
the same document root, API proxy routes, HTTPS certificate, and cache behavior
there. Do not serve the Vite development process on port 8082 publicly.

## Verify

```bash
curl -I https://mobile.meenaagencies.co.in/
curl -I https://mobile.meenaagencies.co.in/manifest.webmanifest
curl https://mobile.meenaagencies.co.in/api/health
curl -i https://mobile.meenaagencies.co.in/stock/current/1
```

The health request should return the Go API's JSON, not the app's `index.html`
or a 404. Open the site in a private browser window, sign in, and check that
scripts, styles, login, and a PDF request load on the mobile hostname. Then
check installation from a phone over HTTPS.

For a linked customer login, inspect the authenticated `/mobile/profile`
response in browser Network tools. `profile.status` should be `LINKED`, and
`profile.customerName` and `profile.addressLine1` should contain the linked
customer's data. If those fields are blank, verify the deployed Go backend
version and the linked `customerId` before troubleshooting the frontend.
