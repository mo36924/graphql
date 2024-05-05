import { expect, it } from "vitest";
import { buildTypes, printTypes, sortTypes } from "./types";

const schema = /* GraphQL */ `
  type User {
    name: String!
    id: ID!
  }

  type Post {
    userId: String!
    id: ID!
    message: String!
  }
`;

it("buildTypes", () => {
  expect(buildTypes(schema)).toMatchInlineSnapshot(`
    {
      "Post": {
        "directives": {},
        "fields": {
          "id": {
            "directives": {},
            "list": false,
            "name": "id",
            "nullable": false,
            "scalar": true,
            "type": "ID",
          },
          "message": {
            "directives": {},
            "list": false,
            "name": "message",
            "nullable": false,
            "scalar": true,
            "type": "String",
          },
          "userId": {
            "directives": {},
            "list": false,
            "name": "userId",
            "nullable": false,
            "scalar": true,
            "type": "String",
          },
        },
        "name": "Post",
      },
      "User": {
        "directives": {},
        "fields": {
          "id": {
            "directives": {},
            "list": false,
            "name": "id",
            "nullable": false,
            "scalar": true,
            "type": "ID",
          },
          "name": {
            "directives": {},
            "list": false,
            "name": "name",
            "nullable": false,
            "scalar": true,
            "type": "String",
          },
        },
        "name": "User",
      },
    }
  `);
});

it("printTypes", () => {
  expect(printTypes(buildTypes(schema))).toMatchInlineSnapshot(`
    "type User {
      name: String!
      id: ID!
    }

    type Post {
      userId: String!
      id: ID!
      message: String!
    }
    "
  `);
});

it("sortTypes", () => {
  expect(printTypes(sortTypes(buildTypes(schema)))).toMatchInlineSnapshot(`
    "type Post {
      id: ID!
      message: String!
      userId: String!
    }

    type User {
      id: ID!
      name: String!
    }
    "
  `);
});
