import { createRequire } from "node:module";
import { join } from "node:path";

export const rootpath = join(createRequire(import.meta.url).resolve("graphql"), "..", "..", "..");
export const nodeModulesPath = join(rootpath, "node_modules");
export const schemaPath = join(rootpath, "schema.gql");
