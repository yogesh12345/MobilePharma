export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
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
