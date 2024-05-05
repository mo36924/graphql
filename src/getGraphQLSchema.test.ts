import { relative } from "node:path";
import { expect, it } from "vitest";
import { getSchemaPath } from "./getGraphQLSchema";

it("getSchemaPath", () => {
  const path = relative(".", getSchemaPath());
  expect(path).toMatchInlineSnapshot(`"schema.gql"`);
});
