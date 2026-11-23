import { afterEach, describe, expect, it, vi } from "vitest";

const readOwnerJson = vi.fn();
vi.mock("../../lib/ownerData", () => ({ readOwnerJson: (...args: unknown[]) => readOwnerJson(...args) }));
vi.mock("../ownerDataAssets", () => ({
  OWNER_DATA_ASSETS: { "address-owner-63000": { filename: "address_owner_63000.json", size: 10, sha256: "x".repeat(64) } },
}));

import { addressIndexBase, loadAddressManifest, resetAddressIndexCache } from "../addressIndexLoader";
import { loadingRegistry } from "../../lib/loadingRegistry";
import { clearOwnerAddressCache, loadOwnerAddressCounty, ownerAddressAsset } from "../addressOwnerLoader";

afterEach(() => {
  readOwnerJson.mockReset();
  resetAddressIndexCache();
  clearOwnerAddressCache();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("公開分片 base", () => {
  it("和其他 lock 資產一樣走 BASE_URL 相對路徑（本機 public/、正式 Worker→R2）", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(addressIndexBase()).toBe("/address-index/v1");
    vi.stubEnv("BASE_URL", "/sub/");
    expect(addressIndexBase()).toBe("/sub/address-index/v1");
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
    readOwnerJson.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 401 }));
    await expect(loadOwnerAddressCounty("63000", "x")).resolves.toBeNull();
  });

  it("站主版讀不到（例如還沒上傳的 404、網路錯）安靜回 null，不記為載入失敗，下次再試", async () => {
    const events: string[] = [];
    const off = loadingRegistry.subscribeEvents((e) => { events.push(e.type); });
    readOwnerJson.mockRejectedValueOnce(Object.assign(new Error("not found"), { status: 404 }));
    await expect(loadOwnerAddressCounty("63000", "x")).resolves.toBeNull();
    readOwnerJson.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(loadOwnerAddressCounty("63000", "x")).resolves.toBeNull();
    expect(readOwnerJson).toHaveBeenCalledTimes(2);
    off();
    expect(events).toContain("end");
    expect(events).not.toContain("fail");
  });

  it("讀到後依區建分片；撤權時進行中的請求回來也丟掉", async () => {
    let resolve!: (v: unknown) => void;
    readOwnerJson.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const pending = loadOwnerAddressCounty("63000", "x");
    clearOwnerAddressCache();
    resolve({ v: 1, county: "63000", towns: { 中正區: { 重慶南路一段: [["9號", 1, 2, "t"]] } } });
    await expect(pending).resolves.toBeNull();

    readOwnerJson.mockResolvedValueOnce({ v: 1, county: "63000", towns: { 中正區: { 重慶南路一段: [["9號", 1, 2, "t"]] } } });
    const towns = await loadOwnerAddressCounty("63000", "x");
    expect(towns?.get("中正區")?.get("重慶南路1段")?.rows.get("9號")).toEqual(["9號", 1, 2, "t"]);
  });
});
