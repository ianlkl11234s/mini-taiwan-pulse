/**
 * scripts/dev/merge-develop.mjs 的測試：純函式用字串 fixture；流程用暫存 git repo 造衝突（重產指令換成假的 node -e，幾秒內跑完）。
 * 暫存 repo 隔離使用者的全域 git 設定（GIT_CONFIG_GLOBAL=/dev/null），CI runner 沒有 git 身分也能跑。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classify, CHANGELOG, GOLDEN, INVENTORY, mergeChangelog, mergeJsonObject, runMergeDevelop,
} from "../../scripts/dev/merge-develop.mjs";

const log = (head: string) => `# Changelog

## 版本總覽

| 版號 | 日期 | 重點 |
|---|---|---|
| v1.0.0 | 2026-11-01 | A |

## [Unreleased]

> 說明

${head}
## v1.0.0 — 2026-11-01 — A

### 新增

- 功能 A（#1）
`;

describe("classify", () => {
  it("白名單", () => {
    expect(classify(`${GOLDEN}/tw-交通.json`)).toBe("golden");
    expect(classify(`${GOLDEN}/_order.json`)).toBe("golden");
    expect(classify(INVENTORY)).toBe("inventory");
    expect(classify(CHANGELOG)).toBe("changelog");
    expect(classify("src/data/__tests__/layerGoldenSnapshot.test.ts")).toBeNull();
    expect(classify("src/i18n/locales/en/layers.json")).toBe("locale");
    expect(classify("src/i18n/locales/ja/params.json")).toBe("locale");
    expect(classify("src/i18n/keys.generated.ts")).toBeNull();
    expect(classify("src/data/layerManifest.ts")).toBeNull();
  });
});

describe("mergeChangelog", () => {
  const base = log("### 新增\n\n- 既有 X（#2）\n");

  it("兩邊都在同一小節加條目 → develop 在前、本分支接在尾端，不重複小節", () => {
    const theirs = log("### 新增\n\n- 既有 X（#2）\n\n- develop 的 D（#4）\n\n### 修正\n\n- develop 修 F（#5）\n");
    const ours = log("### 新增\n\n- 既有 X（#2）\n\n- 本分支 O（#6）\n\n### 修正\n\n- 本分支修 G（#6）\n");
    const r = mergeChangelog({ base, ours, theirs });
    expect(r.ok).toBe(true);
    const text = (r as { text: string }).text;
    expect(text).toBe(log("### 新增\n\n- 既有 X（#2）\n\n- develop 的 D（#4）\n\n- 本分支 O（#6）\n\n### 修正\n\n- develop 修 F（#5）\n- 本分支修 G（#6）\n"));
    expect(text.match(/### 新增/g)).toHaveLength(2); // Unreleased 一個＋v1.0.0 一個
  });

  it("develop 沒有的小節依 新增→修正→…→注意事項 的順序補上", () => {
    const theirs = log("### 新增\n\n- 既有 X（#2）\n\n### 注意事項\n\n- 注意 N（#7）\n");
    const ours = log("### 新增\n\n- 既有 X（#2）\n\n### 修正\n\n- 本分支修 G（#6）\n");
    const r = mergeChangelog({ base, ours, theirs });
    expect((r as { text: string }).text).toBe(log("### 新增\n\n- 既有 X（#2）\n\n### 修正\n\n- 本分支修 G（#6）\n\n### 注意事項\n\n- 注意 N（#7）\n"));
  });

  it("develop 期間發了版（Unreleased 被搬空）→ 本分支條目仍回到 Unreleased", () => {
    const theirs = log("").replace("## v1.0.0", "## v1.1.0 — 2026-11-02 — B\n\n### 新增\n\n- 既有 X（#2）\n\n## v1.0.0");
    const ours = log("### 新增\n\n- 既有 X（#2）\n- 本分支 O（#6）\n");
    const r = mergeChangelog({ base, ours, theirs });
    expect(r.ok).toBe(true);
    const text = (r as { text: string }).text;
    const unreleased = text.slice(text.indexOf("## [Unreleased]"), text.indexOf("## v1.1.0"));
    expect(unreleased).toContain("### 新增\n\n- 本分支 O（#6）");
    expect(unreleased).not.toContain("既有 X");
  });

  it("本分支改到已發布段落 → 停", () => {
    const ours = log("### 新增\n\n- 既有 X（#2）\n").replace("- 功能 A（#1）", "- 功能 A（#1）\n- 誤寫（#6）");
    const r = mergeChangelog({ base, ours, theirs: log("### 新增\n\n- 既有 X（#2）\n- D（#4）\n") });
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("Unreleased 以外");
  });
});

describe("mergeJsonObject", () => {
  const j = (o: Record<string, string>) => `${JSON.stringify(o, null, 2)}\n`;
  const base = j({ a: "A" });

  it("檔尾兩邊各加鍵 → 都留、develop 在前", () => {
    const r = mergeJsonObject({ base, ours: j({ a: "A", o: "O" }), theirs: j({ a: "A", t: "T" }) });
    expect(r).toEqual({ ok: true, text: j({ a: "A", t: "T", o: "O" }) });
  });

  it("同一個鍵兩邊值不同 → 停", () => {
    const r = mergeJsonObject({ base, ours: j({ a: "A", k: "1" }), theirs: j({ a: "A", k: "2" }) });
    expect(r.ok).toBe(false);
  });

  it("原檔有重複鍵（JSON.parse 會吃掉）→ 停", () => {
    const dup = '{\n  "a": "A",\n  "a": "B"\n}\n';
    const r = mergeJsonObject({ base, ours: dup, theirs: j({ a: "A" }) });
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("重複鍵");
  });
});

// ── 暫存 git repo ─────────────────────────────────────────────────

const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
};
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "merge-develop-"));
  dirs.push(dir);
  const git = (...args: string[]) => execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: dir, env: ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const write = (files: Record<string, string>) => {
    for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
  };
  const read = (p: string) => readFileSync(join(dir, p), "utf8");
  git("init", "-q", "-b", "develop");
  return { dir, git, write, read };
}

// golden 是目錄：G_A 兩邊都改（衝突）；G_GONE 本分支改、develop 刪（modify/delete 衝突）；G_B 只有本分支改（乾淨合併）
const G_A = `${GOLDEN}/tw-a.json`;
const G_GONE = `${GOLDEN}/tw-gone.json`;
const G_B = `${GOLDEN}/tw-b.json`;
const golden = (n: number, tag: string) => `${JSON.stringify({ count: n, tag }, null, 2)}\n`;
const j = (o: Record<string, string>) => `${JSON.stringify(o, null, 2)}\n`;
// 假的重產：golden 寫 count=99；inventory 寫固定內容
const REGEN = {
  golden: ["node", ["-e", `require("fs").writeFileSync(${JSON.stringify(G_A)}, JSON.stringify({ count: 99, tag: "regen" }, null, 2) + "\\n")`]] as [string, string[]],
  inventory: ["node", ["-e", `require("fs").writeFileSync(${JSON.stringify(INVENTORY)}, "regen\\n")`]] as [string, string[]],
};

/** base → develop 與 feature 各自改共用檔，造出所有白名單衝突；extra 可再加白名單外的衝突。 */
function conflictedRepo(extra = false) {
  const r = repo();
  r.write({
    [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n"),
    [G_A]: golden(10, "base"), [G_GONE]: golden(1, "base"), [G_B]: golden(2, "base"), [INVENTORY]: "base\n",
    "src/i18n/locales/en/layers.json": j({ a: "A" }), "src/other.ts": "export const x = 0;\n",
  });
  r.git("add", "-A"); r.git("commit", "-qm", "base");
  r.git("switch", "-qc", "feat");
  r.write({
    [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n- 本分支 O（#6）\n"),
    [G_A]: golden(11, "feat"), [G_GONE]: golden(1, "feat"), [G_B]: golden(3, "feat"), [INVENTORY]: "feat\n",
    "src/i18n/locales/en/layers.json": j({ a: "A", o: "O" }),
    ...(extra ? { "src/other.ts": "export const x = 1;\n" } : {}),
  });
  r.git("commit", "-qam", "feat");
  r.git("switch", "-q", "develop");
  r.write({
    [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n- develop D（#4）\n"),
    [G_A]: golden(12, "dev"), [INVENTORY]: "dev\n",
    "src/i18n/locales/en/layers.json": j({ a: "A", t: "T" }),
    ...(extra ? { "src/other.ts": "export const x = 2;\n" } : {}),
  });
  r.git("rm", "-q", "--", G_GONE);
  r.git("commit", "-qam", "dev");
  r.git("switch", "-q", "feat");
  return r;
}

const run = (dir: string, dryRun = false) => {
  const out: string[] = [];
  const res = runMergeDevelop({ cwd: dir, remote: "", branch: "develop", fetch: false, dryRun, regen: REGEN, env: ENV, log: (s) => out.push(s) });
  return { ...res, out: out.join("\n") };
};

describe("runMergeDevelop（暫存 repo）", () => {
  it("沒有衝突 → 直接建立 merge commit", () => {
    const r = repo();
    r.write({ "a.txt": "a\n" }); r.git("add", "-A"); r.git("commit", "-qm", "base");
    r.git("switch", "-qc", "feat"); r.write({ "b.txt": "b\n" }); r.git("add", "-A"); r.git("commit", "-qm", "feat");
    r.git("switch", "-q", "develop"); r.write({ "c.txt": "c\n" }); r.git("add", "-A"); r.git("commit", "-qm", "dev");
    r.git("switch", "-q", "feat");
    expect(run(r.dir).code).toBe(0);
    expect(r.git("rev-list", "--parents", "-1", "HEAD").trim().split(" ")).toHaveLength(3);
    expect(existsSync(join(r.dir, ".git/MERGE_HEAD"))).toBe(false);
  });

  it("只有白名單衝突 → 全部解完、git add，但不 commit", () => {
    const r = conflictedRepo();
    const res = run(r.dir);
    expect(res.code, res.out).toBe(0);
    expect(existsSync(join(r.dir, ".git/MERGE_HEAD"))).toBe(true);
    expect(r.git("diff", "--name-only", "--diff-filter=U").trim()).toBe("");
    expect(r.read(CHANGELOG)).toContain("- 既有 X（#2）\n- develop D（#4）\n- 本分支 O（#6）\n");
    expect(JSON.parse(r.read("src/i18n/locales/en/layers.json"))).toEqual({ a: "A", t: "T", o: "O" });
    expect(Object.keys(JSON.parse(r.read("src/i18n/locales/en/layers.json")))).toEqual(["a", "t", "o"]);
    expect(r.read(G_A)).toContain('"regen"');
    expect(existsSync(join(r.dir, G_GONE)), "develop 已刪的 group 檔要移除").toBe(false);
    expect(r.read(G_B)).toBe(golden(3, "feat"));
    expect(r.read(INVENTORY)).toBe("regen\n");
    expect(res.out).toContain("請檢查後 git commit");
  });

  it("有白名單外的衝突 → 那個檔不碰、不重產、exit 1；手動解完再跑一次接著做", () => {
    const r = conflictedRepo(true);
    const first = run(r.dir);
    expect(first.code).toBe(1);
    expect(first.out).toContain("src/other.ts");
    expect(r.read("src/other.ts")).toContain("<<<<<<<");
    expect(r.git("diff", "--name-only", "--diff-filter=U").trim().split("\n").sort()).toEqual([INVENTORY, G_A, G_GONE, "src/other.ts"].sort());
    r.write({ "src/other.ts": "export const x = 3;\n" });
    r.git("add", "src/other.ts");
    const second = run(r.dir);
    expect(second.code, second.out).toBe(0);
    expect(r.git("diff", "--name-only", "--diff-filter=U").trim()).toBe("");
    expect(r.read(G_A)).toContain('"regen"');
  });

  it("CHANGELOG 衝突落在已發布段落 → 停、留給人處理", () => {
    const r = repo();
    r.write({ [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n") }); r.git("add", "-A"); r.git("commit", "-qm", "base");
    r.git("switch", "-qc", "feat");
    r.write({ [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n").replace("- 功能 A（#1）", "- 功能 A（#1）\n- 誤寫（#6）") }); r.git("commit", "-qam", "feat");
    r.git("switch", "-q", "develop");
    r.write({ [CHANGELOG]: log("### 新增\n\n- 既有 X（#2）\n").replace("- 功能 A（#1）", "- 功能 A（#1）\n- 另一個（#4）") }); r.git("commit", "-qam", "dev");
    r.git("switch", "-q", "feat");
    const res = run(r.dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain("Unreleased 以外");
    expect(r.read(CHANGELOG)).toContain("<<<<<<<");
  });

  it("工作區有未提交改動 → 拒絕（exit 2，什麼都不動）", () => {
    const r = conflictedRepo();
    r.write({ "src/other.ts": "dirty\n" });
    expect(run(r.dir).code).toBe(2);
    expect(existsSync(join(r.dir, ".git/MERGE_HEAD"))).toBe(false);
    expect(r.read("src/other.ts")).toBe("dirty\n");
  });

  it("--dry-run 只列計畫，不合併", () => {
    const r = conflictedRepo(true);
    const head = r.git("rev-parse", "HEAD");
    const res = run(r.dir, true);
    expect(res.code).toBe(0);
    expect(res.out).toContain("src/other.ts：不在白名單");
    expect(res.out).toContain(`${G_A}：取 develop 版`);
    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(r.dir, ".git/MERGE_HEAD"))).toBe(false);
  });
});
