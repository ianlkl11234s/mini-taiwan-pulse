import { describe, expect, it, vi } from "vitest";
import { __test__ } from "../gfwPmtilesSourceType";

describe("GFW PMTiles protocol tile cache", () => {
  it("同一 immutable tile 的後續 repaint 直接回傳 cache，不重發 Range", async () => {
    const original = vi.fn((_request: { url: string }, callback: (error?: unknown, data?: Uint8Array) => void) => {
      callback(undefined, new Uint8Array([1, 2, 3]));
      return { cancel: vi.fn() };
    });
    const protocol = { tile: original };
    __test__.cacheProtocolTileReads(protocol);

    const first = await new Promise<Uint8Array>((resolve, reject) => {
      protocol.tile({ url: "pmtiles://grid.pmtiles/8/220/110" }, (error, data) => error ? reject(error) : resolve(data!));
    });
    const second = await new Promise<Uint8Array>((resolve, reject) => {
      protocol.tile({ url: "pmtiles://grid.pmtiles/8/220/110" }, (error, data) => error ? reject(error) : resolve(data!));
    });

    expect(original).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});

type SendArgs = [string, Record<string, unknown>, (error?: unknown, data?: unknown) => void];

function createReloadFixture(state: string, hasActor = true) {
  const send = vi.fn((..._args: SendArgs) => ({ cancel: vi.fn() }));
  const tile = {
    uid: 42,
    state,
    tileZoom: 8,
    tileID: { canonical: { url: () => "pmtiles://grid.pmtiles/8/220/110" }, overscaledZ: 8, overscaleFactor: () => 1 },
    actor: hasActor ? { send } : undefined,
    isSymbolTile: false,
    isExtraShadowCaster: false,
    loadVectorData: vi.fn(),
    setExpiryData: vi.fn(),
  };
  const source = {
    map: {
      painter: {},
      showCollisionBoxes: false,
      _refreshExpiredTiles: false,
      _requestManager: { normalizeTileURL: (url: string) => url, transformRequest: (url: string) => ({ url }) },
    },
    tiles: ["pmtiles://grid.pmtiles"],
    scheme: "xyz",
    tileSize: 512,
    id: "gfw-hourly-grid-pmtiles-source",
    scope: "",
    promoteId: undefined,
  };
  return { tile, source, send };
}

describe("GFW PMTiles reload path", () => {
  it("worker 已持有的 tile 走 reloadTile 且不重送 bytes（修上游誤送 loadTile）", () => {
    const { tile, source, send } = createReloadFixture("loaded");
    const callback = vi.fn();
    const handled = __test__.reloadPmVectorTile(source as never, tile as never, callback, vi.fn());

    expect(handled).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const [message, params] = send.mock.calls[0]!;
    expect(message).toBe("reloadTile");
    expect(params.uid).toBe(42);
    expect(params.data).toBeUndefined();
    expect(params.type).toBe("vector");
    expect(params.source).toBe("gfw-hourly-grid-pmtiles-source");
  });

  it("首次載入 / expired / loading 三種狀態一律交回上游的 loadTile 路徑", () => {
    for (const [state, hasActor] of [["loading", true], ["expired", true], ["loaded", false]] as const) {
      const { tile, source, send } = createReloadFixture(state, hasActor);
      expect(__test__.reloadPmVectorTile(source as never, tile as never, vi.fn(), vi.fn())).toBe(false);
      expect(send).not.toHaveBeenCalled();
    }
  });

  it("library 內部形狀不如預期時退回上游，不吞掉 tile 載入", () => {
    const { tile, source } = createReloadFixture("loaded");
    const broken = { ...source, map: { ...source.map, _requestManager: { normalizeTileURL: () => { throw new Error("shape"); }, transformRequest: () => ({}) } } };
    expect(__test__.reloadPmVectorTile(broken as never, tile as never, vi.fn(), vi.fn())).toBe(false);

    const noPainter = { ...source, map: { ...source.map, painter: undefined } };
    expect(__test__.reloadPmVectorTile(noPainter as never, tile as never, vi.fn(), vi.fn())).toBe(false);
  });

  it("worker 回覆後把資料交給 tile，並接續 pending reloadCallback", () => {
    const { tile, source, send } = createReloadFixture("loaded");
    const callback = vi.fn();
    const retry = vi.fn();
    const pending = vi.fn();
    (tile as { reloadCallback?: unknown }).reloadCallback = pending;
    __test__.reloadPmVectorTile(source as never, tile as never, callback, retry);

    const done = send.mock.calls[0]![2];
    const parsed = { rawTileData: new Uint8Array([1]) };
    done(null, parsed);

    expect(tile.loadVectorData).toHaveBeenCalledWith(parsed, source.map.painter);
    expect(callback).toHaveBeenCalledWith(null, parsed);
    expect(retry).toHaveBeenCalledWith(tile, pending);
    expect((tile as { reloadCallback?: unknown }).reloadCallback).toBeNull();
  });

  it("tile 已 abort 時不再把資料塞回 tile", () => {
    const { tile, source, send } = createReloadFixture("loaded");
    const callback = vi.fn();
    __test__.reloadPmVectorTile(source as never, tile as never, callback, vi.fn());
    (tile as { aborted?: boolean }).aborted = true;

    const done = send.mock.calls[0]![2];
    done(null, { rawTileData: new Uint8Array([1]) });

    expect(tile.loadVectorData).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(null);
  });
});
