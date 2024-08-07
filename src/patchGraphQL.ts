import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nodeModulesPath } from "./paths";

const path = join(nodeModulesPath, "graphql", "package.json");
const pkg = JSON.parse(readFileSync(path, "utf-8"));

const code = JSON.stringify(
  {
    ...pkg,
    exports: {
      ...pkg.exports,
      ".": {
        import: "./index.mjs",
        require: "./index.js",
        default: "./index.js",
      },
      "./*": {
        import: "./*.mjs",
        require: "./*.js",
        default: "./*.js",
      },
    },
  },
  null,
  2,
);

writeFileSync(path, code);
