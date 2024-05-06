import { relative } from "node:path";
import { expect, it } from "vitest";
import { nodeModulesPath, rootpath, schemaPath } from "./paths";

const getRelativePath = (path: string) => relative(".", path);

it("rootpath", () => {
  expect(getRelativePath(rootpath)).toMatchInlineSnapshot(`""`);
});

it("nodeModulesPath", () => {
  expect(getRelativePath(nodeModulesPath)).toMatchInlineSnapshot(`"node_modules"`);
});

it("schemaPath", () => {
  expect(getRelativePath(schemaPath)).toMatchInlineSnapshot(`"schema.gql"`);
});
