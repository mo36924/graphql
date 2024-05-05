import { expect, it } from "vitest";
import { formatGraphQL } from "./format";

it("formatGraphQL", () => {
  expect(formatGraphQL("type User{id:ID!}")).toMatchInlineSnapshot(`
    "type User {
      id: ID!
    }
    "
  `);
});
