/**
 * Design system guard — CSS 部分的規則定義與掃描器（ratchet）。
 *
 * 規範：docs/design-system/spec.md §9（自動檢查）。TS／TSX 的同名規則已改成 ESLint
 * （eslint-rules/rules/design.js，既有違規記在 eslint-suppressions.json）；ESLint 不解析 CSS，
 * 所以樣式表仍由本檔掃描。本檔放在 __tests__ 下，不進 bundle，也避免規則自己的 pattern 字串被自己掃到。
 *
 * - 掃 src/**\/*.css，排除 __tests__、fixture、*.test.*。
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
  /** design-system/spec.md 章節（失敗訊息引用） */
  docSection: string;
  /** 該怎麼改 */
  fix: string;
  /** false = 只記錄不擋 */
  enforce: boolean;
  appliesTo: (path: string) => boolean;
  count: (content: string, path: string) => number;
}

export type GuardCounts = Record<string, Record<string, number>>;

const SCANNED_EXT = /\.css$/;
const isCss = (p: string) => p.endsWith(".css");
const EXCLUDED = [/(^|\/)__tests__\//, /(^|\/)__fixtures__\//, /fixtures?/i, /\.test\.[a-z]+$/];

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
    appliesTo: isCss,
    count: (text) =>
      countMatches(
        stripBlockComments(text),
        /fonts\.googleapis|@font-face|\bJetBrains Mono\b|["'`]Inter["'`]|\bInter\s*,|\bGeorgia\b|\bSongti\b/,
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
    id: "triangle-chevron",
    description: "展開／收合不用 ▶ ▼ 三角字元",
    docSection: "§5.16 Chevron",
    fix: "用 lucide-react 的 <ChevronRight size={12} />，展開時 rotate(90deg)",
    enforce: true,
    appliesTo: isCss,
    // 只看程式碼（註解提到 ▶ 不算）；與 ▲ 同一行的 ▼ 是升降趨勢符號（資料語意），不算 chevron。
    count: (text) =>
      codeOnlyLines(text).reduce((n, line) => {
        const right = countMatches(line, /▶|&#x25[bB]6;|&#9654;|\\u25[bB]6/);
        const down = /▲|\\u25[bB]2/.test(line) ? 0 : countMatches(line, /▼|&#x25[bB][cC];|&#9660;|\\u25[bB][cC]/);
        return n + right + down;
      }, 0),
  },
  {
    id: "uppercase-eyebrow",
    description: "不用 text-transform: uppercase（英文大寫小標）",
    docSection: "§6.1 標籤一律中文",
    fix: "eyebrow 寫中文（例「交通 · 公車」），9px var(--text-dim)，不轉大寫",
    enforce: true,
    appliesTo: isCss,
    count: (text) =>
      countMatches(stripBlockComments(text), /textTransform\s*:\s*["']uppercase["']|text-transform\s*:\s*uppercase/),
  },
  {
    id: "raw-z-index",
    description: "不寫死 ≥10 的 z-index 數字（zIndex: 30／z-index: 45）；層級走 Z_INDEX／--z-*",
    docSection: "§5.25 層級（z-index）",
    fix: "改用 designTokens.ts 的 Z_INDEX.<層>（CSS 用 var(--z-*)）；同層前後靠 DOM 順序。確屬特例（LoadingScreen、資料更新中遮罩等）要寫進 design-system/spec.md 特例表",
    enforce: true,
    // src/styles/** 是層級定義檔本身；元件內部 <10 的小值（0／1／2／3…）只排兄弟順序，不算全站層級。
    appliesTo: (p) => isCss(p) && !p.startsWith("src/styles/"),
    count: (text) => countRawZIndex(text),
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
    `  規範：docs/design-system/spec.md ${rule.docSection}`,
  ].join("\n");
}

export const BASELINE_RELATIVE_PATH = "src/styles/__tests__/designSystemGuard.baseline.json";
