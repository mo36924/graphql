import { GraphQLScalarType, GraphQLSchema } from "graphql";
import { GraphQLDateTime, GraphQLJSON, GraphQLUUID } from "graphql-scalars";

export const customScalarTypeNames = ["Date", "UUID", "JSON"] as const;
export const customScalars = customScalarTypeNames.map((name) => `scalar ${name}\n`).join("");
export type CustomScalarTypeName = (typeof customScalarTypeNames)[number];
export const isCustomScalarTypeName = (type: string): type is CustomScalarTypeName =>
  customScalarTypeNames.includes(type as CustomScalarTypeName);
export const scalarTypeNames = ["ID", "Int", "Float", "String", "Boolean", ...customScalarTypeNames] as const;
export type ScalarTypeName = (typeof scalarTypeNames)[number];
export const isScalarTypeName = (name: string): name is ScalarTypeName => scalarTypeNames.includes(name as any);
export const primaryKeyTypeName = "UUID" satisfies ScalarTypeName;

const customScalarTypeMap: { [key in CustomScalarTypeName]: GraphQLScalarType } = {
  Date: GraphQLDateTime,
  UUID: GraphQLUUID,
  JSON: GraphQLJSON,
};

export const mergeCustomScalars = (schema: GraphQLSchema) => {
  const typeMap = schema.getTypeMap();
  for (const [key, value] of Object.entries(customScalarTypeMap)) {
    Object.assign(typeMap[key], value);
  }
};
