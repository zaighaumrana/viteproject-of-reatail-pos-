import { defineConfig } from "vite";

export default defineConfig({
  base: "/viteproject-of-reatail-pos-/",     // ← Must match your repo name
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});