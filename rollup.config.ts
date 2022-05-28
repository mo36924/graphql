import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import dts from "rollup-plugin-dts";

const input = Object.fromEntries(
  ["buildASTSchema", "config", "index", "json", "schema"].map((name) => [name, `./src/${name}.ts`]),
);

const ts = typescript();

export default defineConfig([
  {
    input,
    output: {
      dir: "dist",
      sourcemap: true,
      entryFileNames: "[name].mjs",
      chunkFileNames: "[name]-[hash].mjs",
      generatedCode: "es2015",
      hoistTransitiveImports: false,
    },
    plugins: [
      ts,
      {
        name: "resolve",
        resolveId(source) {
          if (/^[@\w]/.test(source)) {
            return { id: `${source}${source.startsWith("graphql/") ? ".mjs" : ""}`, external: true };
          }
        },
      },
    ],
  },
  {
    input,
    output: {
      dir: "dist",
      sourcemap: true,
      entryFileNames: "[name].cjs",
      chunkFileNames: "[name]-[hash].cjs",
      generatedCode: "es2015",
      hoistTransitiveImports: false,
      format: "commonjs",
      exports: "auto",
    },
    external: /^[@\w]/,
    plugins: [ts],
  },
  {
    input,
    output: { dir: "dist" },
    plugins: [dts()],
  },
]);
