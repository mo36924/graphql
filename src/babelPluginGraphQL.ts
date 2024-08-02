import { PluginObj, types as t } from "@babel/core";
import {
  DocumentNode,
  GraphQLInputType,
  TypeInfo,
  parse,
  stripIgnoredCharacters,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { getGraphQLSchema } from "./getGraphQLSchema";

declare global {
  type GraphQLTemplateStringsArray = TemplateStringsArray & {
    _: { values: any[]; variables: object; data: object };
  };

  const gql: <T extends GraphQLTemplateStringsArray>(
    strings: T,
    ...values: T["_"]["values"]
  ) => { query: string; variables: T["_"]["variables"]; _: T["_"] };
}

export default (): PluginObj => {
  const schema = getGraphQLSchema();
  return {
    name: "graphql",
    visitor: {
      TaggedTemplateExpression(path) {
        const {
          tag,
          quasi: { quasis, expressions },
        } = path.node;

        if (!t.isIdentifier(tag)) {
          return;
        }

        const name = tag.name;

        if (name !== "gql") {
          return;
        }

        let query = quasis
          .map(({ value: { cooked, raw } }) => cooked ?? raw)
          .reduce((prev, current, i) => `${prev}$_${i - 1}${current}`);

        let documentNode: DocumentNode;

        try {
          documentNode = parse(query);
        } catch (err) {
          throw path.buildCodeFrameError(String(err));
        }

        const values: GraphQLInputType[] = [];
        const typeInfo = new TypeInfo(schema);

        let field = "";

        visit(
          documentNode,
          visitWithTypeInfo(typeInfo, {
            Field(node) {
              field ||= node.name.value;
            },
            Variable() {
              values.push(typeInfo.getInputType()!);
            },
          }),
        );

        const isMutation = !!schema.getMutationType()?.getFields()[field];
        const operation = isMutation ? "mutation" : "query";

        if (values.length) {
          const variables = `(${values.map((value, i) => `$_${i}:${value}`).join()})`;
          query = `${operation}${variables}${query}`;
        } else if (operation === "mutation") {
          query = `${operation}${query}`;
        }

        try {
          documentNode = parse(query);
        } catch (err) {
          throw path.buildCodeFrameError(String(err));
        }

        const errors = validate(schema, documentNode);

        if (errors.length) {
          throw path.buildCodeFrameError(errors[0].message);
        }

        const properties: t.ObjectProperty[] = [
          t.objectProperty(t.identifier("query"), t.stringLiteral(stripIgnoredCharacters(query))),
        ];

        if (expressions.length) {
          properties.push(
            t.objectProperty(
              t.identifier("variables"),
              t.objectExpression(
                expressions.map((expression, i) => t.objectProperty(t.identifier(`_${i}`), expression as t.Expression)),
              ),
            ),
          );
        }

        path.replaceWith(t.objectExpression(properties));
      },
    },
  };
};
