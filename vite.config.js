import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const basePath = process.env.VITE_APP_BASE_PATH || "/";

export default defineConfig({
  base: basePath.endsWith("/") ? basePath : `${basePath}/`,
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: resolve(__dirname, "src/tests/setup.js")
  }
});
