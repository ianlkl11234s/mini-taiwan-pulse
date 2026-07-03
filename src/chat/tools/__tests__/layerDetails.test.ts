import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MapBridge } from "../../types";
import { DATASET_WHITELIST } from "../datasets";
import { RPC_WHITELIST } from "../rpcTools";

// mock 掉 RPC 層（避免打網路），保留 RPC_WHITELIST 真值
vi.mock("../rpcTools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../rpcTools")>();
  return { ...actual, callWhitelistedRpc: vi.fn() };
});

import { collectLayerDetails } from "../catalogTools";
import { callWhitelistedRpc } from "../rpcTools";

const mockBridge = (visible: string[] = []): MapBridge => ({
  bulkSetVisibility: () => {},
  allOff: () => {},
  flyTo: () => {},
  jumpToPlace: () => true,
  highlightPoint: () => {},
  getVisibleLayerKeys: () => visible,
  getCurrentTimeISO: () => "2026-07-03T00:00:00Z",
  getCamera: () => ({ lng: 121, lat: 24, zoom: 7 }),
});

const mockedRpc = vi.mocked(callWhitelistedRpc);

beforeEach(() => {
  mockedRpc.mockReset();
  mockedRpc.mockResolvedValue({
    ok: true,
    result: [{ source_agency: "環境部", license: "CC BY 4.0" }],
  });
});

describe("catalogTools.collectLayerDetails", () => {
  it("aggregates label + theme + group + source for a known layer key", async () => {
    const r = await collectLayerDetails(["wfLandfill"], mockBridge(["wfLandfill"]));
    expect(r.requested).toBe(1);
    expect(r.truncatedKeys).toBe(false);
    const details = r.details as Array<{
      found: boolean;
      label: string;
      theme: string;
      group: string;
      visibleNow: boolean;
      source: unknown;
    }>;
    expect(details[0]!.found).toBe(true);
    expect(details[0]!.label).toContain("掩埋場");
    expect(details[0]!.theme).toContain("廢棄物");
    expect(details[0]!.group).toBe("處理設施");
    expect(details[0]!.visibleNow).toBe(true);
    expect(details[0]!.source).toBeTruthy();
    expect(mockedRpc).toHaveBeenCalledWith("get_data_catalog_for_layer", {
      p_layer_key: "wfLandfill",
    });
  });

  it("caps at 5 keys and flags truncation", async () => {
    const keys = [
      "wfLandfill",
      "wfIncinerator",
      "wfRecycling",
      "wfTransfer",
      "wfMedical",
      "wfMonitoring",
      "wfScrapYard",
    ];
    const r = await collectLayerDetails(keys, mockBridge());
    expect(r.requested).toBe(7);
    expect(r.truncatedKeys).toBe(true);
    expect(r.details as unknown[]).toHaveLength(5);
    expect(mockedRpc).toHaveBeenCalledTimes(5); // 只對前 5 個打 RPC
  });

  it("marks unknown keys as not found without calling the RPC", async () => {
    const r = await collectLayerDetails(["__nope__"], mockBridge());
    const details = r.details as Array<{ found: boolean; note?: string }>;
    expect(details[0]!.found).toBe(false);
    expect(details[0]!.note).toContain("__nope__");
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("degrades gracefully when the catalog RPC fails", async () => {
    mockedRpc.mockResolvedValue({ ok: false, error: "boom" });
    const r = await collectLayerDetails(["wfLandfill"], mockBridge());
    const details = r.details as Array<{ found: boolean; label: string; source: string }>;
    expect(details[0]!.found).toBe(true); // catalog 資訊仍在
    expect(details[0]!.label).toContain("掩埋場");
    expect(String(details[0]!.source)).toContain("boom");
  });
});

describe("DATASET_WHITELIST waste entry", () => {
  it("includes wasteStopsStatic pointing to a static geojson", () => {
    const w = DATASET_WHITELIST.wasteStopsStatic;
    expect(w).toBeTruthy();
    expect(w!.url).toMatch(/\.geojson$/);
    expect(w!.label).toBeTruthy();
    expect(w!.description.length).toBeGreaterThan(20);
  });

  it("every whitelist entry has a well-formed url / label / description", () => {
    for (const [id, meta] of Object.entries(DATASET_WHITELIST)) {
      expect(meta.url, id).toMatch(/^\.\//);
      expect(meta.label, id).toBeTruthy();
      expect(meta.description, id).toBeTruthy();
    }
  });
});

describe("RPC_WHITELIST waste count RPCs", () => {
  it("exposes the lightweight waste count RPCs used for 「幾個掩埋場」", () => {
    for (const name of ["get_waste_facility_counts", "get_waste_disposal_point_counts"]) {
      expect(RPC_WHITELIST[name]).toBeTruthy();
      expect(RPC_WHITELIST[name]!.description).toBeTruthy();
    }
  });
});
