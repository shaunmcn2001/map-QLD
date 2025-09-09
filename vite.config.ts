import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from "path";

// GitHub Pages repo name
const REPO = "map-QLD";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") }
  },
  // IMPORTANT for GitHub Project Pages
  base: `/${REPO}/`,
});
