import { expect, it } from "vitest";
import { buildSchema } from "./schema";
import { buildDeclaration } from "./declaration";

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

it("declaration", () => {
  const schema = buildSchema(model);
  const declaration = buildDeclaration(schema);
  expect(declaration).toMatchInlineSnapshot(`
    "declare global {
      namespace GraphQL {
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
        type UpdateDataClass = { id: string; name?: string | null; users?: UpdateDataUser[] | null };
        type UpdateDataClub = { id: string; name?: string | null; users?: UpdateDataUser[] | null };
        type UpdateDataProfile = { id: string; age?: number | null; user?: UpdateDataUser | null };
        type UpdateDataUser = {
          id: string;
          class?: UpdateDataClass | null;
          clubs?: UpdateDataClub[] | null;
          name?: string | null;
          profile?: UpdateDataProfile | null;
        };
        type DeleteDataClass = { id: string; users?: DeleteDataUser[] | null };
        type DeleteDataClub = { id: string; users?: DeleteDataUser[] | null };
        type DeleteDataProfile = { id: string; user?: DeleteDataUser | null };
        type DeleteDataUser = {
          id: string;
          class?: DeleteDataClass | null;
          clubs?: DeleteDataClub[] | null;
          profile?: DeleteDataProfile | null;
        };
        type WhereClass = {
          id?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          name?: WhereString | null;
          and?: WhereClass | null;
          or?: WhereClass | null;
          not?: WhereClass | null;
        };
        type WhereClub = {
          id?: WhereUUID | null;
          createdAt?: WhereDate | null;
          updatedAt?: WhereDate | null;
          name?: WhereString | null;
          and?: WhereClub | null;
          or?: WhereClub | null;
          not?: WhereClub | null;
        };
        type WhereProfile = {
          id?: WhereUUID | null;
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
          eq?: DateTime | null;
          ne?: DateTime | null;
          gt?: DateTime | null;
          lt?: DateTime | null;
          ge?: DateTime | null;
          le?: DateTime | null;
          in?: DateTime[] | null;
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
        type OrderClass = { id?: Order | null; createdAt?: Order | null; updatedAt?: Order | null; name?: Order | null };
        type OrderClub = { id?: Order | null; createdAt?: Order | null; updatedAt?: Order | null; name?: Order | null };
        type OrderProfile = {
          id?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          age?: Order | null;
          userId?: Order | null;
        };
        type OrderUser = {
          id?: Order | null;
          createdAt?: Order | null;
          updatedAt?: Order | null;
          classId?: Order | null;
          name?: Order | null;
        };
      }
    }
    export {};
    "
  `);
});
