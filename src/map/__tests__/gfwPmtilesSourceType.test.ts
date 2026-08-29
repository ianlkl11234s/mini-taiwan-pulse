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
