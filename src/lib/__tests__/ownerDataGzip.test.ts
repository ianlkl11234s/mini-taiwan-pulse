import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

// gzipSync 不寫時間戳，同一輸入輸出固定：mock 與測試各算一次，大小一致
const PAYLOAD = JSON.stringify({ hello: "gb", n: [1, 2, 3] });
vi.mock("../supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } } }));
vi.mock("../../data/ownerDataAssets", async () => {
  const { gzipSync: gz } = await import("node:zlib");
  const size = gz(Buffer.from(JSON.stringify({ hello: "gb", n: [1, 2, 3] }))).length;
  return {
    OWNER_DATA_ENDPOINT: "/api/private-research/owner-data",
    OWNER_DATA_MAX_RANGE_BYTES: 8 * 1024 * 1024,
    OWNER_DATA_ASSETS: { "test-gz": { filename: "test.json.gz", size, sha256: "x".repeat(64) } },
  };
});

import { readOwnerJson } from "../ownerData";

describe("owner-data gzip JSON（檔名 .gz）", () => {
  it("Range 讀回原始位元組後解壓再解析", async () => {
    const body = gzipSync(Buffer.from(PAYLOAD));
    const fetchFn = vi.fn(async () => new Response(new Uint8Array(body), { status: 206 }));
    const data = await readOwnerJson<{ hello: string; n: number[] }>("test-gz" as never, { fetchFn, token: async () => "tok" });
    expect(data).toEqual({ hello: "gb", n: [1, 2, 3] });
    expect(fetchFn).toHaveBeenCalledWith("/api/private-research/owner-data/test-gz", expect.objectContaining({ headers: { Authorization: "Bearer tok", Range: `bytes=0-${body.length - 1}` } }));
  });
});
