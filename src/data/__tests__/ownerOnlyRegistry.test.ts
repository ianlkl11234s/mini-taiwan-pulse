import { describe, expect, it } from "vitest";
import { GATED_LAYERS } from "../../components/sidebar/layerCatalog";
import { LAYER_MANIFEST } from "../layerManifest";

// 站主限定名單的唯一來源＝manifest topics "OWNER_ONLY"；GATED_LAYERS 由它派生（layerCatalog.ts）。
// 這是安全清單：下面釘死完整 key，少一個標記（＝私人圖層對外開放）或多一個都要紅，
// 改名單時同步更新本表與 gis-platform public.gated_layers。
const PINNED = [
  // 畜牧
  "livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck",
  "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther", "livestockSlaughter",
  // 石化 · 油氣
  "lpgSubpackaging", "lpgRetailers", "lngTerminal", "pipelineGas", "pipelineOilGas",
  "industrialRefinery", "industrialStorageTank", "industrialPowerPlant", "coalTerminal", "fossilFuelInfra",
  // 電力 · 電網
  "osmSubstationsEhv", "osmSubstations", "osmPowerLines", "osmPowerTowers", "substationEhvGlow", "powerLinesGlow",
  // 電力 · 廠
  "facPrimary", "facPlanned", "facHistorical", "facSecondary", "facOsmSupplement", "powerGenerationUnit", "powerPlantGlow",
  "aviationRestrictedGlow",
  "busCrowdingSim", "electionEvents2026",
  // 已從 sidebar 下架但 API 敏感（無 LayerDef、無介面）
  "facOffshore", "osmPowerPlantsStatic", "powerPlants",
  // 日本水資源
  "jpWaterDams", "jpWaterRivers", "jpWaterSupplyFacilities", "jpWaterSupplyAreas",
  "jpWaterSewerFacilities", "jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds",
  // 橋梁（BSS 授權 HOLD）
  "bssNationalBridgePreview", "bssNationalBridgePointsPreview", "bridgeResilienceTwinCity",
  // 土壤液化／軟弱土層
  "soilLiquefactionPotential", "weakSoilClay0To5", "weakSoilSand0To5", "weakSoilClay5To10",
  "weakSoilSand5To10", "weakSoilClay10To20", "weakSoilSand10To20", "liquefactionMonitoringSites",
  "water1944Taipei", "gbPollutionInventoryEngland", "allenCoralAtlas",
].sort();

describe("站主限定名單（manifest OWNER_ONLY ⇔ GATED_LAYERS）", () => {
  it("manifest 標 OWNER_ONLY 的 key 與釘死清單完全一致", () => {
    const tagged = Object.values(LAYER_MANIFEST).filter((e) => e.topics.includes("OWNER_ONLY")).map((e) => e.key as string).sort();
    expect(tagged).toEqual(PINNED);
  });

  it("GATED_LAYERS 與 manifest OWNER_ONLY 完全一致", () => {
    expect([...GATED_LAYERS].map(String).sort()).toEqual(PINNED);
  });
});
