/**
 * Design system guard — 規則定義與掃描器（ratchet）。
 *
 * 規範：docs/design-system.md §9（自動檢查）。本檔放在 __tests__ 下，
 * 一方面不進 bundle，一方面避免規則自己的 pattern 字串被自己掃到。
 *
 * - 掃 src/**\/*.{ts,tsx,css}，排除 __tests__、fixture、*.test.*。
 * - 每條規則按「檔案」計數，跟 designSystemGuard.baseline.json 比：
 *   任何檔案計數增加、或新檔案出現違規 → 測試失敗；計數減少 → 提示可降低基準。
 * - enforce: false 的規則只記錄不擋（啟發式、誤判風險較高）。
 * - 更新基準：npm run design:baseline（只會往下降；新增違規會被拒絕）。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface GuardRule {
  id: string;
  /** 一句話：擋什麼 */
  description: string;
  /** design-system.md 章節（失敗訊息引用） */
  docSection: string;
  /** 該怎麼改 */
  fix: string;
  /** false = 只記錄不擋 */
  enforce: boolean;
  appliesTo: (path: string) => boolean;
  count: (content: string, path: string) => number;
}

export type GuardCounts = Record<string, Record<string, number>>;

const SCANNED_EXT = /\.(ts|tsx|css)$/;
const EXCLUDED = [/(^|\/)__tests__\//, /(^|\/)__fixtures__\//, /fixtures?/i, /\.test\.[a-z]+$/];

const CJK = /[㐀-䶿一-鿿豈-﫿　-〿＀-￯]/;

function countMatches(text: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  return text.match(g)?.length ?? 0;
}

/** 去掉 CSS／JS 區塊註解（保留行數以外的東西不重要，只算命中） */
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 去掉整行註解與行尾 `// ...`（只在 // 前有空白時，避免誤砍 https://） */
function codeOnlyLines(text: string): string[] {
  return stripBlockComments(text)
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .map((line) => line.replace(/\s\/\/\s.*$/, ""));
}

const isTsLike = (p: string) => /\.(ts|tsx)$/.test(p);

/**
 * 同一行內：`FONT_DATA` 之後第一個結束開標籤的 `>`（不含 `=>`）到下一個 `<` 之間的文字
 * （= 該元素的直接子文字，含 {…} 表達式裡的字串）若有中文 → 算一筆。
 * 「中文在外、數字包在 FONT_DATA span 內」的正確寫法不會命中。
 */
export function countFontDataOnCjk(text: string): number {
  let n = 0;
  for (const line of codeOnlyLines(text)) {
    const re = /\bFONT_DATA\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const rest = line.slice(m.index);
      const close = /[^=]>/.exec(rest);
      if (!close) continue;
      const child = rest.slice(close.index + 2).split("<")[0] ?? "";
      if (CJK.test(child)) n++;
    }
  }
  return n;
}

/** `zIndex: <n>`／`z-index: <n>` 中 n ≥ 10 的寫死數字（Z_INDEX.mapOverlay = 10 起才是全站層級） */
export function countRawZIndex(text: string): number {
  let n = 0;
  for (const line of codeOnlyLines(text)) {
    for (const m of line.matchAll(/\b(?:zIndex|z-index)\s*:\s*["']?(\d+)\b/g)) {
      if (Number(m[1]) >= 10) n++;
    }
  }
  return n;
}

export const RULES: readonly GuardRule[] = [
  {
    id: "web-font",
    description: "不載入 web font，也不引用未載入的字族名（Inter／JetBrains Mono／Georgia／宋體）",
    docSection: "§4.1 字型角色",
    fix: "中文與一般文字用 FONT_CJK／var(--font-cjk)；數字、時間、座標、代碼用 FONT_DATA／var(--font-data)",
    enforce: true,
    appliesTo: () => true,
    count: (text) =>
      countMatches(
        stripBlockComments(text),
        /fonts\.googleapis|@font-face|["']JetBrains Mono["']|\bInter\s*,|\bGeorgia\b|\bSongti\b/,
      ),
  },
  {
    id: "hex-literal-in-ui-css",
    description: "UI 樣式表（src/research/*.css、src/components/**/*.css）不寫 hex 色碼字面值",
    docSection: "§3 Token 表",
    fix: "改用 src/styles/tokens.css 的 var(--...)；淡色用 --light-*；圖層資料色屬例外需在 PR 說明",
    enforce: true,
    appliesTo: (p) => /^src\/research\/[^/]+\.css$/.test(p) || /^src\/components\/.+\.css$/.test(p),
    count: (text) => countMatches(stripBlockComments(text), /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/),
  },
  {
    id: "native-range",
    description: "原生 range 只能出現在共用滑桿元件本體（src/components/controls/Slider.tsx，S1 樣式）",
    docSection: "§5.13 滑桿 V2＋S1",
    fix: "改用 src/components/controls/Slider.tsx（<Slider>，.ctl-range）；圖層控制走 ParamControlList 的 slider（內部也是 <Slider>）",
    enforce: true,
    appliesTo: (p) => isTsLike(p) && p !== "src/components/controls/Slider.tsx",
    count: (text) => countMatches(stripBlockComments(text), /type\s*=\s*["'{]\s*["']?range["']|type\s*:\s*["']range["']/),
  },
  {
    id: "triangle-chevron",
    description: "展開／收合不用 ▶ ▼ 三角字元",
    docSection: "§5.16 Chevron",
    fix: "用 lucide-react 的 <ChevronRight size={12} />，展開時 rotate(90deg)",
    enforce: true,
    appliesTo: () => true,
    // 只看程式碼（註解提到 ▶ 不算）；與 ▲ 同一行的 ▼ 是升降趨勢符號（資料語意），不算 chevron。
    count: (text) =>
      codeOnlyLines(text).reduce((n, line) => {
        const right = countMatches(line, /▶|&#x25[bB]6;|&#9654;|\\u25[bB]6/);
        const down = /▲|\\u25[bB]2/.test(line) ? 0 : countMatches(line, /▼|&#x25[bB][cC];|&#9660;|\\u25[bB][cC]/);
        return n + right + down;
      }, 0),
  },
  {
    id: "english-control-label",
    description: "圖層控制項標籤（layerParamsSpec.ts labelPrefix）一律中文開頭",
    docSection: "§6.1 標籤一律中文",
    fix: "labelPrefix 改中文（英文代碼如需保留，放 labelSuffix 或說明文字）",
    enforce: true,
    appliesTo: (p) => p === "src/data/layerParamsSpec.ts",
    count: (text) => countMatches(text, /labelPrefix\s*:\s*["'`][A-Za-z]/),
  },
  {
    id: "uppercase-eyebrow",
    description: "不用 text-transform: uppercase（英文大寫小標）",
    docSection: "§6.1 標籤一律中文",
    fix: "eyebrow 寫中文（例「交通 · 公車」），9px var(--text-dim)，不轉大寫",
    enforce: true,
    appliesTo: () => true,
    count: (text) =>
      countMatches(stripBlockComments(text), /textTransform\s*:\s*["']uppercase["']|text-transform\s*:\s*uppercase/),
  },
  {
    id: "font-data-on-cjk",
    description: "（啟發式）套 FONT_DATA 的 JSX 元素，其直接文字內容含中文 → 中文被套成等寬字",
    docSection: "§4.1 字型角色",
    fix: "把數字包成獨立 <span style={{ fontFamily: FONT_DATA }}>，中文留在 FONT_CJK 節點",
    enforce: true,
    appliesTo: (p) => p.endsWith(".tsx"),
    count: (text) => countFontDataOnCjk(text),
  },
  {
    id: "raw-z-index",
    description: "不寫死 ≥10 的 z-index 數字（zIndex: 30／z-index: 45）；層級走 Z_INDEX／--z-*",
    docSection: "§5.25 層級（z-index）",
    fix: "改用 designTokens.ts 的 Z_INDEX.<層>（CSS 用 var(--z-*)）；同層前後靠 DOM 順序。確屬特例（LoadingScreen、資料更新中遮罩等）要寫進 design-system.md 特例表",
    enforce: true,
    // src/styles/** 是層級定義檔本身；元件內部 <10 的小值（0／1／2／3…）只排兄弟順序，不算全站層級。
    appliesTo: (p) => !p.startsWith("src/styles/"),
    count: (text) => countRawZIndex(text),
  },
  {
    id: "internal-id-display",
    description: "（啟發式，只記錄）datasetId 直接放進 JSX 文字或 title／label／desc 欄位",
    docSection: "§6.3 不印內部識別碼",
    fix: "先過人類可讀映射（例 describeDataset(datasetId).label），查不到顯示「未命名資料集」而不是代號",
    enforce: false,
    appliesTo: isTsLike,
    count: (text) => {
      const lines = codeOnlyLines(text).join("\n");
      return (
        countMatches(lines, /(?<!=)>\s*\{[^{}\n]*\bdataset_?[iI]d\b[^{}\n]*\}/) +
        countMatches(lines, /\b(?:title|label|desc|text)\s*:\s*[^,\n}]*\bdataset_?[iI]d\b(?!\s*\))/)
      );
    },
  },
];

export function listScannedFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const rel = relative(root, abs).split(sep).join("/");
      if (statSync(abs).isDirectory()) {
        if (name === "node_modules") continue;
        walk(abs);
      } else if (SCANNED_EXT.test(name) && !EXCLUDED.some((re) => re.test(rel))) {
        out.push(rel);
      }
    }
  };
  walk(join(root, "src"));
  return out;
}

export function scanFiles(root: string, files: readonly string[] = listScannedFiles(root)): GuardCounts {
  const counts: GuardCounts = Object.fromEntries(RULES.map((r) => [r.id, {}]));
  for (const rel of files) {
    const text = readFileSync(join(root, rel), "utf8");
    for (const rule of RULES) {
      if (!rule.appliesTo(rel)) continue;
      const n = rule.count(text, rel);
      if (n > 0) counts[rule.id]![rel] = n;
    }
  }
  return sortCounts(counts);
}

export function sortCounts(counts: GuardCounts): GuardCounts {
  const out: GuardCounts = {};
  for (const id of Object.keys(counts).sort()) {
    const files = counts[id]!;
    out[id] = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]!]));
  }
  return out;
}

export interface GuardDelta {
  rule: string;
  file: string;
  baseline: number;
  current: number;
}

export function compareCounts(current: GuardCounts, baseline: GuardCounts): { increases: GuardDelta[]; decreases: GuardDelta[] } {
  const increases: GuardDelta[] = [];
  const decreases: GuardDelta[] = [];
  for (const rule of RULES) {
    const cur = current[rule.id] ?? {};
    const base = baseline[rule.id] ?? {};
    for (const file of new Set([...Object.keys(cur), ...Object.keys(base)])) {
      const c = cur[file] ?? 0;
      const b = base[file] ?? 0;
      if (c > b) increases.push({ rule: rule.id, file, baseline: b, current: c });
      else if (c < b) decreases.push({ rule: rule.id, file, baseline: b, current: c });
    }
  }
  return { increases, decreases };
}

/** 基準只往下降：取 min(current, baseline)，歸零的檔案移除。 */
export function ratchetDown(current: GuardCounts, baseline: GuardCounts): GuardCounts {
  const out: GuardCounts = {};
  for (const rule of RULES) {
    const cur = current[rule.id] ?? {};
    const base = baseline[rule.id] ?? {};
    const files: Record<string, number> = {};
    for (const [file, b] of Object.entries(base)) {
      const n = Math.min(b, cur[file] ?? 0);
      if (n > 0) files[file] = n;
    }
    out[rule.id] = files;
  }
  return sortCounts(out);
}

export function formatIncrease(d: GuardDelta): string {
  const rule = RULES.find((r) => r.id === d.rule)!;
  const where = d.baseline === 0 ? "新違規" : `${d.baseline} → ${d.current}`;
  return [
    `✗ [${d.rule}] ${d.file}：+${d.current - d.baseline}（${where}）`,
    `  規則：${rule.description}`,
    `  怎麼改：${rule.fix}`,
    `  規範：docs/design-system.md ${rule.docSection}`,
  ].join("\n");
}

export const BASELINE_RELATIVE_PATH = "src/styles/__tests__/designSystemGuard.baseline.json";
