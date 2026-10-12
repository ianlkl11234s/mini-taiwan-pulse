/**
 * 掃描程式碼裡「寫死的中文」行數，依 i18n 路線圖的區塊分組（docs/features/i18n/ROADMAP.md）。
 *
 * 計數口徑：.ts/.tsx（排除測試）中，去掉註解後仍含中文的行數。是近似指標，不是精確字串數；
 * 同一套口徑前後比較才有意義。
 *
 * 用法：
 * - 看進度：`npx tsx scripts/i18n/hardcoded-zh.ts`
 * - 某區塊翻完、數字下降後鎖住新基準：`npx tsx scripts/i18n/hardcoded-zh.ts --write`
 * - `hardcodedZh.test.ts` 會擋「比基準多」（防倒退）；數字只能往下。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface I18nArea {
  id: string;
  /** 路線圖階段 */
  phase: string;
  label: string;
  /** 路徑前綴（相對 repo 根目錄，用 /） */
  paths: string[];
  /**
   * `ui`：介面元件，目標是寫死中文歸零（或只剩允許的例外）。
   * `data`：中文是資料標籤或識別字的正本（例 manifest 圖層名），不以歸零為目標，改看翻譯覆蓋率。
   */
  kind: "ui" | "data";
}

/** 順序即比對優先序：先列的區塊先認領檔案。 */
export const I18N_AREAS: I18nArea[] = [
  { id: "shell", phase: "P0", label: "工具列、外框", kind: "ui", paths: ["src/App.tsx", "src/main.tsx", "src/components/toolbar/", "src/components/ModeToggle.tsx", "src/components/LoadingScreen.tsx", "src/components/LoadingStatus.tsx", "src/components/CameraHud.tsx", "src/components/InfoModal.tsx", "src/components/ShareModal.tsx", "src/components/MobileBottomSheet.tsx", "src/components/StyleSelector.tsx"] },
  { id: "sidebar", phase: "P0", label: "側欄", kind: "ui", paths: ["src/components/sidebar/", "src/components/IconRailSidebar.tsx", "src/components/LayerSidebar.tsx"] },
  { id: "popup", phase: "P1", label: "點擊說明框", kind: "ui", paths: ["src/components/featureInfo/", "src/components/FeatureInfoPanel.tsx"] },
  { id: "legend", phase: "P2", label: "圖例", kind: "ui", paths: ["src/components/LegendPanel.tsx", "src/components/legend/"] },
  { id: "params", phase: "P2", label: "圖層設定面板", kind: "ui", paths: ["src/data/layerParamsSpec.ts", "src/state/layerParamsControls.ts", "src/components/controls/"] },
  { id: "timeline", phase: "P3", label: "時間軸", kind: "ui", paths: ["src/components/timeline/", "src/components/TimelineControls.tsx", "src/components/HistoricalTimeline.tsx", "src/components/EarthquakeReplayPanel.tsx"] },
  { id: "intel", phase: "P3", label: "監測模式", kind: "ui", paths: ["src/components/intel/"] },
  { id: "satellite", phase: "P3", label: "衛星主控台", kind: "ui", paths: ["src/components/satelliteConsole/"] },
  { id: "member", phase: "P3", label: "會員、登入、後台", kind: "ui", paths: ["src/components/member/", "src/components/auth/", "src/components/admin/"] },
  { id: "chat", phase: "P4", label: "AI 對話", kind: "ui", paths: ["src/chat/", "src/components/chat/"] },
  { id: "research", phase: "P4", label: "分析 Agent、資料描述", kind: "data", paths: ["src/research/"] },
  { id: "data", phase: "P2/P5", label: "資料標籤（類別、單位、統計配方）", kind: "data", paths: ["src/data/"] },
  { id: "map", phase: "P2", label: "地圖 hook／圖層文字", kind: "ui", paths: ["src/hooks/", "src/map/", "src/three/"] },
  { id: "other", phase: "—", label: "其他", kind: "ui", paths: ["src/"] },
];

const HAN = /[㐀-鿿]/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
}

export function countZhLines(source: string): number {
  return stripComments(source).split("\n").filter((line) => HAN.test(line)).length;
}

/** repoRoot 底下 src/ 的掃描結果：區塊 id → 行數 */
export function scanHardcodedZh(repoRoot: string): Record<string, number> {
  const files: string[] = [];
  walk(join(repoRoot, "src"), files);
  const result: Record<string, number> = Object.fromEntries(I18N_AREAS.map((a) => [a.id, 0]));
  for (const file of files) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    if (rel.startsWith("src/i18n/")) continue;
    const area = I18N_AREAS.find((a) => a.paths.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)));
    if (!area) continue;
    result[area.id] = (result[area.id] ?? 0) + countZhLines(readFileSync(file, "utf8"));
  }
  return result;
}
