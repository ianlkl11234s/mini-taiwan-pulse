import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  fetchSimBundle, loadSimBundle, loadSimFile, resetSimBundleCacheForTests, simBundleFileUrl, simBundleRoot, simBundleStatus,
} from "../simBundle";
import { DEFAULT_SIM_BUNDLE_ROOT, SimBundleError } from "../simBundleTypes";

const ROOT = "https://data.example.test/sim/v1/";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const enc = (text: string) => new TextEncoder().encode(text);

function bundleJson(extra: Record<string, unknown> = {}) {
  return JSON.stringify({ schema: "pulse-sim-bundle-v1", slug: "transit_reach", bundle_version: "v1", ...extra });
}

function stub(files: Record<string, string | Uint8Array>) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!(url in files)) return new Response("missing", { status: 404 });
    const body = files[url]!;
    return new Response(typeof body === "string" ? enc(body) : body, { status: 200 });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => resetSimBundleCacheForTests());
afterEach(() => vi.unstubAllGlobals());

describe("simBundleRoot", () => {
  it("正式站一律用預設根目錄；VITE_SIM_BUNDLE_BASE 只在 DEV 生效", () => {
    expect(simBundleRoot({ DEV: false, VITE_SIM_BUNDLE_BASE: "http://localhost:8793/sim/v1" })).toBe(DEFAULT_SIM_BUNDLE_ROOT);
    expect(simBundleRoot({ DEV: true, VITE_SIM_BUNDLE_BASE: "http://localhost:8793/sim/v1" })).toBe("http://localhost:8793/sim/v1/");
    expect(simBundleRoot({ DEV: true })).toBe(DEFAULT_SIM_BUNDLE_ROOT);
  });
});

describe("simBundleFileUrl：拒絕跳出版本根目錄", () => {
  const base = `${ROOT}transit_reach/v1/`;
  it("一般相對路徑", () => {
    expect(simBundleFileUrl(base, "od/free/all/tra_1000.u16")).toBe(`${base}od/free/all/tra_1000.u16`);
  });
  it.each(["/etc/passwd", "../v0/bundle.json", "od/../../x", "a\\b", "https://evil.test/x", "//evil.test/x", "./x", ""])("拒絕 %s", (path) => {
    expect(() => simBundleFileUrl(base, path)).toThrow(SimBundleError);
  });
});

describe("fetchSimBundle", () => {
  it("current.json → bundle.json，驗 bundle_sha256", async () => {
    const body = bundleJson();
    stub({
      [`${ROOT}transit_reach/current.json`]: JSON.stringify({ bundle_version: "v1", bundle_sha256: sha(body) }),
      [`${ROOT}transit_reach/v1/bundle.json`]: body,
    });
    const b = await fetchSimBundle("transit_reach", ROOT);
    expect(b.base).toBe(`${ROOT}transit_reach/v1/`);
    expect(b.version).toBe("v1");
  });

  it("sha 不符 → sha_mismatch", async () => {
    stub({
      [`${ROOT}transit_reach/current.json`]: JSON.stringify({ bundle_version: "v1", bundle_sha256: sha("other") }),
      [`${ROOT}transit_reach/v1/bundle.json`]: bundleJson(),
    });
    await expect(fetchSimBundle("transit_reach", ROOT)).rejects.toMatchObject({ code: "sha_mismatch" });
  });

  it("404 → not_found；版本字串帶 .. → schema", async () => {
    stub({});
    await expect(fetchSimBundle("transit_reach", ROOT)).rejects.toMatchObject({ code: "not_found" });
    stub({ [`${ROOT}transit_reach/current.json`]: JSON.stringify({ bundle_version: "../x" }) });
    await expect(fetchSimBundle("transit_reach", ROOT)).rejects.toMatchObject({ code: "schema" });
  });

  it("files[] 有越界路徑 → 整份拒收", async () => {
    const body = bundleJson({ files: [{ name: "../secret.json", bytes: 1, sha256: sha("x") }] });
    stub({
      [`${ROOT}transit_reach/current.json`]: JSON.stringify({ bundle_version: "v1" }),
      [`${ROOT}transit_reach/v1/bundle.json`]: body,
    });
    await expect(fetchSimBundle("transit_reach", ROOT)).rejects.toMatchObject({ code: "path" });
  });
});

describe("loadSimFile：依清單驗 sha，錯誤寫進狀態", () => {
  const base = `${ROOT}transit_reach/v1/`;
  const od = new Uint8Array([1, 2, 3, 4]);
  const odSha = createHash("sha256").update(od).digest("hex");
  const odList = JSON.stringify([{ name: "od/free/all/a.u16", bytes: 4, sha256: odSha }]);
  const manifest = { files: [{ name: "cells.json", bytes: 2, sha256: sha("{}") }], files_od: { file: "files_od.json", sha256: sha(odList) } };

  function bundleObj() {
    return { slug: "transit_reach", version: "v1", base, manifest: { schema: "pulse-sim-bundle-v1", slug: "transit_reach", bundle_version: "v1", ...manifest } };
  }

  it("files[] 與 files_od 清單都驗過才回傳", async () => {
    stub({ [`${base}cells.json`]: "{}", [`${base}files_od.json`]: odList, [`${base}od/free/all/a.u16`]: od });
    expect(new TextDecoder().decode(await loadSimFile(bundleObj(), "cells.json", "t"))).toBe("{}");
    expect(new Uint8Array(await loadSimFile(bundleObj(), "od/free/all/a.u16", "t"))).toEqual(od);
  });

  it("不在清單 → not_listed；內容被換 → sha_mismatch；狀態變 error", async () => {
    stub({ [`${base}files_od.json`]: odList, [`${base}od/free/all/a.u16`]: new Uint8Array([9, 9, 9, 9]), [`${base}x.json`]: "{}" });
    await expect(loadSimFile(bundleObj(), "x.json", "t")).rejects.toMatchObject({ code: "not_listed" });
    await expect(loadSimFile(bundleObj(), "od/free/all/a.u16", "t")).rejects.toMatchObject({ code: "sha_mismatch" });
    expect(simBundleStatus("transit_reach")).toMatchObject({ status: "error", code: "sha_mismatch" });
  });

  it("loadSimBundle 失敗會記錄 error 狀態並允許重試", async () => {
    stub({});
    await expect(loadSimBundle("transit_reach", "t")).rejects.toBeInstanceOf(SimBundleError);
    expect(simBundleStatus("transit_reach").status).toBe("error");
  });
});
