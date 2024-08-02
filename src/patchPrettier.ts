import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nodeModulesPath } from "./paths";

for (const extension of ["js", "mjs"]) {
  const src = join(nodeModulesPath, "prettier", "plugins", `estree.${extension}`);
  const dest = `${src}_`;

  if (!existsSync(dest)) {
    copyFileSync(src, dest);
  }

  const code = readFileSync(dest, "utf-8");

  const printEmbedGraphQLFunctionName = code
    .slice(code.lastIndexOf("function", code.indexOf('parser:"graphql"')))
    .match(/function (.*?)\(/)![1];

  const printEmbedCssFunctionName = code
    .slice(code.lastIndexOf("function", code.indexOf('parser:"scss"')))
    .match(/function (.*?)\(/)![1];

  const replacePlaceholdersFunctionName = code
    .slice(code.indexOf("function", code.indexOf('parser:"scss"')))
    .match(/function (.*?)\(/)![1];

  const patchedCode = code
    .replace(`function ${printEmbedGraphQLFunctionName}`, () => `function _${printEmbedGraphQLFunctionName}`)
    .replace(
      new RegExp(
        `async function ${printEmbedCssFunctionName}.*?function ${replacePlaceholdersFunctionName}.*?(?=function)`,
      ),
      (match) =>
        match +
        match
          .replace(printEmbedCssFunctionName, () => printEmbedGraphQLFunctionName)
          .replace("scss", "graphql")
          .replaceAll(replacePlaceholdersFunctionName, () => `_${replacePlaceholdersFunctionName}`)
          .replaceAll("/@", "/\\$")
          .replaceAll("@", "$")
          .replaceAll("-", "_"),
    );

  writeFileSync(src, patchedCode);
}
