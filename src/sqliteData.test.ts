import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { buildSchema } from "./schema";
import { identifier } from "./sqlite";
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

test("buildSQLiteData", () => {
  const schema = buildSchema(model);
  const sqliteSchema = buildSQLiteSchema(schema);
  const sqliteData = buildSQLiteData(schema);
  const db = new Database(":memory:");
  db.exec(sqliteSchema);
  db.exec(sqliteData);
  const result = db.prepare<[], { name: string }>("select name from sqlite_schema where type = 'table'").all();

  const names = Object.fromEntries(
    result.map(({ name }) => [
      name,
      db.prepare<[], { length: number }>(`select count(*) as length from ${identifier(name)}`).all()[0].length,
    ]),
  );

  expect(names).toMatchInlineSnapshot(`
    {
      "Class": 3,
      "Club": 3,
      "ClubToUser": 27,
      "Profile": 9,
      "User": 9,
    }
  `);
});
