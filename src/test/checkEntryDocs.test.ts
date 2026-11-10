/** 單一入口文件檢查（scripts/dev/check-entry-docs.mjs）的 fixture 測試；不讀真檔。 */
import { describe, expect, it } from "vitest";
import { checkEntryDocs, extractIds, parseBacklog } from "../../scripts/dev/check-entry-docs.mjs";

const BACKLOG = `# Backlog

## A. 群

| ID | Tier | Pri | State | Item | Next action / blocker | Acceptance |
|---|---|---|---|---|---|---|
| OPEN-1 | 底線:資安 | P1 | ready | 未關閉列 | [細節](../../docs/features/x/README.md) | 驗收 |
| AR-12/13 | 北極星:效率 | P2 | blocked | 不規則 ID | — | — |
| FB-001 | 待討論 | P3 | waiting_external | 〔byok-chat〕BC-3 預設模型 | 原檔：[byok](../../docs/archive/2026-11-09/features/byok-chat/backlog.md) | — |
| BAD-1 | 待討論 | P3 | scheduled | State 不在白名單 | — | — |
| BAD-2 | 待討論 | P3 | ready | 連結壞掉 | [x](../../docs/missing.md) | — |

## 已關閉（2026-11-10）

- **DONE-1**：已完成。證據：#1。
- **DONE-2**／**DONE-3**：一起完成。
  - DONE-4 封存清單的縮排列

| ID | 說明 |
|---|---|
| DONE-5 | 表格裡的已關閉列 |
| OPEN-1 | 同時出現在已關閉段：以未關閉為準 |
`;

const projects = (rows: string, deadline = "") => `# 專案追蹤總表

**有期限的事（日期排序）**

| 期限 | 事項 | 誰 | BACKLOG |
|---|---|---|---|
${deadline}

**本週進行中**

- DONE-1 在 bullet 裡提到不檢查。

### 群

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
${rows}

## 已結案

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 舊 | ✅ | — | — | DONE-5 | [舊](archive/x.md) | — |
`;

const exists = (p: string) => !p.includes("missing");
const run = (rows: string, deadline = "", today = "2026-11-10") =>
  checkEntryDocs({ projects: projects(rows, deadline), backlog: BACKLOG, today, fileExists: exists });
const rulesOf = (ps: { rule: string }[]) => ps.map((p) => p.rule).sort();

describe("extractIds", () => {
  it("展開／、～ 縮寫", () => {
    expect(extractIds("SEC-3／4／8、DEV-2～4、VP-1～VP-3")).toEqual(
      expect.arrayContaining(["SEC-3", "SEC-4", "SEC-8", "DEV-2", "DEV-3", "DEV-4", "VP-1", "VP-2", "VP-3"]),
    );
  });
});

describe("parseBacklog", () => {
  it("分出未關閉與已關閉集合（含 FB 原 ID、粗體、縮排列、表格）", () => {
    const bl = parseBacklog(BACKLOG);
    for (const id of ["OPEN-1", "AR-12/13", "FB-001", "BC-3"]) expect(bl.open.has(id), id).toBe(true);
    for (const id of ["DONE-1", "DONE-2", "DONE-3", "DONE-4", "DONE-5"]) expect(bl.closed.has(id), id).toBe(true);
  });
});

describe("checkEntryDocs", () => {
  it("BACKLOG 檔本身：State 白名單與壞連結（FB 原檔連 archive 不算錯）", () => {
    const ps = run("| a | 🟡 | — | — | OPEN-1 | BACKLOG OPEN-1 | — |");
    expect(rulesOf(ps)).toEqual(["link", "state"]);
    expect(ps.find((p) => p.rule === "state")!.message).toContain("BAD-1");
  });

  const projectProblems = (rows: string, deadline = "", today?: string) =>
    run(rows, deadline, today).filter((p) => p.file === "docs/PROJECTS.md");

  it("引用已關閉 ID 報錯並帶行號；做到哪欄與已結案段不檢查", () => {
    const ps = projectProblems("| a | 🟡 | — | DONE-1 完成 | DONE-2／3 | BACKLOG OPEN-1 | — |");
    expect(rulesOf(ps)).toEqual(["closed-id", "closed-id"]);
    expect(ps[0]!.line).toBeGreaterThan(0);
    expect(ps.map((p) => p.message).join()).toMatch(/DONE-2.*DONE-3|DONE-3.*DONE-2/);
  });

  it("FB 原 ID 與未關閉／已關閉都出現的 ID 算未關閉", () => {
    expect(projectProblems("| a | 🔵 | — | — | BC-3：決定 | BACKLOG FB-001 | — |")).toEqual([]);
  });

  it("查無此 ID：BACKLOG 欄、BACKLOG 字樣之後、下一步的「ID：」子句；ADR 之類不誤報", () => {
    const ps = projectProblems("| a | 🟢 | — | — | NEWS-9：驗 RSS；參考 ADR-0022 | BACKLOG GHOST-1；ADR-0026 | — |", "| 2026-12-01 | x | Claude | NOPE-1 |");
    expect(ps.map((p) => p.message).join("\n")).toMatch(/NEWS-9[\s\S]*/);
    expect(rulesOf(ps)).toEqual(["unknown-id", "unknown-id", "unknown-id"]);
  });

  it("正本不得指向 archive；壞連結報錯", () => {
    const ps = projectProblems("| a | 🟢 | — | — | — | [舊](archive/2026-11-09/x.md)、[壞](./features/missing.md) | — |");
    expect(rulesOf(ps)).toEqual(["archive-link", "link"]);
  });

  it("期限：過期沒結果報錯；有結果標記、未到期、無日期不報；範圍取尾日、月份取月底", () => {
    const dl = [
      "| 2026-11-09 | 過期 | Claude | OPEN-1 |",
      "| 2026-11-08 | 有結果 〔結果 2026-11-09：五項都正常〕 | Claude | OPEN-1 |",
      "| 2026-11-08 | 待確認不算 〔待確認〕 | Claude | OPEN-1 |",
      "| ~2026-11-09～12 | 範圍 | Claude | OPEN-1 |",
      "| 2026-11 前 | 月份 | Claude | OPEN-1 |",
      "| 持續留意 | 無日期 | 使用者 | — |",
    ].join("\n");
    const ps = projectProblems("| a | 🟡 | — | — | — | — | — |", dl, "2026-11-10");
    expect(ps.filter((p) => p.rule === "deadline")).toHaveLength(2);
    const later = projectProblems("| a | 🟡 | — | — | — | — | — |", dl, "2026-12-01").filter((p) => p.rule === "deadline");
    expect(later).toHaveLength(4);
  });

  it("行內豁免要寫理由；有理由就略過該規則", () => {
    const ok = projectProblems("| a | 🟡 | — | — | DONE-1 <!-- entry-docs-ignore closed-id: 說明關閉原因 --> | — | — |");
    expect(ok).toEqual([]);
    const bad = projectProblems("| a | 🟡 | — | — | DONE-1 <!-- entry-docs-ignore closed-id: --> | — | — |");
    expect(rulesOf(bad)).toEqual(["closed-id", "ignore-syntax"]);
  });
});
