// 釘住站主限定（owner-only）資安守門的套用範圍：資安規則的範圍不能悄悄變窄。
// owner-only 檔＝src/data、src/hooks（非測試）裡含 /api/private-research/、或 import 了含它的 src/data 模組的檔。
// 每個都必須被 pulse/owner-only-no-external-source 覆蓋，不然就要列進 OWNER_ONLY_EXEMPT（附理由，且本檔逐字釘住）。
import { ESLint } from "eslint";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OWNER_ONLY_EXEMPT } from "../../eslint.config.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd: root, allowInlineConfig: false });
const MARKER = "/api/private-research/";
const REGISTRIES = new Set(["src/data/layerManifest.ts"]);
const rel = (abs) => relative(root, abs).split(sep).join("/");
const isTest = (p) => /(^|\/)__tests__\//.test(p) || /\.(test|spec)\.[a-z]+$/.test(p) || /fixture/i.test(p);

function listSources(dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSources(p));
    else if (/\.tsx?$/.test(entry.name) && !isTest(p)) out.push(p);
  }
  return out;
}

/** 掃描 src/data、src/hooks 找出 owner-only 檔（不依賴 eslint.config.js）。 */
function discoverOwnerOnlyFiles() {
  const files = [...listSources("src/data"), ...listSources("src/hooks")];
  const text = new Map(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));
  // 全站登記簿（layerManifest）也含 marker，但 import 它的檔不因此算 owner-only
  const markerData = new Set(files.filter((f) => f.startsWith("src/data/") && !REGISTRIES.has(f) && text.get(f).includes(MARKER)));
  const importsMarker = (f) =>
    [...text.get(f).matchAll(/from\s+["'](\.[^"']+)["']/g)].some((m) => {
      const target = rel(resolve(join(root, dirname(f)), m[1]));
      return markerData.has(`${target}.ts`) || markerData.has(`${target}.tsx`) || markerData.has(target);
    });
  return files.filter((f) => text.get(f).includes(MARKER) || importsMarker(f)).sort();
}

const covered = async (file, ruleId = "pulse/owner-only-no-external-source") => {
  const config = await eslint.calculateConfigForFile(file);
  const v = config?.rules?.[ruleId];
  return (Array.isArray(v) ? v[0] : v) === 2;
};

// 原本 readFileSync＋toMatch 測試掃的檔（bridgeResilienceTypes.test.ts、useBssBridgeLayers.test.ts、useSoilLiquefactionLayers.test.ts）
const ORIGINAL_URL_ENV = ["src/data/bridgeResilienceLoader.ts", "src/data/bridgeResilienceTypes.ts", "src/hooks/useBridgeResilienceLayers.ts", "src/hooks/useBssBridgeLayers.ts"];
const ORIGINAL_SOIL = ["src/hooks/useSoilLiquefactionLayers.ts"];

describe("owner-only 資安守門的套用範圍", () => {
  const discovered = discoverOwnerOnlyFiles();

  it("找得到 owner-only 檔（掃描本身沒壞）", () => {
    expect(discovered).toEqual(expect.arrayContaining([...ORIGINAL_URL_ENV, ...ORIGINAL_SOIL]));
  });

  it("每個 owner-only 檔都套用 owner-only-no-external-source，或列在 OWNER_ONLY_EXEMPT", async () => {
    const missing = [];
    for (const f of discovered) if (!(f in OWNER_ONLY_EXEMPT) && !(await covered(f))) missing.push(f);
    expect(missing, "新 owner-only 檔要加進 eslint.config.js 的 OWNER_ONLY_FILES").toEqual([]);
  });

  it("原測試掃的檔全部覆蓋，且不能被豁免", async () => {
    for (const f of [...ORIGINAL_URL_ENV, ...ORIGINAL_SOIL]) {
      expect(f in OWNER_ONLY_EXEMPT, f).toBe(false);
      expect(await covered(f), f).toBe(true);
    }
    for (const f of ORIGINAL_SOIL) expect(await covered(f, "pulse/owner-only-banned-text"), f).toBe(true);
  });

  it("豁免清單逐字釘住（新增豁免要改這裡並在 PR 說明），且每筆都還是 owner-only 檔", () => {
    expect(Object.keys(OWNER_ONLY_EXEMPT).sort()).toEqual([
      "src/data/jpWaterLoader.ts",
      "src/data/layerManifest.ts",
      "src/hooks/useJpWaterLayers.ts",
      "src/hooks/useMapInteraction.ts",
    ]);
    for (const f of Object.keys(OWNER_ONLY_EXEMPT)) expect(discovered, f).toContain(f);
  });

  it("soil 的禁用字串至少包含原測試的全部 pattern", async () => {
    const config = await eslint.calculateConfigForFile(ORIGINAL_SOIL[0]);
    const regexes = config.rules["pulse/owner-only-banned-text"][1].patterns.map((p) => p.regex);
    expect(regexes).toEqual(['gis\\.liquid\\.net\\.tw|WMSServer|WMTS|"raster"', "TPSite|臺北市中山站"]);
  });

  it("規則對真實檔案生效：在 owner-only 檔寫外部網址／import.meta.env 會紅", async () => {
    const lint = async (filePath, code) => (await eslint.lintText(code, { filePath }))[0].messages.map((m) => m.ruleId);
    expect(await lint("src/hooks/useBssBridgeLayers.ts", 'const u = "https://x.test/tiles";')).toContain("pulse/owner-only-no-external-source");
    expect(await lint("src/data/bridgeResilienceTypes.ts", "const e = import.meta.env.VITE_X;")).toContain("pulse/owner-only-no-external-source");
    expect(await lint("src/data/soilLiquefactionTypes.ts", 'const u = "https://liquefaction.gsmma.gov.tw/cgs/Web/Map.aspx";')).not.toContain(
      "pulse/owner-only-no-external-source",
    );
    expect(await lint("src/data/soilLiquefactionTypes.ts", 'const u = "https://evil.test/";')).toContain("pulse/owner-only-no-external-source");
    expect(await lint("src/hooks/useSoilLiquefactionLayers.ts", 'const s = { type: "raster" };')).toContain("pulse/owner-only-banned-text");
  });

  it("只 import 公開模組的檔不算 owner-only", () => {
    expect(discovered).not.toContain("src/hooks/useMapReadyTick.ts");
  });
});
