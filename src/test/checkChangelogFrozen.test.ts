/** 已發布 CHANGELOG 段落凍結檢查（scripts/dev/check-changelog-frozen.mjs，DEV-7）的 fixture 測試；不讀真檔、不碰 git。 */
import { describe, expect, it } from "vitest";
import { checkChangelogFrozen, formatReport, splitVersionSections, versionOf } from "../../scripts/dev/check-changelog-frozen.mjs";

const doc = (unreleased: string, versions: string) => `# Changelog

## 版本總覽

| 版號 | 日期 | 重點 |
|---|---|---|
| v1.1.0 | 2026-11-02 | B |
| v1.0.0 | 2026-11-01 | A |

## [Unreleased]

${unreleased}
${versions}`;

const V110 = `## v1.1.0 — 2026-11-02 — B

### 新增

- 功能 B（#2）

`;
const V100 = `## v1.0.0 — 2026-11-01 — A

### 新增

- 功能 A（#1）
`;
const MASTER = doc("", V110 + V100);

describe("versionOf／splitVersionSections", () => {
  it("吃兩種標題寫法，非版本標題回 null", () => {
    expect(versionOf("## v2.44.0 — 2026-11-23 — 泰國")).toBe("2.44.0");
    expect(versionOf("## [2.44.0] - 2026-11-23")).toBe("2.44.0");
    expect(versionOf("## [Unreleased]")).toBeNull();
    expect(versionOf("## 版本總覽")).toBeNull();
  });

  it("段落到下一個 ## 為止，結尾空行不算", () => {
    const s = splitVersionSections(MASTER);
    expect([...s.keys()]).toEqual(["1.1.0", "1.0.0"]);
    expect(s.get("1.1.0")!.lines).toEqual(["## v1.1.0 — 2026-11-02 — B", "", "### 新增", "", "- 功能 B（#2）"]);
  });
});

describe("checkChangelogFrozen", () => {
  it("和 master 相同 → 通過", () => {
    expect(checkChangelogFrozen({ master: MASTER, head: MASTER }).errors).toEqual([]);
  });

  it("Unreleased 新增條目、版本總覽改動 → 不受限", () => {
    const head = doc("### 新增\n\n- 新功能 C（#3）\n", V110 + V100).replace("| v1.1.0 | 2026-11-02 | B |", "| v1.1.0 | 2026-11-02 | B（改寫） |");
    expect(checkChangelogFrozen({ master: MASTER, head }).errors).toEqual([]);
  });

  it("條目寫進已發布段落 → 紅，指出版本、行號與修法", () => {
    const head = doc("", V110.replace("- 功能 B（#2）", "- 功能 B（#2）\n- 誤寫進舊版的 C（#3）") + V100);
    const r = checkChangelogFrozen({ master: MASTER, head });
    expect(r.errors.map((e) => e.version)).toEqual(["1.1.0"]);
    expect(r.errors[0]!.diff).toEqual([{ op: "+", text: "- 誤寫進舊版的 C（#3）", line: head.split("\n").indexOf("- 誤寫進舊版的 C（#3）") + 1 }]);
    const report = formatReport(r).join("\n");
    expect(report).toContain("v1.1.0");
    expect(report).toContain("Unreleased");
  });

  it("改寫或刪掉已發布段落的條目 → 紅（- 與 + 都列出）", () => {
    const head = doc("", V110 + V100.replace("- 功能 A（#1）", "- 功能 A，改寫（#1）"));
    const r = checkChangelogFrozen({ master: MASTER, head });
    expect(r.errors.map((e) => e.version)).toEqual(["1.0.0"]);
    expect(r.errors[0]!.diff.map((d) => d.op).sort()).toEqual(["+", "-"]);
  });

  it("CRLF 與段落尾端空行數不同不算改動", () => {
    const head = MASTER.replace(/\n/g, "\r\n").replace("- 功能 B（#2）\r\n", "- 功能 B（#2）\r\n\r\n\r\n");
    expect(checkChangelogFrozen({ master: MASTER, head }).errors).toEqual([]);
  });

  describe("base=master（發版與 hotfix PR）", () => {
    it("發版 PR：Unreleased 搬成新版本段落 → 通過（master 還沒有的段落不受限）", () => {
      const head = doc("", "## v1.2.0 — 2026-11-03 — C\n\n### 新增\n\n- 功能 C（#3）\n\n" + V110 + V100);
      const r = checkChangelogFrozen({ master: MASTER, head });
      expect(r.errors).toEqual([]);
      expect(r.missing).toEqual([]);
    });

    it("hotfix PR：多一個 PATCH 段落 → 通過；但順手改舊段落一樣紅", () => {
      const patch = "## v1.1.1 — 2026-11-03 — 修正\n\n### 修正\n\n- 修 X（#4）\n\n";
      expect(checkChangelogFrozen({ master: MASTER, head: doc("", patch + V110 + V100) }).errors).toEqual([]);
      const bad = doc("", patch + V110.replace("- 功能 B（#2）", "- 功能 B（#2）\n- 修 X（#4）") + V100);
      expect(checkChangelogFrozen({ master: MASTER, head: bad }).errors.map((e) => e.version)).toEqual(["1.1.0"]);
    });

    it("hotfix 已進 master、本分支還沒合回（少一個段落）→ 只列 missing，不算錯", () => {
      const masterWithHotfix = doc("", "## v1.1.1 — 2026-11-03 — 修正\n\n- 修 X（#4）\n\n" + V110 + V100);
      const r = checkChangelogFrozen({ master: masterWithHotfix, head: MASTER });
      expect(r.errors).toEqual([]);
      expect(r.missing).toEqual(["1.1.1"]);
    });
  });
});
