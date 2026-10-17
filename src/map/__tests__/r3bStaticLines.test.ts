import { describe, expect, it, vi } from "vitest";
import { updateRailTracks } from "../railTracks";
import { updateStaticTrails, setStaticTrailsOpacity } from "../staticTrails";

function mockMap() {
  const source = { setData: vi.fn() };
  const layers = new Set<string>();
  let added = false;
  return {
    getSource: () => added ? source : undefined,
    addSource: vi.fn(() => { added = true; }),
    getLayer: (id: string) => layers.has(id),
    addLayer: vi.fn((layer: {id: string}) => { layers.add(layer.id); }),
    setPaintProperty: vi.fn(), source,
  };
}
describe("R3b static line style-only changes", () => {
  it("rail theme changes preserve source and K4 opacity", () => {
    const map = mockMap();
    const data = { type: "FeatureCollection", features: [] } as const;
    updateRailTracks(map as never, data as never, true);
    updateRailTracks(map as never, data as never, false);
    expect(map.source.setData).not.toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith("rail-tracks-line", "line-opacity", 0.85);
  });
  it("flight theme changes only paint; new data refreshes geometry", () => {
    const map = mockMap();
    const flights: never[] = [];
    updateStaticTrails(map as never, flights, true);
    updateStaticTrails(map as never, flights, false);
    expect(map.source.setData).not.toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith("static-trails-line", "line-opacity", 0.6);
    expect(map.setPaintProperty).toHaveBeenCalledWith("static-trails-line", "line-color", ["get", "colorLight"]);
    setStaticTrailsOpacity(map as never, 0.25, 0.1, false);
    expect(map.setPaintProperty).toHaveBeenCalledWith("static-trails-line", "line-opacity", 0.3);
    setStaticTrailsOpacity(map as never, 0, 0, false);
    expect(map.setPaintProperty).toHaveBeenCalledWith("static-trails-line", "line-opacity", 0);
    updateStaticTrails(map as never, [], false);
    expect(map.source.setData).toHaveBeenCalledTimes(1);
  });
});
