// 選舉統計（2026-11-04，取代獨立圖層「2022 村里得票」）：總統、立委政黨票、縣市長、縣市議員政黨合計、全國性公投，
// 村里（VILLAGE_NLSC_1150817）／鄉鎮／縣市，5 dataset、66 recipe、390 個 exact selector。
// 交付 JSON 由 scripts/statistics/build_election_statistics_recipes.py 從 analytics docs/handoff/election-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 放在 GIS 主題「政治 Politics → 選舉」（layerCatalog 併進既有群組，不另開主題）；一屆選舉一列，列內下拉切指標×層級。
import catalogJson from "./electionStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const ELECTION_ENABLED_STATISTICS_KEYS = [
  "statsElectionPresidentTopPartyCounty", "statsElectionPresidentTopPartyTownship", "statsElectionPresidentTopPartyVillage",
  "statsElectionPresidentKmtMinusDppCounty", "statsElectionPresidentKmtMinusDppTownship", "statsElectionPresidentKmtMinusDppVillage",
  "statsElectionPresidentVoteShareCounty", "statsElectionPresidentVoteShareTownship", "statsElectionPresidentVoteShareVillage",
  "statsElectionPresidentTurnoutCounty", "statsElectionPresidentTurnoutTownship", "statsElectionPresidentTurnoutVillage",
  "statsElectionPresidentValidVotesCounty", "statsElectionPresidentValidVotesTownship", "statsElectionPresidentValidVotesVillage",
  "statsElectionLegislatorPartyTopPartyCounty", "statsElectionLegislatorPartyTopPartyTownship", "statsElectionLegislatorPartyTopPartyVillage",
  "statsElectionLegislatorPartyKmtMinusDppCounty", "statsElectionLegislatorPartyKmtMinusDppTownship", "statsElectionLegislatorPartyKmtMinusDppVillage",
  "statsElectionLegislatorPartyVoteShareCounty", "statsElectionLegislatorPartyVoteShareTownship", "statsElectionLegislatorPartyVoteShareVillage",
  "statsElectionLegislatorPartyTurnoutCounty", "statsElectionLegislatorPartyTurnoutTownship", "statsElectionLegislatorPartyTurnoutVillage",
  "statsElectionLegislatorPartyValidVotesCounty", "statsElectionLegislatorPartyValidVotesTownship", "statsElectionLegislatorPartyValidVotesVillage",
  "statsElectionMayorTopPartyCounty", "statsElectionMayorTopPartyTownship", "statsElectionMayorTopPartyVillage",
  "statsElectionMayorKmtMinusDppCounty", "statsElectionMayorKmtMinusDppTownship", "statsElectionMayorKmtMinusDppVillage",
  "statsElectionMayorVoteShareCounty", "statsElectionMayorVoteShareTownship", "statsElectionMayorVoteShareVillage",
  "statsElectionMayorTurnoutCounty", "statsElectionMayorTurnoutTownship", "statsElectionMayorTurnoutVillage",
  "statsElectionMayorValidVotesCounty", "statsElectionMayorValidVotesTownship", "statsElectionMayorValidVotesVillage",
  "statsElectionCouncilorPartyTopPartyCounty", "statsElectionCouncilorPartyTopPartyTownship", "statsElectionCouncilorPartyTopPartyVillage",
  "statsElectionCouncilorPartyKmtMinusDppCounty", "statsElectionCouncilorPartyKmtMinusDppTownship", "statsElectionCouncilorPartyKmtMinusDppVillage",
  "statsElectionCouncilorPartyVoteShareCounty", "statsElectionCouncilorPartyVoteShareTownship", "statsElectionCouncilorPartyVoteShareVillage",
  "statsElectionCouncilorPartyTurnoutCounty", "statsElectionCouncilorPartyTurnoutTownship", "statsElectionCouncilorPartyTurnoutVillage",
  "statsElectionCouncilorPartyValidVotesCounty", "statsElectionCouncilorPartyValidVotesTownship", "statsElectionCouncilorPartyValidVotesVillage",
  "statsElectionReferendumAgreeRateCounty", "statsElectionReferendumAgreeRateTownship", "statsElectionReferendumAgreeRateVillage",
  "statsElectionReferendumTurnoutCounty", "statsElectionReferendumTurnoutTownship", "statsElectionReferendumTurnoutVillage",
] as const;
export type ElectionStatisticsLayerKey = typeof ELECTION_ENABLED_STATISTICS_KEYS[number];

export const ELECTION_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
