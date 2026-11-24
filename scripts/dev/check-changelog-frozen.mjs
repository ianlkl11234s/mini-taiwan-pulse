#!/usr/bin/env node
// 已發布的 CHANGELOG 段落不可被改（BACKLOG DEV-7）。
//
// 規則：CHANGELOG.md 裡「origin/master 上已經有的版本段落」（`## v2.44.0 — …` 或 `## [2.44.0]` 起，到下一個 `## ` 標題前）
// 在本分支必須與 master 逐字相同。`## [Unreleased]`、`## 版本總覽` 等非版本段落，以及 master 還沒有的新版本段落不受限。
// 為什麼：新條目誤寫進舊版段落，發版時不會被搬、正式站「更新紀錄」也不會出現；過去靠發版前人工比對（33 次）。
//
// - base=master 的 PR（發版、hotfix）：新增的版本段落 master 還沒有，不受限；舊段落一樣不可改。
// - master 有、本分支沒有的版本段落（例：hotfix 剛進 master、還沒合回 develop）只提醒不擋，
//   否則回合併前所有 PR 都會紅。真的刪掉舊段落也只會看到提醒，靠人看。
// - 讀不到 master（沒 fetch）→ 失敗，不靜默通過（docs/ci.md §1.3）。
//
// 零相依（只用 node 內建）。用法：node scripts/dev/check-changelog-frozen.mjs [--base <git ref>]（預設 origin/master）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CHANGELOG_PATH = "CHANGELOG.md";

/** `## v2.44.0 — …`、`## [2.44.0] …`、`## 2.44.0` → "2.44.0"；其他標題回 null。 */
export function versionOf(heading) {
  const m = /^##\s+\[?v?(\d+\.\d+\.\d+)\]?(?=\s|$)/.exec(heading);
  return m ? m[1] : null;
}

/** 切出版本段落：version → { heading, line（1 起算）, lines }。結尾空白行不算（避免段落間空行造成雜訊）。 */
export function splitVersionSections(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections = new Map();
  let cur = null;
  const close = () => {
    if (!cur) return;
    while (cur.lines.length && cur.lines[cur.lines.length - 1].trim() === "") cur.lines.pop();
    if (!sections.has(cur.version)) sections.set(cur.version, cur);
    cur = null;
  };
  lines.forEach((line, i) => {
    if (!line.startsWith("## ")) {
      cur?.lines.push(line);
      return;
    }
    close();
    const version = versionOf(line);
    if (version) cur = { version, heading: line, line: i + 1, lines: [line] };
  });
  close();
  return sections;
}

/** 最小行級 diff（LCS），回傳 [{ op: "-" | "+", text, line }]，line 是該行在 head（+）或 master（-）段落內的位置（1 起算）。 */
export function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; }
    else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { out.push({ op: "+", text: b[j], line: j + 1 }); j++; }
    else { out.push({ op: "-", text: a[i], line: i + 1 }); i++; }
  }
  return out;
}

/**
 * 比對 master 與本分支的 CHANGELOG。
 * @returns {{ errors: {version: string, headLine: number, diff: {op: string, text: string, line: number}[]}[], missing: string[], checked: number }}
 */
export function checkChangelogFrozen({ master, head }) {
  const base = splitVersionSections(master);
  const mine = splitVersionSections(head);
  const errors = [];
  const missing = [];
  for (const [version, sec] of base) {
    const h = mine.get(version);
    if (!h) { missing.push(version); continue; }
    if (h.lines.join("\n") === sec.lines.join("\n")) continue;
    errors.push({ version, headLine: h.line, diff: diffLines(sec.lines, h.lines).map((d) => ({ ...d, line: d.op === "+" ? h.line + d.line - 1 : sec.line + d.line - 1 })) });
  }
  return { errors, missing, checked: base.size };
}

/** 違規說明（含修法）；給 CLI 與測試共用。 */
export function formatReport(result, baseRef = "origin/master") {
  const out = [];
  for (const e of result.errors) {
    out.push(`CHANGELOG.md:${e.headLine} 已發布的 v${e.version} 段落和 ${baseRef} 不同：`);
    for (const d of e.diff) {
      const clip = d.text.length > 160 ? `${d.text.slice(0, 160)}…` : d.text;
      out.push(`  ${d.op} ${d.op === "+" ? "本分支" : "master"} 第 ${d.line} 行：${clip}`);
    }
  }
  if (result.errors.length) {
    out.push(
      "修法：把「+」的條目搬回 `## [Unreleased]` 對應的 ### 小節（新增／修正／效能／資料／注意事項），「-」的行照 master 還原。" +
        "已發布的段落只在發版時產生，之後不再改（docs/RELEASING.md）。",
    );
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--base");
  const baseRef = (i >= 0 ? args[i + 1] : "") || "origin/master";
  const gha = Boolean(process.env.GITHUB_ACTIONS);
  let master;
  try {
    master = execFileSync("git", ["show", `${baseRef}:${CHANGELOG_PATH}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    console.error(`::error::讀不到 ${baseRef} 的 ${CHANGELOG_PATH}（${err.stderr?.toString().trim() || err.message}）。先跑 git fetch origin master；這項檢查不會在讀不到時自動略過。`);
    return 1;
  }
  const result = checkChangelogFrozen({ master, head: readFileSync(CHANGELOG_PATH, "utf8") });
  if (result.missing.length) {
    const msg = `${baseRef} 有、本分支沒有的版本段落：${result.missing.map((v) => `v${v}`).join("、")}（多半是本分支落後 master，例如 hotfix 還沒合回 develop；先 git merge origin/develop 或等回合併）。只提醒，不擋。`;
    console.log(msg);
    if (gha) console.log(`::warning file=${CHANGELOG_PATH}::${msg}`);
  }
  for (const line of formatReport(result, baseRef)) console.log(line);
  if (gha) for (const e of result.errors) console.log(`::error file=${CHANGELOG_PATH},line=${e.headLine}::已發布的 v${e.version} 段落被改，條目要搬回 Unreleased`);
  console.log(`check-changelog-frozen：比對 ${baseRef} 已發布的 ${result.checked} 個版本段落，${result.errors.length} 個被改。`);
  return result.errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
