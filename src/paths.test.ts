import { relative } from "node:path";
import { expect, test } from "vitest";
import { nodeModulesPath, rootpath, schemaPath } from "./paths";

const getRelativePath = (path: string) => relative(".", path);

test("rootpath", () => {
  expect(getRelativePath(rootpath)).toMatchInlineSnapshot(`""`);
});

test("nodeModulesPath", () => {
  expect(getRelativePath(nodeModulesPath)).toMatchInlineSnapshot(`"node_modules"`);
});

test("schemaPath", () => {
  expect(getRelativePath(schemaPath)).toMatchInlineSnapshot(`"schema.gql"`);
});
