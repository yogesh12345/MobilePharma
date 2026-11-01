import { pathToFileURL } from "node:url";

export async function checkMobileBackend(baseURL, request = fetch) {
  const url = new URL("/mobile/access", baseURL);
  const response = await request(url, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error",
  });
  const isJSON = (response.headers.get("content-type") ?? "").includes("application/json");
  if (response.status === 401 && isJSON) {
    const body = await response.json();
    if (typeof body?.error === "string") return;
  }
  throw new Error(`${url} returned HTTP ${response.status}${isJSON ? "" : " without JSON"}. Deploy and restart the updated Go backend, confirm its mobile-access migration succeeds, and check the API proxy before publishing this app.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkMobileBackend(process.env.MOBILEPHARMA_PUBLIC_URL || "https://mobile.meenaagencies.co.in");
    console.log("The protected /mobile/access route is available. Check authenticated access after deployment.");
  } catch (error) {
    console.error(`MobilePharma backend check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
