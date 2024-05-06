#!/usr/bin/env node

const patch = async () => {
  await import("./patchGraphQL");
  await import("./patchPrettier");
  await import("./patchTypescript");
};

patch().catch(console.error);
