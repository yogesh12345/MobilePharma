import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const previewRootRedirect: Plugin = {
  name: "preview-root-redirect",
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url === "/" || request.url === "/mobile-app") {
        response.writeHead(302, { Location: "/mobile-app/" });
        response.end();
        return;
      }
      next();
    });
  },
};

const previewApiTarget =
  process.env.MOBILEPHARMA_PREVIEW_API_TARGET || "http://127.0.0.1:8081";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), previewRootRedirect],
  preview: {
    proxy: {
      "^/(?!$|mobile-app(?:/|$))": {
        target: previewApiTarget,
        changeOrigin: true,
        headers: { Origin: new URL(previewApiTarget).origin },
      },
    },
  },
});
