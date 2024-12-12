import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src/", // The source folder is your root
  build: {
    outDir: "../dist", // Output to a directory outside src
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"), // Adjust paths to include 'src'
        marius: resolve(__dirname, "src/marius.html"),
        dome: resolve(__dirname, "src/dome.html"),
      },
    },
  },
  server: {
    cors: true,
  },
});
