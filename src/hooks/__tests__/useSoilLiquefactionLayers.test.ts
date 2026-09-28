import { describe, expect, it } from "vitest";
import { SOIL_LIQUEFACTION_POTENTIAL_WMTS, SOIL_LIQUEFACTION_RASTER_SPECS, WEAK_SOIL_WMS_LAYERS } from "../useSoilLiquefactionLayers";
describe("soil-liquefaction official raster contracts", () => {
  it("uses the current official WMTS potential service", () => { expect(SOIL_LIQUEFACTION_POTENTIAL_WMTS).toContain("P04032/Soil_cgs_2026"); expect(SOIL_LIQUEFACTION_RASTER_SPECS.soilLiquefactionPotential.url).toContain("{z}/{y}/{x}.png"); });
  it("preserves the official WMS layer ordering and request dialect for six weak-soil views", () => { expect(WEAK_SOIL_WMS_LAYERS).toEqual({ weakSoilClay0To5: "5", weakSoilSand0To5: "4", weakSoilClay5To10: "3", weakSoilSand5To10: "2", weakSoilClay10To20: "1", weakSoilSand10To20: "0" }); for (const spec of Object.values(SOIL_LIQUEFACTION_RASTER_SPECS).slice(1)) { expect(spec.url).toContain("VERSION=1.1.1"); expect(spec.url).toContain("SRS=EPSG:3857"); expect(spec.url).toContain("BBOX={bbox-epsg-3857}"); } });
});
