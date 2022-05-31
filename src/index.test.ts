import { expect, test } from "@jest/globals";
import { parse } from "graphql";
import { buildExecutionContext } from "graphql/execution/execute";
import { format } from "sql-formatter";
import { buildModel, buildQuery, isQuery } from "./index";

const symbol = Symbol();
const raw = (value: any) => ({ [symbol]: value });

expect.addSnapshotSerializer({
  test: (value: any) => typeof value?.[symbol] === "string",
  serialize: (value: any) => value[symbol],
});

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

const { graphql, declaration, schema } = buildModel(model);

const query = (query: string) => {
  if (typeof query !== "string") {
    throw new Error("Invalid SQL.");
  }

  const document = parse(query);
  const context = buildExecutionContext({ schema, document });

  if (!("schema" in context)) {
    throw context[0];
  }

  const result = buildQuery(context);
  const sql = isQuery(result) ? result[0] : result.map((queries) => queries[0]).join("");
  return raw(format(sql));
};

test("index", () => {
  expect(raw(graphql)).toMatchInlineSnapshot(`
    scalar Date

    scalar UUID

    scalar JSON

    directive @join on OBJECT

    directive @unique on FIELD_DEFINITION

    directive @key(name: String!) on FIELD_DEFINITION

    directive @ref(name: String!) on FIELD_DEFINITION

    directive @field(name: String!, key: String!) on FIELD_DEFINITION

    directive @type(name: String!, keys: [String!]!) on FIELD_DEFINITION

    type Query {
      class(where: WhereClass, order: OrderClass, offset: Int): Class
      classes(where: WhereClass, order: OrderClass, limit: Int, offset: Int): [Class!]!
      club(where: WhereClub, order: OrderClub, offset: Int): Club
      clubs(where: WhereClub, order: OrderClub, limit: Int, offset: Int): [Club!]!
      profile(where: WhereProfile, order: OrderProfile, offset: Int): Profile
      profiles(where: WhereProfile, order: OrderProfile, limit: Int, offset: Int): [Profile!]!
      user(where: WhereUser, order: OrderUser, offset: Int): User
      users(where: WhereUser, order: OrderUser, limit: Int, offset: Int): [User!]!
    }

    type Mutation {
      create(data: CreateData!): Query!
      update(data: UpdateData!): Query!
      delete(data: DeleteData!): Query!
      read: Query!
    }

    type Class {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      name: String!
      users(where: WhereUser, order: OrderUser, limit: Int, offset: Int): [User!]! @field(name: "class", key: "classId")
    }

    type Club {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      name: String!
      users(where: WhereUser, order: OrderUser, limit: Int, offset: Int): [User!]!
        @type(name: "ClubToUser", keys: ["clubId", "userId"])
    }

    type Profile {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      age: Int
      user(where: WhereUser): User @key(name: "userId")
      userId: UUID @ref(name: "User") @unique
    }

    type User {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      class(where: WhereClass): Class @key(name: "classId")
      classId: UUID @ref(name: "Class")
      clubs(where: WhereClub, order: OrderClub, limit: Int, offset: Int): [Club!]!
        @type(name: "ClubToUser", keys: ["userId", "clubId"])
      name: String!
      profile(where: WhereProfile): Profile @field(name: "user", key: "userId")
    }

    type ClubToUser @join {
      id: UUID!
      version: UUID!
      createdAt: Date!
      updatedAt: Date!
      clubId: UUID! @ref(name: "Club")
      userId: UUID! @ref(name: "User")
    }

    input CreateData {
      class: CreateDataClass
      classes: [CreateDataClass!]
      club: CreateDataClub
      clubs: [CreateDataClub!]
      profile: CreateDataProfile
      profiles: [CreateDataProfile!]
      user: CreateDataUser
      users: [CreateDataUser!]
    }

    input UpdateData {
      class: UpdateDataClass
      classes: [UpdateDataClass!]
      club: UpdateDataClub
      clubs: [UpdateDataClub!]
      profile: UpdateDataProfile
      profiles: [UpdateDataProfile!]
      user: UpdateDataUser
      users: [UpdateDataUser!]
    }

    input DeleteData {
      class: DeleteDataClass
      classes: [DeleteDataClass!]
      club: DeleteDataClub
      clubs: [DeleteDataClub!]
      profile: DeleteDataProfile
      profiles: [DeleteDataProfile!]
      user: DeleteDataUser
      users: [DeleteDataUser!]
    }

    input CreateDataClass {
      name: String!
      users: [CreateDataUser!]
    }

    input CreateDataClub {
      name: String!
      users: [CreateDataUser!]
    }

    input CreateDataProfile {
      age: Int
      user: CreateDataUser
    }

    input CreateDataUser {
      class: CreateDataClass
      clubs: [CreateDataClub!]
      name: String!
      profile: CreateDataProfile
    }

    input UpdateDataClass {
      id: UUID!
      version: UUID!
      name: String
      users: [UpdateDataUser!]
    }

    input UpdateDataClub {
      id: UUID!
      version: UUID!
      name: String
      users: [UpdateDataUser!]
    }

    input UpdateDataProfile {
      id: UUID!
      version: UUID!
      age: Int
      user: UpdateDataUser
    }

    input UpdateDataUser {
      id: UUID!
      version: UUID!
      class: UpdateDataClass
      clubs: [UpdateDataClub!]
      name: String
      profile: UpdateDataProfile
    }

    input DeleteDataClass {
      id: UUID!
      version: UUID!
      users: [DeleteDataUser!]
    }

    input DeleteDataClub {
      id: UUID!
      version: UUID!
      users: [DeleteDataUser!]
    }

    input DeleteDataProfile {
      id: UUID!
      version: UUID!
      user: DeleteDataUser
    }

    input DeleteDataUser {
      id: UUID!
      version: UUID!
      class: DeleteDataClass
      clubs: [DeleteDataClub!]
      profile: DeleteDataProfile
    }

    input WhereClass {
      id: WhereUUID
      version: WhereUUID
      createdAt: WhereDate
      updatedAt: WhereDate
      name: WhereString
      and: WhereClass
      or: WhereClass
      not: WhereClass
    }

    input WhereClub {
      id: WhereUUID
      version: WhereUUID
      createdAt: WhereDate
      updatedAt: WhereDate
      name: WhereString
      and: WhereClub
      or: WhereClub
      not: WhereClub
    }

    input WhereProfile {
      id: WhereUUID
      version: WhereUUID
      createdAt: WhereDate
      updatedAt: WhereDate
      age: WhereInt
      userId: WhereUUID
      and: WhereProfile
      or: WhereProfile
      not: WhereProfile
    }

    input WhereUser {
      id: WhereUUID
      version: WhereUUID
      createdAt: WhereDate
      updatedAt: WhereDate
      classId: WhereUUID
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

    input OrderClass {
      id: Order
      version: Order
      createdAt: Order
      updatedAt: Order
      name: Order
    }

    input OrderClub {
      id: Order
      version: Order
      createdAt: Order
      updatedAt: Order
      name: Order
    }

    input OrderProfile {
      id: Order
      version: Order
      createdAt: Order
      updatedAt: Order
      age: Order
      userId: Order
    }

    input OrderUser {
      id: Order
      version: Order
      createdAt: Order
      updatedAt: Order
      classId: Order
      name: Order
    }

    enum Order {
      asc
      desc
    }

  `);

  expect(raw(declaration)).toMatchInlineSnapshot(`
    export {};
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
        type Order = "asc" | "desc";
        type CreateData = {
          class?: CreateDataClass | null;
          classes?: CreateDataClass[] | null;
          club?: CreateDataClub | null;
          clubs?: CreateDataClub[] | null;
          profile?: CreateDataProfile | null;
          profiles?: CreateDataProfile[] | null;
          user?: CreateDataUser | null;
          users?: CreateDataUser[] | null;
        };
        type UpdateData = {
          class?: UpdateDataClass | null;
          classes?: UpdateDataClass[] | null;
          club?: UpdateDataClub | null;
          clubs?: UpdateDataClub[] | null;
          profile?: UpdateDataProfile | null;
          profiles?: UpdateDataProfile[] | null;
          user?: UpdateDataUser | null;
          users?: UpdateDataUser[] | null;
        };
        type DeleteData = {
          class?: DeleteDataClass | null;
          classes?: DeleteDataClass[] | null;
          club?: DeleteDataClub | null;
          clubs?: DeleteDataClub[] | null;
          profile?: DeleteDataProfile | null;
          profiles?: DeleteDataProfile[] | null;
          user?: DeleteDataUser | null;
          users?: DeleteDataUser[] | null;
        };
        type CreateDataClass = { name: string; users?: CreateDataUser[] | null };
        type CreateDataClub = { name: string; users?: CreateDataUser[] | null };
        type CreateDataProfile = { age?: number | null; user?: CreateDataUser | null };
        type CreateDataUser = {
          class?: CreateDataClass | null;
          clubs?: CreateDataClub[] | null;
          name: string;
          profile?: CreateDataProfile | null;
        };
        type UpdateDataClass = { id: string; version: string; name?: string | null; users?: UpdateDataUser[] | null };
        type UpdateDataClub = { id: string; version: string; name?: string | null; users?: UpdateDataUser[] | null };
        type UpdateDataProfile = { id: string; version: string; age?: number | null; user?: UpdateDataUser | null };
        type UpdateDataUser = {
          id: string;
          version: string;
          class?: UpdateDataClass | null;
          clubs?: UpdateDataClub[] | null;
          name?: string | null;
          profile?: UpdateDataProfile | null;
        };
        type DeleteDataClass = { id: string; version: string; users?: DeleteDataUser[] | null };
        type DeleteDataClub = { id: string; version: string; users?: DeleteDataUser[] | null };
        type DeleteDataProfile = { id: string; version: string; user?: DeleteDataUser | null };
        type DeleteDataUser = {
          id: string;
          version: string;
          class?: DeleteDataClass | null;
          clubs?: DeleteDataClub[] | null;
          profile?: DeleteDataProfile | null;
        };
        type WhereClass = {
          id?: WhereUUID | null;
          version?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          name?: WhereString | null;
          and?: WhereClass | null;
          or?: WhereClass | null;
          not?: WhereClass | null;
        };
        type WhereClub = {
          id?: WhereUUID | null;
          version?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          name?: WhereString | null;
          and?: WhereClub | null;
          or?: WhereClub | null;
          not?: WhereClub | null;
        };
        type WhereProfile = {
          id?: WhereUUID | null;
          version?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          age?: WhereInt | null;
          userId?: WhereUUID | null;
          and?: WhereProfile | null;
          or?: WhereProfile | null;
          not?: WhereProfile | null;
        };
        type WhereUser = {
          id?: WhereUUID | null;
          version?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          classId?: WhereUUID | null;
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
        type OrderClass = {
          id?: Order | null;
          version?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          name?: Order | null;
        };
        type OrderClub = {
          id?: Order | null;
          version?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          name?: Order | null;
        };
        type OrderProfile = {
          id?: Order | null;
          version?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          age?: Order | null;
          userId?: Order | null;
        };
        type OrderUser = {
          id?: Order | null;
          version?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          classId?: Order | null;
          name?: Order | null;
        };
      }
    }

  `);

  expect(query(`{user{id}}`)).toMatchInlineSnapshot(`
    select
      cast(
        jsonb_build_object(
          'user',
          select
            jsonb_build_object('id', "id") as data
          from
            "User"
          limit
            1
        ) as text
      ) as data;
  `);

  expect(query(`{users{clubs{id,name}}}`)).toMatchInlineSnapshot(`
    select
      cast(
        jsonb_build_object(
          'users',
          coalesce(
            (
              select
                jsonb_agg(data)
              from
                (
                  select
                    jsonb_build_object(
                      'clubs',
                      coalesce(
                        (
                          select
                            jsonb_agg(data)
                          from
                            (
                              select
                                jsonb_build_object('id', "id", 'name', "name") as data
                              from
                                "Club"
                              where
                                id in (
                                  select
                                    "clubId"
                                  from
                                    "ClubToUser"
                                  where
                                    "clubId" is not null
                                    and "userId" = "User".id
                                )
                            ) as t
                        ),
                        jsonb_build_array()
                      )
                    ) as data
                  from
                    "User"
                ) as t
            ),
            jsonb_build_array()
          )
        ) as text
      ) as data;
  `);

  expect(query(`mutation{create(data:{user:{name:"test"}}){user{id}}}`)).toMatchInlineSnapshot(`
    insert into
      "User" ("id", "version", "createdAt", "updatedAt", "name")
    values
      (?, ?, ?, ?, ?);

    select
      cast(
        jsonb_build_object(
          'user',
          select
            jsonb_build_object('id', "id") as data
          from
            "User"
          where
            id in (?)
          limit
            1
        ) as text
      ) as "create";
  `);
});
