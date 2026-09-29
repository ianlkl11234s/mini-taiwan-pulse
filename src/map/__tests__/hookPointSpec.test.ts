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

/** HOOK_POINT_TIERS 每行註解結尾的 `src/...` 是該層的 hook 檔；回傳 檔案 → 該檔涵蓋的分階。 */
function hookTierFiles(): Map<string, Set<string>> {
  const text = fs.readFileSync(path.join(SOURCE_ROOT, "map", "pointTiers.ts"), "utf8");
  const block = text.slice(text.indexOf("export const HOOK_POINT_TIERS"));
  const byFile = new Map<string, Set<string>>();
  for (const line of block.split("\n")) {
    const match = line.match(/^\s+\w+: "([SMLB])",.*(src\/[\w/.]+\.tsx?)\s*$/);
    const [, tier, file] = match ?? [];
    if (!tier || !file) continue;
    byFile.set(file, (byFile.get(file) ?? new Set<string>()).add(tier));
  }
  return byFile;
}

const LEGACY_RADIUS_HELPERS = [
  "scaledRadius", "dotRadiusExpression", "CIRCLE_RADIUS", "RADIUS_EXPR", "marineObservationRadiusExpression",
];
/** B 類（依資料決定半徑）本來就保留自己的半徑算式，不受舊 helper 名稱限制。 */
const LEGACY_RADIUS_ALLOWLIST = new Set([
  "src/hooks/useFloodSensorLayer.ts",
  "src/hooks/useEarthquakeLayer.ts",
  "src/hooks/useEarthquakesGlobalLayer.ts",
  "src/map/earthquakeReplayLayerFactory.ts",
]);
/** 掃描誤列：主體是 symbol icon，circle 只是選取圈／群集泡泡／連線節點，不是主體點。 */
const NOT_A_POINT_FILE = new Set(["src/hooks/useGlobalEventsLayer.ts"]);
/** 描邊依資料變色（深度色），是資料編碼，不套底圖色細縫。 */
const STROKE_EXEMPT = new Set([
  "src/hooks/useGlobalEventsLayer.ts", // 同上：circle 非主體
  "src/hooks/useEarthquakeLayer.ts",
  "src/hooks/useEarthquakesGlobalLayer.ts",
]);

describe("hook point spec R2 ratchet", () => {
  it("does not reintroduce zoom-driven circle radii outside the overlay registry", () => {
    // R2 hooks baseline before: 24; after this migration: 3（≤ 才是 ratchet：只准變少）。
    expect(zoomDrivenCircleRadii().length).toBeLessThanOrEqual(3);
  });

  it("every non-bubble hook point file uses pointRadius and pointStrokePaint", () => {
    const byFile = hookTierFiles();
    expect(byFile.size).toBeGreaterThan(30);
    const missing: string[] = [];
    for (const [file, tiers] of byFile) {
      const text = fs.readFileSync(path.join(SOURCE_ROOT, "..", file), "utf8");
      const fixedTier = [...tiers].some((tier) => tier !== "B");
      if (fixedTier && !NOT_A_POINT_FILE.has(file) && !text.includes("pointRadius(")) missing.push(`${file}: pointRadius(`);
      if (!STROKE_EXEMPT.has(file) && !text.includes("pointStrokePaint(")) missing.push(`${file}: pointStrokePaint(`);
    }
    expect(missing).toEqual([]);
  });

  it("no legacy radius helpers remain in hook point files", () => {
    const offenders: string[] = [];
    for (const file of hookTierFiles().keys()) {
      if (LEGACY_RADIUS_ALLOWLIST.has(file)) continue;
      const text = fs.readFileSync(path.join(SOURCE_ROOT, "..", file), "utf8");
      for (const name of LEGACY_RADIUS_HELPERS) if (text.includes(name)) offenders.push(`${file}: ${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it("does not hand-roll the stroke opacity formula", () => {
    const offenders = SCAN_ROOTS.flatMap(sourceFiles)
      .filter((file) => !file.endsWith("pointSpec.ts") && !file.endsWith("mapStyleScale.ts"))
      .filter((file) => /Math\.min\(1,\s*POINT_STROKE\.opacity/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SOURCE_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("uses fixed tiers and theme seam strokes in extracted paint helpers", () => {
    expect(animalWelfarePointRadius(1)).toBe(4.5);
    expect(animalWelfarePointStroke(true, 0.85)).toMatchObject({
      "circle-stroke-color": "#0a0a14", "circle-stroke-width": 1, "circle-stroke-opacity": 0.8,
    });
    expect(powerPolePointPaint(false, 0.7, 1)).toMatchObject({
      "circle-radius": 4.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
    });
    // 火災：casualty 為真時保留白框（資料編碼），其餘為底圖色細縫。
    expect(fireEventsPointStroke(true, 1)).toMatchObject({
      "circle-stroke-color": ["case", ["get", "casualty"], "#ffffff", "#0a0a14"],
      "circle-stroke-opacity": 0.8,
    });
    expect(fireLatestPointStroke(false, 1)).toMatchObject({
      "circle-stroke-color": ["case", ["get", "casualty"], "#ffffff", "#ffffff"],
      "circle-stroke-opacity": 0.9,
    });
  });
});
