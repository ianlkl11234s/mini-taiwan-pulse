/** check-assets 的 R2／S3 取檔決策（scripts/deploy/asset-source.mjs，CI-10 方案 A）；注入假的取檔函式，不碰網路與 git。 */
import { describe, expect, it, vi } from "vitest";
import { memoBaseLock, resolveAsset, type AssetEntry, type FetchResult } from "../../scripts/deploy/asset-source.mjs";

const entry: AssetEntry = { path: "public/x/new_v2.pmtiles", sha256: "a".repeat(64), bytes: 100, s3_key: "deploy-assets/x/new_v2.pmtiles" };
const good: FetchResult = { status: 200, sha256: entry.sha256, bytes: entry.bytes };
const bad: FetchResult = { status: 200, sha256: "b".repeat(64), bytes: 99 };
const notFound: FetchResult = { status: 404 };

function deps(over: Partial<Parameters<typeof resolveAsset>[1]> = {}) {
  return {
    fetchR2: vi.fn(async () => notFound),
    inBaseLock: vi.fn(async () => false),
    s3Configured: true,
    fetchS3: vi.fn(async () => good),
    ...over,
  };
}

describe("resolveAsset", () => {
  it("R2 有且 sha256 相符 → 用 R2，不查 master、不碰 S3", async () => {
    const d = deps({ fetchR2: vi.fn(async () => good) });
    expect(await resolveAsset(entry, d)).toEqual({ ok: true, source: "r2" });
    expect(d.inBaseLock).not.toHaveBeenCalled();
    expect(d.fetchS3).not.toHaveBeenCalled();
  });

  it("R2 404＋master lock 沒有＋S3 sha256 相符 → 用 S3", async () => {
    const d = deps();
    expect(await resolveAsset(entry, d)).toEqual({ ok: true, source: "s3" });
    expect(d.inBaseLock).toHaveBeenCalledWith(entry.path);
  });

  it("R2 404＋master lock 沒有＋S3 sha256 不符 → 紅", async () => {
    const r = await resolveAsset(entry, deps({ fetchS3: vi.fn(async () => bad) }));
    expect(r).toMatchObject({ ok: false, source: "s3" });
    expect(!r.ok && r.reason).toContain("S3 版本與 lock 不符");
  });

  it("R2 404＋master lock 已有 → 紅（真的壞了），不改走 S3", async () => {
    const d = deps({ inBaseLock: vi.fn(async () => true) });
    const r = await resolveAsset(entry, d);
    expect(r).toMatchObject({ ok: false, source: "r2" });
    expect(!r.ok && r.reason).toContain("真的壞了");
    expect(d.fetchS3).not.toHaveBeenCalled();
  });

  it("沒有 S3 金鑰（fork PR／未設 secret）→ 紅並說明，不靜默通過", async () => {
    const d = deps({ s3Configured: false });
    const r = await resolveAsset(entry, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("沒有 S3 唯讀金鑰");
    expect(d.fetchS3).not.toHaveBeenCalled();
  });

  it("讀不到 master lock → 紅，不當成新檔", async () => {
    const d = deps({ inBaseLock: vi.fn(async () => { throw new Error("unknown revision"); }) });
    const r = await resolveAsset(entry, d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain("讀不到 origin/master 的 lock");
    expect(d.fetchS3).not.toHaveBeenCalled();
  });

  it("R2 非 404 錯誤（403、5xx）→ 照舊紅，不改走 S3", async () => {
    for (const status of [403, 500]) {
      const d = deps({ fetchR2: vi.fn(async () => ({ status })) });
      expect(await resolveAsset(entry, d)).toEqual({ ok: false, source: "r2", reason: `R2 HTTP ${status}` });
      expect(d.fetchS3).not.toHaveBeenCalled();
    }
  });

  it("R2 200 但內容不符 → 紅，不改走 S3", async () => {
    const d = deps({ fetchR2: vi.fn(async () => bad) });
    expect(await resolveAsset(entry, d)).toMatchObject({ ok: false, source: "r2" });
    expect(d.fetchS3).not.toHaveBeenCalled();
  });

  it("S3 也沒有（404／403）→ 紅，提示先上傳 S3", async () => {
    for (const status of [404, 403]) {
      const r = await resolveAsset(entry, deps({ fetchS3: vi.fn(async () => ({ status })) }));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.reason).toContain("先用 upload-deploy-assets.sh 上傳 S3");
    }
  });
});

describe("memoBaseLock", () => {
  it("只讀一次基準 lock", async () => {
    const read = vi.fn(() => ["public/a.json"]);
    const has = memoBaseLock(read);
    expect(await Promise.all([has("public/a.json"), has("public/b.json")])).toEqual([true, false]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("讀失敗時丟錯", async () => {
    const has = memoBaseLock(() => { throw new Error("no master"); });
    await expect(has("public/a.json")).rejects.toThrow("no master");
  });
});
