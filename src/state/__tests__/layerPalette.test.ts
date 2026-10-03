import { afterEach, describe, expect, it } from "vitest";
import { buildDefaultVisibility } from "../layerVisibilityStore";
import { layerParamsStore } from "../layerParamsStore";
import {
  HEATMAP_PALETTE_KEYS, gridRampFor, heatmapRampFor, heatmapStackFactor, layerPaletteId,
} from "../layerPalette";
import { HEATMAP } from "../../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../../map/palettes";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { getParamsSpec } from "../../data/layerParamsSpec";
import type { LayerVisibility } from "../../types";
import { applyLayerControl, describeLayerControls } from "../../research/layerControls";
import { captureSceneParams, resolveSceneRestore } from "../../lib/memberSceneAdapter";
import type { MemberSceneSnapshot } from "../../lib/memberSchema";

afterEach(() => layerParamsStore.reset());

describe("R7 顏色解析器", () => {
  it("熱區預設新版 magma；換色盤後 paint 跟著換，暗淡各用自己那版", () => {
    expect(heatmapRampFor("medClinic", true)).toEqual(paletteRamp("magma", true));
    layerParamsStore.setParam("medClinic", "medClinicPalette", "viridis");
    expect(heatmapRampFor("medClinic", true)).toEqual(paletteRamp("viridis", true));
    expect(heatmapRampFor("medClinic", false)).toEqual(paletteRamp("viridis", false));
    const heat = OVERLAY_REGISTRY.find((c) => c.id === "medClinic")!.layers.find((l) => l.type === "heatmap")!;
    expect(JSON.stringify(heat.paint(false, {})["heatmap-color"])).toContain("rgba(70,192,111,"); // viridis 淡版第 1 階 #46c06f
  });

  it("色盤只換熱區，不改點的顏色", () => {
    const config = OVERLAY_REGISTRY.find((c) => c.id === "medClinic")!;
    const before = config.layers.filter((l) => l.type === "circle").map((l) => JSON.stringify(l.paint(true, {})["circle-color"]));
    layerParamsStore.setParam("medClinic", "medClinicPalette", "batlow");
    const after = config.layers.filter((l) => l.type === "circle").map((l) => JSON.stringify(l.paint(true, {})["circle-color"]));
    expect(after).toEqual(before);
  });

  it("網格預設沿用現行色系（viridis／magma／cividis；YlOrRd、inferno → YlOrBr）", () => {
    expect(layerPaletteId("factoryDensityGrid")).toBe("viridis");
    expect(layerPaletteId("companyCapitalGrid")).toBe("magma");
    expect(layerPaletteId("companyAgeStructure")).toBe("cividis");
    expect(layerPaletteId("realEstatePresaleGrid")).toBe("YlOrBr");
    expect(layerPaletteId("jpPopulationMesh1km")).toBe("YlOrBr");
    expect(layerPaletteId("propertyValueGrid", "propertyValueGridPalette")).toBe("YlOrBr");
    expect(gridRampFor("propertyValueGrid", true, 9, "propertyValueGridPalette")).toHaveLength(9);
  });

  it("whenDefault：選單停在預設時用指定色盤，換色後用所選", () => {
    expect(gridRampFor("jpPopulationMesh1km", true, 6, undefined, "BuPu")).toEqual(resampleRamp(paletteRamp("BuPu", true)!, 6));
    layerParamsStore.setParam("jpPopulationMesh1km", "jpPopulationMeshPalette", "tokyo");
    expect(gridRampFor("jpPopulationMesh1km", true, 6, undefined, "BuPu")).toEqual(resampleRamp(paletteRamp("tokyo", true)!, 6));
  });

  it("日本醫療 5 層共用一個網格色盤（改一層，其他層一起變）", () => {
    layerParamsStore.setParam("jpMedicalClinics", "jpMedicalGridPalette", "acton");
    expect(layerPaletteId("jpMedicalHospitals")).toBe("acton");
    expect(layerPaletteId("jpCarePlanning")).toBe("viridis");
  });

  it("Q6 B：同時開 ≥2 層可換色熱區才降透明度", () => {
    const vis = (on: string[]) => ({ ...buildDefaultVisibility(), ...Object.fromEntries(on.map((k) => [k, true])) }) as LayerVisibility;
    expect(heatmapStackFactor(vis(["medClinic"]))).toBe(1);
    expect(heatmapStackFactor(vis(["medClinic", "medAED"]))).toBe(HEATMAP.stackedOpacity);
    expect(heatmapStackFactor(vis(["medClinic", "rainGauge"]))).toBe(1);
  });

  it("熱區色盤清單：43 層，每層都有 registry 或 hook 熱區", () => {
    expect(HEATMAP_PALETTE_KEYS).toHaveLength(43);
    for (const key of HEATMAP_PALETTE_KEYS) {
      expect(getParamsSpec(key)!.some((s) => s.kind === "palette" && s.default === "magma")).toBe(true);
    }
  });

  it("場景存檔存回選色；不在色盤庫的值還原成預設", () => {
    layerParamsStore.setParam("medClinic", "medClinicPalette", "speed");
    const params = captureSceneParams(["medClinic"], layerParamsStore.getAll());
    expect(params.medClinic?.medClinicPalette).toBe("speed");
    const scene = (p: Record<string, Record<string, string | number | boolean>>) => ({ layers: ["medClinic"], params: p, basemap: "dark" }) as unknown as MemberSceneSnapshot;
    const ok = resolveSceneRestore(scene(params), new Set(["medClinic"]), new Set(), ["dark"]);
    expect(ok.params.medClinic?.medClinicPalette).toBe("speed");
    const bad = resolveSceneRestore(scene({ medClinic: { medClinicPalette: "jet" } }), new Set(["medClinic"]), new Set(), ["dark"]);
    expect(bad.params.medClinic?.medClinicPalette).toBe("magma");
    expect(bad.skipped.some((s) => s.includes("medClinicPalette"))).toBe(true);
  });

  it("Agent 白名單隨 spec：palette 控件可描述、可設、拒收庫外值", () => {
    const c = describeLayerControls("medClinic", new Set()).controls.find((x) => x.kind === "palette")!;
    expect(c.controlId).toBe("medClinicPalette");
    expect(c.options).toHaveLength(17);
    expect(applyLayerControl({ layerKey: "medClinic", controlId: c.controlId, expectedValue: "magma", value: "batlow" }, new Set())).toBe("batlow");
    expect(() => applyLayerControl({ layerKey: "medClinic", controlId: c.controlId, expectedValue: "batlow", value: "jet" }, new Set())).toThrow("LAYER_CONTROL_VALUE_INVALID");
  });
});
