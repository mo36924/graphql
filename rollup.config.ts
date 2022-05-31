import typescript from "@rollup/plugin-typescript";
import { Plugin, RollupOptions, defineConfig } from "rollup";
import dts from "rollup-plugin-dts";

const input = Object.fromEntries(
  ["babel", "buildASTSchema", "config", "index", "json", "query", "schema"].map((name) => [name, `./src/${name}.ts`]),
);

const ts = typescript();

const resolve: Plugin = {
  name: "resolve",
  resolveId(id) {
    if (id === "graphql") {
      return { id: "graphql/index.mjs", external: true };
    }

    if (id.startsWith("graphql/")) {
      return { id: `${id}.mjs`, external: true };
    }

    if (/^[@\w]/.test(id)) {
      return { id, external: true };
    }
  },
};

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
    plugins: [ts, resolve],
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
  ...["buildASTSchema", "json", "query"].flatMap<RollupOptions>((name) => [
    {
      input: `./src/${name}.ts`,
      output: { file: `./dist/${name}.mjs`, sourcemap: true, generatedCode: "es2015" },
      treeshake: "smallest",
      plugins: [ts, resolve],
    },
    {
      input: `./src/${name}.ts`,
      output: {
        file: `./dist/${name}.cjs`,
        sourcemap: true,
        generatedCode: "es2015",
        format: "commonjs",
        exports: "auto",
      },
      treeshake: "smallest",
      external: /^[@\w]/,
      plugins: [ts],
    },
  ]),
  {
    input,
    output: { dir: "dist" },
    plugins: [dts()],
  },
]);
