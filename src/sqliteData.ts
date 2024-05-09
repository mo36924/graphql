import { GraphQLSchema } from "graphql";
import { buildData } from "./data";
import { identifier, literal } from "./sqlite";

export const buildSQLiteData = (schema: GraphQLSchema) => {
  const data = buildData(schema);
  let insert = "";

  for (const { name, fields, values } of data) {
    const table = identifier(name);
    const columns = fields.map(identifier).join();

    const _values = values
      .map((v) => v.map(({ value }) => literal(value)))
      .map((v) => `(${v.join()})`)
      .join(",\n");

    insert += `insert into ${table} (${columns}) values \n${_values};\n`;
  }

  const sql = insert;
  return sql;
};
