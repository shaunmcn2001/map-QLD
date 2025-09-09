// vite.config.ts
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

const isPages = process.env.BUILD_TARGET === "pages"; // pages or render
const REPO = "map-QLD";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  base: isPages ? `/${REPO}/` : "/", // Render -> "/", GH Pages -> "/map-QLD/"
});
