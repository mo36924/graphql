import { D1Database } from "@cloudflare/workers-types";
import { GraphQLSchema } from "graphql";
import { buildContext } from "./buildContext";
import { parseRequestParams } from "./parseRequestParams";
import { buildQuery } from "./sqlite";

export const execute = async (db: D1Database, query: string) => {
  const rows = await db.prepare(query).raw<string[]>();
  return new Response(rows[0][0], { headers: { "Content-Type": "application/json; charset=utf-8" } });
};

export const handler = async (request: Request, schema: GraphQLSchema, db: D1Database) => {
  try {
    const params = await parseRequestParams(request);
    const context = buildContext(request, schema, params);
    const query = buildQuery(context);
    const response = await execute(db, query);
    return response;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return new Response(null, { status: 500, statusText: "Internal Server Error" });
  }
};
