import { expect, test } from "@jest/globals";
import { buildModel } from "./index";

const model = /* GraphQL */ `
  type User {
    name: String!
  }
`;

test("buildModel", () => {
  const { graphql } = buildModel(model);

  expect(graphql).toMatchInlineSnapshot(`
    "scalar Date

    scalar UUID

    scalar JSON

    directive @join on OBJECT

    directive @unique on FIELD_DEFINITION

    directive @key(name: String!) on FIELD_DEFINITION

    directive @ref(name: String!) on FIELD_DEFINITION

    directive @field(name: String!, key: String!) on FIELD_DEFINITION

    directive @type(name: String!, keys: [String!]!) on FIELD_DEFINITION

    type Query {
      user(where: WhereUser, order: OrderUser, offset: Int): User
      users(where: WhereUser, order: OrderUser, limit: Int, offset: Int): [User!]!
    }

    type Mutation {
      create(data: CreateData!): Query!
      update(data: UpdateData!): Query!
      delete(data: DeleteData!): Query!
      read: Query!
    }

    type User {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      name: String!
    }

    input CreateData {
      user: CreateDataUser
      users: [CreateDataUser!]
    }

    input UpdateData {
      user: UpdateDataUser
      users: [UpdateDataUser!]
    }

    input DeleteData {
      user: DeleteDataUser
      users: [DeleteDataUser!]
    }

    input CreateDataUser {
      name: String!
    }

    input UpdateDataUser {
      id: UUID!
      version: UUID!
      name: String
    }

    input DeleteDataUser {
      id: UUID!
      version: UUID!
    }

    input WhereUser {
      id: WhereUUID
      version: WhereUUID
      createdAt: WhereDate
      updatedAt: WhereDate
      name: WhereString
      and: WhereUser
      or: WhereUser
      not: WhereUser
    }

    input WhereID {
      eq: ID
      ne: ID
      gt: ID
      lt: ID
      ge: ID
      le: ID
      in: [ID]
      like: String
    }

    input WhereInt {
      eq: Int
      ne: Int
      gt: Int
      lt: Int
      ge: Int
      le: Int
      in: [Int]
      like: String
    }

    input WhereFloat {
      eq: Float
      ne: Float
      gt: Float
      lt: Float
      ge: Float
      le: Float
      in: [Float]
      like: String
    }

    input WhereString {
      eq: String
      ne: String
      gt: String
      lt: String
      ge: String
      le: String
      in: [String]
      like: String
    }

    input WhereBoolean {
      eq: Boolean
      ne: Boolean
    }

    input WhereDate {
      eq: Date
      ne: Date
      gt: Date
      lt: Date
      ge: Date
      le: Date
      in: [Date]
      like: String
    }

    input WhereUUID {
      eq: UUID
      ne: UUID
      gt: UUID
      lt: UUID
      ge: UUID
      le: UUID
      in: [UUID]
      like: String
    }

    input WhereJSON {
      eq: JSON
      ne: JSON
      gt: JSON
      lt: JSON
      ge: JSON
      le: JSON
      in: [JSON]
      like: String
    }

    input OrderUser {
      id: Order
      version: Order
      createdAt: Order
      updatedAt: Order
      name: Order
    }

    enum Order {
      asc
      desc
    }
    "
  `);
});
