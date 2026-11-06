import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf-8");

describe("docs 新鮮度", () => {
  it("docs/PROJECTS.md 的「最後盤點」不早於最新版發布日", () => {
    const latest = read("CHANGELOG.md").match(/^## v(\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})/m);
    expect(latest, "CHANGELOG.md 找不到版本標題（## vX.Y.Z — YYYY-MM-DD）").not.toBeNull();
    const audit = read("docs/PROJECTS.md").match(/最後盤點：(\d{4}-\d{2}-\d{2})/);
    expect(audit, "docs/PROJECTS.md 找不到「最後盤點：YYYY-MM-DD」").not.toBeNull();

    const [, version, releaseDate] = latest!;
    const auditDate = audit![1];
    expect(
      auditDate >= releaseDate,
      `最新版 v${version} 發布於 ${releaseDate}，但 docs/PROJECTS.md 的「最後盤點」仍是 ${auditDate}。` +
        "發版後請更新 docs/PROJECTS.md 的「最後盤點」與相關專案列（以及 .claude/memory/STATUS.md）。",
    ).toBe(true);
  });
});
