import { GraphQLSchema } from "graphql";
import { ScalarTypeName } from "./scalars";
import { getSchemaTypes } from "./schema";
import { isSchemaTypeName } from "./types";
import { createObject } from "./utils";

export const buildData = (schema: GraphQLSchema, baseRecordCount = 3) => {
  const types = getSchemaTypes(schema);
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
    [key in ScalarTypeName]: any;
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
