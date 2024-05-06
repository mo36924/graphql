import { readFileSync } from "node:fs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import swc from "@rollup/plugin-swc";
import { defineConfig } from "rollup";
import { dts } from "rollup-plugin-dts";
import shebang from "rollup-plugin-preserve-shebang";

const input = Object.fromEntries(
  Object.keys(JSON.parse(readFileSync("package.json", "utf-8")).exports)
    .map((name) => name.slice(2) || "index")
    .map((name) => [name, `./src/${name}.ts`]),
);

export default defineConfig([
  {
    input,
    output: [
      {
        dir: "dist",
        format: "module",
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        hoistTransitiveImports: false,
        generatedCode: { arrowFunctions: true, constBindings: true, objectShorthand: true },
      },
      {
        dir: "dist",
        format: "commonjs",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name]-[hash].cjs",
        hoistTransitiveImports: false,
        generatedCode: { arrowFunctions: true, constBindings: true, objectShorthand: true },
      },
    ],
    external: /^[@\w]/,
    plugins: [shebang(), nodeResolve({ extensions: [".ts"] }), swc()],
  },
  {
    input,
    output: { dir: "dist" },
    logLevel: "silent",
    plugins: [dts()],
  },
]);
