import { afterEach, describe, expect, it, vi } from "vitest";

const fetchOwnerJson = vi.fn();
vi.mock("../../lib/ownerData", () => ({ fetchOwnerJson: (...args: unknown[]) => fetchOwnerJson(...args) }));
vi.mock("../ownerDataAssets", () => ({
  OWNER_DATA_ASSETS: { "address-owner-63000": { filename: "address-owner-63000.json", size: 10, sha256: "x".repeat(64) } },
}));

import {
  addressIndexBase, clearOwnerAddressCache, DEFAULT_ADDRESS_INDEX_BASE, loadAddressManifest, loadOwnerAddressCounty,
  ownerAddressAsset, resetAddressIndexCache,
} from "../addressIndexLoader";

afterEach(() => {
  fetchOwnerJson.mockReset();
  resetAddressIndexCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("公開分片 base", () => {
  it("未設定時用正式 CDN 路徑，設定時去掉尾端斜線", () => {
    vi.stubEnv("VITE_ADDRESS_INDEX_BASE", "");
    expect(addressIndexBase()).toBe(DEFAULT_ADDRESS_INDEX_BASE);
    vi.stubEnv("VITE_ADDRESS_INDEX_BASE", "http://127.0.0.1:3797/");
    expect(addressIndexBase()).toBe("http://127.0.0.1:3797");
  });

  it("manifest 載入失敗會丟錯（呼叫端顯示錯誤，不當成查無），下次重試", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadAddressManifest("x")).rejects.toThrow(/404/);
    await expect(loadAddressManifest("x")).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("站主版", () => {
  it("只認白名單裡有的縣市", () => {
    expect(ownerAddressAsset("63000")).toBe("address-owner-63000");
    expect(ownerAddressAsset("99999")).toBeNull();
  });

  it("非站主（401／403）回 null，不算錯誤", async () => {
    fetchOwnerJson.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 401 }));
    await expect(loadOwnerAddressCounty("63000", "x")).resolves.toBeNull();
  });

  it("讀到後依區建分片；撤權時進行中的請求回來也丟掉", async () => {
    let resolve!: (v: unknown) => void;
    fetchOwnerJson.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const pending = loadOwnerAddressCounty("63000", "x");
    clearOwnerAddressCache();
    resolve({ v: 1, county: "63000", towns: { 中正區: { 重慶南路一段: [["9號", 1, 2, "t"]] } } });
    await expect(pending).resolves.toBeNull();

    fetchOwnerJson.mockResolvedValueOnce({ v: 1, county: "63000", towns: { 中正區: { 重慶南路一段: [["9號", 1, 2, "t"]] } } });
    const towns = await loadOwnerAddressCounty("63000", "x");
    expect(towns?.get("中正區")?.get("重慶南路1段")?.rows.get("9號")).toEqual(["9號", 1, 2, "t"]);
  });
});
