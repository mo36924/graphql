import { readFileSync } from "node:fs";
import { GraphQLSchema } from "graphql";
import { schemaPath } from "./paths";
import { buildSchema } from "./schema";

let _graphql: string | undefined;
let schema: GraphQLSchema | undefined;

export const getGraphQLSchema = (): GraphQLSchema => {
  const graphql = readFileSync(schemaPath, "utf-8");

  if (graphql === _graphql && schema) {
    return schema;
  }

  _graphql = graphql;
  schema = buildSchema(graphql);
  return schema;
};
