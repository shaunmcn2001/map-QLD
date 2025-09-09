import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

const REPO = "map-QLD";
const isPages = process.env.BUILD_TARGET === "pages";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  base: isPages ? `/${REPO}/` : "/",
});
