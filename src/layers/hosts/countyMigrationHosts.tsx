// 台灣圖層延伸 B5：縣市間遷徙流向 Host（年份 select 編成索引，見 layerParamsSpec twCountyMigrationYear）。
import { useCountyMigrationFlowsLayer } from "../../hooks/useCountyMigrationFlowsLayer";
import { COUNTY_MIGRATION_DEFAULT_YEAR, COUNTY_MIGRATION_YEARS } from "../../data/countyMigrationFlows";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const CountyMigrationFlowsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCountyMigrationFlowsLayer");
  const p = useKeyOverlayParams("twCountyMigrationFlows");
  const year = COUNTY_MIGRATION_YEARS[p.twCountyMigrationYearIdx ?? 0] ?? COUNTY_MIGRATION_DEFAULT_YEAR;
  useCountyMigrationFlowsLayer(deps.mapRef, deps.layerVisibility.twCountyMigrationFlows, p.twCountyMigrationFlowsOpacity ?? 0.85, year, deps.isDarkTheme);
  return null;
};
