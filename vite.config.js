import { defineConfig } from "vite";

export default defineConfig({
  base: "/viteproject-of-reatail-pos-/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    target: "es2022",
  },
});