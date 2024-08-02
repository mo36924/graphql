import { extname } from "node:path";
import { transformSync } from "@babel/core";
import { Plugin } from "vite";
import babelPluginGraphQL from "./babelPluginGraphQL";

export const vitePluginGraphQL = (): Plugin => {
  const extnames = [".js", ".jsx", ".ts", ".tsx"];
  return {
    name: "graphql",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!extnames.includes(extname(id))) {
        return;
      }

      const result = transformSync(code, {
        babelrc: false,
        configFile: false,
        browserslistConfigFile: false,
        filename: id,
        sourceMaps: true,
        parserOpts: { plugins: ["jsx", "typescript"] },
        plugins: [babelPluginGraphQL],
      });

      return { code: result?.code ?? undefined, map: result?.map ?? undefined };
    },
  };
};
