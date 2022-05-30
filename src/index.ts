import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { camelCase, pascalCase } from "change-case";
import { cosmiconfigSync } from "cosmiconfig";
import { diffChars } from "diff";
import {
  FieldDefinitionNode,
  GraphQLInputField,
  GraphQLSchema,
  NoUndefinedVariablesRule,
  ObjectTypeDefinitionNode,
  buildASTSchema as _buildASTSchema,
  getNamedType,
  getNullableType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  parse,
  print,
  specifiedRules,
  stripIgnoredCharacters,
} from "graphql";
import { getArgumentValues } from "graphql/execution/values";
import colors from "picocolors";
import pluralize from "pluralize";
import prettier from "prettier";
import buildASTSchema from "./buildASTSchema";

const primaryKeyTypeName = "UUID";
const baseScalarTypeNames = ["ID", "Int", "Float", "String", "Boolean"] as const;
const customScalarTypeNames = ["Date", "UUID", "JSON"] as const;
const schemaTypeNames = ["Query", "Mutation", "Subscription"];
const baseFieldNames = ["id", "version", "createdAt", "updatedAt"];
const comparisonOperators = ["eq", "ne", "gt", "lt", "ge", "le", "in", "like"];
const logicalOperators = ["not", "and", "or"];
const graphqlTags = ["gql", "query", "useQuery", "mutation", "useMutation", "subscription", "useSubscription"] as const;
type ScalarTypeName = typeof scalarTypeNames[number];
type GraphQLTag = typeof graphqlTags[number];
type GraphQLTagOperation = "" | "query" | "mutation" | "subscription";

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
const isGraphQLTag = (tag: string): tag is GraphQLTag => graphqlTags.includes(tag as any);
const validationRules = specifiedRules.filter((rule) => rule !== NoUndefinedVariablesRule);

const getTypescriptType = (type: string): string =>
  typescriptTypes.hasOwnProperty(type) ? typescriptTypes[type as ScalarTypeName] : type;

const getPostgresTypes = (type: string) => {
  if (postgresTypes.hasOwnProperty(type)) {
    return postgresTypes[type as ScalarTypeName];
  }

  throw new Error("Invalid type.");
};

const getGraphQLTagOperation = (tag: GraphQLTag) => graphqlTagOperations[tag];

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

const writeFile = (path: string, data: string) => {
  mkdirSync(dirname(path), { recursive: true });

  try {
    const _data = readFileSync(path, "utf-8");

    if (data === _data) {
      return;
    }
  } catch {}

  writeFileSync(path, data);
};

const escapeIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const escapeLiteral = (value: string | number | boolean | Date | null | undefined) => {
  if (value === null || value === undefined) {
    return "NULL";
  }

  switch (typeof value) {
    case "boolean":
      return value ? "TRUE" : "FALSE";
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

const buildModel = (model: string) => {
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

const loadConfig = () => {
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

const getSchema = () => {
  const { model: modelPath, ...config } = loadConfig();
  let model: string;

  try {
    model = readFileSync(modelPath, "utf-8");
  } catch (error) {
    model = format("type User { name: String }");
  }

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

export * from "graphql";
export {
  GraphQLTag,
  GraphQLTagOperation,
  isGraphQLTag,
  getGraphQLTagOperation,
  validationRules,
  buildModel,
  loadConfig,
  getSchema,
};
