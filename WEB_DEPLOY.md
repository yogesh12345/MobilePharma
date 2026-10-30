# Browser deployment on the PharmaSys Linux server

The app already uses React and Vite. `npm run build:web` creates a browser and
installable PWA build under `dist/`. The Android and iOS projects remain usable.

## Test the built app on Windows 11

From PowerShell in `D:\MobilePharma`, with the local Go backend running on port
8081:

```powershell
$env:MOBILEPHARMA_PREVIEW_API_TARGET = "http://127.0.0.1:8081"
npm run preview -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/mobile-app/` on that computer. Opening the root
URL `http://127.0.0.1:4173/` redirects there. The preview server
forwards API requests to `http://127.0.0.1:8081`.

To test from a phone on the same Wi-Fi network, restart preview with LAN access:

```powershell
$env:MOBILEPHARMA_PREVIEW_API_TARGET = "http://127.0.0.1:8081"
npm run preview -- --host 0.0.0.0 --port 4173
```

Find the laptop's Wi-Fi IPv4 address with `ipconfig`, then open
`http://LAPTOP-IP:4173/mobile-app/` (including the final slash) in the phone
browser. Keep preview and the
Go backend running. If the phone cannot connect, check Windows Defender Firewall
and confirm that both devices
are on the same Wi-Fi network without client isolation. The Go API stays on the
laptop; preview forwards phone requests to it. The preview proxy sends the API's
origin to Go so its CORS middleware accepts the same-host flow.

If Windows classifies Wi-Fi as a Public network, an administrator can allow only
the local Wi-Fi subnet to reach preview:

```powershell
New-NetFirewallRule -DisplayName "MobilePharma Preview 4173" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -RemoteAddress 192.168.1.0/24 -Profile Public
```

Adjust the subnet if the laptop's Wi-Fi address changes. This rule is only for
local testing and can be removed afterward with
`Remove-NetFirewallRule -DisplayName "MobilePharma Preview 4173"`.

An HTTP LAN address is fine for browser testing, but installation and service
worker behavior require HTTPS (or localhost on the same device). Test those
features after deploying to the HTTPS server.

To use the existing HTTPS Go backend instead of a local Go process:

```powershell
$env:MOBILEPHARMA_PREVIEW_API_TARGET = "https://back.meenaagencies.co.in"
npm run preview -- --host 127.0.0.1 --port 4173
```

Close the preview with Ctrl+C. The environment variable affects only the
preview proxy; it does not change the already compiled browser files.
If switching between the local and HTTPS backends, stop preview and set the
variable explicitly before starting it again. A PowerShell environment variable
persists in that terminal until changed or removed.

## Host it alongside the API

Use the existing HTTPS API host, `back.meenaagencies.co.in`, and serve the app at
`https://back.meenaagencies.co.in/mobile-app/`. The browser build sends API
requests to the same host root (`/login`, `/me`, `/mobile/...`, `/so/...`, and
`/api/whatsapp/...`). The current Go/Gin backend in `D:\Backend` already
registers these routes, and the existing reverse proxy sends the host to that
Go service on `127.0.0.1:8081`. Keep that proxy behavior for all paths outside
`/mobile-app/`. The separate React/Vite desktop frontend on
`witty.meenaagencies.co.in` continues to use the same Go backend. No browser
CORS allowlist is needed for the mobile app's same-origin requests.

The Go backend has an optional `REQUIRE_DESKTOP_SHELL_PROOF` setting. It must be
disabled for ordinary handset browsers, or the backend must explicitly permit
browser requests; otherwise its middleware returns HTTP 403 before login and
other API routes are handled. Check this setting in the server environment if
the page loads but login fails with "Desktop launcher proof required".

On a build machine with Node.js and npm:

```bash
npm ci
npm run build:web
```

Copy the *contents* of `dist/` to `/var/www/mobile-app/` on the Linux server.
For example, when building on that server:

```bash
sudo mkdir -p /var/www/mobile-app
sudo rsync -a --delete dist/ /var/www/mobile-app/
```

Add the locations from `deploy/nginx-mobile-app.conf` **inside the existing HTTPS
server block for the API host**. Keep the API's current locations in place. Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Open `https://back.meenaagencies.co.in/mobile-app/` in a phone browser and sign
in. In Chrome, use **Install app** or **Add to Home screen**. In iPhone Safari,
use **Share → Add to Home Screen**. HTTPS is required for the service worker and
home screen installation. The app shell can load from cache after the first
visit; data operations still require the API connection.

## Verification

1. Open the URL on a phone. Confirm the login screen loads without missing icons
   or script errors.
2. Sign in and open the modules available to the account.
3. In browser developer tools, verify `/login` and `/me` use the same host and
   that `/mobile-app/sw.js` registers with scope `/mobile-app/`.
   The Go API should return its normal login response, not HTTP 403 from the
   desktop proof middleware.
4. After a later deployment, reload once to let the updated service worker take
   over; then confirm the latest screen is shown.

If the app must use a separate hostname instead, build with an appropriate
`VITE_API_BASE_URL` and configure the API's CORS policy for that exact HTTPS
origin. The same-host setup above is the default browser build.
