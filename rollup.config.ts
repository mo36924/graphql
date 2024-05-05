import { readFileSync } from "node:fs";
import swc from "@rollup/plugin-swc";
import { defineConfig } from "rollup";
import { dts } from "rollup-plugin-dts";

const input = Object.fromEntries(
  Object.keys(JSON.parse(readFileSync("package.json", "utf-8")).exports)
    .map((name) => name.slice(2) || "index")
    .map((name) => [name, `./src/${name}.ts`]),
);

export default defineConfig([
  {
    input,
    output: {
      dir: "dist",
      format: "module",
      entryFileNames: "[name].js",
      chunkFileNames: "[name]-[hash].js",
      hoistTransitiveImports: false,
      generatedCode: { arrowFunctions: true, constBindings: true, objectShorthand: true },
    },
    plugins: [
      swc(),
      {
        name: "resolve",
        resolveId(source, importer) {
          if (source[0] === "." && !source.endsWith(".ts")) {
            return this.resolve(`${source}.ts`, importer);
          } else if (source === "graphql") {
            return { id: "graphql/index.mjs", external: true };
          } else if (source === "graphql/execution/execute") {
            return { id: "graphql/execution/execute.mjs", external: true };
          } else if (/^[@\w]/.test(source)) {
            return false;
          }
        },
      },
    ],
  },
  {
    input,
    output: {
      dir: "dist",
      format: "commonjs",
      entryFileNames: "[name].cjs",
      chunkFileNames: "[name]-[hash].cjs",
      hoistTransitiveImports: false,
      generatedCode: { arrowFunctions: true, constBindings: true, objectShorthand: true },
    },
    plugins: [
      swc(),
      {
        name: "resolve",
        resolveId(source, importer) {
          if (source[0] === "." && !source.endsWith(".ts")) {
            return this.resolve(`${source}.ts`, importer);
          } else if (/^[@\w]/.test(source)) {
            return false;
          }
        },
      },
    ],
  },
  {
    input,
    output: { dir: "dist" },
    plugins: [dts()],
  },
]);
