import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { buildContext } from "./buildContext";
import { buildSchema } from "./schema";
import { buildQuery } from "./sqlite";
import { buildSQLiteData } from "./sqliteData";
import { buildSQLiteSchema } from "./sqliteSchema";

const model = /* GraphQL */ `
  type User {
    name: String!
    profile: Profile
    class: Class!
    clubs: [Club!]!
  }

  type Profile {
    age: Int
  }

  type Class {
    name: String!
    users: [User!]!
  }

  type Club {
    name: String!
    users: [User!]!
  }
`;

it("buildQuery", () => {
  const schema = buildSchema(model);
  const sqliteSchema = buildSQLiteSchema(schema);
  const sqliteData = buildSQLiteData(schema);
  const db = new Database(":memory:");
  db.exec(sqliteSchema);
  db.exec(sqliteData);
  const context = buildContext(new Request("http://example.com"), schema, {
    query: "{users(limit: 2){id name class{name}}}",
  });
  const query = buildQuery(context);
  const result = db.prepare<object[], { data: string }>(query).all()[0].data;
  expect(JSON.parse(result)).toMatchInlineSnapshot(`
    {
      "users": [
        {
          "class": {
            "name": "name-1",
          },
          "id": "00000000-0000-4000-a000-000300000001",
          "name": "name-1",
        },
        {
          "class": {
            "name": "name-2",
          },
          "id": "00000000-0000-4000-a000-000300000002",
          "name": "name-2",
        },
      ],
    }
  `);
});
