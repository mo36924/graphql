import { expect, it } from "vitest";
import { patchPrettier } from "./patchPrettier";

it("patchPrettier", async () => {
  patchPrettier();
  // eslint-disable-next-line no-template-curly-in-string
  const code = "gql`{users(limit:${i}){id,name}}`";
  const { resolveConfig, format } = await import("prettier");
  const config = await resolveConfig("index.js");
  const formattedCode = await format(code, { ...config, filepath: "index.js" });
  expect(formattedCode).toMatchInlineSnapshot(`
    "gql\`
      {
        users(limit: \${i}) {
          id
          name
        }
      }
    \`;
    "
  `);
});
