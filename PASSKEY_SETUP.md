# Device sign-in setup

The login screen supports passkeys after a user enables one from **Menu → Device sign-in** while signed in. Setup asks for the current password once. Later sign-ins use the device's available verification method; the app never receives face, iris, or fingerprint data. Password sign-in remains available for recovery.

The Go backend in `D:\Backend` must be deployed before the new frontend. Its migration creates `mobile_passkeys` and `mobile_passkey_challenges` on startup. The backend defaults to the production mobile hostname when both passkey settings are absent. To override the domain, set both environment variables on the backend:

```text
PASSKEY_RP_ID=mobile.meenaagencies.co.in
PASSKEY_ORIGINS=https://mobile.meenaagencies.co.in
```

Use HTTPS in production. For local browser testing, set `PASSKEY_RP_ID=localhost` and `PASSKEY_ORIGINS=http://localhost:8082`, then restart the backend. A passkey created for localhost is separate from the production domain.

Verify the running backend with `curl https://mobile.meenaagencies.co.in/mobile/passkeys/availability`. It should return `{"available":true}` after the updated Go backend is deployed and restarted. If it returns `false`, check that both environment settings are either absent or valid; setting only one leaves passkeys unavailable. The frontend hides setup while the server is unavailable.

If `CORS_ALLOW_ORIGINS` is explicitly set on the backend, include `https://mobile.meenaagencies.co.in` there as well; the installed app calls the API on `back.meenaagencies.co.in`.

The installed Android and iOS apps also require association with `mobile.meenaagencies.co.in`:

Use the example files in `deploy/passkey-assetlinks.example.json` and `deploy/passkey-apple-app-site-association.example` as templates. Publish the completed files without the `.example` suffix. Do not publish placeholders.

1. Android: publish `https://mobile.meenaagencies.co.in/.well-known/assetlinks.json` with package `in.co.meenaagencies.pharmasys` and the **release signing certificate's SHA-256 fingerprint**. Add the Android app origin (`android:apk-key-hash:<base64url SHA-256 certificate hash>`) to `PASSKEY_ORIGINS`, separated by a comma. The release keystore referenced by this checkout is not present here, so its fingerprint still needs to be supplied.
2. iOS: sign the app with the Associated Domains entitlement in `ios/App/App/App.entitlements`. Publish `https://mobile.meenaagencies.co.in/.well-known/apple-app-site-association` with the Apple Team ID plus `in.co.meenaagencies.pharmasys` under `webcredentials.apps`. Add `capacitor://mobile.meenaagencies.co.in` to `PASSKEY_ORIGINS`. The Xcode project does not specify a Team ID, so this file cannot be finalized yet.
3. Rebuild and install the native apps after the domain files and backend are deployed. Test registration and sign-in on real devices. Android WebView needs a version that supports Web Authentication; unsupported devices can continue to use the password.

In mobile Chrome, the login page shows **Sign in with passkey** when the service is available. The browser opens its passkey chooser only after the user taps that button. The website cannot select a fingerprint or skip Chrome's credential confirmation. A passkey can also be removed from the Device sign-in screen.

For a private phone, select **Stay signed in on this phone** during login to reuse the existing server session for up to 30 days. The 10-minute browser idle sign-out still applies when this option is unchecked. Logout, server revocation, and token expiry end a remembered session. Anyone who can open Chrome on an unlocked phone can use a remembered session, so the phone's screen lock and access to enrolled fingerprints matter.

If passkey sign-in reports that the operation was not allowed, first confirm that **Set up passkey** completed successfully while signed in on the same mobile hostname. The availability endpoint only confirms server configuration; it does not mean a passkey has been enrolled on the phone. Sign in with a password, open **Menu → Device sign-in**, complete setup, then tap **Sign in with passkey** on the login screen. Cancelling the device prompt can produce the same browser error.
