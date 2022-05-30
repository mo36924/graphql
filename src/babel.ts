import { ConfigAPI, PluginObj, types as t } from "@babel/core";
import {
  DocumentNode,
  GraphQLInputType,
  GraphQLSchema,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  OperationDefinitionNode,
  OperationTypeNode,
  TokenKind,
  TypeInfo,
  TypeNode,
  ValidationRule,
  VariableDefinitionNode,
  isListType,
  isNamedType,
  isNonNullType,
  parse,
  print,
  stripIgnoredCharacters,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { getGraphQLTagOperation, getSchema, isGraphQLTag } from "./index";

export type Options = {
  schema?: GraphQLSchema;
  rules?: ValidationRule[];
};

let _schema: GraphQLSchema;

const toAst = (type: GraphQLInputType): TypeNode => {
  if (isListType(type)) {
    return { kind: Kind.LIST_TYPE, type: toAst(type.ofType) };
  } else if (isNonNullType(type)) {
    return { kind: Kind.NON_NULL_TYPE, type: toAst(type.ofType) as any };
  }

  return { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: type.name } };
};

export default (_api: ConfigAPI, options: Options): PluginObj => {
  const schema = options.schema ?? (_schema ??= getSchema());
  const rules = options.rules;
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

        const _tag = tag.name;

        if (!isGraphQLTag(_tag)) {
          return;
        }

        const operation = getGraphQLTagOperation(_tag);

        let query = quasis
          .map(({ value: { cooked, raw } }) => cooked ?? raw)
          .reduce((query, value, i) => `${query}$_${i - 1}${value}`);

        let document: DocumentNode;

        try {
          document = parse(operation + query);
        } catch (err) {
          throw path.buildCodeFrameError(String(err));
        }

        let inputTypes: GraphQLInputType[] = [];
        const typeInfo = new TypeInfo(schema);

        document = visit(
          document,
          visitWithTypeInfo(typeInfo, {
            OperationDefinition: {
              enter() {
                inputTypes = [];
              },
              leave(node): OperationDefinitionNode | void {
                const _operation =
                  node.loc!.startToken.kind === TokenKind.BRACE_L
                    ? ((operation || "query") as OperationTypeNode)
                    : node.operation;

                if (!inputTypes.length) {
                  return { ...node, operation: _operation };
                }

                const variableDefinitions = [
                  ...node.variableDefinitions!,
                  ...inputTypes.map(
                    (inputType, i): VariableDefinitionNode => ({
                      kind: Kind.VARIABLE_DEFINITION,
                      variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: `_${i}` } },
                      type: toAst(inputType),
                    }),
                  ),
                ];

                return {
                  ...node,
                  operation: _operation,
                  variableDefinitions: variableDefinitions,
                };
              },
            },
            Variable() {
              inputTypes.push(typeInfo.getInputType()!);
            },
          }),
        );

        // if (values.length) {
        //   const variables = `(${values.map((value, i) => `$_${i}:${value}`).join()})`;
        //   query = operation + variables + query;
        // } else if (operation !== "query") {
        //   query = operation + query;
        // }

        // try {
        //   document = parse(query);
        // } catch (err) {
        //   throw path.buildCodeFrameError(String(err));
        // }

        const errors = validate(schema, document, rules);

        if (errors.length) {
          throw path.buildCodeFrameError(errors[0].message);
        }

        const properties: t.ObjectProperty[] = [
          t.objectProperty(t.identifier("query"), t.stringLiteral(stripIgnoredCharacters(print(document)))),
        ];

        if (expressions.length) {
          properties.push(
            t.objectProperty(
              t.identifier("variables"),
              t.objectExpression(
                expressions.map((expression, i) => t.objectProperty(t.identifier("_" + i), expression as t.Expression)),
              ),
            ),
          );
        }

        path.replaceWith(t.callExpression(tag, [t.objectExpression(properties)]));
      },
    },
  };
};
