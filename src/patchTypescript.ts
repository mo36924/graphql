/* eslint-disable ts/consistent-type-imports */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CompletionItemKind } from "graphql-language-service";
import { buildSync } from "esbuild";
import ts from "typescript";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { nodeModulesPath } from "./paths";

declare const graphql: typeof import("graphql");
declare const graphqlLanguageService: typeof import("graphql-language-service");
declare const getGraphQLSchema: typeof import("./getGraphQLSchema").getGraphQLSchema;

declare const {
  DiagnosticCategory,
  ScriptElementKind,
  createLanguageService: _createLanguageService,
  forEachChild,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isTaggedTemplateExpression,
  isTemplateMiddle,
  isTemplateTail,
}: typeof ts;
declare const {
  emptyArray,
  createAnonymousType,
  createArrayType,
  getUnionType,
  createProperty,
  createSymbolTable,
  createTupleType,
  getIntersectionType,
  getGlobalType,
  getGlobalTemplateStringsArrayType,
}: any;
declare const [unknownType, stringType, numberType, booleanType, nullType]: ts.Type[];

function getEffectiveTemplateStringsArrayType(node: ts.TaggedTemplateExpression): ts.Type | undefined {
  const {
    TypeInfo,
    getNamedType,
    getNullableType,
    isListType,
    isNullableType,
    parse,
    validate,
    visit,
    visitWithTypeInfo,
    specifiedRules,
    NoUndefinedVariablesRule,
  } = graphql;

  const isQueryTag = ({ tag }: ts.TaggedTemplateExpression) => isIdentifier(tag) && tag.escapedText === "gql";

  const getGlobalDateType = () => getGlobalType("Date", 0, true) || unknownType;

  const createPropertiesType = (symbolTable: ts.SymbolTable) =>
    createAnonymousType(undefined, symbolTable, emptyArray, emptyArray, emptyArray);

  const getTypescriptType = (typeName: string) => {
    switch (typeName) {
      case "ID":
      case "String":
        return stringType;
      case "Int":
      case "Float":
        return numberType;
      case "Boolean":
        return booleanType;
      case "Date":
        return getGlobalDateType();
      default:
        return unknownType;
    }
  };

  if (!isQueryTag(node)) {
    return;
  }

  const { template } = node;
  let query = "";
  if (isNoSubstitutionTemplateLiteral(template)) {
    query += template.text;
  } else {
    query += template.head.text;
    template.templateSpans.forEach((span, i) => {
      query += `$_${i}${span.literal.text}`;
    });
  }
  let documentNode;
  try {
    documentNode = parse(query);
  } catch {
    return;
  }
  const validationRules = specifiedRules.filter((rule) => rule !== NoUndefinedVariablesRule);
  const graphqlSchema = getGraphQLSchema();
  const errors = validate(graphqlSchema, documentNode, validationRules);
  if (errors.length) {
    return;
  }
  const typeInfo = new TypeInfo(graphqlSchema);
  const values: ts.Type[] = [];
  const variables: ts.Symbol[] = [];
  const symbols: ts.Symbol[] = [];
  const symbolsMap = new Map<any, ts.Symbol[]>();
  let i = 0;
  visit(
    documentNode,
    visitWithTypeInfo(typeInfo, {
      Variable() {
        const variableName = `_${i++}`;
        const inputType = typeInfo.getInputType();
        const nullableType = getNullableType(inputType);
        const namedType = getNamedType(nullableType)!;
        let type = getTypescriptType(namedType.name);
        if (isListType(nullableType)) {
          type = createArrayType(type);
        }
        if (isNullableType(inputType)) {
          type = getUnionType([type, nullType]);
        }
        const symbol = createProperty(variableName, type);
        values.push(type);
        variables.push(symbol);
      },
      Field: {
        enter(node, _key, parent) {
          if (node.selectionSet) {
            symbolsMap.set(node.selectionSet.selections, []);
            return;
          }
          const parentSymbols = symbolsMap.get(parent) || symbols;
          const fieldName = (node.alias || node.name).value;
          const outputType = typeInfo.getType();
          const namedType = getNamedType(outputType)!;
          let type = getTypescriptType(namedType.name);
          if (isNullableType(outputType)) {
            type = getUnionType([type, nullType]);
          }
          const symbol = createProperty(fieldName, type);
          parentSymbols.push(symbol);
          return false;
        },
        leave(node, _key, parent) {
          const parentSymbols = symbolsMap.get(parent) || symbols;
          const fieldName = (node.alias || node.name).value;
          const outputType = typeInfo.getType();
          const nullableType = getNullableType(outputType);
          const selectionSymbols = symbolsMap.get(node.selectionSet?.selections ?? []);
          const selectionSymbolTable = createSymbolTable(selectionSymbols);
          let type = createPropertiesType(selectionSymbolTable);
          if (isListType(nullableType)) {
            type = createArrayType(type);
          }
          if (isNullableType(outputType)) {
            type = getUnionType([type, nullType]);
          }
          const symbol = createProperty(fieldName, type);
          parentSymbols.push(symbol);
        },
      },
    }),
  );
  const valuesSymbol = createProperty("values", createTupleType(values));
  const variablesSymbol = createProperty("variables", createPropertiesType(createSymbolTable(variables)));
  const dataSymbol = createProperty("data", createPropertiesType(createSymbolTable(symbols)));
  const privateSymbol = createProperty(
    "_",
    createPropertiesType(createSymbolTable([valuesSymbol, variablesSymbol, dataSymbol])),
  );
  const graphQLTemplateStringsArrayType = getIntersectionType([
    getGlobalTemplateStringsArrayType(),
    createPropertiesType(createSymbolTable([privateSymbol])),
  ]);
  return graphQLTemplateStringsArrayType;
}

function createLanguageService(...args: Parameters<typeof _createLanguageService>): ts.LanguageService {
  const { GraphQLError } = graphql;
  const {
    CompletionItemKind,
    DIAGNOSTIC_SEVERITY,
    Position,
    getDiagnostics,
    getTokenAtPosition,
    getAutocompleteSuggestions,
    getHoverInformation,
  } = graphqlLanguageService;

  const isQueryTag = (node: ts.Node): node is ts.TaggedTemplateExpression =>
    isTaggedTemplateExpression(node) && isIdentifier(node.tag) && node.tag.escapedText === "gql";

  const getScriptElementKind = (completionItemKind: CompletionItemKind | undefined): ts.ScriptElementKind => {
    switch (completionItemKind) {
      case CompletionItemKind.Function:
      case CompletionItemKind.Constructor:
        return ScriptElementKind.functionElement;
      case CompletionItemKind.Field:
      case CompletionItemKind.Variable:
        return ScriptElementKind.memberVariableElement;
      default:
        return ScriptElementKind.unknown;
    }
  };

  const getDiagnosticCategory = (diagnosticSeverity: DiagnosticSeverity | undefined): ts.DiagnosticCategory => {
    switch (diagnosticSeverity) {
      case DIAGNOSTIC_SEVERITY.Warning:
        return DiagnosticCategory.Warning;
      case DIAGNOSTIC_SEVERITY.Information:
        return DiagnosticCategory.Message;
      case DIAGNOSTIC_SEVERITY.Hint:
        return DiagnosticCategory.Suggestion;
      default:
        return DiagnosticCategory.Error;
    }
  };

  const getHoverQueryTag = (sourceFile: ts.SourceFile, position: number) => {
    const tag = forEachChild(sourceFile, function visitor(node): true | undefined | ts.TaggedTemplateExpression {
      if (position < node.pos) {
        return true;
      }

      if (position >= node.end) {
        return;
      }

      if (isQueryTag(node)) {
        const template = node.template;

        if (isNoSubstitutionTemplateLiteral(template)) {
          if (position >= template.getStart() + 1 && position < template.getEnd() - 1) {
            return node;
          }
        } else {
          const head = template.head;

          if (position >= head.getStart() + 1 && position < head.getEnd() - 2) {
            return node;
          }

          for (const { literal } of template.templateSpans) {
            if (
              position >= literal.getStart() + 1 &&
              position < literal.getEnd() - (isTemplateMiddle(literal) ? 2 : 1)
            ) {
              return node;
            }
          }
        }
      }

      return forEachChild(node, visitor);
    });

    if (tag === true) {
      return;
    }

    return tag;
  };

  const normalizeQuery = (node: ts.TaggedTemplateExpression) => {
    const template = node.template;
    let query = "";

    if (isNoSubstitutionTemplateLiteral(template)) {
      // 2 \`\`
      const templateWidth = template.getWidth() - 2;
      query = template.text.padStart(templateWidth);
    } else {
      const head = template.head;
      const templateSpans = template.templateSpans;

      // 3 \`...\${
      const templateWidth = head.getWidth() - 3;
      query = head.text.padStart(templateWidth);

      templateSpans.forEach((span, i) => {
        const spanWidth = span.getFullWidth();
        const literal = span.literal;
        const literalWidth = literal.getWidth();
        const expressionWidth = spanWidth - literalWidth;
        const variableName = `$_${i}`;
        const variable = variableName.padStart(expressionWidth + 2).padEnd(expressionWidth + 3);
        const templateWidth = literalWidth - (isTemplateTail(literal) ? 2 : 3);
        const template = literal.text.padStart(templateWidth);
        query += variable + template;
      });
    }

    const field = query.match(/\w+/)?.[0] ?? "";
    const graphqlSchema = getGraphQLSchema();
    const isMutation = !!graphqlSchema.getMutationType()?.getFields()[field];
    const operation = isMutation ? "mutation" : "query";
    query = operation + query.replace(/\n|\r/g, " ");
    const offset = -operation.length + template.getStart() + 1;

    return { query, offset };
  };

  const languageService = _createLanguageService(...args);
  const getSourceFile = (fileName: string) => languageService.getProgram()?.getSourceFile(fileName);

  return {
    ...languageService,
    getQuickInfoAtPosition(fileName, position) {
      const sourceFile = getSourceFile(fileName);

      if (!sourceFile) {
        return;
      }

      const tag = getHoverQueryTag(sourceFile, position);

      if (!tag) {
        return languageService.getQuickInfoAtPosition(fileName, position);
      }

      const { query, offset } = normalizeQuery(tag);
      const cursor = new Position(0, position - offset);
      const token = getTokenAtPosition(query, cursor);
      const graphqlSchema = getGraphQLSchema();
      const marked = getHoverInformation(graphqlSchema, query, cursor, token);

      if (marked === "" || typeof marked !== "string") {
        return;
      }

      return {
        kind: ScriptElementKind.string,
        textSpan: {
          start: offset + token.start,
          length: token.end - token.start,
        },
        kindModifiers: "",
        displayParts: [{ text: marked, kind: "" }],
      };
    },
    getCompletionsAtPosition(fileName, position, options) {
      const sourceFile = getSourceFile(fileName);

      if (!sourceFile) {
        return;
      }

      const tag = getHoverQueryTag(sourceFile, position);

      if (!tag) {
        return languageService.getCompletionsAtPosition(fileName, position, options);
      }

      const { query, offset } = normalizeQuery(tag);
      const cursor = new Position(0, position - offset);
      const graphqlSchema = getGraphQLSchema();
      const items = getAutocompleteSuggestions(graphqlSchema, query, cursor);

      if (/^\s*{\s*}\s*$/.test(query)) {
        const operation = "mutation";
        const cursor = new Position(0, operation.length + position - offset);
        const labels = new Set(items.map((item) => item.label));
        const mutationItems = getAutocompleteSuggestions(graphqlSchema, operation + query, cursor).filter(
          (item) => !labels.has(item.label),
        );
        items.push(...mutationItems);
      }

      if (!items.length) {
        return;
      }

      return {
        isGlobalCompletion: false,
        isMemberCompletion: false,
        isNewIdentifierLocation: false,
        entries: items.map((item) => ({
          name: item.label,
          kindModifiers: "",
          kind: getScriptElementKind(item.kind),
          sortText: "",
        })),
      };
    },
    getSemanticDiagnostics(fileName) {
      const diagnostics = languageService.getSemanticDiagnostics(fileName);
      const sourceFile = getSourceFile(fileName);

      if (!sourceFile) {
        return diagnostics;
      }

      forEachChild(sourceFile, function visitor(node) {
        if (isQueryTag(node)) {
          try {
            const { query, offset } = normalizeQuery(node);
            const graphqlSchema = getGraphQLSchema();
            const _diagnostics = getDiagnostics(query, graphqlSchema);

            for (const {
              range: { start, end },
              severity,
              message,
            } of _diagnostics) {
              if (/Variable "\$.*?" is not defined/.test(message)) {
                continue;
              }
              diagnostics.push({
                category: getDiagnosticCategory(severity),
                code: 9999,
                messageText: message,
                file: sourceFile,
                start: start.character + offset,
                length: end.character - start.character,
              });
            }
          } catch (error) {
            if (error instanceof GraphQLError) {
              diagnostics.push({
                category: DiagnosticCategory.Error,
                code: 9999,
                messageText: error.message,
                file: sourceFile,
                start: node.template.getStart() + 1,
                length: node.template.getWidth() - 2,
              });
            }
          }
        }

        forEachChild(node, visitor);
      });

      return diagnostics;
    },
  };
}

const result = buildSync({
  bundle: true,
  write: false,
  platform: "node",
  mainFields: ["module", "main"],
  resolveExtensions: [".ts", ".mjs", ".js", ".cjs"],
  logLevel: "error",
  external: ["prettier", "@prettier/sync"],
  banner: { js: "var _importMetaUrl = require('url').pathToFileURL(__filename).href;" },
  define: {
    "import.meta.url": "_importMetaUrl",
  },
  stdin: {
    contents: `
        export * as graphql from "graphql"
        export * as graphqlLanguageService from "graphql"
        export { getGraphQLSchema } from "./getGraphQLSchema"
      `,
    loader: "ts",
    resolveDir: dirname(fileURLToPath(import.meta.url)),
  },
});

const code = `
const { graphql, graphqlLanguageService, getGraphQLSchema } = (() => {
  var exports = {}
  var module = { exports };
  ${result.outputFiles[0]?.text ?? ""}
  return module.exports;
})();
`;

for (const name of ["tsc", "tsserver"]) {
  const src = join(nodeModulesPath, "typescript", "lib", `${name}.js`);
  const dest = `${src}_`;
  if (!existsSync(dest)) {
    copyFileSync(src, dest);
  }
  writeFileSync(
    src,
    readFileSync(dest, "utf-8")
      .replace('"use strict";', (match) => match + code)
      .replace(
        /function getEffectiveCallArguments[\s\S]*?(?=getGlobalTemplateStringsArrayType)/,
        (match) => `${getEffectiveTemplateStringsArrayType}${match}getEffectiveTemplateStringsArrayType(node)||`,
      )
      .replace("function createLanguageService(", () => `${createLanguageService}function _createLanguageService(`),
  );
}
