import { DocumentNode, GraphQLSchema, OperationDefinitionNode, getOperationAST, parse, validate } from "graphql";
import { ExecutionContext, buildExecutionContext } from "graphql/execution/execute";
import { Params } from "./parseRequestParams";

export type Context = {
  request: Request;
  params: Params;
} & ExecutionContext;
export const buildContext = (request: Request, schema: GraphQLSchema, params: Params): Context => {
  let document: DocumentNode;

  try {
    document = parse(params.query, { noLocation: true });
  } catch {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  const errors = validate(schema, document);

  if (errors.length) {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  let node: OperationDefinitionNode | null | undefined;

  try {
    node = getOperationAST(document);
  } catch {}

  if (!node) {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  const operation = node.operation;

  if (operation === "mutation" && request.method === "GET") {
    throw new Response(null, { status: 405, statusText: "Method Not Allowed", headers: { allow: "POST" } });
  }

  const context = buildExecutionContext({
    schema,
    document,
    variableValues: params.variables,
  });

  if ("at" in context) {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  return { ...context, request, params };
};
