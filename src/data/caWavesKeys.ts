/** 加拿大第 3–8 波規格驅動資料層 key（2026-11-17，analytics #402；SSOT：types／registry／測試共用，不放其他相依）。 */
export const CA_WAVE_KEYS = [
  // 第 2 波 HOLD 補上（C002）＋第 3 波剩餘：水、災害、環境
  "caMaritimeZones", "caPermafrost", "caDams", "caRecyclingDepots", "caFloodMapInventory", "caAbFloodHazard", "caGlaciers", "caRiversLakes",
  // 第 4 波：自然保護、海洋、道路結構
  "caProtectedAreas", "caCriticalHabitat", "caMarineConservation", "caTideStations", "caEcozones", "caForestManagement",
  "caBridgesTunnels", "caFerryRoutes", "caTorontoKsi",
  // 第 5 波：教育、醫療、運動（LODE）
  "caLodeHealth", "caLodeSchools", "caLodeSports", "caBcChildcare",
  // 第 6 波：文化、司法、生活
  "caLodeCulture", "caCbsaOffices", "caParksCanadaAccommodation", "caCourtsCorrections", "caTorontoTheftFromVehicle", "caWildfirePoints", "caBroadbandHex",
  // 第 7 波：工商與農業
  "caMines", "caGrainElevators", "caDroughtMonitor", "caSoilLandscapes", "caNsAquaculture", "caAbattoirs", "caOdbus",
  // 第 8 波：城市開發申請
  "caTorontoDevApplications",
] as const;
export type CaWaveKey = (typeof CA_WAVE_KEYS)[number];
