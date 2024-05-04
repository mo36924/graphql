import antfu from "@antfu/eslint-config";

export default antfu({
  stylistic: false,
  typescript: {
    overrides: {
      "ts/consistent-type-imports": ["error", { prefer: "no-type-imports" }],
    },
  },
});
