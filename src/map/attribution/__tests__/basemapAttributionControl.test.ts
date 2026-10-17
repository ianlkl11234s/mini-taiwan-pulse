import { describe, expect, it, vi } from "vitest";
import mapboxgl from "mapbox-gl";
import { BasemapAttributionControl } from "../mapAttribution";

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("BasemapAttributionControl（內建版權列只顯示底圖）", () => {
  const proto = mapboxgl.AttributionControl.prototype as any;

  it("mapbox-gl 仍有被覆寫的私有方法（升級套件時這裡會先紅）", () => {
    expect(typeof proto._updateAttributions).toBe("function");
  });

  it("呼叫原實作時遮掉非底圖 source 的 attribution，結束後還原", () => {
    const basemap = { url: "mapbox://mapbox.mapbox-streets-v8", attribution: "© Mapbox © OpenStreetMap" };
    const layer = { url: "./x.pmtiles", attribution: "經濟部水利署 水門位置 · 政府資料開放授權條款第1版" };
    const hookLayer = { attribution: "Global Fishing Watch" };
    const seen: unknown[][] = [];
    const spy = vi.spyOn(proto, "_updateAttributions").mockImplementation(function () {
      seen.push([basemap.attribution, layer.attribution, hookLayer.attribution]);
    });
    const ctrl = Object.create(BasemapAttributionControl.prototype) as any;
    ctrl._map = { style: { _mergedSourceCaches: {
      composite: { getSource: () => basemap },
      water: { getSource: () => layer },
      gfw: { getSource: () => hookLayer },
    } } };
    ctrl._updateAttributions();
    expect(seen).toEqual([["© Mapbox © OpenStreetMap", undefined, undefined]]);
    expect(layer.attribution).toBe("經濟部水利署 水門位置 · 政府資料開放授權條款第1版");
    expect(hookLayer.attribution).toBe("Global Fishing Watch");
    spy.mockRestore();
  });

  it("找不到內部 source cache 時退回原實作（寧可多標、不可漏標）", () => {
    const spy = vi.spyOn(proto, "_updateAttributions").mockImplementation(() => {});
    const ctrl = Object.create(BasemapAttributionControl.prototype) as any;
    ctrl._map = { style: {} };
    ctrl._updateAttributions();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
