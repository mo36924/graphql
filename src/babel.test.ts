import { transformSync } from "@babel/core";
import { expect, test } from "@jest/globals";
import { buildSchema } from "graphql";
import plugin, { Options } from "./babel";

test("babel", () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      user(id: ID!): User
    }
    type User {
      id: ID!
    }
  `);

  const code = transformSync("gql`{user(id:${'id'}){id}}`", { plugins: [[plugin, { schema } as Options]] })!.code;

  expect(code).toMatchInlineSnapshot(`
    "gql({
      query: \\"query($_0:ID!){user(id:$_0){id}}\\",
      variables: {
        _0: 'id'
      }
    });"
  `);
});
