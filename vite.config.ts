import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// O núcleo Python é carregado em tempo de execução pelo worker (não passa pelo bundler),
// então a pasta python/ é copiada como está para o build.
const copiarPython = {
  name: "copiar-python",
  closeBundle() {
    cpSync(resolve(__dirname, "python"), resolve(__dirname, "dist/python"), {
      recursive: true,
      filter: (origem: string) => !origem.includes("__pycache__"),
    });
  },
};

export default defineConfig({
  base: "./",
  plugins: [copiarPython],
  build: {
    target: "es2022",
    // o worker precisa ser um arquivo de verdade: ele localiza python/ pelo próprio endereço
    assetsInlineLimit: (arquivo: string) => (arquivo.endsWith("worker.js") ? false : undefined),
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        jogo: resolve(__dirname, "index.html"),
        laboratorio: resolve(__dirname, "laboratorio/index.html"),
      },
    },
  },
});
