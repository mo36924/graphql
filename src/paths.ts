import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
let path = join(filename, "..", "..");
const suffix = `${sep}node_modules${sep}@mo36924${sep}graphql`;
if (path.endsWith(suffix)) {
  path = path.slice(0, -suffix.length);
}

export const rootpath = path;
export const nodeModulesPath = join(path, "node_modules");
export const schemaPath = join(path, "schema.gql");
