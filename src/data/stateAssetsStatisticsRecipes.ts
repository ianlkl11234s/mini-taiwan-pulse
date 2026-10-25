// 國有資產統計（G16，2026-10-24）：財政部國有財產署國有非公用土地／房地／出租／住宅用地（縣市）、
// 台糖可供出租與歷年標租標的（鄉鎮市區，非持有地）、行政執行署已拍定不動產（縣市／鄉鎮，只有件數、無金額）。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family stateAssets 從 analytics
// docs/handoff/state-assets-statistics-recipes.json 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./stateAssetsStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const STATE_ASSETS_ENABLED_STATISTICS_KEYS = [
  "statsStateLandIdleArea", "statsStateLandIdleShare", "statsStateLandIdleParcels", "statsStateLandStatusShare", "statsStateLandArea", "statsStateLandParcels", "statsStateLandValuePerSqm", "statsStatePropertyArea", "statsStatePropertyParcels", "statsStatePropertyValuePerSqm", "statsStateLandRentalArea", "statsStateLandRentalParcels", "statsStateResidentialArea", "statsStateResidentialParcels", "statsTaisugarRentableArea", "statsTaisugarRentableParcels", "statsTaisugarAnnouncedArea", "statsTaisugarAnnouncedParcels", "statsTaisugarAnnouncedListings", "statsMojAuctionItems", "statsMojAuctionLots", "statsMojAuctionItemsByCategory", "statsMojAuctionItemsTown",
] as const;
export type StateAssetsStatisticsLayerKey = typeof STATE_ASSETS_ENABLED_STATISTICS_KEYS[number];

export const STATE_ASSETS_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
