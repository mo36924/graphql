import { expect, test } from "vitest";
import { formatGraphQL } from "./format";

test("formatGraphQL", () => {
  expect(formatGraphQL("type User{id:ID!}")).toMatchInlineSnapshot(`
    "type User {
      id: ID!
    }
    "
  `);
});
