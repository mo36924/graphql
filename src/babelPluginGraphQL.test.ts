import { transformSync } from "@babel/core";
import { expect, it } from "vitest";
import babelPluginGraphQL from "./babelPluginGraphQL";

it("babelPluginGraphQL", () => {
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
