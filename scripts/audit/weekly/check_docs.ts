/**
 * Weekly Audit — D 組「文件與結構」收集器（D1 / D2 / D3 / D4 / D7 / D8）
 *   D5（PMTILES_STATUS.md 對帳）2026-10-17 移除：該狀態檔已於 2026-10-16 歸檔、不再維護。
 *
 * 見 docs/proposal/weekly-audit-2026-08-21/README.md §2 D 組、§3.1 陷阱。
 * D6（豁免名單健康度）不在本腳本範圍——維持 🤝 人工判讀，等 v2。
 *
 *   D1 README 數字對帳：直接 import manifest 與 production `THEMES`／`GATED_LAYERS`／`LAYER_MACRO_GROUPS`
 *      （不 grep 硬解析），對 2026-10 表格版 README 的「圖層規模」表逐項 diff：
 *      layer key 總數＋資料路徑 A/B/C/D、側欄主題數／大分類數、側欄圖層開關（不重複 key）、
 *      站主限定圖層、六大分類逐類「主題數／圖層開關數」，以及專案結構的 Loader／CustomLayer／Scene 檔案數。
 *      README 2026-10 改版後不再列的數字（orphan 內部 key、完整主題清單表、上游 dataset 數、
 *      collector 數、nginx location 數、docs/features 資料夾數）不再報 error，
 *      記在 metrics.d1.skipped（reason：README 2026-10 改版後不再列此數字）。
 *      L2 可分析數來自 layer-status-summary 生成檔，不在本腳本範圍。

 *   D7 params spec 漂移：⚠️ 陷阱 1 —— `layerParamsSpec.ts` 含非文字位元組，BSD grep
 *      會判成 binary 而**靜默回傳空結果**。本腳本一律用 `import` 直接讀，不 grep。
 *
 *   D3 文件落後於程式：⚠️ 陷阱 2 —— 資料夾層級 `git log -1` 會被批次 reorg commit
 *      （`docs:`／`docs(backlog):`／`memory:` 前綴）洗成假的「全部都剛更新」。
 *      本腳本排除這類前綴的 commit 才取最後日期；有 `handoff.md` 的夾只看該單檔。
 *      實測另外踩到一個前綴變體 `memory+docs:`（Wave 2 全域 memory 大改組批次
 *      commit）與 `docs:`/`memory:` 是同一類現象，一併排除。
 *
 *   D4 docs 頂層散檔：⚠️ 陷阱 3 —— 判準是「有沒有被連結」不是檔名。掃
 *      CLAUDE.md／README.md／.claude/memory/*.md／docs/development-rules.md，
 *      也涵蓋使用者全域 MEMORY.md（機器特定路徑，讀不到就記進 errors 並在
 *      finding 註明分類可能偏誤，不讓整支腳本因此掛掉）。
 *
 * 輸出：.claude/.cache/weekly-audit/docs.json（不進版控）
 * 執行：npx vite-node scripts/audit/weekly/check_docs.ts
 *       （不能用 tsx：THEMES → src/state/localeStore.ts 用了 import.meta.glob，tsx 不支援）
 *
 * 硬約束：純讀，不寫任何專案檔；任何子檢查失敗進 errors[] 但不中斷整支；
 *         report 只列不動；不輸出密鑰（本腳本不碰任何連線字串，但仍保留 redact
 *         防呆，與其他收集器一致）。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LAYER_MANIFEST } from "../../../src/data/layerManifest";
import { MIGRATED_PARAMS_KEYS } from "../../../src/data/layerParamsSpec";
import { GATED_LAYERS, LAYER_MACRO_GROUPS, THEMES, themeMacroGroup } from "../../../src/components/sidebar/layerCatalog";

// ── 路徑 ──────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(ROOT, ".claude/.cache/weekly-audit");
const OUT_FILE = path.join(OUT_DIR, "docs.json");

const FEATURES_DIR = path.join(ROOT, "docs/features");
const README_PATH = path.join(ROOT, "README.md");
const GLOBAL_MEMORY_PATH =
  "/Users/migu/.claude-migu/projects/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/memory/MEMORY.md";

const STALE_DAYS_D3 = 60;
const STALE_DAYS_D4 = 60;
const FEATURE_FILES = ["README.md", "backlog.md", "changelog.md", "handoff.md"] as const;

// ── 型別 ──────────────────────────────────────────────────────────
type Level = "green" | "yellow" | "red";
interface Finding {
  id: string;
  level: Level;
  title: string;
  detail: string;
  evidence: string;
}
interface ErrorEntry {
  step: string;
  message: string;
}

// ── 小工具（與 probe_layers.ts 同款，本腳本自成一體不共用模組）──────

/** 防呆用：任何要進 JSON 的字串都過一次，濾掉可能誤入的連線字串／JWT／API key。 */
function redact(s: string): string {
  return s
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED>")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<REDACTED>")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "<REDACTED>")
    .replace(/password\s*=\s*\S+/gi, "password=<REDACTED>");
}

function deepRedact<T>(value: T): T {
  if (typeof value === "string") return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map(deepRedact) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepRedact(v);
    return out as T;
  }
  return value;
}

function readFileSafe(p: string): string | null {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** 批次 reorg commit 的 subject 前綴——這類 commit 摸過幾乎每個夾但不是「實質更新」。 */
function isBatchReorgSubject(subject: string): boolean {
  return /^docs:|^docs\(backlog\):|^memory:|^memory\+docs:/.test(subject);
}

interface CommitEntry {
  date: string; // YYYY-MM-DD
  subject: string;
}

/** `git log`，用 \x1f 分隔避免 subject 含 '|' 撞欄。任何 git 失敗回傳 []（呼叫端自行決定 fallback）。 */
function gitLogFor(pathspecs: string[]): CommitEntry[] {
  try {
    const out = execFileSync(
      "git",
      ["log", "--format=%ad\x1f%s", "--date=short", "--", ...pathspecs],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    return out
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        const [date, ...rest] = l.split("\x1f");
        return { date: date ?? "", subject: rest.join("\x1f") };
      })
      .filter((e) => e.date);
  } catch {
    return [];
  }
}

/** 取「最後實質更新日」：優先排除批次 reorg commit；全被排除時退回未過濾的最新一筆。 */
function lastSubstantiveDate(pathspecs: string[]): { date: string | null; usedFallback: boolean } {
  const log = gitLogFor(pathspecs);
  if (log.length === 0) return { date: null, usedFallback: false };
  const substantive = log.find((e) => !isBatchReorgSubject(e.subject));
  if (substantive) return { date: substantive.date, usedFallback: false };
  return { date: log[0]!.date, usedFallback: true }; // 全部都是批次 commit，仍給個日期但註記
}

function daysSince(dateStr: string, now: Date): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function listFeatureFolders(): string[] {
  try {
    return readdirSync(FEATURES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "_TEMPLATE")
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

// ── main ──────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const now = new Date();
  const findings: Finding[] = [];
  const errors: ErrorEntry[] = [];
  const metrics: Record<string, unknown> = {};

  // ══════════════════════════════════════════════════════════════
  // D1 — README 數字對帳（對齊 2026-10 表格版 README）
  // ══════════════════════════════════════════════════════════════
  {
    const entries = Object.entries(LAYER_MANIFEST) as [string, { section: unknown; dataClass: string }][];
    const actualTotal = entries.length;
    const sidebarKeys = new Set(THEMES.flatMap((theme) => theme.groups).flatMap((group) => group.layers).map((layer) => String(layer.key)));
    const actualThemed = sidebarKeys.size;
    const actualOrphan = entries.filter(([, v]) => v.section === null).length;
    const actualDataClass: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const [, v] of entries) actualDataClass[v.dataClass] = (actualDataClass[v.dataClass] ?? 0) + 1;
    const actualFeatures = listFeatureFolders().length;
    const actualGated = GATED_LAYERS.size;
    const actualThemeCount = THEMES.length;
    const actualMacroCount = LAYER_MACRO_GROUPS.length;
    // 大分類逐類：主題數／圖層開關數（組內不重複 key）
    const actualMacro: Record<string, { zh: string; themes: number; toggles: number }> = {};
    for (const g of LAYER_MACRO_GROUPS) actualMacro[g.key] = { zh: g.zh, themes: 0, toggles: 0 };
    const macroKeys = new Map<string, Set<string>>(LAYER_MACRO_GROUPS.map((g) => [g.key, new Set<string>()]));
    for (const theme of THEMES) {
      const mk = themeMacroGroup(theme);
      actualMacro[mk]!.themes += 1;
      for (const grp of theme.groups) for (const l of grp.layers) macroKeys.get(mk)!.add(String(l.key));
    }
    for (const [mk, set] of macroKeys) actualMacro[mk]!.toggles = set.size;

    const countDir = (dir: string, suffix: string): number | null => {
      try {
        return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith(suffix)).length;
      } catch (e) {
        errors.push({ step: "D1", message: `無法列出 ${dir}：${String(e)}` });
        return null;
      }
    };
    const actualLoaders = countDir("src/data", "Loader.ts");
    const actualCustomLayers = countDir("src/map", "CustomLayer.ts");
    const actualScenes = countDir("src/three", "Scene.ts");

    const readme = readFileSafe(README_PATH);
    if (readme === null) {
      errors.push({ step: "D1", message: `無法讀取 ${README_PATH}` });
    } else {
      const d1Detail: Record<string, unknown> = {
        actual: {
          total: actualTotal,
          dataClass: actualDataClass,
          themeCount: actualThemeCount,
          macroCount: actualMacroCount,
          themed: actualThemed,
          gated: actualGated,
          macro: actualMacro,
          loaderFiles: actualLoaders,
          customLayerFiles: actualCustomLayers,
          sceneFiles: actualScenes,
          // 以下 README 已不寫，僅留參考
          orphan: actualOrphan,
          features: actualFeatures,
        },
        claimed: {} as Record<string, number>,
        skipped: [] as { key: string; reason: string }[],
      };
      const claimedMap = d1Detail.claimed as Record<string, number>;
      const skipped = d1Detail.skipped as { key: string; reason: string }[];

      const reportClaim = (key: string, label: string, claimed: number, actual: number | null, hint: string) => {
        claimedMap[key] = claimed;
        if (actual === null) return;
        if (claimed === actual) {
          findings.push({ id: "D1", level: "green", title: `README「${label}」與現況一致`, detail: `${claimed} = ${actual}`, evidence: hint });
        } else {
          findings.push({
            id: "D1",
            level: "yellow",
            title: `README「${label}」已過期`,
            detail: `README 說 ${claimed}、實際 ${actual}（差 ${actual - claimed >= 0 ? "+" : ""}${actual - claimed}）`,
            evidence: hint,
          });
        }
      };
      const mismatch = (label: string, hint: string) =>
        errors.push({ step: "D1", message: `正則失配，抓不到「${label}」的 README 敘述（${hint}），需人工核對正則是否被改寫` });

      // 1) 圖層規模表：layer key 總數＋資料路徑 A/B/C/D（同一格）
      {
        const hint = "README §功能總覽／圖層規模 表 vs LAYER_MANIFEST";
        const m = readme.match(/\|\s*manifest 登記的 layer key\s*\|\s*(\d+)（資料路徑\s*A\s*(\d+)／B\s*(\d+)／C\s*(\d+)／D\s*(\d+)）/);
        if (!m) {
          mismatch("layer key 總數與資料路徑 A/B/C/D", hint);
        } else {
          reportClaim("total", "layer key 總數", Number(m[1]), actualTotal, hint);
          (["A", "B", "C", "D"] as const).forEach((cls, i) =>
            reportClaim(`dataClass${cls}`, `dataClass ${cls} 層數`, Number(m[i + 2]), actualDataClass[cls] ?? 0, hint),
          );
        }
      }

      // 2) 側欄主題數＋大分類數
      {
        const hint = "README §圖層規模 表 vs THEMES / LAYER_MACRO_GROUPS";
        const m = readme.match(/\|\s*側欄主題\s*\|\s*(\d+)\s*個，分\s*(\d+)\s*大分類/);
        if (!m) mismatch("側欄主題數／大分類數", hint);
        else {
          reportClaim("themeCount", "側欄主題數", Number(m[1]), actualThemeCount, hint);
          reportClaim("macroCount", "大分類數", Number(m[2]), actualMacroCount, hint);
        }
      }

      // 3) 側欄圖層開關（不重複 key）
      {
        const hint = "README §圖層規模 表 vs THEMES 內不重複 layer key";
        const m = readme.match(/\|\s*側欄圖層開關（不重複 key）\s*\|\s*(\d+)\s*\|/);
        if (!m) mismatch("側欄圖層開關數", hint);
        else reportClaim("themed", "側欄圖層開關數（不重複 key）", Number(m[1]), actualThemed, hint);
      }

      // 4) 站主限定圖層
      {
        const hint = "README §圖層規模 表 vs GATED_LAYERS.size";
        const m = readme.match(/\|\s*站主限定圖層\s*\|\s*(\d+)\s*\|/);
        if (!m) mismatch("站主限定圖層數", hint);
        else reportClaim("gated", "站主限定圖層數", Number(m[1]), actualGated, hint);
      }

      // 5) 六大分類逐類「主題數／圖層開關數」
      {
        const hint = "README §圖層規模下方「六大分類（主題數／圖層開關數）」 vs LAYER_MACRO_GROUPS + THEMES";
        const line = readme.match(/六大分類（主題數／圖層開關數）[：:][^\n]*/)?.[0];
        if (!line) {
          mismatch("六大分類逐類主題數／圖層開關數", hint);
        } else {
          for (const g of LAYER_MACRO_GROUPS) {
            const m = line.match(new RegExp(`${g.zh}\\s*(\\d+)／(\\d+)`));
            if (!m) {
              mismatch(`大分類「${g.zh}」主題數／圖層開關數`, hint);
              continue;
            }
            reportClaim(`macro.${g.key}.themes`, `大分類「${g.zh}」主題數`, Number(m[1]), actualMacro[g.key]!.themes, hint);
            reportClaim(`macro.${g.key}.toggles`, `大分類「${g.zh}」圖層開關數`, Number(m[2]), actualMacro[g.key]!.toggles, hint);
          }
        }
      }

      // 6) 專案結構：Loader／CustomLayer／Scene 檔案數
      {
        const hint = "README §專案結構 vs src/ 檔案數";
        const m1 = readme.match(/\*Loader\.ts（(\d+)\s*個）/);
        if (!m1) mismatch("Loader 數", hint);
        else reportClaim("loaderFiles", "Loader 數", Number(m1[1]), actualLoaders, hint);

        const m2 = readme.match(/\*CustomLayer\.ts（(\d+)\s*個）/);
        if (!m2) mismatch("CustomLayer 數", hint);
        else reportClaim("customLayerFiles", "CustomLayer 數", Number(m2[1]), actualCustomLayers, hint);

        const m3 = readme.match(/（(\d+)\s*個\s*\*Scene\.ts）/);
        if (!m3) mismatch("Three.js Scene 數", hint);
        else reportClaim("sceneFiles", "Three.js Scene 數（*Scene.ts）", Number(m3[1]), actualScenes, hint);
      }

      // 7) README 2026-10 改版後不再寫的數字：記 skipped，不當 error
      const SKIP_REASON = "README 2026-10 改版後不再列此數字";
      for (const key of ["orphan", "themeTable", "upstreamDatasets", "collectors", "nginxLocations", "featuresFolders"]) {
        skipped.push({ key, reason: SKIP_REASON });
      }

      metrics.d1 = d1Detail;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D7 — params spec 漂移（manifest.params 非空 vs layerParamsSpec 匯出的 key 集合）
  // ══════════════════════════════════════════════════════════════
  {
    const entries = Object.entries(LAYER_MANIFEST) as [string, { params: unknown }][];
    const manifestParamsKeys = new Set(entries.filter(([, v]) => v.params !== null).map(([k]) => k));
    const specKeys = new Set(MIGRATED_PARAMS_KEYS as unknown as string[]);
    const onlyInManifest = [...manifestParamsKeys].filter((k) => !specKeys.has(k)).sort();
    const onlyInSpec = [...specKeys].filter((k) => !manifestParamsKeys.has(k)).sort();

    metrics.d7 = {
      manifest_params_count: manifestParamsKeys.size,
      spec_params_count: specKeys.size,
      only_in_manifest: onlyInManifest,
      only_in_spec: onlyInSpec,
    };

    if (onlyInManifest.length === 0 && onlyInSpec.length === 0) {
      findings.push({
        id: "D7",
        level: "green",
        title: `params spec 與 manifest 完全對齊（各 ${manifestParamsKeys.size} 筆）`,
        detail: "P3 參數控件遷移殘留清空——manifest.params 非空 key 集合與 layerParamsSpec 匯出 key 集合完全相等",
        evidence: "src/data/layerManifest.ts params!=null vs src/data/layerParamsSpec.ts LAYER_PARAMS_SPEC",
      });
    } else {
      findings.push({
        id: "D7",
        level: "yellow",
        title: `params spec 漂移：manifest ${manifestParamsKeys.size} 筆 vs spec ${specKeys.size} 筆`,
        detail:
          (onlyInManifest.length > 0 ? `只在 manifest：${onlyInManifest.slice(0, 20).join(", ")}${onlyInManifest.length > 20 ? ` (+${onlyInManifest.length - 20})` : ""}\n` : "") +
          (onlyInSpec.length > 0 ? `只在 spec：${onlyInSpec.slice(0, 20).join(", ")}${onlyInSpec.length > 20 ? ` (+${onlyInSpec.length - 20})` : ""}` : ""),
        evidence: "P3 參數控件遷移殘留（雙軌判別式兩側 key 集合不相等）",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D2 — feature README 齊全度
  // 依 docs/features/README.md「最小文件契約」：只有 README.md 必備；handoff／backlog／changelog
  // 視需要才建（不得為湊模板建空檔），缺這三份只記在 metrics，不報黃燈。
  // ══════════════════════════════════════════════════════════════
  const featureFolders = listFeatureFolders();
  {
    const incomplete: { folder: string; missing: string[] }[] = [];
    for (const folder of featureFolders) {
      const missing = FEATURE_FILES.filter((f) => !existsSync(path.join(FEATURES_DIR, folder, f)));
      if (missing.length > 0) incomplete.push({ folder, missing });
    }
    const missingReadme = incomplete.filter((i) => i.missing.includes("README.md")).map((i) => i.folder);
    metrics.d2 = {
      total_folders: featureFolders.length,
      missing_readme: missingReadme,
      optional_missing: incomplete
        .map((i) => ({ folder: i.folder, missing: i.missing.filter((f) => f !== "README.md") }))
        .filter((i) => i.missing.length > 0),
    };
    if (missingReadme.length === 0) {
      findings.push({
        id: "D2",
        level: "green",
        title: `所有 ${featureFolders.length} 個 feature 夾都有 README.md`,
        detail: "handoff／backlog／changelog 依契約視需要建立，缺件清單見 metrics.d2.optional_missing",
        evidence: "docs/features/*/README.md 存在性掃描（契約：docs/features/README.md）",
      });
    } else {
      findings.push({
        id: "D2",
        level: "yellow",
        title: `${missingReadme.length} 個 feature 夾缺 README.md（共 ${featureFolders.length} 夾）`,
        detail: missingReadme.join("\n"),
        evidence: "docs/features/*/README.md 存在性掃描（契約：docs/features/README.md）",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D3 — 文件落後於程式（feature 夾最後實質更新日 > 60 天）
  // ══════════════════════════════════════════════════════════════
  {
    const staleFolders: { folder: string; lastDate: string; days: number; usedFallback: boolean; basis: string }[] = [];
    const freshFolders: string[] = [];
    let d3Errors = 0;

    for (const folder of featureFolders) {
      const handoffPath = path.join(FEATURES_DIR, folder, "handoff.md");
      const hasHandoff = existsSync(handoffPath);
      const basis = hasHandoff ? `${folder}/handoff.md` : `${folder}/（排除 backlog.md）`;
      const pathspecs = hasHandoff
        ? [`docs/features/${folder}/handoff.md`]
        : [`docs/features/${folder}`, `:(exclude)docs/features/${folder}/backlog.md`];

      const { date, usedFallback } = lastSubstantiveDate(pathspecs);
      if (date === null) {
        d3Errors++;
        errors.push({ step: "D3", message: `${folder}：git log 查無此路徑的歷史（可能是未追蹤或路徑有誤）` });
        continue;
      }
      const days = daysSince(date, now);
      if (days > STALE_DAYS_D3) {
        staleFolders.push({ folder, lastDate: date, days, usedFallback, basis });
      } else {
        freshFolders.push(folder);
      }
    }

    metrics.d3 = {
      total_folders_checked: featureFolders.length - d3Errors,
      stale_threshold_days: STALE_DAYS_D3,
      stale_count: staleFolders.length,
      stale: staleFolders.map((s) => ({ folder: s.folder, last_date: s.lastDate, days: s.days, used_fallback_date: s.usedFallback })),
    };

    if (staleFolders.length === 0) {
      findings.push({
        id: "D3",
        level: "green",
        title: `無 feature 夾文件超過 ${STALE_DAYS_D3} 天未實質更新`,
        detail: `已排除批次 reorg commit（docs:/docs(backlog):/memory:/memory+docs: 前綴）後計算`,
        evidence: `檢查 ${featureFolders.length - d3Errors} 夾`,
      });
    } else {
      const fallbackNote = staleFolders.some((s) => s.usedFallback)
        ? "（標 * 的夾：所有 commit 都是批次 reorg，日期為退回值，可能比實際更舊）"
        : "";
      findings.push({
        id: "D3",
        level: "yellow",
        title: `${staleFolders.length} 個 feature 夾超過 ${STALE_DAYS_D3} 天未實質更新`,
        detail:
          staleFolders
            .sort((a, b) => b.days - a.days)
            .map((s) => `${s.folder}${s.usedFallback ? "*" : ""}：${s.lastDate}（${s.days} 天前，依據 ${s.basis}）`)
            .join("\n") + (fallbackNote ? `\n${fallbackNote}` : ""),
        evidence: "git log，已排除 docs:/docs(backlog):/memory:/memory+docs: 開頭的批次 commit",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D4 — docs 頂層散檔（linked / orphan_old / orphan_recent）
  // ══════════════════════════════════════════════════════════════
  {
    let topDocs: string[] = [];
    try {
      topDocs = readdirSync(path.join(ROOT, "docs"), { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith(".md"))
        .map((d) => d.name)
        .sort();
    } catch (e) {
      errors.push({ step: "D4", message: `無法列出 docs/*.md：${String(e)}` });
    }

    // 連結掃描來源：CLAUDE.md、README.md、.claude/memory/*.md、docs/development-rules.md、全域 MEMORY.md
    const linkScanSources: { label: string; path: string }[] = [
      { label: "CLAUDE.md", path: path.join(ROOT, "CLAUDE.md") },
      { label: "README.md", path: README_PATH },
      { label: "docs/development-rules.md", path: path.join(ROOT, "docs/development-rules.md") },
      { label: "全域 MEMORY.md", path: GLOBAL_MEMORY_PATH },
    ];
    let memoryDirFiles: string[] = [];
    try {
      memoryDirFiles = readdirSync(path.join(ROOT, ".claude/memory"), { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith(".md"))
        .map((d) => path.join(ROOT, ".claude/memory", d.name));
    } catch (e) {
      errors.push({ step: "D4", message: `無法列出 .claude/memory/*.md：${String(e)}` });
    }
    for (const p of memoryDirFiles) linkScanSources.push({ label: path.relative(ROOT, p), path: p });

    let linkScanText = "";
    let globalMemoryReadable = false;
    for (const src of linkScanSources) {
      const content = readFileSafe(src.path);
      if (content === null) {
        errors.push({ step: "D4", message: `連結掃描來源讀取失敗：${src.label}（${src.path}）` });
        continue;
      }
      if (src.path === GLOBAL_MEMORY_PATH) globalMemoryReadable = true;
      linkScanText += `\n${content}`;
    }
    if (!globalMemoryReadable) {
      errors.push({ step: "D4", message: "連結掃描不含全域 memory，此分類可能偏誤" });
    }

    const linked: string[] = [];
    const orphanOld: { name: string; ageDays: number }[] = [];
    const orphanRecent: { name: string; ageDays: number }[] = [];

    for (const name of topDocs) {
      const isLinked = linkScanText.includes(name);
      let ageDays: number | null = null;
      const { date } = lastSubstantiveDate([`docs/${name}`]);
      if (date) {
        ageDays = daysSince(date, now);
      } else {
        // git 查無歷史（極少見，例如剛建立未 commit）→ 退回檔案系統 mtime
        try {
          ageDays = Math.floor((now.getTime() - statSync(path.join(ROOT, "docs", name)).mtime.getTime()) / (1000 * 60 * 60 * 24));
        } catch {
          errors.push({ step: "D4", message: `${name}：無 git 歷史也讀不到 mtime，年齡未知` });
          continue;
        }
      }

      if (isLinked) {
        linked.push(name);
      } else if (ageDays > STALE_DAYS_D4) {
        orphanOld.push({ name, ageDays });
      } else {
        orphanRecent.push({ name, ageDays });
      }
    }

    metrics.d4 = {
      total_top_level_docs: topDocs.length,
      age_threshold_days: STALE_DAYS_D4,
      linked_count: linked.length,
      orphan_old_count: orphanOld.length,
      orphan_recent_count: orphanRecent.length,
      linked,
      orphan_old: orphanOld,
      orphan_recent: orphanRecent,
      global_memory_scan_included: globalMemoryReadable,
    };

    const biasNote = globalMemoryReadable ? "" : "\n⚠️ 連結掃描不含全域 memory，此分類可能偏誤（見 errors[]）。";
    if (orphanOld.length === 0) {
      findings.push({
        id: "D4",
        level: "green",
        title: `無無人連結且超過 ${STALE_DAYS_D4} 天的頂層文件`,
        detail: `${topDocs.length} 份頂層 docs/*.md：${linked.length} 有連結、${orphanRecent.length} 無連結但夠新`,
        evidence: "CLAUDE.md／README.md／.claude/memory/*.md／docs/development-rules.md／全域 MEMORY.md",
      });
    } else {
      findings.push({
        id: "D4",
        level: "yellow",
        title: `${orphanOld.length} 份頂層文件無人連結且超過 ${STALE_DAYS_D4} 天（歸檔候選）`,
        detail:
          orphanOld
            .sort((a, b) => b.ageDays - a.ageDays)
            .map((f) => `${f.name}（${f.ageDays} 天前）`)
            .join("\n") + biasNote,
        evidence: `共 ${topDocs.length} 份頂層文件，${linked.length} 有連結（不列入候選，即使舊）`,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // D8 — 更新頻率欄位覆蓋率
  // ══════════════════════════════════════════════════════════════
  {
    const freqRegex = /更新頻率|每日|每小時|即時|realtime|快照|refresh/i;
    let withFreq = 0;
    let total = 0;
    const missing: string[] = [];
    for (const folder of featureFolders) {
      const handoffPath = path.join(FEATURES_DIR, folder, "handoff.md");
      const content = readFileSafe(handoffPath);
      if (content === null) continue; // 缺 handoff.md 的夾不計入分母（handoff 依契約視需要才建）
      total++;
      if (freqRegex.test(content)) withFreq++;
      else missing.push(folder);
    }
    const ratio = total > 0 ? Math.round((withFreq / total) * 1000) / 1000 : null;
    metrics.d8 = { total_handoff_files: total, with_frequency_count: withFreq, coverage_ratio: ratio, missing_folders: missing };

    findings.push({
      id: "D8",
      level: ratio !== null && ratio < 0.5 ? "yellow" : "green",
      title: `更新頻率欄位覆蓋率 ${withFreq}/${total}${ratio !== null ? `（${Math.round(ratio * 100)}%）` : ""}`,
      detail: missing.length > 0 ? `未提及更新頻率的夾：${missing.join("、")}` : "全數 handoff.md 都有提及更新頻率相關字樣",
      evidence: "docs/features/*/handoff.md 關鍵字比對：更新頻率／每日／每小時／即時／realtime／快照／refresh",
    });
  }

  // ── 收攏輸出 ──
  const durationSec = (Date.now() - startedAt) / 1000;
  const output = {
    collector: "docs",
    collected_at: new Date().toISOString(),
    ok: true,
    duration_sec: Math.round(durationSec * 10) / 10,
    metrics,
    findings,
    errors,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(deepRedact(output), null, 2));

  const tally = { red: 0, yellow: 0, green: 0 } as Record<Level, number>;
  for (const f of findings) tally[f.level]++;
  console.log(`[check_docs] wrote ${OUT_FILE}`);
  console.log(
    `[check_docs] findings: red=${tally.red} yellow=${tally.yellow} green=${tally.green} errors=${errors.length} duration=${output.duration_sec}s`,
  );
}

main().catch((e) => {
  const message = redact(String((e as Error)?.stack ?? e));
  console.error("[check_docs] fatal:", message);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      OUT_FILE,
      JSON.stringify(
        {
          collector: "docs",
          collected_at: new Date().toISOString(),
          ok: false,
          duration_sec: 0,
          metrics: {},
          findings: [],
          errors: [{ step: "fatal", message }],
        },
        null,
        2,
      ),
    );
  } catch {
    // 連寫檔都失敗就真的沒辦法了
  }
  process.exit(0); // 依契約：探測器失敗不中斷排程，靠 ok:false + errors[] 表達
});
