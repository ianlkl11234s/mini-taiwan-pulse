// 本機 `npm run check` 與 CI 必須跑同一組檢查：package.json 的 check 串的 check:* ＝ ci.yml 呼叫的 check:*。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const names = (s: string) => [...s.matchAll(/npm run (check:[a-z0-9-]+)/g)].map((m) => m[1]!);

describe("npm run check ⇔ CI", () => {
  it("check 依序串的 check:* 與 ci.yml 的 step 相同（同順序）", () => {
    const local = names(pkg.scripts.check ?? "");
    expect(local.length).toBeGreaterThan(0);
    expect(names(ci)).toEqual(local);
  });

  it("每個 check:* 都有定義", () => {
    for (const n of names(pkg.scripts.check ?? "")) expect(pkg.scripts[n], n).toBeTruthy();
  });
});
