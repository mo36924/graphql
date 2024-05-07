import {
  GraphQLInputField,
  GraphQLSchema,
  getNamedType,
  getNullableType,
  isInputObjectType,
  isListType,
  isNonNullType,
} from "graphql";
import { formatDeclaration } from "./format";
import { ScalarTypeName } from "./scalars";
import { createObject } from "./utils";

export const buildDeclaration = (schema: GraphQLSchema) => {
  const typescriptTypes = createObject<{ [type in ScalarTypeName]: string }>({
    ID: "string",
    String: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    Date: "Date",
    UUID: "string",
    JSON: "any",
  });

  const getTypescriptType = (type: string) => typescriptTypes[type as ScalarTypeName] ?? type;

  const getFieldType = (field: GraphQLInputField) => {
    const { type, name } = field;
    const isNonNull = isNonNullType(type);
    const nullableType = getNullableType(type);
    const isList = isListType(nullableType);
    const namedType = getNamedType(nullableType);
    const fieldType = namedType.name;
    const typescriptType = getTypescriptType(fieldType);
    return `${name}${isNonNull ? "" : "?"}:${typescriptType}${isList ? "[]" : ""}${isNonNull ? "" : "|null"};`;
  };

  const types = schema.getTypeMap();
  let declaration = `declare global { namespace GraphQL {`;

  for (const type of Object.values(types)) {
    const name = type.name;

    if (isInputObjectType(type)) {
      declaration += `type ${name} = {`;

      for (const field of Object.values(type.getFields())) {
        declaration += getFieldType(field);
      }

      declaration += "};";
    }
  }

  declaration += "}}export{}";

  const formattedDeclaration = formatDeclaration(declaration);

  return formattedDeclaration;
};
