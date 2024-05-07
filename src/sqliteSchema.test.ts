import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { buildSchema } from "./schema";
import { buildSQLiteSchema } from "./sqliteSchema";
const db = new Database(":memory:");

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

it("sqliteSchema", () => {
  const schema = buildSchema(model);
  const sqliteSchema = buildSQLiteSchema(schema);
  expect(sqliteSchema).toMatchInlineSnapshot(`
    "create table "Class" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "name" text not null
    );
    create table "Club" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "name" text not null
    );
    create table "Profile" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "age" integer,
      "userId" blob
    );
    create table "User" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "classId" blob,
      "name" text not null
    );
    create table "ClubToUser" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "clubId" blob not null,
      "userId" blob not null
    );
    create unique index "Profile_userId" on "Profile" ("userId");
    create index "User_classId" on "User" ("classId");
    create index "ClubToUser_clubId" on "ClubToUser" ("clubId");
    create index "ClubToUser_userId" on "ClubToUser" ("userId");
    "
  `);

  db.exec(sqliteSchema);
  const result = db.prepare("select * from sqlite_schema").all();
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "name": "Class",
        "rootpage": 2,
        "sql": "CREATE TABLE "Class" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "name" text not null
    )",
        "tbl_name": "Class",
        "type": "table",
      },
      {
        "name": "sqlite_autoindex_Class_1",
        "rootpage": 3,
        "sql": null,
        "tbl_name": "Class",
        "type": "index",
      },
      {
        "name": "Club",
        "rootpage": 4,
        "sql": "CREATE TABLE "Club" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "name" text not null
    )",
        "tbl_name": "Club",
        "type": "table",
      },
      {
        "name": "sqlite_autoindex_Club_1",
        "rootpage": 5,
        "sql": null,
        "tbl_name": "Club",
        "type": "index",
      },
      {
        "name": "Profile",
        "rootpage": 6,
        "sql": "CREATE TABLE "Profile" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "age" integer,
      "userId" blob
    )",
        "tbl_name": "Profile",
        "type": "table",
      },
      {
        "name": "sqlite_autoindex_Profile_1",
        "rootpage": 7,
        "sql": null,
        "tbl_name": "Profile",
        "type": "index",
      },
      {
        "name": "User",
        "rootpage": 8,
        "sql": "CREATE TABLE "User" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "classId" blob,
      "name" text not null
    )",
        "tbl_name": "User",
        "type": "table",
      },
      {
        "name": "sqlite_autoindex_User_1",
        "rootpage": 9,
        "sql": null,
        "tbl_name": "User",
        "type": "index",
      },
      {
        "name": "ClubToUser",
        "rootpage": 10,
        "sql": "CREATE TABLE "ClubToUser" (
      "id" blob not null primary key,
      "createdAt" text not null,
      "updatedAt" text not null,
      "clubId" blob not null,
      "userId" blob not null
    )",
        "tbl_name": "ClubToUser",
        "type": "table",
      },
      {
        "name": "sqlite_autoindex_ClubToUser_1",
        "rootpage": 11,
        "sql": null,
        "tbl_name": "ClubToUser",
        "type": "index",
      },
      {
        "name": "Profile_userId",
        "rootpage": 12,
        "sql": "CREATE UNIQUE INDEX "Profile_userId" on "Profile" ("userId")",
        "tbl_name": "Profile",
        "type": "index",
      },
      {
        "name": "User_classId",
        "rootpage": 13,
        "sql": "CREATE INDEX "User_classId" on "User" ("classId")",
        "tbl_name": "User",
        "type": "index",
      },
      {
        "name": "ClubToUser_clubId",
        "rootpage": 14,
        "sql": "CREATE INDEX "ClubToUser_clubId" on "ClubToUser" ("clubId")",
        "tbl_name": "ClubToUser",
        "type": "index",
      },
      {
        "name": "ClubToUser_userId",
        "rootpage": 15,
        "sql": "CREATE INDEX "ClubToUser_userId" on "ClubToUser" ("userId")",
        "tbl_name": "ClubToUser",
        "type": "index",
      },
    ]
  `);
});
