import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { defineConfig, type Plugin } from "vite";

function workerServiceWorkerPlugin(): Plugin {
  return {
    name: "worker-pwa-service-worker",
    apply: "build",
    generateBundle() {
      const sourcePath = resolve(__dirname, "src/worker-sw.ts");
      const source = readFileSync(sourcePath, "utf8");
      const output = transpileModule(source, {
        compilerOptions: {
          module: ModuleKind.ESNext,
          target: ScriptTarget.ES2022,
        },
      });

      this.emitFile({
        type: "asset",
        fileName: "worker-sw.js",
        source: output.outputText,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), workerServiceWorkerPlugin()],
});
