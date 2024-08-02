import { transformSync } from "@babel/core";
import { expect, test } from "vitest";
import babelPluginGraphQL from "./babelPluginGraphQL";

test("babelPluginGraphQL", () => {
  // eslint-disable-next-line no-template-curly-in-string
  const result = transformSync("gql`{users(limit: ${i}){name}}`", { plugins: [babelPluginGraphQL] });

  expect(result?.code).toMatchInlineSnapshot(`
    "({
      query: "query($_0:Int){users(limit:$_0){name}}",
      variables: {
        _0: i
      }
    });"
  `);
});
