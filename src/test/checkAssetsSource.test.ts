/** check-assets 的 R2／S3 取檔決策（scripts/deploy/asset-source.mjs，CI-10 方案 A）；注入假的取檔函式，不碰網路與 git。 */
import { describe, expect, it, vi } from "vitest";
import { changedLockEntries, checkPresence, memoBaseLock, resolveAsset, type AssetEntry, type FetchResult, type HeadResult } from "../../scripts/deploy/asset-source.mjs";

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

// CI-11：lock 新增／變更的條目都要真的有檔（公開空間或 S3），只做 HEAD
describe("changedLockEntries", () => {
  const base = [
    { path: "public/a.pmtiles", sha256: "1".repeat(64), bytes: 10 },
    { path: "public/b.json", sha256: "2".repeat(64), bytes: 20 },
  ];
  it("只挑新增或內容變更的 r2 條目", () => {
    const cur = [
      { ...base[0]!, delivery: "r2" }, // 沒變
      { ...base[1]!, sha256: "3".repeat(64), delivery: "r2" }, // 同路徑改內容
      { path: "public/c.pmtiles", sha256: "4".repeat(64), bytes: 30, delivery: "r2" }, // 新增
      { path: "public/d.pmtiles", sha256: "5".repeat(64), bytes: 40, delivery: "s3" }, // 不是 r2
    ];
    expect(changedLockEntries(cur, base).map((e) => e.path)).toEqual(["public/b.json", "public/c.pmtiles"]);
  });
});

describe("checkPresence", () => {
  const sized = (bytes: number | null, status = 200): HeadResult => ({ status, bytes });
  const presence = (over: Partial<Parameters<typeof checkPresence>[1]> = {}) => ({
    headPublic: vi.fn(async () => ({ status: 404 }) as HeadResult),
    s3Configured: true,
    headS3: vi.fn(async () => ({ status: 404 }) as HeadResult),
    ...over,
  });

  it("公開空間有且大小相符 → 綠，不查 S3", async () => {
    const d = presence({ headPublic: vi.fn(async () => sized(entry.bytes)) });
    expect(await checkPresence(entry, d)).toEqual({ ok: true, source: "public" });
    expect(d.headS3).not.toHaveBeenCalled();
  });

  it("只有 S3、大小相符（還沒發版）→ 綠", async () => {
    const d = presence({ headS3: vi.fn(async () => sized(entry.bytes)) });
    expect(await checkPresence(entry, d)).toEqual({ ok: true, source: "s3" });
  });

  it("公開空間是舊版（同路徑改內容）、S3 是新版 → 綠", async () => {
    const d = presence({ headPublic: vi.fn(async () => sized(entry.bytes - 1)), headS3: vi.fn(async () => ({ status: 200, bytes: entry.bytes, sha256: entry.sha256 })) });
    expect(await checkPresence(entry, d)).toEqual({ ok: true, source: "s3" });
  });

  it("兩邊都沒有 → 紅，說明還沒上傳", async () => {
    const r = await checkPresence(entry, presence({ headS3: vi.fn(async () => ({ status: 403 }) as HeadResult) }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/公開空間沒有.*S3 .*也沒有.*還沒上傳/);
  });

  it("S3 大小不符或 sha256 metadata 不符 → 紅", async () => {
    const small = await checkPresence(entry, presence({ headS3: vi.fn(async () => sized(entry.bytes + 5)) }));
    expect(!small.ok && small.reason).toMatch(/大小不符/);
    const otherSha = await checkPresence(entry, presence({ headS3: vi.fn(async () => ({ status: 200, bytes: entry.bytes, sha256: "f".repeat(64) })) }));
    expect(!otherSha.ok && otherSha.reason).toMatch(/sha256 與 lock 不符/);
  });

  it("公開空間沒有、又沒有 S3 金鑰（fork PR）→ 紅，不靜默通過", async () => {
    const d = presence({ s3Configured: false });
    const r = await checkPresence(entry, d);
    expect(!r.ok && r.reason).toMatch(/沒有 S3 唯讀金鑰/);
    expect(d.headS3).not.toHaveBeenCalled();
  });

  it("公開空間有檔但沒回大小、也沒有 S3 金鑰 → 紅", async () => {
    const r = await checkPresence(entry, presence({ s3Configured: false, headPublic: vi.fn(async () => sized(null)) }));
    expect(!r.ok && r.reason).toMatch(/沒回大小/);
  });

  it("公開空間連線失敗、S3 有 → 綠；S3 也失敗 → 紅並帶錯誤", async () => {
    const down = vi.fn(async () => ({ status: 0, error: "逾時" }) as HeadResult);
    expect(await checkPresence(entry, presence({ headPublic: down, headS3: vi.fn(async () => sized(entry.bytes)) }))).toEqual({ ok: true, source: "s3" });
    const r = await checkPresence(entry, presence({ headPublic: down, headS3: down }));
    expect(!r.ok && r.reason).toMatch(/查 S3 .*失敗（逾時）/);
  });
});
