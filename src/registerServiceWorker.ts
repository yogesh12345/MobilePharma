export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    // Preview builds can inherit a worker from an older local build. Remove it
    // so the next navigation loads the current files from the preview server.
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(
        registrations
          .filter((registration) => registration.scope.startsWith(`${window.location.origin}${import.meta.env.BASE_URL}`))
          .map((registration) => registration.unregister()),
      ),
    );
    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("pharmasys-pwa-")).map((key) => caches.delete(key)),
        ),
      );
    }
    return;
  }

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL;

    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .catch((error) => {
        console.info("Service worker registration failed", error);
      });
  });
}
