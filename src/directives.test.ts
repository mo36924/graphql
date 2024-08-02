import { expect, test } from "vitest";
import { printDirectives } from "./directives";

test("printDirectives", () => {
  expect(printDirectives({ field: { name: "user", key: "userId" } })).toMatchInlineSnapshot(
    `"@field(name:"user" key:"userId" )"`,
  );
});
