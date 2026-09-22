import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { chiayiBusRouteDescriptor, createChiayiBusRouteAdapter } from "../busRouteDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const route = (routeUid: string, routeName: string, direction = 0, coords: unknown = [[120.4, 23.5], [120.41, 23.51]]) => ({ routeUid, routeName, direction, coords });
const response = (body: unknown, headers: HeadersInit = { "content-type": "application/json" }) => new Response(JSON.stringify(body), { status: 200, headers });
const executor = (body: unknown, headers?: HeadersInit) => {
  const fetcher = vi.fn(async () => response(body, headers));
  return { fetcher, query: new QueryExecutor([createChiayiBusRouteAdapter(fetcher)]) };
};

describe("Chiayi TDX bus route research adapter", () => {
  it("materializes all 31 verified same-origin route shapes from the immutable local fixture", async () => {
    const bytes = await readFile(new URL("../../../public/bus/chiayi_bus_routes.json", import.meta.url));
    const fetcher = vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "application/json" } }));
    const query = new QueryExecutor([createChiayiBusRouteAdapter(fetcher)]);
    const result = await query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId, limit: 1 });
    expect(result.totalMatched).toBe(31);
    expect(result.rows).toEqual([expect.objectContaining({ route_id: "CYI0119_樂活3路_0", route_label: "樂活3路", geometry: expect.objectContaining({ type: "LineString" }) })]);
  });

  it("creates LineString route snapshots and permits declared route_id or route_uid filtering", async () => {
    const { fetcher, query } = executor({ "CYI0001_測試_0": route("CYI0001", "測試"), "CYI0002_另一線_1": route("CYI0002", "另一線", 1, [[120.42, 23.52], [120.42, 23.52], [120.43, 23.53]]) });
    const result = await query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId, filters: [{ field: "route_uid", op: "eq", value: "CYI0002" }] });
    expect(fetcher).toHaveBeenCalledWith("/bus/chiayi_bus_routes.json", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result.rows).toEqual([expect.objectContaining({ route_id: "CYI0002_另一線_1", route_label: "另一線", geometry: { type: "LineString", coordinates: [[120.42, 23.52], [120.42, 23.52], [120.43, 23.53]] } })]);
    expect(result.sourceRefs[0]).toMatchObject({ sourceId: "tdx-chiayi-city-bus-shape", version: expect.stringContaining("tdx-source-version-unknown;sha256:"), checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it("rejects malformed coordinates and oversized route sets while retaining distinct map-keyed paths", async () => {
    await expect(executor({ "bad": route("CYI0001", "測試", 0, [[120.4, 23.5], [999, 23.5]]) }).query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId })).rejects.toThrow("INVALID_ROUTE_RECORD");
    await expect(executor({ "one": route("CYI0001", "測試"), "two": route("CYI0001", "同 UID 不同路徑", 0, [[120.41, 23.51], [120.42, 23.52]]) }).query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId })).resolves.toMatchObject({ totalMatched: 2 });
    const oversized = Object.fromEntries(Array.from({ length: 2_001 }, (_, index) => [`R${index}`, route(`R${index}`, "測試")]));
    await expect(executor(oversized).query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId })).rejects.toThrow("ROUTE_SCAN_BUDGET_EXCEEDED");
  });

  it("rejects declared and streamed assets above the fixed 2 MiB cap", async () => {
    await expect(executor({ "one": route("CYI0001", "測試") }, { "content-type": "application/json", "content-length": String(2 * 1024 * 1024 + 1) }).query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId })).rejects.toThrow("DATASET_TOO_LARGE");
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); controller.close(); } });
    const fetcher = vi.fn(async () => new Response(stream, { status: 200, headers: { "content-type": "application/json" } }));
    await expect(new QueryExecutor([createChiayiBusRouteAdapter(fetcher)]).execute({ datasetId: chiayiBusRouteDescriptor.datasetId })).rejects.toThrow("DATASET_TOO_LARGE");
  });

  it("forwards a caller abort to the fetch, preserves it from timeout classification, and accepts an already-aborted caller", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      requestSignal = init?.signal as AbortSignal;
      requestSignal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const query = new QueryExecutor([createChiayiBusRouteAdapter(fetcher)]);
    const controller = new AbortController();
    const pending = query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId }, controller.signal);
    await vi.waitFor(() => expect(requestSignal).toBeDefined());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(requestSignal?.aborted).toBe(true);

    const alreadyAborted = new AbortController(); alreadyAborted.abort();
    await expect(query.execute({ datasetId: chiayiBusRouteDescriptor.datasetId }, alreadyAborted.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
