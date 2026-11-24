/**
 * 國家模組邊界（B1 P2，2026-11-24）：國家模組不 import 別國的國家模組。
 *
 * 為什麼：之後要把各國搬成可延後載入的「國家包」。只要有一條靜態 import 指向別國，rollup 就會把別國拉回開站。
 * 被多國共用的東西放中性檔（`data/intlLayerShared.ts`、`components/{featureInfo/intlSpecPanel,legend/intlSpecLegend}.tsx`），
 * 各國都從中性檔 import。
 *
 * 判定「國家模組」（src 底下，排除測試檔）：
 *   1. 檔名前綴 `<cc>[A-Z]…` 或 hook 的 `use<Cc>[A-Z]…`，cc ∈ kr／jp／gb／ca／ie／ph／vn／th／cn／fr
 *      （例：krDataLayers.ts、caInfraTypes.ts、cnPanels.tsx、useGbWaterLayers.ts）。
 *   2. `layers/hosts/<國名>Hosts.tsx`（koreaHosts→kr、japanHosts→jp、ukHosts→gb、canadaHosts→ca、irelandHosts→ie、
 *      philippinesHosts→ph、vietnamHosts→vn、thailandHosts→th、chinaHosts→cn、franceHosts→fr、indonesiaHosts→id）。
 * 其餘（含 `intl*` 中性檔、`atlas*`、`layerManifest` 等組裝層）不是國家模組，可以 import 任何國家模組。
 * 型別 import（`import type`）一樣算，因為之後要拆的是檔案依賴，不只是執行期依賴。
 *
 * 豁免清單只能減不能增：每筆都必須「仍然違規」，否則測試失敗要求刪掉；新增違規不能靠加豁免過關。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const SRC = resolve(__dirname, "../..");
const CC = ["kr", "jp", "gb", "ca", "ie", "ph", "vn", "th", "cn", "fr", "id"] as const;
type Cc = (typeof CC)[number];

const HOST_COUNTRY: Readonly<Record<string, Cc>> = {
  koreaHosts: "kr", japanHosts: "jp", ukHosts: "gb", canadaHosts: "ca", irelandHosts: "ie",
  philippinesHosts: "ph", vietnamHosts: "vn", thailandHosts: "th", chinaHosts: "cn", franceHosts: "fr", indonesiaHosts: "id",
};

/** 檔案（相對 src）所屬國家；不是國家模組回 null。 */
export function countryOf(relPath: string): Cc | null {
  const stem = basename(relPath).split(".")[0]!;
  if (relPath.startsWith("layers/hosts/") && HOST_COUNTRY[stem]) return HOST_COUNTRY[stem]!;
  const m = /^(?:use)?(kr|jp|gb|ca|ie|ph|vn|th|cn|fr|id)(?:[A-Z])/i.exec(stem);
  if (!m) return null;
  // 前綴必須是小寫（kr…）或 use 後的大寫首字（useKr…），避免把 `cache…`、`phase…` 誤判
  const hasUse = stem.startsWith("use");
  const body = hasUse ? stem.slice(3) : stem;
  const prefix = body.slice(0, 2);
  if (hasUse ? prefix[0] !== prefix[0]!.toUpperCase() : prefix !== prefix.toLowerCase()) return null;
  if (!/[A-Z]/.test(body[2] ?? "")) return null;
  const cc = prefix.toLowerCase() as Cc;
  return CC.includes(cc) ? cc : null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  for (const e of EXTS) {
    try {
      if (statSync(base + e).isFile()) return base + e;
    } catch { /* 試下一個副檔名 */ }
  }
  return null;
}

/** 靜態 import／export-from／動態 import() 的模組字串。 */
const IMPORT_RE = /(?:\bimport|\bexport)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_RE)) out.push((m[1] ?? m[2])!);
  return out;
}

/** 目前所有「國家模組 → 別國國家模組」的邊，格式 `<from> -> <to>`（相對 src）。 */
function crossCountryEdges(): string[] {
  const edges: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file);
    const from = countryOf(rel);
    if (!from) continue;
    for (const spec of importsOf(file)) {
      const target = resolveImport(file, spec);
      if (!target) continue;
      const toRel = relative(SRC, target);
      const to = countryOf(toRel);
      if (to && to !== from) edges.push(`${rel} -> ${toRel}`);
    }
  }
  return [...new Set(edges)].sort();
}

/**
 * 暫時切不掉的邊（只能減不能增）。
 * 原因：各國 hook 共用英國水文檔 `useGbWaterLayers.ts` 裡的通用 PMTiles／熱區建構器（useGbPmtilesLayers、gbMaskFilter 等，
 * 名稱叫 Gb 但實際是 20 個檔共用的 helper），菲律賓 hook `usePhLayers.ts` 裡的規格驅動 hook 被中、泰、越、加重用；
 * 搬家要動約 20 個 hook／host 檔，超過 P2 停損（設計 §7 停損點 1），留給 P5 與各國包一起搬。
 * 解法方向：把 helper 搬進中性的 `hooks/intlPmtilesLayers.ts`、`hooks/intlSpecDataLayer.ts`，再逐筆刪除下列項目。
 */
const KNOWN_EXEMPTIONS: readonly string[] = [
  "hooks/useCaAreaLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCaEnergyLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCaEnvLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCaTerrainLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCaTransportLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCnLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useCnLayers.ts -> hooks/usePhLayers.ts",
  "hooks/useIdLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useIeBathymetryLayer.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useJpInlandFloodAreasLayer.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useJpLandslideWarningAreasLayer.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useJpNationalForestsLayer.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useJpTourismLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useJpZoningUseDistrictsLayer.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useKrDataLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useKrEcoWasteLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useKrEnergyLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useKrTransportLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/usePhLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useThLayers.ts -> hooks/useGbWaterLayers.ts",
  "hooks/useVnLayers.ts -> hooks/useGbWaterLayers.ts",
  "layers/hosts/canadaHosts.tsx -> hooks/useGbWaterLayers.ts",
  "layers/hosts/canadaHosts.tsx -> hooks/usePhLayers.ts",
  "layers/hosts/chinaHosts.tsx -> hooks/useGbWaterLayers.ts",
  "layers/hosts/indonesiaHosts.tsx -> hooks/usePhLayers.ts",
  "layers/hosts/irelandHosts.tsx -> hooks/useKrDataLayers.ts",
  "layers/hosts/thailandHosts.tsx -> hooks/usePhLayers.ts",
  "layers/hosts/vietnamHosts.tsx -> hooks/usePhLayers.ts",
];

/** 中性共用檔：自己不能 import 任何國家模組（否則不算中性）。 */
const NEUTRAL_FILES: readonly string[] = [
  "data/intlLayerShared.ts",
  "components/featureInfo/intlSpecPanel.tsx",
  "components/legend/intlSpecLegend.tsx",
  "data/atlasStatisticsRecipes.ts", // 外國配方只經由 atlasCountryFamilies（登記處）進來
];

describe("countryModuleBoundaries", () => {
  it("國家判定規則：前綴、hook、host 檔名", () => {
    expect(countryOf("data/krDataLayers.ts")).toBe("kr");
    expect(countryOf("data/caInfraTypes.ts")).toBe("ca");
    expect(countryOf("hooks/useGbWaterLayers.ts")).toBe("gb");
    expect(countryOf("components/featureInfo/cnPanels.tsx")).toBe("cn");
    expect(countryOf("layers/hosts/koreaHosts.tsx")).toBe("kr");
    expect(countryOf("layers/hosts/ukHosts.tsx")).toBe("gb");
    // 不是國家模組
    expect(countryOf("data/canopyGiantsTypes.ts")).toBeNull();
    expect(countryOf("data/intlLayerShared.ts")).toBeNull();
    expect(countryOf("data/idDataLayers.ts")).toBe("id");
    expect(countryOf("hooks/useIdLayers.ts")).toBe("id");
    expect(countryOf("layers/hosts/indonesiaHosts.tsx")).toBe("id");
    expect(countryOf("hooks/useIdleTimer.ts")).toBeNull();
    expect(countryOf("data/identityTypes.ts")).toBeNull();
    expect(countryOf("data/idle.ts")).toBeNull();
    expect(countryOf("data/phaseTypes.ts")).toBeNull();
    expect(countryOf("data/frequencyTypes.ts")).toBeNull();
    expect(countryOf("hooks/useCategoryFilter.ts")).toBeNull();
    expect(countryOf("layers/hosts/miscHosts.tsx")).toBeNull();
  });

  it("國家模組不 import 別國模組（豁免清單以外零違規）", () => {
    const unexpected = crossCountryEdges().filter((e) => !KNOWN_EXEMPTIONS.includes(e));
    expect(unexpected, `新增了跨國 import；把共用的東西搬到 data/intlLayerShared.ts 之類的中性檔：\n${unexpected.join("\n")}`).toEqual([]);
  });

  it("豁免清單只能減不能增：已修好的項目要從 KNOWN_EXEMPTIONS 刪掉", () => {
    const actual = new Set(crossCountryEdges());
    const stale = KNOWN_EXEMPTIONS.filter((e) => !actual.has(e));
    expect(stale, `下列豁免已不再違規，請刪除：\n${stale.join("\n")}`).toEqual([]);
  });

  it("中性共用檔不 import 任何國家模組", () => {
    const offenders: string[] = [];
    for (const rel of NEUTRAL_FILES) {
      const file = join(SRC, rel);
      for (const spec of importsOf(file)) {
        const target = resolveImport(file, spec);
        if (target && countryOf(relative(SRC, target))) offenders.push(`${rel} -> ${relative(SRC, target)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("外國統計配方只由 atlasCountryFamilies 登記處 import", () => {
    const recipeRe = /(?:^|\/)(?:kr|gb|ca|ie)StatisticsRecipes$/;
    const offenders: string[] = [];
    for (const file of walk(join(SRC, "data"))) {
      const rel = relative(SRC, file);
      if (rel === "data/atlasCountryFamilies.ts" || countryOf(rel)) continue;
      for (const spec of importsOf(file)) if (recipeRe.test(spec)) offenders.push(`${rel} -> ${spec}`);
    }
    expect(offenders).toEqual([]);
  });
});
