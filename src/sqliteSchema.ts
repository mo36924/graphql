import { GraphQLSchema } from "graphql";
import { ScalarTypeName } from "./scalars";
import { getSchemaTypes } from "./schema";
import { identifier } from "./sqlite";
import { isSchemaTypeName } from "./types";
import { createObject } from "./utils";

export const buildSQLiteSchema = (schema: GraphQLSchema) => {
  const types = getSchemaTypes(schema);
  const create: string[] = [];
  const unique: string[] = [];
  const index: string[] = [];

  const dbTypes = createObject<Record<ScalarTypeName, string>>({
    UUID: "blob",
    ID: "text",
    Int: "integer",
    Float: "real",
    String: "text",
    Boolean: "integer",
    Date: "text",
    JSON: "text",
  });

  for (const [typeName, type] of Object.entries(types)) {
    if (isSchemaTypeName(typeName)) {
      continue;
    }

    const { fields } = type;
    const columns: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const {
        type: fieldTypeName,
        nullable,
        scalar,
        directives: { ref: refDirective, unique: uniqueDirective },
      } = field;

      if (scalar) {
        const dbType = dbTypes[fieldTypeName as ScalarTypeName];

        if (fieldName === "id") {
          columns.push(`${identifier(fieldName)} ${dbType} not null primary key`);
        } else {
          columns.push(`${identifier(fieldName)} ${dbType}${nullable ? "" : " not null"}`);
        }
      }

      if (uniqueDirective) {
        unique.push(
          `create unique index ${identifier(`${typeName}_${fieldName}`)} on ${identifier(typeName)} (${identifier(fieldName)});\n`,
        );
      } else if (refDirective) {
        index.push(
          `create index ${identifier(`${typeName}_${fieldName}`)} on ${identifier(typeName)} (${identifier(fieldName)});\n`,
        );
      }
    }

    create.push(`create table ${identifier(typeName)} (\n${columns.map((column) => `  ${column}`).join(",\n")}\n);\n`);
  }

  return [create, unique, index].flat().join("");
};
