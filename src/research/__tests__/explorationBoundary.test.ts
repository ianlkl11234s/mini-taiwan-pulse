import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import ts from "typescript";

// Guard the runtime dependency boundary, not just whether advanced buttons are hidden.
function dependencies(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const follow = (specifier: string) => {
      if (!specifier.startsWith(".")) return;
      const base = resolve(dirname(file), specifier);
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(path => /\.[cm]?[jt]sx?$/.test(path) && existsSync(path));
      if (target) visit(target);
    };
    const walk = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const onlyTypes = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(item => item.isTypeOnly));
        if (!onlyTypes) follow(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        follow(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        follow(node.arguments[0].text);
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  visit(entry);
  return [...seen].map(file => relative(process.cwd(), file));
}

describe("paired research runtime boundary", () => {
  it("loads bounded dataset readers and typed analysis, but not presentation overlays", () => {
    const reached = dependencies(resolve("src/research/MainMapConnection.tsx"));
    expect(reached).toContain("src/research/layerExploration.ts");
    expect(reached).toContain("src/research/researchDatasets.ts");
    expect(reached).toContain("src/research/queryExecutor.ts");
    expect(reached).toContain("src/research/researchAnalysisSession.ts");
    expect(reached).toContain("src/research/analysisOperations.ts");
    const presentation = /\/research\/(nearbyData|nearbyOverlay|analysisResultOverlay|NearbyResults)\.[jt]sx?$/;
    expect(reached.filter(file => presentation.test(file))).toEqual([]);
  });
});
