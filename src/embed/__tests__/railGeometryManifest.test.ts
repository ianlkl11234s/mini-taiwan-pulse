/**
 * 鐵路幾何 bundle 的**指標檔解析 + 降級路徑**（EM-16 內容雜湊檔名）。
 *
 * 為什麼值得測：這條路徑失敗時的正確行為是「靜默略過該層」——
 * 也就是**畫面上什麼都不會說**。manifest 解析寫錯只會讓鐵路悄悄不見，
 * 截圖與 console 都看不出來，只能靠測試守。
 *
 * 三件事：
 *   1. 檔名驗證（manifest 是外部檔案，不驗就等於讓它決定要打哪個 URL）
 *   2. 降級要涵蓋 **manifest 失敗**與 **bundle 失敗**兩種（後者是部署競態，見 railReplayData 註解）
 *   3. 全程不 throw
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseRailManifest,
  fetchRailGeometry,
  RAIL_MANIFEST_URL,
  RAIL_GEOMETRY_LEGACY_URL,
} from "../railReplayData";

const HASHED = "rail_slim.4e0dc14093.json.gz";
const HASHED_URL = `/embed-rail/${HASHED}`;

describe("parseRailManifest", () => {
  it("正常 manifest → 組出雜湊檔名的完整路徑", () => {
    expect(parseRailManifest({ bundle: HASHED, hash: "4e0dc14093" })).toBe(HASHED_URL);
  });

  it("接受 8~10 hex 兩端的長度", () => {
    expect(parseRailManifest({ bundle: "rail_slim.abcdef01.json.gz" })).toBe(
      "/embed-rail/rail_slim.abcdef01.json.gz",
    );
    expect(parseRailManifest({ bundle: "rail_slim.0123456789.json.gz" })).toBe(
      "/embed-rail/rail_slim.0123456789.json.gz",
    );
  });

  it.each([
    ["缺 bundle 欄位", { hash: "4e0dc14093" }],
    ["bundle 不是字串", { bundle: 42 }],
    ["null（fetch 失敗時的回傳）", null],
    ["undefined", undefined],
    ["整份是陣列", []],
    ["path traversal", { bundle: "../../../etc/passwd" }],
    ["絕對網址（跨網域）", { bundle: "https://evil.example/x.json.gz" }],
    ["帶目錄的相對路徑", { bundle: "sub/rail_slim.4e0dc14093.json.gz" }],
    ["hash 不是 hex", { bundle: "rail_slim.zzzzzzzzzz.json.gz" }],
    ["hash 太短", { bundle: "rail_slim.4e0dc1.json.gz" }],
    ["hash 太長", { bundle: "rail_slim.4e0dc140931234.json.gz" }],
    ["舊的固定檔名（沒有 hash 段）", { bundle: "rail_slim.json.gz" }],
  ])("壞掉的 manifest 一律回 null：%s", (_label, input) => {
    expect(parseRailManifest(input)).toBeNull();
  });
});

// ── fetchRailGeometry 的降級 ───────────────────────────────────────────────

const BUNDLE_BODY = { systems: { tra: { tracks: {}, stationProgress: {} } } };
const LEGACY_BODY = { systems: { thsr: { tracks: {}, stationProgress: {} } } };

/** fetchMaybeGzipJson 只用到 `ok` 與 `arrayBuffer()`；非 gzip（無 magic byte）走純文字分支。 */
function jsonRes(obj: unknown) {
  return {
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(obj)).buffer,
  };
}
const notFound = { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };

/** routes 沒列到的 URL 一律當 404。 */
function stubFetch(routes: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (url: string) => routes[url] ?? notFound);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchRailGeometry", () => {
  it("正常路徑：manifest → 雜湊檔名，且完全不碰舊的固定檔名", async () => {
    const fetchMock = stubFetch({
      [RAIL_MANIFEST_URL]: jsonRes({ bundle: HASHED }),
      [HASHED_URL]: jsonRes(BUNDLE_BODY),
    });

    expect(await fetchRailGeometry()).toEqual(BUNDLE_BODY);
    const called = fetchMock.mock.calls.map((c) => c[0]);
    expect(called).toEqual([RAIL_MANIFEST_URL, HASHED_URL]);
    expect(called).not.toContain(RAIL_GEOMETRY_LEGACY_URL);
  });

  it("manifest 404（尚未部署過的環境）→ 退回固定檔名", async () => {
    const fetchMock = stubFetch({ [RAIL_GEOMETRY_LEGACY_URL]: jsonRes(LEGACY_BODY) });
    expect(await fetchRailGeometry()).toEqual(LEGACY_BODY);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      RAIL_MANIFEST_URL,
      RAIL_GEOMETRY_LEGACY_URL,
    ]);
  });

  it("manifest 格式壞掉 → 退回固定檔名（不去打亂七八糟的 URL）", async () => {
    const fetchMock = stubFetch({
      [RAIL_MANIFEST_URL]: jsonRes({ bundle: "../../evil.json.gz" }),
      [RAIL_GEOMETRY_LEGACY_URL]: jsonRes(LEGACY_BODY),
    });
    expect(await fetchRailGeometry()).toEqual(LEGACY_BODY);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      RAIL_MANIFEST_URL,
      RAIL_GEOMETRY_LEGACY_URL,
    ]);
  });

  it("manifest 是壞 JSON → 退回固定檔名", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === RAIL_MANIFEST_URL
          ? { ok: true, arrayBuffer: async () => new TextEncoder().encode("{ not json").buffer }
          : url === RAIL_GEOMETRY_LEGACY_URL
            ? jsonRes(LEGACY_BODY)
            : notFound,
      ),
    );
    expect(await fetchRailGeometry()).toEqual(LEGACY_BODY);
  });

  it("manifest 有、雜湊 bundle 還沒到（部署競態）→ 退回固定檔名", async () => {
    const fetchMock = stubFetch({
      [RAIL_MANIFEST_URL]: jsonRes({ bundle: HASHED }),
      [RAIL_GEOMETRY_LEGACY_URL]: jsonRes(LEGACY_BODY),
    });
    expect(await fetchRailGeometry()).toEqual(LEGACY_BODY);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      RAIL_MANIFEST_URL,
      HASHED_URL,
      RAIL_GEOMETRY_LEGACY_URL,
    ]);
  });

  it("bundle 抓到但沒有 systems（壞檔）→ 也算失敗，退回固定檔名", async () => {
    stubFetch({
      [RAIL_MANIFEST_URL]: jsonRes({ bundle: HASHED }),
      [HASHED_URL]: jsonRes({ metadata: {} }),
      [RAIL_GEOMETRY_LEGACY_URL]: jsonRes(LEGACY_BODY),
    });
    expect(await fetchRailGeometry()).toEqual(LEGACY_BODY);
  });

  it("兩條路都失敗 → null（呼叫端靜默略過該層），不 throw", async () => {
    stubFetch({});
    await expect(fetchRailGeometry()).resolves.toBeNull();
  });

  it("網路整個炸掉（fetch reject）→ null，不 throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(fetchRailGeometry()).resolves.toBeNull();
  });
});
