#!/usr/bin/env node
// 把 origin/develop 合進目前分支，並自動處理「共用檔」的固定衝突（疊層 PR 合併時人工做過 16 次以上的那幾種）。
//
//   npm run merge:develop [-- --dry-run]
//
// 會做的事：
//   1. 工作區有未提交的追蹤檔改動 → 拒絕執行（不 stash、不 reset）。
//   2. git fetch origin develop → git merge --no-commit origin/develop。沒有衝突就照一般 git merge 直接 commit，結束。
//   3. 有衝突時只碰白名單：
//      - layer-golden/ 目錄下的檔（B1 P1 起 golden 是目錄）、layer-style-inventory.json：取 develop 版
//        （checkout --theirs；develop 已刪的檔 git rm）後用既有指令重產（dump 只重寫有變的檔）。
//      - CHANGELOG.md：只處理 Unreleased。以 develop 版為底，把本分支在 Unreleased 新增的條目依 ### 小節接到尾端
//        （develop 的在前、不產生重複小節）；本分支動到 Unreleased 以外的段落 → 停下不處理。
//      - src/**/locales/**/*.json（layers.json、params.json、legend.*.json…）：兩邊的鍵都留（develop 的順序在前，本分支新增的接在後面）；
//        同一個鍵兩邊值不同、或原檔有重複鍵 → 停下不處理。
//   4. 其他檔案有衝突：一律不碰，列出清單、以非 0 結束、保留現場。手動解完並 git add 後再跑一次，
//      會從進行中的合併接著做（重產要等原始碼沒有衝突標記才跑）。
//   不用 reset --hard、checkout -- .、clean；有衝突時不自動 commit，最後印出動過的檔，請人檢查後 git commit。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GOLDEN = "src/data/__tests__/__fixtures__/layer-golden";
export const INVENTORY = "docs/design-system/layer-style-inventory.json";
export const CHANGELOG = "CHANGELOG.md";
export const LOCALE_RE = /^src\/(?:.*\/)?locales\/.+\.json$/;
export const SECTION_ORDER = ["新增", "修正", "效能", "資料", "注意事項"];

export const DEFAULT_REGEN = {
  golden: ["npx", ["vite-node", "scripts/preprocess/dump-layer-golden.ts"]],
  inventory: ["npm", ["run", "design:audit-layers"]],
};

/** 白名單分類；不在白名單回 null。 */
export function classify(path) {
  if (path === GOLDEN || path.startsWith(`${GOLDEN}/`)) return "golden";
  if (path === INVENTORY) return "inventory";
  if (path === CHANGELOG) return "changelog";
  if (LOCALE_RE.test(path)) return "locale";
  return null;
}

// ── CHANGELOG ───────────────────────────────────────────────────────

const split = (t) => t.replace(/\r\n/g, "\n").split("\n");

/** Unreleased 的範圍 [start, end)：start 是 `## [Unreleased]` 那行，end 是下一個 `## ` 標題（或檔尾）。 */
function unreleasedRange(lines) {
  const start = lines.findIndex((l) => /^##\s+\[Unreleased\]/i.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return [start, end];
}

/** Unreleased 內每一個非空行 → 所屬 ### 小節（小節前的說明文字為 ""）。 */
function unreleasedEntries(lines, [start, end]) {
  const out = [];
  let sec = "";
  for (let i = start + 1; i < end; i++) {
    const l = lines[i];
    const h = /^###\s+(.+?)\s*$/.exec(l);
    if (h) { sec = h[1]; continue; }
    if (l.trim() === "") continue;
    out.push({ sec, text: l, blankBefore: lines[i - 1]?.trim() === "" });
  }
  return out;
}

/**
 * 三方合併 CHANGELOG 的 Unreleased（base／ours＝本分支／theirs＝develop 都是無衝突標記的完整檔）。
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function mergeChangelog({ base, ours, theirs }) {
  const [b, o, t] = [split(base), split(ours), split(theirs)];
  const [rb, ro, rt] = [unreleasedRange(b), unreleasedRange(o), unreleasedRange(t)];
  if (!rb || !ro || !rt) return { ok: false, reason: "找不到 ## [Unreleased] 段落" };
  const outside = (lines, [s, e]) => [...lines.slice(0, s + 1), ...lines.slice(e)].join("\n");
  if (outside(o, ro) !== outside(b, rb)) {
    return { ok: false, reason: "本分支改到 Unreleased 以外的段落（已發布的版本段落或版本總覽），要手動處理：多出的條目搬回 Unreleased" };
  }
  const baseSet = new Set(unreleasedEntries(b, rb).map((e) => e.text));
  const oursEntries = unreleasedEntries(o, ro);
  const oursSet = new Set(oursEntries.map((e) => e.text));
  const added = oursEntries.filter((e) => !baseSet.has(e.text));
  const removed = [...baseSet].filter((x) => !oursSet.has(x));
  // 縮排的續行（子條目）屬於上一個頂層條目：既有條目的續行被改／刪／新增，逐行合併會把它接到別人的條目下，改人工處理
  const parentOf = (entries, i) => { for (let k = i - 1; k >= 0; k--) if (!/^\s/.test(entries[k].text)) return entries[k].text; return null; };
  const indented = (t) => /^\s+\S/.test(t);
  const baseEntries = unreleasedEntries(b, rb);
  const touchedParent = [
    ...oursEntries.map((e, i) => ({ e, i })).filter(({ e }) => indented(e.text) && !baseSet.has(e.text)).map(({ i }) => parentOf(oursEntries, i)).filter((p) => p !== null && baseSet.has(p)),
    ...baseEntries.map((e, i) => ({ e, i })).filter(({ e }) => indented(e.text) && !oursSet.has(e.text)).map(({ i }) => parentOf(baseEntries, i)).filter((p) => p !== null && oursSet.has(p)),
  ];
  if (touchedParent.length) return { ok: false, reason: `本分支改了既有條目的子項目（${touchedParent[0]}），逐行合併會把子項目接到別的條目下，要手動處理` };
  if (added.some((e) => e.sec === "")) return { ok: false, reason: "本分支在 Unreleased 的小節標題之前加了文字，不知道該放哪個 ### 小節" };

  const lines = [...t];
  let [, end] = rt;
  const start = rt[0];
  // 本分支刪掉的條目（例：改寫）：develop 版仍有同一行就一起刪
  for (const r of removed) {
    const i = lines.findIndex((l, k) => k > start && k < end && l === r);
    if (i < 0) continue;
    const dropBlank = lines[i - 1]?.trim() === "" && lines[i + 1]?.trim() === "";
    lines.splice(i, dropBlank ? 2 : 1);
    end -= dropBlank ? 2 : 1;
  }
  const theirsSet = new Set(lines.slice(start + 1, end));
  const bySec = new Map();
  for (const e of added) {
    if (theirsSet.has(e.text)) continue; // develop 已經有（例：先合過一部分）
    if (!bySec.has(e.sec)) bySec.set(e.sec, []);
    bySec.get(e.sec).push(e);
  }
  for (const [sec, entries] of bySec) {
    const block = [];
    entries.forEach((e, k) => { if (k > 0 && e.blankBefore) block.push(""); block.push(e.text); });
    const headings = [];
    for (let i = start + 1; i < end; i++) {
      const h = /^###\s+(.+?)\s*$/.exec(lines[i]);
      if (h) headings.push({ i, name: h[1] });
    }
    const hit = headings.find((h) => h.name === sec);
    let at;
    let insert;
    if (hit) {
      const next = headings.find((h) => h.i > hit.i);
      let last = (next ? next.i : end) - 1;
      while (last > hit.i && lines[last].trim() === "") last--;
      at = last + 1;
      // 沿用 develop 這個小節的寫法：條目之間有空行就空一行再接
      const firstEntry = lines.findIndex((l, k) => k > hit.i && l.trim() !== "");
      const blankSeparated = lines.slice(firstEntry, last).some((l) => l.trim() === "");
      insert = last === hit.i || blankSeparated ? ["", ...block] : block;
    } else {
      const rank = (n) => { const r = SECTION_ORDER.indexOf(n); return r < 0 ? SECTION_ORDER.length : r; };
      const later = headings.find((h) => rank(h.name) > rank(sec));
      const newSec = [`### ${sec}`, "", ...block, ""];
      if (later) { at = later.i; insert = newSec; }
      else {
        let last = end - 1;
        while (last > start && lines[last].trim() === "") last--;
        at = last + 1;
        insert = ["", ...newSec.slice(0, -1)];
      }
    }
    lines.splice(at, 0, ...insert);
    end += insert.length;
  }
  return { ok: true, text: lines.join("\n") };
}

// ── locales JSON ────────────────────────────────────────────────────

/** 第一層的鍵（依 2 格縮排的 `JSON.stringify(_, null, 2)` 格式），用來抓 JSON.parse 會靜默吃掉的重複鍵。 */
function topLevelKeys(text) {
  return [...text.matchAll(/^ {2}"((?:[^"\\]|\\.)*)"\s*:/gm)].map((m) => JSON.parse(`"${m[1]}"`));
}

/**
 * 三方合併平面 JSON 物件（locales 的 layers.json）。develop 的鍵順序在前，本分支新增的鍵接在後面。
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function mergeJsonObject({ base, ours, theirs }) {
  const parsed = {};
  for (const [name, text] of Object.entries({ base, ours, theirs })) {
    let obj;
    try { obj = JSON.parse(text); } catch (err) { return { ok: false, reason: `${name} 版不是合法 JSON：${err.message}` }; }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, reason: `${name} 版不是 JSON 物件` };
    const keys = topLevelKeys(text);
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dup.length) return { ok: false, reason: `${name} 版有重複鍵：${[...new Set(dup)].join(", ")}` };
    if (`${JSON.stringify(obj, null, 2)}\n` !== text.replace(/\r\n/g, "\n")) return { ok: false, reason: `${name} 版不是 2 格縮排的標準格式，自動合併會整檔改格式` };
    parsed[name] = obj;
  }
  const { base: b, ours: o, theirs: t } = parsed;
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
  const out = { ...t };
  const conflicts = [];
  for (const k of Object.keys(o)) {
    if (!has(b, k)) {
      if (has(t, k) && !same(t[k], o[k])) conflicts.push(k);
      else out[k] = o[k];
    } else if (!same(o[k], b[k])) {
      if (!has(t, k)) conflicts.push(k); // 本分支改值、develop 刪除：不默默復活，要人決定
      else if (same(t[k], b[k])) out[k] = o[k];
      else if (!same(t[k], o[k])) conflicts.push(k);
    }
  }
  for (const k of Object.keys(b)) {
    if (has(o, k)) continue;
    if (has(t, k) && same(t[k], b[k])) delete out[k];
    else if (has(t, k)) conflicts.push(k);
  }
  if (conflicts.length) return { ok: false, reason: `兩邊對同一個鍵給了不同的值：${conflicts.join(", ")}` };
  return { ok: true, text: `${JSON.stringify(out, null, 2)}\n` };
}

// ── 流程 ────────────────────────────────────────────────────────────

/**
 * @param {{ cwd: string, remote?: string, branch?: string, fetch?: boolean, dryRun?: boolean,
 *   regen?: { golden: [string, string[]], inventory: [string, string[]] }, env?: NodeJS.ProcessEnv, log?: (s: string) => void }} opts
 * @returns {{ code: number, touched: string[], manual: string[] }}
 */
export function runMergeDevelop(opts) {
  const { cwd, remote = "origin", branch = "develop", fetch = true, dryRun = false, regen = DEFAULT_REGEN, env = process.env, log = console.log } = opts;
  const target = remote ? `${remote}/${branch}` : branch;
  const git = (args, o = {}) => execFileSync("git", args, { cwd, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...o });
  const tryGit = (args) => spawnSync("git", args, { cwd, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  // -z：路徑以 NUL 分隔且不加引號跳脫（core.quotePath 預設會把 tw-交通.json 輸出成 "tw-\\344..." 而分類失敗）
  const unmergedFiles = () => git(["diff", "-z", "--name-only", "--diff-filter=U"]).split("\0").filter(Boolean);
  const touched = [];
  const manual = [];
  const done = (code) => ({ code, touched, manual });

  const gitDir = git(["rev-parse", "--absolute-git-dir"]).trim();
  const inMerge = existsSync(join(gitDir, "MERGE_HEAD"));

  if (!inMerge) {
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]).trim();
    if (dirty) {
      log(`工作區有未提交的改動，先 commit 或自行收好再跑：\n${dirty}`);
      return done(2);
    }
    if (fetch && remote) {
      log(`git fetch ${remote} ${branch}`);
      git(["fetch", "--no-tags", remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], { stdio: ["ignore", "pipe", "inherit"] });
    }
    if (tryGit(["merge-base", "--is-ancestor", target, "HEAD"]).status === 0) {
      log(`已包含 ${target}，不用合併。`);
      return done(0);
    }
    if (dryRun) {
      const mt = tryGit(["merge-tree", "--write-tree", "--name-only", "--no-messages", "-z", "HEAD", target]);
      const files = mt.status === 1 ? mt.stdout.split("\0").slice(1).filter(Boolean) : [];
      if (mt.status > 1) { log(`git merge-tree 失敗：${mt.stderr}`); return done(1); }
      log(files.length ? `合併 ${target} 會有 ${files.length} 個衝突檔：` : `合併 ${target} 不會有衝突：會直接 merge 並 commit。`);
      planFor(files, log);
      return done(0);
    }
    log(`git merge --no-commit ${target}`);
    const m = tryGit(["-c", "merge.conflictStyle=diff3", "merge", "--no-ff", "--no-commit", target]);
    const unmergedNow = unmergedFiles();
    if (m.status !== 0 && !unmergedNow.length) {
      log(`git merge 失敗（不是衝突）：\n${m.stdout}${m.stderr}`);
      return done(1);
    }
    if (!unmergedNow.length) {
      git(["commit", "--no-edit"]);
      log(`沒有衝突，已照一般 git merge 建立 merge commit：${git(["log", "--oneline", "-1"]).trim()}`);
      return done(0);
    }
  } else {
    log("偵測到進行中的合併（MERGE_HEAD），接著處理剩下的衝突。");
  }

  const unmerged = unmergedFiles();
  if (!unmerged.length) {
    log("沒有未解的衝突。請檢查後 git commit。");
    return done(0);
  }
  if (dryRun) {
    log(`進行中的合併還有 ${unmerged.length} 個衝突檔：`);
    planFor(unmerged, log);
    return done(0);
  }
  const kinds = new Map(unmerged.map((p) => [p, classify(p)]));
  const others = unmerged.filter((p) => !kinds.get(p));
  const stage = (n, p) => {
    const r = tryGit(["show", `:${n}:${p}`]);
    return r.status === 0 ? r.stdout : null;
  };
  const writeAdd = (p, text) => {
    writeFileSync(join(cwd, p), text);
    git(["add", "--", p]);
    touched.push(p);
  };

  // 純文字類：不需要原始碼可編譯，先解
  for (const p of unmerged) {
    const kind = kinds.get(p);
    if (kind !== "changelog" && kind !== "locale") continue;
    const [base, ours, theirs] = [1, 2, 3].map((n) => stage(n, p));
    if (base === null || ours === null || theirs === null) { manual.push(`${p}（某一邊新增或刪除了整個檔）`); continue; }
    const r = kind === "changelog" ? mergeChangelog({ base, ours, theirs }) : mergeJsonObject({ base, ours, theirs });
    if (r.ok) { writeAdd(p, r.text); log(`✓ ${p}：兩邊條目都保留（develop 在前）`); }
    else manual.push(`${p}（${r.reason}）`);
  }

  const goldenConflicts = unmerged.filter((p) => kinds.get(p) === "golden");
  const needGolden = goldenConflicts.length > 0;
  const needInventory = unmerged.includes(INVENTORY);
  const blockers = [...others, ...manual];
  if (blockers.length) {
    log(`\n以下衝突要手動處理（工具沒有碰）：`);
    for (const p of blockers) log(`  - ${p}`);
    if (needGolden || needInventory) log(`解完並 git add 後再跑一次 npm run merge:develop，會接著重產 ${[needGolden && "layer-golden", needInventory && "樣式盤點"].filter(Boolean).join("、")}。`);
    report();
    return done(1);
  }

  const run = ([cmd, args]) => {
    log(`$ ${cmd} ${args.join(" ")}`);
    const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 失敗（exit ${r.status}）`);
  };
  try {
    if (needGolden) {
      // develop 版為準：develop 有的檔取 theirs，develop 已刪的 group 檔直接移除；之後 dump 依原始碼重產
      for (const p of goldenConflicts) {
        if (stage(3, p) !== null) git(["checkout", "--theirs", "--", p]);
        else git(["rm", "-q", "--force", "--", p]);
      }
      run(regen.golden);
      git(["add", "-A", "--", GOLDEN]);
      touched.push(`${GOLDEN}/（${goldenConflicts.length} 個衝突檔，重產後整個目錄已 git add）`);
    }
    if (needInventory) {
      git(["checkout", "--theirs", "--", INVENTORY]);
      run(regen.inventory);
      git(["add", "--", INVENTORY]);
      touched.push(INVENTORY);
    }
  } catch (err) {
    log(`重產失敗：${err.message}。現場保留，修好後再跑一次。`);
    report();
    return done(1);
  }
  if (manual.length) {
    log(`\n以下衝突要手動處理：`);
    for (const p of manual) log(`  - ${p}`);
    report();
    return done(1);
  }
  report();
  log("\n請檢查後 git commit（合併尚未 commit；跑 npm run verify 確認）。");
  return done(0);

  function report() {
    if (!touched.length) return;
    log(`\n本工具動過的檔（已 git add）：`);
    for (const p of [...new Set(touched)]) log(`  - ${p}`);
  }
}

function planFor(files, log) {
  const plan = {
    golden: "取 develop 版後跑 npx vite-node scripts/preprocess/dump-layer-golden.ts 重產（只重寫有變的 group 檔）",
    inventory: "取 develop 版後跑 npm run design:audit-layers 重產",
    changelog: "Unreleased 兩邊條目都保留（develop 在前、依 ### 小節合併）；動到已發布段落就停",
    locale: "兩邊的鍵都留（develop 在前）；同鍵不同值或重複鍵就停",
  };
  for (const p of files) log(`  - ${p}：${plan[classify(p)] ?? "不在白名單，要手動處理（工具不碰）"}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("用法：npm run merge:develop [-- --dry-run]（說明見 docs/git-workflow.md「合併 develop」）");
    return 0;
  }
  const cwd = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  return runMergeDevelop({ cwd, dryRun: args.includes("--dry-run") }).code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
