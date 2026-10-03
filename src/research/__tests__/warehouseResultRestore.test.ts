import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ResultCollection, WarehouseResultsMeta } from "../bridgeClient";
import { ResearchAnalysisSession } from "../researchAnalysisSession";
import { restoreWarehouseResults } from "../warehouseResultRestore";

const mixed = JSON.stringify({ type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Polygon", coordinates: [[[121.5, 25.03], [121.52, 25.03], [121.52, 25.05], [121.5, 25.03]]] }, properties: { name: "環域" } },
  { type: "Feature", geometry: { type: "Point", coordinates: [121.51, 25.04] }, properties: { name: "國小" } },
] });
const single = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: {} }] });
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const files: Record<string, string> = { "wh-3": mixed, "wh-7": single };
const metaOf = (id: string) => ({ resultId: id, sha256: sha(files[id]!), bytes: files[id]!.length, label: `結果 ${id}`, featureCount: JSON.parse(files[id]!).features.length, style: null });

function setup(meta: (ids: string[]) => Promise<WarehouseResultsMeta>) {
  const session = new ResearchAnalysisSession();
  const fetchText = vi.fn(async (id: string) => { const text = files[id]; if (!text) throw new Error("RESULT_NOT_FOUND"); return text; });
  const metaSpy = vi.fn(meta);
  const expired = new Set<string>();
  const deps = { has: (id: string) => session.hasResult(id), meta: metaSpy, importResult: (args: Record<string, unknown>) => session.importWarehouseResult(args, fetchText), expired };
  return { session, fetchText, metaSpy, expired, deps };
}
const collection = (items: [string, string | null][], groups: string[] = []): ResultCollection => ({ items: items.map(([resultId, groupId]) => ({ resultId, visible: true, groupId })), groups: groups.map(groupId => ({ groupId, label: groupId, visible: true })) });

describe("restoreWarehouseResults (P1 reload)", () => {
  it("asks meta for missing base ids (suffix stripped) and imports them through the gateway fetcher", async () => {
    const { session, fetchText, metaSpy, deps } = setup(async ids => ({ results: ids.map(metaOf), missing: [] }));
    const scene = collection([["wh-3:point", null], ["wh-3:polygon", null], ["wh-7", null]]);
    const outcome = await restoreWarehouseResults(scene, deps);
    expect(metaSpy).toHaveBeenCalledWith(["wh-3", "wh-7"]);
    expect(fetchText.mock.calls.map(call => call[0])).toEqual(["wh-3", "wh-7"]);
    expect(outcome).toEqual({ collection: scene, restored: ["wh-3", "wh-7"], dropped: [] });
    expect(session.hasResult("wh-3:point") && session.hasResult("wh-3:polygon") && session.hasResult("wh-7")).toBe(true);
  });

  it("drops gone items, prunes their empty groups, remembers them and keeps the rest", async () => {
    const { metaSpy, expired, deps } = setup(async () => ({ results: [metaOf("wh-7")], missing: ["wh-5"] }));
    const scene = collection([["wh-5", "old"], ["wh-7", "kept"], ["local-analysis", null]], ["old", "kept"]);
    deps.has = ((has) => (id: string) => id === "local-analysis" || has(id))(deps.has);
    const outcome = await restoreWarehouseResults(scene, deps);
    expect(outcome.dropped).toEqual(["wh-5"]);
    expect(outcome.collection).toEqual(collection([["wh-7", "kept"], ["local-analysis", null]], ["kept"]));
    expect(expired.has("wh-5")).toBe(true);
    metaSpy.mockClear();
    await restoreWarehouseResults(collection([["wh-5", null]]), deps);
    expect(metaSpy).not.toHaveBeenCalled();
  });

  it("drops an item whose bytes fail sha256 verification against the meta", async () => {
    const { expired, deps } = setup(async () => ({ results: [{ ...metaOf("wh-7"), sha256: "0".repeat(64) }], missing: [] }));
    const outcome = await restoreWarehouseResults(collection([["wh-7", null]]), deps);
    expect(outcome).toEqual({ collection: null, restored: [], dropped: ["wh-7"] });
    expect(expired.has("wh-7")).toBe(true);
  });

  it("does not mark transient meta failures as expired and is a no-op when everything is local", async () => {
    const { expired, metaSpy, deps } = setup(async () => { throw new Error("BRIDGE_UNAVAILABLE"); });
    expect((await restoreWarehouseResults(collection([["wh-7", null]]), deps)).dropped).toEqual(["wh-7"]);
    expect(expired.size).toBe(0);
    metaSpy.mockClear();
    const local = collection([["local-analysis", null]]);
    expect(await restoreWarehouseResults(local, { ...deps, has: () => true })).toEqual({ collection: local, restored: [], dropped: [] });
    expect(metaSpy).not.toHaveBeenCalled();
  });

  it("gives up on a stalled restore at the deadline", async () => {
    const { deps } = setup(() => new Promise(() => {}));
    const outcome = await restoreWarehouseResults(collection([["wh-7", null]]), { ...deps, deadlineMs: 20 });
    expect(outcome.dropped).toEqual(["wh-7"]);
  });
});

describe("MainMapConnection render order (P1)", () => {
  it("restores missing warehouse results before validating the scene, and imports via the gateway", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/research/MainMapConnection.tsx", "utf8");
    const render = source.slice(source.indexOf("const render = useCallback"), source.indexOf("const connect = useCallback"));
    const restoreAt = render.indexOf("await restoreWarehouseResults(scene.results");
    expect(restoreAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeLessThan(render.indexOf("mapPresentable(scene.results"));
    expect(render.indexOf("if (revision === 0)")).toBeLessThan(restoreAt);
    expect(source).toContain("importWarehouseResult(request.args, id => context.client.fetchResult(context.studyId, context.tabId, id))");
  });
});
