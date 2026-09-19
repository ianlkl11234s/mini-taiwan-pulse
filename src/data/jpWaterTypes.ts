/** Japan water assets stay source-separated. A station registry is not a water-quality observation. */
export const JP_WATER_LAYER_KEYS = [
  "jpWaterDams", "jpWaterLakes", "jpWaterSupplyFacilities", "jpWaterSupplyAreas",
  "jpWaterSewerFacilities", "jpWaterRivers", "jpWaterLocalPipes", "jpWaterLocalFacilities",
  "jpWaterQualityStations", "jpWaterLevelStations",
] as const;

export type JpWaterLayerKey = typeof JP_WATER_LAYER_KEYS[number];
export type JpWaterFormat = "geojson" | "pmtiles";
export type JpWaterGeometryRole = "point" | "line" | "polygon";

/** Only these keys have a release asset allowlisted for the current frontend. */
export const JP_WATER_RELEASED_LAYER_KEYS = [
  "jpWaterLakes", "jpWaterLocalFacilities", "jpWaterQualityStations", "jpWaterLevelStations",
] as const satisfies readonly JpWaterLayerKey[];

export const JP_WATER_LAYER_CONTRACT: Record<JpWaterLayerKey, {
  geometryRole: JpWaterGeometryRole; sourceYear: string; sourceLabel: string; historical: boolean; publicDistribution: boolean;
}> = {
  jpWaterDams: { geometryRole: "point", sourceYear: "2014", sourceLabel: "國土數値情報 W01 ダム", historical: true, publicDistribution: false },
  jpWaterLakes: { geometryRole: "polygon", sourceYear: "2005", sourceLabel: "國土數値情報 W09 湖沼", historical: true, publicDistribution: true },
  jpWaterSupplyFacilities: { geometryRole: "point", sourceYear: "2010/2012", sourceLabel: "國土數値情報 P21 上水道関連施設", historical: true, publicDistribution: false },
  jpWaterSupplyAreas: { geometryRole: "polygon", sourceYear: "2010/2012", sourceLabel: "國土數値情報 P21 給水区域", historical: true, publicDistribution: false },
  jpWaterSewerFacilities: { geometryRole: "point", sourceYear: "2012", sourceLabel: "國土數値情報 P22 下水道関連施設", historical: true, publicDistribution: false },
  jpWaterRivers: { geometryRole: "line", sourceYear: "2006–2009", sourceLabel: "國土數値情報 W05 河川", historical: true, publicDistribution: false },
  jpWaterLocalPipes: { geometryRole: "line", sourceYear: "source-specific", sourceLabel: "半田市 水道管路", historical: false, publicDistribution: false },
  jpWaterLocalFacilities: { geometryRole: "point", sourceYear: "source-specific", sourceLabel: "高松市 水道施設", historical: false, publicDistribution: true },
  jpWaterQualityStations: { geometryRole: "point", sourceYear: "2024", sourceLabel: "環境省 水質測定地点台帳", historical: true, publicDistribution: true },
  jpWaterLevelStations: { geometryRole: "point", sourceYear: "unknown (station registry undated)", sourceLabel: "横浜市 水位観測所", historical: false, publicDistribution: true },
};
