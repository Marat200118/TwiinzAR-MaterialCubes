import { defineConfig } from "vite";
import { resolve } from "path";


export default defineConfig({
  root: "src/",
  build: {
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "/index.html"),
        marius: resolve(__dirname, "/marius.html"),
        dome: resolve(__dirname, "/dome.html"),
      },
    },
  },
  server: {
    cors: true,
  },
});
