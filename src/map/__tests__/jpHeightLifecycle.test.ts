import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerVisibility, OverlayConfig } from "../../types";
import { createJpHeightLifecycle, jpHeightCatalogStore } from "../jpHeightLifecycle";

const sha = "a".repeat(64);
const asset = (path: string, bbox: number[], minzoom: number, maxzoom: number, sourceLayer?: string) => ({ url: `./jp-heights/${path}.pmtiles`, bbox, minzoom, maxzoom, bytes: 1024, sha256: sha, ...(sourceLayer ? { sourceLayer } : {}) });
const catalog = { schema: "jp-height-catalog-v1", version: "test-v1", regions: Array.from({ length: 100 }, (_, i) => {
  const x = 130 + (i % 10) * .1, y = 30 + Math.floor(i / 10) * .1, bbox = [x, y, x + .08, y + .08];
  return { id: `r-${i}`, label: `R${i}`, bbox, status: "ready", buildings: asset(`b-${i}`, bbox, 12, 16, "buildings"), grid: asset(`g-${i}`, bbox, 4, 12, "building_grid"), canopy: asset(`c-${i}`, bbox, 8, 14) };
}), canopyOverview: asset("canopy-overview", [120, 20, 150, 50], 4, 12) };
function configs(): OverlayConfig[] { return [
  { id: "jpBuildingHeight", sourceId: "jp-building-height", sourceUrl: "./jp-heights/buildings.pmtiles", pmtiles: { sourceLayer: "buildings", minzoom: 12, maxzoom: 16 }, layers: [{ suffix: "fill", type: "fill", paint: () => ({}) }] },
  { id: "jpBuildingHeight", sourceId: "jp-building-height-grid", sourceUrl: "./jp-heights/grid.pmtiles", pmtiles: { sourceLayer: "building_grid", minzoom: 4, maxzoom: 12 }, layers: [{ suffix: "fill", type: "fill", maxzoom: 13, paint: () => ({}) }] },
  { id: "jpCanopyHeight", sourceId: "jp-canopy-height", sourceUrl: "./jp-heights/canopy.pmtiles", pmtiles: { minzoom: 8, maxzoom: 14 }, layers: [{ suffix: "raster", type: "raster", paint: () => ({}) }] },
]; }
function visibility() { return { jpBuildingHeight: true, jpCanopyHeight: true } as LayerVisibility; }
function fakeMap() { let box=[129,29,132,32], zoom=10; const sources=new Map<string,unknown>(),layers=new Map<string,unknown>(),events=new Map<string,Set<(e?:unknown)=>void>>(); const map={getSource:(id:string)=>sources.get(id),addSource:(id:string)=>sources.set(id,{}),removeSource:(id:string)=>sources.delete(id),getLayer:(id:string)=>layers.get(id),addLayer:(l:{id:string})=>layers.set(l.id,l),removeLayer:(id:string)=>layers.delete(id),getLayoutProperty:vi.fn(),setLayoutProperty:vi.fn(),setPaintProperty:vi.fn(),getBounds:()=>({getWest:()=>box[0]!,getSouth:()=>box[1]!,getEast:()=>box[2]!,getNorth:()=>box[3]!}),getZoom:()=>zoom,isSourceLoaded:()=>true,on:(n:string,f:(e?:unknown)=>void)=>{if(!events.has(n))events.set(n,new Set());events.get(n)!.add(f);},off:(n:string,f:(e?:unknown)=>void)=>events.get(n)?.delete(f)}; return {map,set:(next:number[],z:number)=>{box=next;zoom=z;},emit:(n:string,e?:unknown)=>events.get(n)?.forEach(f=>f(e)),ids:()=>[...sources.keys()].sort(),count:(n:string)=>events.get(n)?.size??0}; }
async function ready() { await vi.waitFor(() => expect(jpHeightCatalogStore.getSnapshot().version).toBe("test-v1")); }
afterEach(()=>vi.restoreAllMocks());

describe("catalog-driven JP height lifecycle", () => {
  it("loads a 100-city catalog, caps source classes, and reports capped regions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(catalog)));
    const fake=fakeMap(), life=createJpHeightLifecycle(fake.map); life.refresh(configs(),visibility(),false,{}); await ready();
    expect(fake.ids()).toHaveLength(6);
    expect(fake.map.getLayer("jp-building-height-grid--r-55-fill")).not.toHaveProperty("maxzoom"); expect(fake.ids().filter(x=>x.includes("building-height-grid"))).toHaveLength(4); expect(fake.ids().filter(x=>x.includes("canopy-height"))).toHaveLength(2);
    expect(jpHeightCatalogStore.getSnapshot().cappedRegionIds.length).toBeGreaterThan(0); life.dispose(); expect(fake.ids()).toEqual([]);
  });
  it("uses detail instead of grid at z13 and cancels delayed moves on suspend", async () => {
    const fake=fakeMap(), life=createJpHeightLifecycle(fake.map); life.refresh(configs(),visibility(),false,{}); await ready();
    fake.set([129,29,132,32],13); fake.emit("moveend"); life.suspend(); await new Promise((r)=>setTimeout(r,220)); expect(fake.ids()).toEqual([]); life.resume(); life.refresh(configs(),visibility(),false,{ jpBuildingHeightOpacity: .4 });
    expect(fake.ids().filter(x=>x.includes("building-height--"))).toHaveLength(4); expect(fake.ids().some(x=>x.includes("grid--"))).toBe(false); life.dispose();
  });
  it("keeps listeners bounded through style-like suspend/resume cycles", async () => {
    const fake=fakeMap(), life=createJpHeightLifecycle(fake.map); life.refresh(configs(),visibility(),false,{}); await ready();
    for(let i=0;i<100;i+=1){life.suspend();life.resume();fake.set([130+(i%10)*.1,30+Math.floor(i/10)*.1,130.2+(i%10)*.1,30.2+Math.floor(i/10)*.1],10);life.refresh(configs(),visibility(),Boolean(i%2),{});expect(fake.ids().length).toBeLessThanOrEqual(6);}
    life.dispose(); expect(fake.count("moveend")).toBe(0); expect(fake.count("sourcedata")).toBe(0);
  });
  it("unmounts outside coverage and when both toggles are off, including a world-copy view", async () => {
    const fake=fakeMap(), life=createJpHeightLifecycle(fake.map); life.refresh(configs(),visibility(),false,{}); await ready();
    fake.set([154,40,155,41], 10); fake.emit("moveend"); await new Promise((r)=>setTimeout(r,220)); expect(fake.ids()).toEqual([]);
    fake.set([490,29,492,32], 16); life.refresh(configs(),visibility(),false,{}); expect(fake.ids().some((id)=>id.includes("building-height--"))).toBe(true);
    life.refresh(configs(),{ jpBuildingHeight:false,jpCanopyHeight:false } as LayerVisibility,false,{}); expect(fake.ids()).toEqual([]); life.dispose();
  });
  it("uses canopy overview below regional detail zoom and for an uncovered high-zoom view", async () => {
    const fake=fakeMap(), life=createJpHeightLifecycle(fake.map); life.refresh(configs(),visibility(),false,{}); await ready();
    fake.set([129,29,132,32], 6); life.refresh(configs(),visibility(),false,{});
    expect(fake.ids()).toContain("jp-canopy-height--overview");
    expect(fake.ids().filter((id) => id.startsWith("jp-canopy-height--"))).toEqual(["jp-canopy-height--overview"]);
    expect(fake.map.getLayer("jp-canopy-height--overview-raster")).toMatchObject({ minzoom: 4 });
    fake.set([140,40,141,41], 14); life.refresh(configs(),visibility(),false,{});
    expect(fake.ids()).toContain("jp-canopy-height--overview");
    life.dispose();
  });
});
