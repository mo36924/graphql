import { randomUUID as uuid } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ConfigAPI, PluginObj, types as t } from "@babel/core";
import { camelCase, pascalCase } from "change-case";
import { cosmiconfigSync } from "cosmiconfig";
import { diffChars } from "diff";
import {
  DocumentNode,
  FieldDefinitionNode,
  FieldNode,
  GraphQLError,
  GraphQLInputField,
  GraphQLInputType,
  GraphQLObjectType,
  GraphQLScalarTypeConfig,
  GraphQLSchema,
  Kind,
  NoUndefinedVariablesRule,
  ObjectTypeDefinitionNode,
  ObjectValueNode,
  OperationDefinitionNode,
  OperationTypeNode,
  TokenKind,
  TypeInfo,
  TypeNode,
  ValidationRule,
  ValueNode,
  VariableDefinitionNode,
  buildASTSchema as _buildASTSchema,
  getNamedType,
  getNullableType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isNullableType,
  isScalarType,
  parse,
  print,
  specifiedRules,
  stripIgnoredCharacters,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { ExecutionContext } from "graphql/execution/execute";
import { getArgumentValues } from "graphql/execution/values";
import { inspect } from "graphql/jsutils/inspect";
import colors from "picocolors";
import pluralize from "pluralize";
import prettier from "prettier";

export * from "graphql";

const primaryKeyTypeName = "UUID";
const baseScalarTypeNames = ["ID", "Int", "Float", "String", "Boolean"] as const;
const customScalarTypeNames = ["Date", "UUID", "JSON"] as const;
const schemaTypeNames = ["Query", "Mutation", "Subscription"];
const baseFieldNames = ["id", "version", "createdAt", "updatedAt"];
const comparisonOperators = ["eq", "ne", "gt", "lt", "ge", "le", "in", "like"];
const logicalOperators = ["not", "and", "or"];
const graphqlTags = ["gql", "query", "useQuery", "mutation", "useMutation", "subscription", "useSubscription"] as const;
type ScalarTypeName = typeof scalarTypeNames[number];
type ComparisonOperator = typeof comparisonOperators[number];

export type GraphQLTag = typeof graphqlTags[number];
export type GraphQLTagOperation = "" | "query" | "mutation" | "subscription";

const typescriptTypes: { [type in ScalarTypeName]: string } = {
  ID: "string",
  Int: "number",
  Float: "number",
  String: "string",
  Boolean: "boolean",
  Date: "Date",
  UUID: "string",
  JSON: "any",
};

const postgresTypes: { [type in ScalarTypeName]: string } = {
  ID: "string",
  Int: "integer",
  Float: "double precision",
  String: "text",
  Boolean: "boolean",
  Date: "timestamp(3)",
  UUID: "uuid",
  JSON: "jsonb",
};

const graphqlTagOperations: { [tag in GraphQLTag]: GraphQLTagOperation } = {
  gql: "",
  query: "query",
  useQuery: "query",
  mutation: "mutation",
  useMutation: "mutation",
  subscription: "subscription",
  useSubscription: "subscription",
};

const customScalars = /* GraphQL */ `
  scalar Date
  scalar UUID
  scalar JSON
`;

const baseType = /* GraphQL */ `
  type BaseType {
    id: UUID!
    version: UUID!
    createdAt: Date!
    updatedAt: Date!
  }
`;

type TypeDirectives = {
  join?: {};
};

type FieldDirectives = {
  field?: { name: string; key: string };
  type?: { name: string; keys: [string, string] };
  key?: { name: string };
  ref?: { name: string };
  unique?: {};
};

const modelDirectives = /* GraphQL */ `
  directive @field(name: String!) on FIELD_DEFINITION
  directive @type(name: String!) on FIELD_DEFINITION
`;

const schemaDirectives = /* GraphQL */ `
  directive @join on OBJECT
  directive @unique on FIELD_DEFINITION
  directive @key(name: String!) on FIELD_DEFINITION
  directive @ref(name: String!) on FIELD_DEFINITION
  directive @field(name: String!, key: String!) on FIELD_DEFINITION
  directive @type(name: String!, keys: [String!]!) on FIELD_DEFINITION
`;

type Types = { [typeName: string]: Type };
type Type = { name: string; directives: TypeDirectives; fields: Fields };
type Fields = { [fieldName: string]: Field };
type Field = {
  name: string;
  type: string;
  scalar: boolean;
  nullable: boolean;
  list: boolean;
  directives: FieldDirectives;
};

const scalarTypeNames = [...baseScalarTypeNames, ...customScalarTypeNames];
const reservedTypeNames = [...schemaTypeNames, ...scalarTypeNames];
const reservedFieldNames = [...baseFieldNames, ...logicalOperators];
const isCustomScalarTypeName = (type: string) => customScalarTypeNames.includes(type as any);
const isScalarTypeName = (name: string) => scalarTypeNames.includes(name as any);
const isSchemaTypeName = (name: string) => schemaTypeNames.includes(name);
const isReservedTypeName = (name: string) => reservedTypeNames.includes(name);
const isReservedFieldName = (name: string) => reservedFieldNames.includes(name);
const isBaseFieldName = (type: string) => baseFieldNames.includes(type);

export const isGraphQLTag = (tag: string): tag is GraphQLTag => graphqlTags.includes(tag as any);

export const validationRules = /*@__PURE__*/ specifiedRules.filter((rule) => rule !== NoUndefinedVariablesRule);

const getTypescriptType = (type: string): string =>
  typescriptTypes.hasOwnProperty(type) ? typescriptTypes[type as ScalarTypeName] : type;

const getPostgresTypes = (type: string) => {
  if (postgresTypes.hasOwnProperty(type)) {
    return postgresTypes[type as ScalarTypeName];
  }

  throw new Error("Invalid type.");
};

export const getGraphQLTagOperation = (tag: GraphQLTag) => graphqlTagOperations[tag];

const getTypeName = (name: string) => {
  name = pascalCase(pluralize.singular(name));
  const upperCaseName = name.toUpperCase();

  if (isScalarTypeName(upperCaseName)) {
    return upperCaseName;
  }

  return name;
};

const getJoinTypeName = (name1: string, name2?: string): string => {
  if (name2 != null) {
    return [name1, name2].map(getTypeName).sort().join("To");
  }

  const name = getTypeName(name1);
  const names = name.split("To");
  return names.length === 2 ? getJoinTypeName(names[0], names[1]) : name;
};

const getFieldName = (name: string) => camelCase(pluralize.singular(name));
const getListFieldName = (name: string) => camelCase(pluralize.plural(name));

const getKeyFieldName = (name: string) => getFieldName(name).replace(/(Id)*$/, "Id");

const getKeyFieldNames = (name1: string, name2: string): [string, string] => [
  getKeyFieldName(name1),
  getKeyFieldName(name2),
];

const getDirectives = <T extends ObjectTypeDefinitionNode | FieldDefinitionNode>(
  schema: GraphQLSchema,
  node: T,
): T extends ObjectTypeDefinitionNode ? TypeDirectives : FieldDirectives =>
  node.directives!.reduce((directives, directive) => {
    directives[directive.name.value] = getArgumentValues(schema.getDirective(directive.name.value)!, directive);

    return directives;
  }, Object.create(null));

const memoize = <T extends (a1: any, a2: any, a3: any) => any>(fn: T): T => {
  const cache0 = new Map();
  return ((a1: any, a2: any, a3: any): any => {
    let cache1 = cache0.get(a1);

    if (cache1 === undefined) {
      cache1 = new Map();
      cache0.set(a1, cache1);
    }

    let cache2 = cache1.get(a2);

    if (cache2 === undefined) {
      cache2 = new Map();
      cache1.set(a2, cache2);
    }

    let fnResult = cache2.get(a3);

    if (fnResult === undefined) {
      fnResult = fn(a1, a2, a3);
      cache2.set(a3, fnResult);
    }

    return fnResult;
  }) as any;
};

const getFieldDefInfo = memoize((schema: GraphQLSchema, parent: string, field: string) => {
  const def = (schema.getType(parent) as GraphQLObjectType).getFields()[field];
  const name = field;
  const fieldType = def.type;
  const nullable = isNullableType(fieldType);
  const nullableType = getNullableType(fieldType);
  const list = isListType(nullableType);
  const namedType = getNamedType(nullableType);
  const scalar = isScalarType(namedType);
  const type = namedType.name;
  const directives = getDirectives(schema, def.astNode!);
  const _isBaseFieldName = isBaseFieldName(name);
  return { schema, parent, def, name, type, scalar, list, nullable, directives, isBaseFieldName: _isBaseFieldName };
});

const createObject: {
  <T0 = any>(source0?: T0): T0;
  <T0, T1>(source0: T0, source1: T1): T0 & T1;
} = (...sources: any[]) => Object.assign(Object.create(null), ...sources);

const format = (data: string, ext: ".js" | ".d.ts" | ".gql" = ".gql") => {
  if (ext === ".gql") {
    data = print(parse(stripIgnoredCharacters(data)));
  }

  return prettier.format(data, {
    ...prettier.resolveConfig.sync(`index${ext}`),
    filepath: `index${ext}`,
  });
};

const readFile = (path: string) => {
  try {
    return readFileSync(path, "utf-8");
  } catch {}
};

const writeFile = (path: string, data: string) => {
  mkdirSync(dirname(path), { recursive: true });

  if (data !== readFile(path)) {
    writeFileSync(path, data);
  }
};

const escapeIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const escapeLiteral = (value: string | number | boolean | Date | null | undefined) => {
  if (value == null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return value.toString();
    case "object":
      if (value instanceof Date) {
        const iso = value.toISOString();
        return `'${iso.slice(0, 10)} ${iso.slice(11, 23)}'`;
      }

      value = String(value);
  }

  value = `'${value.replaceAll("'", "''")}'`;

  if (value.includes("\\")) {
    value = `E${value.replaceAll("\\", "\\\\")}`;
  }

  return value;
};

const buildTypes = (graphql: string): Types => {
  const documentNode = parse(graphql);
  const schema = _buildASTSchema(documentNode);
  const types = createObject<Types>();

  for (const definition of documentNode.definitions) {
    if (definition.kind !== "ObjectTypeDefinition") {
      continue;
    }

    const fields = createObject<Fields>();

    types[definition.name.value] = {
      name: definition.name.value,
      fields: fields,
      directives: getDirectives(schema, definition),
    };

    for (const fieldDefNode of definition.fields ?? []) {
      const name = fieldDefNode.name;
      let type = fieldDefNode.type;

      const field: Field = (fields[name.value] = {
        name: name.value,
        type: "",
        scalar: false,
        nullable: true,
        list: false,
        directives: getDirectives(schema, fieldDefNode),
      });

      if (type.kind === "NonNullType") {
        type = type.type;
        field.nullable = false;
      }

      if (type.kind === "ListType") {
        type = type.type;
        field.nullable = false;
        field.list = true;
      }

      while (type.kind !== "NamedType") {
        type = type.type;
      }

      field.type = type.name.value;

      if (isScalarTypeName(field.type)) {
        field.scalar = true;
        field.list = false;
      }
    }
  }

  return types;
};

const sortTypes = (types: Types): Types =>
  JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(types)
          .sort(([, a], [, b]) => {
            if (!a.directives.join !== !b.directives.join) {
              return a.directives.join ? 1 : -1;
            }

            if (a.name > b.name) {
              return 1;
            }

            if (a.name < b.name) {
              return -1;
            }

            return 0;
          })
          .map(([typeName, type]) => [
            typeName,
            {
              ...type,
              fields: Object.fromEntries(
                Object.entries(type.fields).sort(([, a], [, b]) => {
                  let indexA = baseFieldNames.indexOf(a.name as any);
                  let indexB = baseFieldNames.indexOf(b.name as any);
                  indexA = indexA === -1 ? baseFieldNames.length : indexA;
                  indexB = indexB === -1 ? baseFieldNames.length : indexB;

                  if (indexA !== indexB) {
                    return indexA - indexB;
                  }

                  if (a.name > b.name) {
                    return 1;
                  }

                  if (a.name < b.name) {
                    return -1;
                  }

                  return 0;
                }),
              ),
            },
          ]),
      ),
    ),
    (_key: string, value: any) =>
      value && typeof value === "object" && !Array.isArray(value) ? createObject(value) : value,
  );

const printTypes = (types: Types): string => {
  let graphql = "";

  for (const { name, directives, fields } of Object.values(types)) {
    graphql += `type ${name}${printDirectives(directives)}{`;

    for (const field of Object.values(fields)) {
      graphql += `${field.name}:${printFieldType(field)}${printDirectives(field.directives)} `;
    }

    graphql += "}";
  }

  return format(graphql);
};

const printFieldType = (field: Pick<Field, "type" | "list" | "nullable">): string =>
  `${field.list ? `[${field.type}!]` : field.type}${field.nullable ? "" : "!"}`;

const printDirectives = (directives: TypeDirectives | FieldDirectives): string => {
  let _directives = "";

  for (const [name, args] of Object.entries(directives)) {
    if (args == null) {
      continue;
    }

    const entries = Object.entries(args);

    if (entries.length === 0) {
      _directives += `@${name}`;
      continue;
    }

    _directives += `@${name}(`;

    for (const [name, value] of entries) {
      _directives += `${name}:${JSON.stringify(value)} `;
    }

    _directives += `)`;
  }

  return _directives;
};

const fixModel = (model: string) => {
  const types = buildTypes(model + customScalars + modelDirectives);
  const joinTypeNameSet = new Set<string>();
  const renameJoinTypeFields: Field[] = [];

  for (let [typeName, type] of Object.entries(types)) {
    delete types[typeName];
    typeName = getTypeName(typeName);

    if (isReservedTypeName(typeName)) {
      continue;
    }

    const { fields } = (types[typeName] = {
      ...type,
      name: typeName,
      directives: {},
    });

    for (let [fieldName, field] of Object.entries(fields)) {
      delete fields[fieldName];
      const { type, scalar, list, directives } = field;
      fieldName = (list ? getListFieldName : getFieldName)(fieldName);

      if (isReservedFieldName(fieldName)) {
        continue;
      }

      const fieldType = getTypeName(type);

      field = fields[fieldName] = {
        ...field,
        name: fieldName,
        type: fieldType,
      };

      if (scalar) {
        field.directives = {};
      } else if (directives.field) {
        if (!list) {
          field.nullable = true;
        }

        directives.field.name = getFieldName(directives.field.name);
      } else if (directives.type && list) {
        let joinTypeName: string;

        if (getTypeName(fieldName) === fieldType) {
          joinTypeName = getJoinTypeName(typeName, fieldType);
        } else {
          joinTypeName = getJoinTypeName(directives.type.name);
          renameJoinTypeFields.push(field);
        }

        joinTypeNameSet.add(joinTypeName);
        directives.type.name = joinTypeName;
      }
    }
  }

  for (let i = 0, len = renameJoinTypeFields.length; i < len; i++) {
    const _renameJoinTypeFields = [renameJoinTypeFields[i]];

    for (let j = i + 1; j < len; j++) {
      if (renameJoinTypeFields[i].directives.type!.name === renameJoinTypeFields[j].directives.type!.name) {
        _renameJoinTypeFields.push(renameJoinTypeFields[j]);
      }
    }

    if (_renameJoinTypeFields.length === 2) {
      const joinTypeName = getJoinTypeName(_renameJoinTypeFields[0].name, _renameJoinTypeFields[1].name);

      joinTypeNameSet.add(joinTypeName);

      _renameJoinTypeFields[0].directives.type!.name = _renameJoinTypeFields[1].directives.type!.name = joinTypeName;
    }
  }

  for (const type of Object.keys(types)) {
    const joinTypeName = getJoinTypeName(type);

    if (joinTypeNameSet.has(joinTypeName)) {
      delete types[type];
    }
  }

  return printTypes(sortTypes(types));
};

const printSchema = (types: Types) => {
  let schema = customScalars + schemaDirectives;
  let query = "";
  let mutation = "";
  let objectType = "";
  let whereInput = "";
  let orderInput = "";
  let createData = "";
  let updateData = "";
  let deleteData = "";
  let createInput = "";
  let updateInput = "";
  let deleteInput = "";
  let orderEnum = "enum Order {asc desc}";

  query += `type Query {`;

  mutation += `type Mutation {
    create(data: CreateData!): Query!
    update(data: UpdateData!): Query!
    delete(data: DeleteData!): Query!
    read: Query!
  `;

  createData += `input CreateData {`;
  updateData += `input UpdateData {`;
  deleteData += `input DeleteData {`;

  for (const [typeName, type] of Object.entries(types)) {
    const { fields, directives } = type;
    const typeDirectives = printDirectives(directives);
    objectType += `type ${typeName} ${typeDirectives} {`;

    for (const [fieldName, field] of Object.entries(fields)) {
      const { scalar, list, type: fieldTypeName } = field;
      const fieldType = printFieldType(field);
      const fieldDirectives = printDirectives(field.directives);

      if (scalar) {
        objectType += `${fieldName}: ${fieldType} ${fieldDirectives}\n`;
      } else if (list) {
        objectType += `${fieldName}(where: Where${fieldTypeName}, order: Order${fieldTypeName}, limit: Int, offset: Int): ${fieldType} ${fieldDirectives}\n`;
      } else {
        objectType += `${fieldName}(where: Where${fieldTypeName}): ${fieldType} ${fieldDirectives}\n`;
      }
    }

    objectType += `}`;
  }

  for (const [typeName, type] of Object.entries(types)) {
    const { fields, directives } = type;

    if (directives.join) {
      continue;
    }

    const fieldName = getFieldName(typeName);
    const fieldListName = getListFieldName(fieldName);

    query += `
      ${fieldName}(where: Where${typeName}, order: Order${typeName}, offset: Int): ${typeName}
      ${fieldListName}(where: Where${typeName}, order: Order${typeName}, limit: Int, offset: Int): [${typeName}!]!
    `;

    createData += `
      ${fieldName}: CreateData${typeName}
      ${fieldListName}: [CreateData${typeName}!]
    `;

    updateData += `
      ${fieldName}: UpdateData${typeName}
      ${fieldListName}: [UpdateData${typeName}!]
    `;

    deleteData += `
      ${fieldName}: DeleteData${typeName}
      ${fieldListName}: [DeleteData${typeName}!]
    `;

    createInput += `input CreateData${typeName} {`;
    updateInput += `input UpdateData${typeName} {`;
    deleteInput += `input DeleteData${typeName} {`;
    whereInput += `input Where${typeName} {`;
    orderInput += `input Order${typeName} {`;

    for (const [fieldName, field] of Object.entries(fields)) {
      const {
        list,
        type: fieldTypeName,
        scalar,
        directives: { ref },
      } = field;

      if (!scalar) {
        if (list) {
          createInput += `${fieldName}: [CreateData${fieldTypeName}!]\n`;
          updateInput += `${fieldName}: [UpdateData${fieldTypeName}!]\n`;
          deleteInput += `${fieldName}: [DeleteData${fieldTypeName}!]\n`;
        } else {
          createInput += `${fieldName}: CreateData${fieldTypeName}\n`;
          updateInput += `${fieldName}: UpdateData${fieldTypeName}\n`;
          deleteInput += `${fieldName}: DeleteData${fieldTypeName}\n`;
        }

        continue;
      }

      if (!ref) {
        const fieldType = printFieldType(field);

        switch (fieldName) {
          case "id":
            updateInput += `${fieldName}: ${fieldType}\n`;
            deleteInput += `${fieldName}: ${fieldType}\n`;
            break;
          case "version":
            updateInput += `${fieldName}: ${fieldType}\n`;
            deleteInput += `${fieldName}: ${fieldType}\n`;
            break;
          case "createdAt":
          case "updatedAt":
            break;
          default:
            createInput += `${fieldName}: ${fieldType}\n`;

            updateInput += `${fieldName}: ${printFieldType({
              ...field,
              nullable: true,
            })}\n`;

            break;
        }
      }

      whereInput += `${fieldName}: Where${fieldTypeName}\n`;
      orderInput += `${fieldName}: Order\n`;
    }

    createInput += `}`;
    updateInput += `}`;
    deleteInput += `}`;

    whereInput += `
      and: Where${typeName}
      or: Where${typeName}
      not: Where${typeName}
    }`;

    orderInput += `}`;
  }

  for (const scalarType of scalarTypeNames) {
    whereInput += `input Where${scalarType} {`;

    for (const comparisonOperator of comparisonOperators) {
      if (scalarType === "Boolean" && comparisonOperator !== "eq" && comparisonOperator !== "ne") {
        continue;
      } else if (comparisonOperator === "in") {
        whereInput += `${comparisonOperator}: [${scalarType}]\n`;
      } else if (comparisonOperator === "like") {
        whereInput += `${comparisonOperator}: String\n`;
      } else {
        whereInput += `${comparisonOperator}: ${scalarType}\n`;
      }
    }

    whereInput += `}`;
  }

  query += `}`;
  mutation += `}`;
  createData += `}`;
  updateData += `}`;
  deleteData += `}`;

  schema +=
    query +
    mutation +
    objectType +
    createData +
    updateData +
    deleteData +
    createInput +
    updateInput +
    deleteInput +
    whereInput +
    orderInput +
    orderEnum;

  return format(schema);
};

const buildModelGraphQL = (model: string) => {
  const types = buildTypes(model + customScalars + schemaDirectives);
  const baseFields = Object.values(buildTypes(baseType + customScalars))[0].fields;

  for (const [typeName, type] of Object.entries(types)) {
    const fields = (type.fields = createObject(type.fields, baseFields));

    for (const [fieldName, field] of Object.entries(fields)) {
      if (field.scalar) {
        continue;
      }

      const directives = field.directives;

      const { key: keyDirective, type: typeDirective, field: fieldDirective } = directives;

      if (keyDirective) {
        continue;
      }

      if (typeDirective) {
        typeDirective.keys = getKeyFieldNames(typeName, field.type);
        const joinTypeName = typeDirective.name;

        if (types[joinTypeName]) {
          continue;
        }

        const typeNames = [typeName, field.type].sort();
        const keys = getKeyFieldNames(typeNames[0], typeNames[1]);

        types[joinTypeName] = {
          name: joinTypeName,
          directives: { join: {} },
          fields: createObject(baseFields, {
            [keys[0]]: {
              name: keys[0],
              type: primaryKeyTypeName,
              list: false,
              nullable: false,
              scalar: true,
              directives: {
                ref: { name: typeNames[0] },
              },
            },
            [keys[1]]: {
              name: keys[1],
              type: primaryKeyTypeName,
              list: false,
              nullable: false,
              scalar: true,
              directives: {
                ref: { name: typeNames[1] },
              },
            },
          }),
        };

        continue;
      }

      if (fieldDirective) {
        const refTypeFieldName = fieldDirective.name;
        const refTypeFields = types[field.type].fields;
        const keyFieldName = getKeyFieldName(refTypeFieldName);
        fieldDirective.key = keyFieldName;

        if (refTypeFields[keyFieldName]?.directives.ref) {
          continue;
        }

        const nullable = refTypeFields[refTypeFieldName]?.nullable ?? true;

        refTypeFields[refTypeFieldName] = {
          name: refTypeFieldName,
          type: typeName,
          list: false,
          nullable: nullable,
          scalar: false,
          directives: {
            key: {
              name: keyFieldName,
            },
          },
        };

        refTypeFields[keyFieldName] = {
          name: keyFieldName,
          type: primaryKeyTypeName,
          list: false,
          nullable: nullable,
          scalar: true,
          directives: {
            ref: { name: typeName },
            ...(field.list ? {} : { unique: {} }),
          },
        };

        continue;
      }

      if (getTypeName(fieldName) !== field.type) {
        continue;
      }

      const refTypeName = field.type;
      const refType = types[refTypeName];
      const refTypeFields = refType.fields;
      const refListField = refTypeFields[getListFieldName(typeName)];
      const fieldIsList = field.list;
      const refFieldIsList = refListField?.list ?? false;

      // *:*
      if (fieldIsList && refFieldIsList) {
        const typeNames = [typeName, refTypeName].sort();
        const joinTypeName = getJoinTypeName(typeName, refTypeName);

        if (types[joinTypeName]) {
          continue;
        }

        directives.type = {
          name: joinTypeName,
          keys: getKeyFieldNames(typeName, refTypeName),
        };

        refListField.directives.type = {
          name: joinTypeName,
          keys: getKeyFieldNames(refTypeName, typeName),
        };

        const keyFieldNames = getKeyFieldNames(typeNames[0], typeNames[1]);

        types[joinTypeName] = {
          name: joinTypeName,
          directives: { join: {} },
          fields: createObject(baseFields, {
            [keyFieldNames[0]]: {
              name: keyFieldNames[0],
              type: primaryKeyTypeName,
              list: false,
              nullable: false,
              scalar: true,
              directives: {
                ref: {
                  name: typeNames[0],
                },
              },
            },
            [keyFieldNames[1]]: {
              name: keyFieldNames[1],
              type: primaryKeyTypeName,
              list: false,
              nullable: false,
              scalar: true,
              directives: {
                ref: {
                  name: typeNames[1],
                },
              },
            },
          }),
        };

        continue;
      }

      // 1:*
      if (fieldIsList && !refFieldIsList) {
        const refNonListFieldName = getFieldName(typeName);
        const keyFieldName = getKeyFieldName(typeName);

        directives.field = {
          name: refNonListFieldName,
          key: keyFieldName,
        };

        refTypeFields[refNonListFieldName] = {
          name: refNonListFieldName,
          type: typeName,
          list: false,
          nullable: true,
          scalar: false,
          directives: {
            key: {
              name: keyFieldName,
            },
          },
        };

        refTypeFields[keyFieldName] = {
          name: keyFieldName,
          type: primaryKeyTypeName,
          list: false,
          nullable: true,
          scalar: true,
          directives: {
            ref: {
              name: typeName,
            },
          },
        };

        continue;
      }

      // 1:1
      if (!fieldIsList && !refFieldIsList) {
        if (field.nullable) {
          const refNonListFieldName = getFieldName(typeName);
          const keyFieldName = getKeyFieldName(typeName);

          directives.field = {
            name: refNonListFieldName,
            key: keyFieldName,
          };

          refTypeFields[refNonListFieldName] = {
            name: refNonListFieldName,
            type: typeName,
            list: false,
            nullable: true,
            scalar: false,
            directives: {
              key: { name: keyFieldName },
            },
          };

          refTypeFields[keyFieldName] = {
            name: keyFieldName,
            type: primaryKeyTypeName,
            list: false,
            nullable: true,
            scalar: true,
            directives: {
              ref: {
                name: typeName,
              },
              unique: {},
            },
          };
        } else {
          const refNonListFieldName = getFieldName(typeName);
          const keyFieldName = getKeyFieldName(refTypeName);

          refTypeFields[refNonListFieldName] = {
            name: refNonListFieldName,
            type: typeName,
            list: false,
            nullable: true,
            scalar: false,
            directives: {
              field: { name: fieldName, key: keyFieldName },
            },
          };

          directives.key = {
            name: keyFieldName,
          };

          type.fields[keyFieldName] = {
            name: keyFieldName,
            type: primaryKeyTypeName,
            list: false,
            nullable: false,
            scalar: true,
            directives: {
              ref: {
                name: refTypeName,
              },
              unique: {},
            },
          };
        }

        continue;
      }
    }
  }

  return printSchema(sortTypes(types));
};

const uuidRegExp =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

const validateUUID = (uuid: any): string => {
  if (typeof uuid === "string" && uuidRegExp.test(uuid)) {
    return uuid;
  }

  throw new GraphQLError("UUID cannot represent value: ".concat(inspect(uuid)), {});
};

const _Date: Partial<GraphQLScalarTypeConfig<Date, (string | number)[]>> = {
  serialize(date) {
    if (date == null || !(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new GraphQLError("Date cannot represent value: ".concat(inspect(date)), {});
    }

    return [0, date.toJSON()];
  },
  parseValue(value: any) {
    let date: Date;

    if (Array.isArray(value) && value.length === 2 && value[0] === 0 && typeof value[1] === "string") {
      const value1 = value[1];
      date = new Date(value1);

      if (value1 !== date.toJSON()) {
        throw new GraphQLError("Date cannot represent value: ".concat(inspect(value)), {});
      }
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError("Date cannot represent value: ".concat(inspect(value)), {});
    }

    return date;
  },
  parseLiteral(valueNode) {
    if (valueNode.kind !== "StringValue") {
      throw new GraphQLError("Date cannot represent a non string value: ".concat(print(valueNode)), {
        nodes: valueNode,
      });
    }

    const date = new Date(valueNode.value);

    if (Number.isNaN(date.getTime())) {
      throw new GraphQLError("Date cannot represent value: ".concat(inspect(valueNode.value)), {});
    }

    return date;
  },
};

const UUID: Partial<GraphQLScalarTypeConfig<string, string>> = {
  serialize: validateUUID,
  parseValue: validateUUID,
  parseLiteral(valueNode) {
    if (valueNode.kind !== "StringValue") {
      throw new GraphQLError("UUID cannot represent a non string value: ".concat(print(valueNode)), {
        nodes: valueNode,
      });
    }

    return validateUUID(valueNode.value);
  },
};

const parseObject = (ast: ObjectValueNode, variables: any): any => {
  const value = Object.create(null);

  ast.fields.forEach((field) => {
    value[field.name.value] = parseLiteral(field.value, variables);
  });

  return value;
};

const parseLiteral = (ast: ValueNode, variables: any): any => {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.OBJECT:
      return parseObject(ast, variables);
    case Kind.LIST:
      return ast.values.map((n) => parseLiteral(n, variables));
    case Kind.NULL:
      return null;
    case Kind.VARIABLE: {
      const name = ast.name.value;
      return variables ? variables[name] : undefined;
    }
  }
};

const _JSON: Partial<GraphQLScalarTypeConfig<any, any>> = {
  parseLiteral,
};

export const buildASTSchema: typeof _buildASTSchema = (documentAST, options) => {
  const schema = _buildASTSchema(documentAST, options);
  const typeMap = schema.getTypeMap();
  Object.assign(typeMap.Date, _Date);
  Object.assign(typeMap.UUID, UUID);
  Object.assign(typeMap.JSON, _JSON);
  return schema;
};

const buildDeclaration = (schema: GraphQLSchema) => {
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
  let scalars = ``;
  let enums = ``;
  let inputs = ``;

  for (const type of Object.values(types)) {
    const name = type.name;

    if (name[0] === "_") {
      continue;
    }

    if (isScalarType(type)) {
      let type = getTypescriptType(name);

      if (type === "Date") {
        type = "globalThis.Date";
      }

      scalars += `type ${name} = ${type};`;
    } else if (isEnumType(type)) {
      enums += `type ${name} = ${type
        .getValues()
        .map(({ value }) => `"${value}"`)
        .join("|")};`;
    } else if (isInputObjectType(type)) {
      inputs += `type ${name} = {`;

      for (const field of Object.values(type.getFields())) {
        inputs += getFieldType(field);
      }

      inputs += "};";
    }
  }

  return format(`export{};declare global { namespace GraphQL {${scalars + enums + inputs}} }`, ".d.ts");
};

const buildTestData = (types: Types, baseRecordCount = 3) => {
  const recordCounts = createObject<{ [typeName: string]: number }>();

  const getRecordCount = (dep: string, deps: string[] = []): number => {
    if (deps.includes(dep)) {
      return 0;
    }

    if (recordCounts[dep]) {
      return recordCounts[dep];
    }

    const recordCount = Math.max(
      baseRecordCount,
      ...Object.values(types[dep].fields).map(({ directives: { ref, unique } }) =>
        ref ? getRecordCount(ref.name, [dep, ...deps]) * (unique ? 1 : baseRecordCount) : 0,
      ),
    );

    recordCounts[dep] = recordCount;
    return recordCount;
  };

  const dataTypes = createObject(
    Object.fromEntries(
      Object.entries(types)
        .filter(([typeName]) => !isSchemaTypeName(typeName))
        .map(([typeName, type], index) => [typeName, { ...type, index, count: getRecordCount(typeName) }]),
    ),
  );

  const defaultDataValues: { [key: string]: any } = createObject<{
    [key: string]: any;
  }>({
    ID: "",
    Int: 0,
    Float: 0,
    String: "",
    Boolean: true,
    UUID: "",
    Date: new Date(0),
    JSON: {},
  });

  const uuid = (value: number, tableIndex: number) =>
    `00000000-0000-4000-a000-${tableIndex.toString().padStart(4, "0")}${value.toString().padStart(8, "0")}`;

  return Object.entries(dataTypes).map(([table, type]) => {
    const { index, count } = dataTypes[table];
    const fields = Object.values(type.fields).filter((field) => field.scalar);
    return {
      ...type,
      index,
      count,
      fields: fields.map(({ name }) => name),
      values: [...Array(count).keys()].map((i) =>
        fields.map((field) => {
          const {
            name,
            type,
            directives: { ref },
          } = field;

          let value = defaultDataValues[type];

          if (ref) {
            const { index, count } = dataTypes[ref.name];
            value = uuid((i % count) + 1, index);
          } else if (type === "UUID") {
            value = uuid(i + 1, index);
          } else if (typeof value === "string") {
            value = `${name}-${i + 1}`;
          }

          return { ...field, value };
        }),
      ),
    };
  });
};

const buildSchemaScript = (graphql: string) =>
  format(
    `
      import buildASTSchema from "@mo36924/graphql/buildASTSchema"

      export default buildASTSchema(JSON.parse(${JSON.stringify(
        JSON.stringify(parse(stripIgnoredCharacters(graphql), { noLocation: true })),
      )}))
    `,
    ".js",
  );

const buildPostgresSchema = (types: Types) => {
  const create: string[] = [];
  const unique: string[] = [];
  const index: string[] = [];

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
        const dbType = getPostgresTypes(fieldTypeName);

        switch (fieldName) {
          case "id":
            columns.push(`${escapeIdentifier(fieldName)} ${dbType} not null primary key`);

            break;
          default:
            columns.push(`${escapeIdentifier(fieldName)} ${dbType}${nullable ? "" : " not null"}`);

            break;
        }
      }

      if (uniqueDirective) {
        unique.push(`alter table ${escapeIdentifier(typeName)} add unique (${escapeIdentifier(fieldName)});\n`);
      } else if (refDirective) {
        index.push(`create index on ${escapeIdentifier(typeName)} (${escapeIdentifier(fieldName)});\n`);
      }
    }

    create.push(
      `create table ${escapeIdentifier(typeName)} (\n${columns.map((column) => `  ${column}`).join(",\n")}\n);\n`,
    );
  }

  return [create, unique, index].flat().join("");
};

const buildPostgersTestData = (data: ReturnType<typeof buildTestData>) => {
  let insert = "";

  for (const { name, fields, values } of data) {
    const table = escapeIdentifier(name);
    const columns = fields.map(escapeIdentifier).join();

    const _values = values
      .map((v) => v.map(({ value }) => escapeLiteral(value)))
      .map((v) => `(${v.join()})`)
      .join(",\n");

    insert += `insert into ${table} (${columns}) values \n${_values};\n`;
  }

  const sql = insert;
  return sql;
};

export const buildModel = (model: string) => {
  const fixedModel = fixModel(model);
  const graphql = buildModelGraphQL(fixedModel);
  const document = parse(graphql);
  const schema = buildASTSchema(document);
  const types = buildTypes(graphql);
  const declaration = buildDeclaration(schema);
  const testData = buildTestData(types);
  const script = buildSchemaScript(graphql);
  const sql = buildPostgresSchema(types);
  const test = buildPostgersTestData(testData);
  return {
    model,
    fixedModel,
    graphql,
    document,
    schema,
    types,
    declaration,
    script,
    sql,
    test,
  };
};

export const loadConfig = () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  const {
    filepath,
    config: { model, declaration, schema, sql, test },
  } = cosmiconfigSync("graphql").search(_dirname) ?? {
    filepath: resolve(_dirname, "..", "..", "..", "..", "package.json"),
    config: {},
  };

  const configDir = dirname(filepath);
  const resolveConfigPath = (path?: string) => path && resolve(configDir, path);

  return {
    filepath,
    model: resolveConfigPath(model ?? "index.gql")!,
    declaration: resolveConfigPath(declaration ?? "node_modules/@types/_graphql/index.d.ts")!,
    schema: resolveConfigPath(schema),
    sql: resolveConfigPath(sql),
    test: resolveConfigPath(test),
  };
};

export const getSchema = () => {
  const { model: modelPath, ...config } = loadConfig();
  const model = readFile(modelPath) ?? format("type User { name: String }");
  const { fixedModel, ...result } = buildModel(model);

  if (model !== fixedModel) {
    throw new Error(
      `Invalid graphql model: ${modelPath}\n\n${diffChars(model, fixedModel)
        .map(({ added, removed, value }) => (added ? colors.bgGreen(value) : removed ? colors.bgRed(value) : value))
        .join("")}`,
    );
  }

  for (const key of ["schema", "declaration", "sql", "test"] as const) {
    if (config[key]) {
      writeFile(config[key]!, result[key === "schema" ? "graphql" : key]);
    }
  }

  return result.schema;
};

type QueryContext = ExecutionContext & { values: any[]; ids?: { [type: string]: string[] | undefined } };
type MutationContext = ExecutionContext & { date: Date; ids: { [type: string]: string[] | undefined } };
type Queries = [sql: string, values: any[]];
type MutationQueries = Queries[];
type UnorderedMutationQueries = [sortKey: any, sql: string, values: any[]][];

export const isQuery = (queries: Queries | MutationQueries): queries is Queries => typeof queries[0] === "string";

export const buildQuery = (context: ExecutionContext) => {
  switch (context.operation.operation) {
    case "query":
      return query(context);
    case "mutation":
      return mutation(context);
    default:
      throw new GraphQLError(`Unsupported ${context.operation.operation} operation.`, {});
  }
};

const query = (context: ExecutionContext, node: OperationDefinitionNode | FieldNode = context.operation): Queries => {
  const values: any[] = [];

  const sql = `select cast(${fields({ ...context, values }, "Query", node)} as text) as ${
    node.kind === "OperationDefinition" ? "data" : escapeIdentifier((node.alias ?? node.name).value)
  };`;

  return [sql, values];
};

const mutation = (context: ExecutionContext) => {
  const queries: MutationQueries = [];
  const date = new Date();

  for (const node of context.operation.selectionSet.selections as FieldNode[]) {
    const field = node.name.value;
    const method = field === "create" ? create : field === "update" ? update : field === "delete" ? _delete : undefined;

    if (method) {
      const info = getFieldDefInfo(context.schema, "Mutation", field);

      queries.push(
        ...method(
          { ...context, date, ids: Object.create(null) },
          node,
          getArgumentValues(info.def, node, context.variableValues).data as { [field: string]: any },
        ),
      );
    } else {
      queries.push(query(context, node));
    }
  }

  return queries;
};

const fields = (context: QueryContext, parent: string, node: OperationDefinitionNode | FieldNode) =>
  `jsonb_build_object(${(node.selectionSet!.selections as FieldNode[])
    .map((node) => `${escapeLiteral((node.alias ?? node.name).value)},${field(context, parent, node)}`)
    .join()})`;

const field = (context: QueryContext, parent: string, node: FieldNode) => {
  const { schema, variableValues, ids, values } = context;
  const name = node.name.value;
  const { scalar, type, list, directives, def } = getFieldDefInfo(schema, parent, name);

  if (scalar) {
    switch (type) {
      case "Date":
        return `jsonb_build_array(0,${escapeIdentifier(name)})`;
      default:
        return escapeIdentifier(name);
    }
  }

  let _ids: string[] | undefined;

  if (ids) {
    _ids = ids[type];

    if (!_ids) {
      return list ? `jsonb_build_array()` : "null";
    }
  }

  let query: string = `select ${fields(context, type, node)} as data from ${escapeIdentifier(type)}`;
  const args: { [argument: string]: any } = getArgumentValues(def, node, variableValues);
  const predicates: string[] = [];

  if (_ids) {
    predicates.push(`id in (${_ids.map(() => "?").join()})`);
    values.push(..._ids);
  }

  if (directives.type) {
    predicates.push(
      `id in (select ${escapeIdentifier(directives.type.keys[1])} from ${escapeIdentifier(
        directives.type.name,
      )} where ${escapeIdentifier(directives.type.keys[1])} is not null and ${escapeIdentifier(
        directives.type.keys[0],
      )} = ${escapeIdentifier(parent)}.id)`,
    );
  } else if (directives.field) {
    predicates.push(`${escapeIdentifier(directives.field.key)} = ${escapeIdentifier(parent)}.id}`);
  } else if (directives.key) {
    predicates.push(`id = ${escapeIdentifier(parent)}.${escapeIdentifier(directives.key.name)}`);
  }

  const _where = where(context, args.where);

  if (_where) {
    predicates.push(_where);
  }

  if (predicates.length) {
    query += ` where ${predicates.join(" and ")}`;
  }

  const _order = order(args.order);

  if (_order) {
    query += ` order by ${_order}`;
  }

  if (!list) {
    query += ` limit 1`;
  } else if (args.limit != null) {
    query += ` limit ?`;
    values.push(args.limit);
  }

  if (args.offset != null) {
    query += ` offset ?`;
    values.push(args.offset);
  }

  if (list) {
    query = `coalesce((select jsonb_agg(data) from (${query}) as t),jsonb_build_array())`;
  }

  return query;
};

const where = (context: QueryContext, args: { [key: string]: any } | null | undefined) => {
  if (!args) {
    return "";
  }

  const { not, and, or, ...fields } = args;
  const values = context.values;
  let predicates: string[] = [];

  for (const [field, operators] of Object.entries(fields)) {
    if (operators == null) {
      continue;
    }

    for (const [operator, value] of Object.entries(operators) as [ComparisonOperator, any][]) {
      if (value === null) {
        if (operator === "eq") {
          predicates.push(`${escapeIdentifier(field)} is null`);
        } else if (operator === "ne") {
          predicates.push(`${escapeIdentifier(field)} is not null`);
        }

        continue;
      }

      switch (operator) {
        case "eq":
          predicates.push(`${escapeIdentifier(field)} = ?`);
          values.push(value);
          break;
        case "ne":
          predicates.push(`${escapeIdentifier(field)} <> ?`);
          values.push(value);
          break;
        case "gt":
          predicates.push(`${escapeIdentifier(field)} > ?`);
          values.push(value);
          break;
        case "lt":
          predicates.push(`${escapeIdentifier(field)} < ?`);
          values.push(value);
          break;
        case "ge":
          predicates.push(`${escapeIdentifier(field)} >= ?`);
          values.push(value);
          break;
        case "le":
          predicates.push(`${escapeIdentifier(field)} <= ?`);
          values.push(value);
          break;
        case "in":
          predicates.push(`${escapeIdentifier(field)} in (${value.map(() => "?").join()})`);
          values.push(...value);
          break;
        case "like":
          predicates.push(`${escapeIdentifier(field)} like ?`);
          values.push(value);
          break;
      }
    }
  }

  const _not = where(context, not);

  if (_not) {
    predicates.push(`not ${_not}`);
  }

  const _and = where(context, and);

  if (_and) {
    predicates.push(_and);
  }

  if (predicates.length) {
    predicates = [predicates.join(" and ")];
  }

  const _or = where(context, or);

  if (_or) {
    predicates.push(_or);
  }

  if (!predicates.length) {
    return "";
  }

  return `(${predicates.join(" or ")})`;
};

const order = (args: { [key: string]: string } | null | undefined) =>
  args
    ? Object.entries(args)
        .map(([field, order]) => `${escapeIdentifier(field)} ${order}`)
        .join()
    : "";

const create = (context: MutationContext, node: FieldNode, data: { [field: string]: any }) => {
  const queries: MutationQueries = [];
  const schema = context.schema;

  for (const [field, value] of Object.entries(data)) {
    if (value == null) {
      continue;
    }

    const { list, type } = getFieldDefInfo(schema, "Query", field);

    if (list) {
      for (const _value of value) {
        queries.push(...createQueries(context, type, { ..._value, id: uuid() }));
      }
    } else {
      queries.push(...createQueries(context, type, { ...value, id: uuid() }));
    }
  }

  queries.push(query(context, node));
  return queries;
};

const createQueries = (
  context: MutationContext,
  parent: string,
  data: { id: string; [field: string]: any },
): MutationQueries => {
  const { schema, date, ids } = context;
  const id = data.id;
  const columns: string[] = [...baseFieldNames];
  const values: any[] = [id, uuid(), date, date];
  const pre: MutationQueries = [];
  const post: MutationQueries = [];
  (ids[parent] ??= []).push(id);

  for (const [field, value] of Object.entries(data)) {
    const { type, scalar, list, directives, isBaseFieldName } = getFieldDefInfo(schema, parent, field);

    if (isBaseFieldName) {
      continue;
    }

    if (scalar) {
      columns.push(field);
      values.push(value);
      continue;
    }

    if (value == null) {
      continue;
    }

    if (directives.type) {
      const insert = `insert into ${escapeIdentifier(directives.type.name)} (${[
        ...baseFieldNames,
        directives.type.keys[0],
        directives.type.keys[1],
      ]
        .map(escapeIdentifier)
        .join()}) values `;

      for (const data of value) {
        const _id = uuid();

        post.push(...createQueries(context, type, { ...data, id: _id }), [
          `${insert}(?,?,?,?,?,?);`,
          [uuid(), uuid(), date, date, id, _id],
        ]);
      }
    } else if (directives.key) {
      const id = uuid();
      columns.push(directives.key.name);
      values.push(id);
      pre.push(...createQueries(context, type, { ...value, id }));
    } else if (directives.field) {
      if (list) {
        for (const data of value) {
          post.push(...createQueries(context, type, { ...data, id: uuid(), [directives.field.key]: id }));
        }
      } else {
        post.push(...createQueries(context, type, { ...value, id: uuid(), [directives.field.key]: id }));
      }
    }
  }

  return [
    ...pre,
    [
      `insert into ${escapeIdentifier(parent)} (${columns.map(escapeIdentifier).join()}) values (${values
        .map(() => "?")
        .join()});`,
      values,
    ],
    ...post,
  ];
};

const sortMutationQueries = (queries: UnorderedMutationQueries): MutationQueries =>
  queries
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([_, sql, values]): [sql: string, values: any[]] => [sql, values]);

const update = (context: MutationContext, node: FieldNode, data: { [field: string]: any }): MutationQueries => {
  const mutationQueries: UnorderedMutationQueries = [];

  for (const [field, value] of Object.entries(data)) {
    if (value == null) {
      continue;
    }

    const { list, type } = getFieldDefInfo(context.schema, "Query", field);

    if (list) {
      for (const _value of value) {
        mutationQueries.push(...updateQueries(context, type, _value));
      }
    } else {
      mutationQueries.push(...updateQueries(context, type, value));
    }
  }

  const queries = sortMutationQueries(mutationQueries);
  queries.push(query(context, node));
  return queries;
};

const updateQueries = (
  context: MutationContext,
  parent: string,
  data: { id: string; version: string; [field: string]: any },
): UnorderedMutationQueries => {
  const queries: UnorderedMutationQueries = [];
  const { schema, date, ids } = context;
  const { id, version } = data;
  const values: any[] = [];
  const setValues: any[] = [];
  const whereValues: any[] = [];
  let set = `set version=?,"updatedAt"=?`;
  setValues.push(uuid(), date);
  let where = `where id=? and version=?`;
  whereValues.push(id, version);
  (ids[parent] ??= []).push(id);

  for (const [field, value] of Object.entries(data)) {
    const { type, scalar, list, directives, isBaseFieldName } = getFieldDefInfo(schema, parent, field);

    if (isBaseFieldName) {
      continue;
    }

    if (directives.ref) {
      if (value != null) {
        where += ` and ${escapeIdentifier(field)}=?`;
        whereValues.push(value);
      }

      continue;
    }

    if (scalar) {
      set += `,${escapeIdentifier(field)}=?`;
      setValues.push(value);
      continue;
    }

    if (value == null) {
      continue;
    }

    if (directives.type) {
      const update = `update ${escapeIdentifier(
        directives.type.name,
      )} set version=?,"updatedAt"=? where ${escapeIdentifier(directives.type.keys[0])}=? and ${escapeIdentifier(
        directives.type.keys[1],
      )}=?;`;

      for (const data of value) {
        const _id = data.id;
        queries.push(...updateQueries(context, type, data), [id < _id ? id : _id, update, [uuid(), date, id, _id]]);
      }
    } else if (directives.key) {
      where += ` and ${escapeIdentifier(directives.key.name)}=?`;
      whereValues.push(value.id);
      queries.push(...updateQueries(context, type, value));
    } else if (directives.field) {
      if (list) {
        for (const data of value) {
          queries.push(...updateQueries(context, type, { ...data, [directives.field.key]: id }));
        }
      } else {
        queries.push(...updateQueries(context, type, { ...value, [directives.field.key]: id }));
      }
    }
  }

  queries.push([id, `update ${escapeIdentifier(parent)} ${set} ${where};`, [...setValues, ...whereValues]]);
  return queries;
};

const _delete = (context: MutationContext, node: FieldNode, data: { [field: string]: any }) => {
  const mutationQueries: UnorderedMutationQueries = [];

  for (const [field, value] of Object.entries(data)) {
    if (value == null) {
      continue;
    }

    const { list, type } = getFieldDefInfo(context.schema, "Query", field);

    if (list) {
      for (const _value of value) {
        mutationQueries.push(...deleteQueries(context, type, _value));
      }
    } else {
      mutationQueries.push(...deleteQueries(context, type, value));
    }
  }

  const queries = sortMutationQueries(mutationQueries);
  queries.unshift(query(context, node));
  return queries;
};

const deleteQueries = (
  context: MutationContext,
  parent: string,
  data: { id: string; version: string; [field: string]: any },
): UnorderedMutationQueries => {
  const queries: UnorderedMutationQueries = [];
  const { schema, ids } = context;
  const { id, version } = data;
  const values: any[] = [];
  let where = `where id=? and version=?`;
  values.push(id, version);
  (ids[parent] ??= []).push(id);

  for (const [field, value] of Object.entries(data)) {
    if (value == null) {
      continue;
    }

    const { type, scalar, list, directives } = getFieldDefInfo(schema, parent, field);

    if (directives.ref) {
      if (value) {
        where += ` and ${escapeIdentifier(field)}=?`;
        values.push(value);
      }

      continue;
    }

    if (scalar) {
      continue;
    }

    if (directives.type) {
      const _delete = `delete from ${escapeIdentifier(directives.type.name)} where ${escapeIdentifier(
        directives.type.keys[0],
      )}=? and ${escapeIdentifier(directives.type.keys[1])}=?;`;

      for (const data of value) {
        const _id = data.id;
        queries.push(...deleteQueries(context, type, data), [id < _id ? id : _id, _delete, [id, _id]]);
      }
    } else if (directives.key) {
      where += ` and ${escapeIdentifier(directives.key.name)}=?`;
      values.push(value.id);
      queries.push(...deleteQueries(context, type, value));
    } else if (directives.field) {
      if (list) {
        for (const data of value) {
          queries.push(...deleteQueries(context, type, { ...data, [directives.field.key]: id }));
        }
      } else {
        queries.push(...deleteQueries(context, type, { ...value, [directives.field.key]: id }));
      }
    }
  }

  queries.push([id, `delete from ${escapeIdentifier(parent)} ${where};`, values]);
  return queries;
};

// json
const reviver = (_key: string, value: any) => {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "string") {
    switch (value[0]) {
      case 0:
        return new Date(value[1]);
    }
  }

  return value;
};

export const jsonParse = (data: string) => JSON.parse(data, reviver);

// babel
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

export const babel = (_api: ConfigAPI, options: Options): PluginObj => {
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
            Variable(node) {
              if (/^_\d+/.test(node.name.value)) {
                inputTypes.push(typeInfo.getInputType()!);
              }
            },
          }),
        );

        const errors = validate(schema, document, rules);

        if (errors.length) {
          throw path.buildCodeFrameError(errors[0].message);
        }

        query = stripIgnoredCharacters(print(document));
        const properties: t.ObjectProperty[] = [t.objectProperty(t.identifier("query"), t.stringLiteral(query))];

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
