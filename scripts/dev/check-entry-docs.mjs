#!/usr/bin/env node
// 單一入口文件檢查（A8）：docs/PROJECTS.md ↔ .claude/memory/BACKLOG.md 不可互相矛盾。
// 規則與標記寫法的正本：.claude/memory/README.md「入口文件自動檢查」。
// 零相依（只用 node 內建），CI 的 entry-docs job 不跑 npm ci 也能執行。
//
// 用法：node scripts/dev/check-entry-docs.mjs [--today YYYY-MM-DD] [--root <repo>]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECTS_PATH = "docs/PROJECTS.md";
export const BACKLOG_PATH = ".claude/memory/BACKLOG.md";

/** BACKLOG 未關閉段允許的 State（README 與 BACKLOG 檔頭要同一份）。 */
export const STATE_WHITELIST = ["ready", "in_progress", "blocked", "waiting_external", "conditional", "verifying", "merged"];

/** 「有期限的事」列的結果標記：〔結果 YYYY-MM-DD：…〕（〔待確認〕不算結果）。 */
export const RESULT_MARK = /〔結果 \d{4}-\d{2}-\d{2}：[^〕]+〕/;

/** 行內豁免：<!-- entry-docs-ignore <rule>: <理由> -->；理由必填。 */
const IGNORE_MARK = /<!--\s*entry-docs-ignore\s+([a-z-]+)\s*:\s*([^>]*?)\s*-->/g;

export const RULES = {
  closedId: "closed-id",
  unknownId: "unknown-id",
  deadline: "deadline",
  state: "state",
  link: "link",
  archive: "archive-link",
};

/** 只警告、不讓 CI 紅的規則：結果只因日期前進而改變的檢查（主要出口是開場 hook，見 BACKLOG DEV-6）。 */
export const WARNING_RULES = new Set(["deadline"]);

// 「像 ID」只用來切 token；是不是 BACKLOG ID 由 BACKLOG 的集合決定，不靠 regex 判斷。
// 舊式無連字號 ID（G015、G025）也要納入，否則引用已關閉／不存在的 G### 不會被檢查（review F087）。
const TOKEN = /[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+[a-z]?|(?<![A-Za-z0-9])G\d{3}(?![A-Za-z0-9])/g;

/** 依 Asia/Taipei 取今天（YYYY-MM-DD）。 */
export function taipeiToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(now);
}

function ignoresOf(line) {
  const out = new Map();
  for (const m of line.matchAll(IGNORE_MARK)) if (m[2]) out.set(m[1], m[2]);
  return out;
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const isTableRow = (l) => l.trimStart().startsWith("|");
const isSeparator = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);

/**
 * 從一段文字取出 ID token，並展開縮寫：
 *   SEC-3／4／5、TWL-5、6、MCP-1～3、VP-1～VP-13、SR-1/SR-2
 */
export function extractIds(text) {
  const ids = [];
  const re = new RegExp(TOKEN.source, "g");
  let m;
  while ((m = re.exec(text))) {
    const tok = m[0];
    ids.push(tok);
    const head = tok.match(/^(.*-)(\d+)$/);
    if (!head) continue;
    const prefix = head[1];
    let rest = text.slice(re.lastIndex);
    let last = Number(head[2]);
    // 連續的「／N」「、N」「/N」或「～N」「~N」「～PREFIX-N」
    for (;;) {
      const list = rest.match(/^\s*[／/、]\s*(\d+)(?![\d.])/);
      const range = rest.match(/^\s*[～~]\s*(?:[A-Z][A-Z0-9]*-)?(\d+)(?![\d.])/);
      if (list) {
        last = Number(list[1]);
        ids.push(prefix + list[1]);
        rest = rest.slice(list[0].length);
        re.lastIndex += list[0].length;
      } else if (range) {
        const end = Number(range[1]);
        if (end > last && end - last <= 30) for (let n = last + 1; n <= end; n++) ids.push(prefix + n);
        last = end;
        rest = rest.slice(range[0].length);
        re.lastIndex += range[0].length;
      } else break;
    }
  }
  return ids;
}

/**
 * 解析 BACKLOG：第一個「## 已關閉」之前是未關閉段。
 * open：表格列首 ID ＋ FB 列 Item 內〔slug〕後的原 ID；closed：已關閉段的 `- **ID**` 與表格列首。
 */
export function parseBacklog(text) {
  const lines = text.split("\n");
  const closeAt = lines.findIndex((l) => /^## 已關閉/.test(l));
  const end = closeAt < 0 ? lines.length : closeAt;
  const open = new Map(); // id -> line no
  const closed = new Map();
  const rows = [];
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inOpen = i < end;
    if (!isTableRow(line)) {
      header = null;
      if (!inOpen) {
        // 「- **A**：」「- **A／B**：」「- **A**／**B**：」：冒號前的粗體都算
        if (/^\s*-\s*\*\*/.test(line)) {
          const head = line.split(/[：:]/)[0];
          for (const bm of head.matchAll(/\*\*([^*]+)\*\*/g))
            for (const id of bm[1].split(/[／/、]/)) if (id.trim() && !closed.has(id.trim().replace(/（.*$/, ""))) closed.set(id.trim().replace(/（.*$/, ""), i + 1);
        }
        // 封存清單的縮排列「  - OG-3 說明…」
        const plain = line.match(/^\s*-\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)[\s：:]/);
        if (plain && !closed.has(plain[1])) closed.set(plain[1], i + 1);
      }
      continue;
    }
    if (isSeparator(line)) continue;
    const cells = splitRow(line);
    if (!header) {
      header = cells;
      continue;
    }
    const id = cells[0];
    if (!id) continue;
    // 列首複合 ID（AR-12/13、AR-14/15）展開後每個都登記，PROJECTS 引用 AR-13 才找得到（review F084）
    const rowIds = [id, ...extractIds(id)];
    if (inOpen) {
      for (const rid of rowIds) if (!open.has(rid)) open.set(rid, i + 1);
      const item = cells[header.indexOf("Item")] ?? "";
      const orig = item.match(/^〔[^〕]+〕\s*([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)/);
      if (orig && !open.has(orig[1])) open.set(orig[1], i + 1);
      rows.push({ line: i + 1, raw: line, id, header, cells });
    } else for (const rid of rowIds) if (!closed.has(rid)) closed.set(rid, i + 1);
  }
  return { open, closed, rows, lines, end };
}

function parseDeadline(cell) {
  const dates = [...cell.matchAll(/(\d{4})-(\d{2})(?:-(\d{2}))?(?:\s*～\s*(\d{1,2}))?/g)];
  if (!dates.length) return null;
  // 取第一個日期：改期寫成「2026-11-20（原 2026-11-09）」時新日期在前
  const d = dates[0];
  const [, y, mo, day, rangeEnd] = d;
  if (rangeEnd) return `${y}-${mo}-${rangeEnd.padStart(2, "0")}`;
  if (day) return `${y}-${mo}-${day}`;
  const last = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
  return `${y}-${mo}-${String(last).padStart(2, "0")}`;
}

/** markdown 相對連結（不含 http、#、mailto）。 */
function relLinks(text) {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1].split("#")[0])
    .filter((h) => h && !/^[a-z]+:/i.test(h));
}

/**
 * 檢查兩份文件。fileExists(repoRelPath) 由呼叫端注入，方便測試。
 * 回傳違規清單：{ file, line, rule, level: "error"|"warning", message }
 */
export function checkEntryDocs({ projects, backlog, today, fileExists = () => true }) {
  const problems = [];
  const bl = parseBacklog(backlog);
  const push = (file, line, rule, message, raw) => {
    const why = ignoresOf(raw ?? "").get(rule);
    if (why) return;
    problems.push({ file, line, rule, level: WARNING_RULES.has(rule) ? "warning" : "error", message });
  };
  const resolveFrom = (fromFile, href) => {
    const p = normalize(join(dirname(fromFile), decodeURI(href)));
    return p.startsWith("..") ? null : p.split(sep).join("/");
  };

  // ── 豁免標記本身要有理由
  for (const [file, text] of [[PROJECTS_PATH, projects], [BACKLOG_PATH, backlog]]) {
    text.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/<!--\s*entry-docs-ignore\b([^>]*)-->/g)) {
        if (!/^\s+[a-z-]+\s*:\s*\S/.test(m[1])) problems.push({ file, line: i + 1, rule: "ignore-syntax", level: "error", message: "豁免標記要寫成 <!-- entry-docs-ignore <rule>: <理由> -->" });
      }
    });
  }

  // ── BACKLOG 未關閉段：State 白名單、連結存在
  for (const r of bl.rows) {
    const si = r.header.indexOf("State");
    if (si >= 0) {
      const state = (r.cells[si] ?? "").replace(/`/g, "");
      if (!STATE_WHITELIST.includes(state)) push(BACKLOG_PATH, r.line, RULES.state, `${r.id} 的 State「${state}」不在白名單（${STATE_WHITELIST.join("／")}）`, r.raw);
    }
  }
  bl.lines.slice(0, bl.end).forEach((l, i) => {
    for (const href of relLinks(l)) {
      const p = resolveFrom(BACKLOG_PATH, href);
      if (p && !fileExists(p)) push(BACKLOG_PATH, i + 1, RULES.link, `連結指向不存在的檔：${href}`, l);
    }
  });

  // ── PROJECTS
  const pl = projects.split("\n");
  const closedSectionAt = pl.findIndex((l) => /^## 已結案/.test(l));
  const pEnd = closedSectionAt < 0 ? pl.length : closedSectionAt;
  let header = null;
  let inDeadline = false;
  for (let i = 0; i < pEnd; i++) {
    const line = pl[i];
    if (/有期限的事/.test(line)) inDeadline = true;
    else if (/^\*\*|^#/.test(line)) inDeadline = false;
    // 未關閉段的所有相對連結都要存在
    for (const href of relLinks(line)) {
      const p = resolveFrom(PROJECTS_PATH, href);
      if (p && !fileExists(p)) push(PROJECTS_PATH, i + 1, RULES.link, `連結指向不存在的檔：${href}`, line);
    }
    if (!isTableRow(line)) {
      header = null;
      continue;
    }
    if (isSeparator(line)) continue;
    const cells = splitRow(line);
    if (!header) {
      header = cells;
      continue;
    }
    const col = (name) => header.indexOf(name);
    const idCells = [];
    for (const name of ["下一步", "正本", "BACKLOG"]) if (col(name) >= 0) idCells.push([name, cells[col(name)] ?? ""]);

    for (const [name, cell] of idCells) {
      // 已關閉 ID：只要出現在這三欄就報
      for (const id of new Set(extractIds(cell))) {
        if (bl.open.has(id)) continue;
        if (bl.closed.has(id)) push(PROJECTS_PATH, i + 1, RULES.closedId, `「${name}」欄引用的 ${id} 已在 BACKLOG 已關閉段（BACKLOG L${bl.closed.get(id)}）`, line);
      }
      // 查無此 ID：BACKLOG 欄整格、其他欄「BACKLOG 」字樣之後到「；」為止
      const scopes = name === "BACKLOG" ? [cell] : [...cell.matchAll(/BACKLOG\s+([^；;]*)/g)].map((m) => m[1]);
      // 「下一步」欄以「ID：」開頭的子句，也當成在引用 BACKLOG 列
      if (name === "下一步") for (const m of cell.matchAll(/(?:^|[；;（(]\s*)([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+|G\d{3})[：:]/g)) scopes.push(m[1]);
      for (const scope of scopes)
        for (const id of new Set(extractIds(scope)))
          if (!bl.open.has(id) && !bl.closed.has(id)) push(PROJECTS_PATH, i + 1, RULES.unknownId, `「${name}」欄引用的 ${id} 在 BACKLOG 查無此列`, line);
    }

    // 正本欄不得指向 archive
    if (col("正本") >= 0)
      for (const href of relLinks(cells[col("正本")] ?? "")) {
        const p = resolveFrom(PROJECTS_PATH, href);
        if (p && p.startsWith("docs/archive/")) push(PROJECTS_PATH, i + 1, RULES.archive, `「正本」指向已封存檔：${href}`, line);
      }

    // 有期限的事：過期且沒有結果註記
    if (inDeadline && col("期限") >= 0) {
      const due = parseDeadline(cells[col("期限")] ?? "");
      if (due && due < today && !RESULT_MARK.test(line))
        push(PROJECTS_PATH, i + 1, RULES.deadline, `期限 ${due} 已過（今天 ${today}），請寫〔結果 YYYY-MM-DD：…〕、改期或刪列`, line);
    }
  }
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const opt = (k) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(opt("--root") ?? join(here, "..", ".."));
  const today = opt("--today") ?? taipeiToday();
  const read = (p) => readFileSync(join(root, p), "utf8");
  const problems = checkEntryDocs({
    projects: read(PROJECTS_PATH),
    backlog: read(BACKLOG_PATH),
    today,
    fileExists: (p) => existsSync(join(root, p)),
  });
  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");
  const gha = Boolean(process.env.GITHUB_ACTIONS);
  const where = (p) => relative(root, join(root, p.file));
  if (warnings.length) {
    console.log(`過期提醒（只警告，不影響結果）：`);
    for (const p of warnings) {
      console.log(`  ${where(p)}:${p.line} [${p.rule}] ${p.message}`);
      if (gha) console.log(`::warning file=${where(p)},line=${p.line}::${p.message}`);
    }
  }
  for (const p of errors) {
    console.log(`${where(p)}:${p.line} [${p.rule}] ${p.message}`);
    if (gha) console.log(`::error file=${where(p)},line=${p.line}::[${p.rule}] ${p.message}`);
  }
  console.log(`check-entry-docs：${errors.length} 個違規、${warnings.length} 個過期提醒（today=${today}）。規則與豁免寫法見 .claude/memory/README.md「入口文件自動檢查」。`);
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
