import { expect, test } from "@jest/globals";
import { buildModel } from "./index";

const model = /* GraphQL */ `
  type User {
    name: String!
  }
`;

test("buildModel", () => {
  const { graphql, declaration } = buildModel(model);

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

  expect(declaration).toMatchInlineSnapshot(`
    "export {};
    declare global {
      namespace GraphQL {
        type Date = globalThis.Date;
        type UUID = string;
        type JSON = any;
        type Int = number;
        type String = string;
        type ID = string;
        type Float = number;
        type Boolean = boolean;
        type Order = \\"asc\\" | \\"desc\\";
        type CreateData = { user?: CreateDataUser | null; users?: CreateDataUser[] | null };
        type UpdateData = { user?: UpdateDataUser | null; users?: UpdateDataUser[] | null };
        type DeleteData = { user?: DeleteDataUser | null; users?: DeleteDataUser[] | null };
        type CreateDataUser = { name: string };
        type UpdateDataUser = { id: string; version: string; name?: string | null };
        type DeleteDataUser = { id: string; version: string };
        type WhereUser = {
          id?: WhereUUID | null;
          version?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          name?: WhereString | null;
          and?: WhereUser | null;
          or?: WhereUser | null;
          not?: WhereUser | null;
        };
        type WhereID = {
          eq?: string | null;
          ne?: string | null;
          gt?: string | null;
          lt?: string | null;
          ge?: string | null;
          le?: string | null;
          in?: string[] | null;
          like?: string | null;
        };
        type WhereInt = {
          eq?: number | null;
          ne?: number | null;
          gt?: number | null;
          lt?: number | null;
          ge?: number | null;
          le?: number | null;
          in?: number[] | null;
          like?: string | null;
        };
        type WhereFloat = {
          eq?: number | null;
          ne?: number | null;
          gt?: number | null;
          lt?: number | null;
          ge?: number | null;
          le?: number | null;
          in?: number[] | null;
          like?: string | null;
        };
        type WhereString = {
          eq?: string | null;
          ne?: string | null;
          gt?: string | null;
          lt?: string | null;
          ge?: string | null;
          le?: string | null;
          in?: string[] | null;
          like?: string | null;
        };
        type WhereBoolean = { eq?: boolean | null; ne?: boolean | null };
        type WhereDate = {
          eq?: Date | null;
          ne?: Date | null;
          gt?: Date | null;
          lt?: Date | null;
          ge?: Date | null;
          le?: Date | null;
          in?: Date[] | null;
          like?: string | null;
        };
        type WhereUUID = {
          eq?: string | null;
          ne?: string | null;
          gt?: string | null;
          lt?: string | null;
          ge?: string | null;
          le?: string | null;
          in?: string[] | null;
          like?: string | null;
        };
        type WhereJSON = {
          eq?: any | null;
          ne?: any | null;
          gt?: any | null;
          lt?: any | null;
          ge?: any | null;
          le?: any | null;
          in?: any[] | null;
          like?: string | null;
        };
        type OrderUser = {
          id?: Order | null;
          version?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          name?: Order | null;
        };
      }
    }
    "
  `);
});
