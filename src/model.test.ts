import { expect, it } from "vitest";
import { buildModel, fixModel } from "./model";

const model = /* GraphQL */ `
  type User {
    name: String!
    profile: Profile
    classes: Class!
    club: [Club]
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

it("fixModel", () => {
  expect(fixModel(model)).toMatchInlineSnapshot(`
    "type Class {
      name: String!
      users: [User!]!
    }

    type Club {
      name: String!
      users: [User!]!
    }

    type Profile {
      age: Int
    }

    type User {
      class: Class!
      clubs: [Club!]!
      name: String!
      profile: Profile
    }
    "
  `);
});

it("buildModel", () => {
  expect(buildModel(model)).toMatchInlineSnapshot(`
    "scalar Date

    scalar UUID

    scalar JSON

    directive @join on OBJECT

    directive @unique on FIELD_DEFINITION

    directive @key(name: String!) on FIELD_DEFINITION

    directive @ref(name: String!) on FIELD_DEFINITION

    directive @field(name: String!, key: String!) on FIELD_DEFINITION

    directive @type(name: String!, keys: [String!]!) on FIELD_DEFINITION

    type Class {
      id: UUID!
      createdAt: Date!
      updatedAt: Date!
      name: String!
      users: [User!]! @field(name: "class", key: "classId")
    }

    type Club {
      id: UUID!
      createdAt: Date!
      updatedAt: Date!
      name: String!
      users: [User!]! @type(name: "ClubToUser", keys: ["clubId", "userId"])
    }

    type Profile {
      id: UUID!
      createdAt: Date!
      updatedAt: Date!
      age: Int
      user: User @key(name: "userId")
      userId: UUID @ref(name: "User") @unique
    }

    type User {
      id: UUID!
      createdAt: Date!
      updatedAt: Date!
      class: Class @key(name: "classId")
      classId: UUID @ref(name: "Class")
      clubs: [Club!]! @type(name: "ClubToUser", keys: ["userId", "clubId"])
      name: String!
      profile: Profile @field(name: "user", key: "userId")
    }

    type ClubToUser @join {
      id: UUID!
      createdAt: Date!
      updatedAt: Date!
      clubId: UUID! @ref(name: "Club")
      userId: UUID! @ref(name: "User")
    }
    "
  `);
});
