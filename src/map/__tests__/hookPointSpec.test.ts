import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  animalWelfarePointRadius,
  animalWelfarePointStroke,
} from "../../hooks/useAnimalWelfarePointsLayer";
import { fireEventsPointStroke } from "../../hooks/useFireEventsLayer";
import { fireLatestPointStroke } from "../../hooks/useFireLatestLayer";
import { powerPolePointPaint } from "../../hooks/usePowerPolesLayer";

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_ROOTS = [path.join(SOURCE_ROOT, "hooks"), path.join(SOURCE_ROOT, "map")];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(file);
    if (!/\.tsx?$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) return [];
    return file.endsWith(path.join("map", "overlayRegistry.ts")) ? [] : [file];
  });
}

function containsZoom(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if ((ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) && child.text === "zoom") {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function propertyName(node: ts.PropertyName): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : null;
}

function zoomDrivenCircleRadii(): string[] {
  const hits: string[] = [];
  for (const file of SCAN_ROOTS.flatMap(sourceFiles)) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      let radiusValue: ts.Node | undefined;
      if (ts.isPropertyAssignment(node) && propertyName(node.name) === "circle-radius") {
        radiusValue = node.initializer;
      } else if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === "setPaintProperty"
        && node.arguments[1] != null
        && ts.isStringLiteral(node.arguments[1])
        && node.arguments[1].text === "circle-radius"
      ) {
        radiusValue = node.arguments[2];
      }
      if (radiusValue && containsZoom(radiusValue)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        hits.push(`${path.relative(SOURCE_ROOT, file)}:${line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return hits.sort();
}

describe("hook point spec R2 ratchet", () => {
  it("does not reintroduce zoom-driven circle radii outside the overlay registry", () => {
    // R2 hooks baseline before: 24; after this migration: 3.
    expect(zoomDrivenCircleRadii()).toHaveLength(3);
  });

  it("uses fixed tiers and theme seam strokes in extracted paint helpers", () => {
    expect(animalWelfarePointRadius(1)).toBe(4.5);
    expect(animalWelfarePointStroke(true, 0.85)).toMatchObject({
      "circle-stroke-color": "#0a0a14", "circle-stroke-width": 1, "circle-stroke-opacity": 0.8,
    });
    expect(powerPolePointPaint(false, 0.7, 1)).toMatchObject({
      "circle-radius": 4.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
    });
    expect(fireEventsPointStroke(true, 1)).toMatchObject({
      "circle-stroke-color": "#0a0a14", "circle-stroke-width": 1, "circle-stroke-opacity": 0.8,
    });
    expect(fireLatestPointStroke(false, 1)).toMatchObject({
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
    });
  });
});
