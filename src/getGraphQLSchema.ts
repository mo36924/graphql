import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { GraphQLSchema } from "graphql";
import { buildSchema } from "./schema";

let schemaPath: string | undefined;

export const getSchemaPath = () => {
  if (schemaPath) {
    return schemaPath;
  }
  const require = createRequire(import.meta.url);
  const graphqlResolvedPath = require.resolve("graphql");
  schemaPath = join(graphqlResolvedPath, "..", "..", "..", "schema.gql");
  return schemaPath;
};

let _graphql: string | undefined;
let schema: GraphQLSchema | undefined;

export const getGraphQLSchema = () => {
  const schemaPath = getSchemaPath();
  const graphql = readFileSync(schemaPath, "utf-8");
  if (graphql === _graphql && schema) {
    return schema;
  }
  _graphql = graphql;
  schema = buildSchema(graphql);
  return schema;
};
