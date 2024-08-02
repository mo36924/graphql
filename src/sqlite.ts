import {
  TypeInfo,
  getArgumentValues,
  getNamedType,
  getNullableType,
  isListType,
  isScalarType,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { Context } from "./buildContext";
import { getDirectives } from "./directives";

export const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
export const literal = (value: string | number | boolean | Date | null | undefined) => {
  if (value == null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
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

  return value;
};

const where = (args: { [key: string]: any } | null | undefined) => {
  if (!args) {
    return "";
  }

  const { not, and, or, ...fields } = args;
  let predicates: string[] = [];

  for (const [field, operators] of Object.entries(fields)) {
    if (operators == null) {
      continue;
    }

    for (const [operator, value] of Object.entries<any>(operators)) {
      if (value === null) {
        if (operator === "eq") {
          predicates.push(`${identifier(field)} is null`);
        } else if (operator === "ne") {
          predicates.push(`${identifier(field)} is not null`);
        }

        continue;
      }

      if (operator === "in") {
        predicates.push(`${identifier(field)} in (${value.map((value: any) => `${literal(value)}`).join()})`);
      } else if (operator in operators) {
        predicates.push(`${identifier(field)} ${operators[operator]} ${literal(value)}`);
      }
    }
  }

  const _not = where(not);

  if (_not) {
    predicates.push(`not ${_not}`);
  }

  const _and = where(and);

  if (_and) {
    predicates.push(_and);
  }

  if (predicates.length) {
    predicates = [predicates.join(" and ")];
  }

  const _or = where(or);

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
        .map(([field, order]) => `${identifier(field)} ${order}`)
        .join()
    : "";

export const buildQuery = ({ schema, operation, variableValues }: Context) => {
  const typeInfo = new TypeInfo(schema);

  const query = visit(
    operation,
    visitWithTypeInfo(typeInfo, {
      OperationDefinition: { leave: (node) => `select json(${node.selectionSet}) as ${identifier("data")}` },
      SelectionSet: { leave: (node) => `jsonb_object(${node.selections})` },
      Field: {
        leave(node) {
          const fieldType = typeInfo.getType()!;
          const nullableType = getNullableType(fieldType);
          const list = isListType(nullableType);
          const namedType = getNamedType(nullableType);
          const scalar = isScalarType(namedType);
          const type = namedType.name;
          let value: string;

          if (scalar) {
            const name = node.name.value;

            switch (type) {
              case "Boolean":
                value = `case ${identifier(name)} when true then jsonb(${literal("true")}) when false then jsonb(${literal("false")}) else null end`;
                break;
              case "Date":
                value = `jsonb_array(0,${identifier(name)})`;
                break;
              default:
                value = identifier(name);
            }
          } else {
            value = `select ${node.selectionSet} as ${identifier("data")} from ${identifier(type)}`;
            const fieldDef = typeInfo.getFieldDef()!;
            const parent = typeInfo.getParentType()!.name;
            const directives = getDirectives(schema, fieldDef.astNode!);
            const args: { [argument: string]: any } = getArgumentValues(fieldDef, node, variableValues);
            const predicates: string[] = [];

            if (directives.type) {
              predicates.push(
                `id in (select ${identifier(directives.type.keys[1])} from ${identifier(directives.type.name)} where ${identifier(
                  directives.type.keys[1],
                )} is not null and ${identifier(directives.type.keys[0])} = ${identifier(parent)}.${identifier("id")})`,
              );
            } else if (directives.field) {
              predicates.push(`${identifier(directives.field.key)} = ${identifier(parent)}.${identifier("id")}`);
            } else if (directives.key) {
              predicates.push(`${identifier("id")} = ${identifier(parent)}.${identifier(directives.key.name)}`);
            }

            const _where = where(args.where);

            if (_where) {
              predicates.push(_where);
            }

            if (predicates.length) {
              value += ` where ${predicates.join(" and ")}`;
            }

            const _order = order(args.order);

            if (_order) {
              value += ` order by ${_order}`;
            }

            if (!list) {
              value += ` limit 1`;
            } else if (args.limit != null) {
              value += ` limit ${literal(args.limit)}`;
            }

            if (args.offset != null) {
              value += ` offset ${literal(args.offset)}`;
            }

            if (list) {
              value = `coalesce((select jsonb_group_array(${identifier("data")}) from (${value}) as ${identifier(
                "t",
              )}),jsonb_array())`;
            } else {
              value = `(${value})`;
            }
          }

          return `${literal((node.alias ?? node.name).value)},${value}`;
        },
      },
    }),
  ) as any;

  if (typeof query !== "string") {
    throw new Response(null, { status: 400, statusText: "Bad Request" });
  }

  return query;
};
