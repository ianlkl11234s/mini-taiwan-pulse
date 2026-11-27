// 英國國家包：從共用檔搬來的國家專屬元件（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import { LegendNote, LegendRow, LegendTitle, SwatchLine, SwatchSquare, useLegendTheme } from "../../components/legend/legendKit";
import { DenseHeatmapLegendRow } from "../../components/legend/legendShared";
import { type MessageKey } from "../../i18n/keys";
import { BOUNDARY_GRAY, LINE_DASH, LINE_WIDTH } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { GB_SMALL_AREA_TYPES } from "./gbAdminTypes";
import { GB_MARITIME_LIMIT_TYPES, gbMaritimeLimitColor, type GbMaritimeLimitKind } from "./gbMaritimeLimitTypes";
import { GB_BUILT_UP_COLOR, GB_GREENSPACE_CATEGORIES, type GbGreenspaceFunctionId, type GbGreenspaceKey } from "./gbOpenSpaceTypes";


/** 英國地方政府區 LAD（ONS May 2026）：單一中性灰界線，圖例只講範圍、版本與署名。 */
export function GbAdminBoundariesLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbLadTitle")} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{i18n.t("legend.urban.gbLadRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.urban.gbCoverage")}</LegendNote>
  </div>;
}


/** 英國統計小區：四地各自的普查小區（同一中性灰線），逐項列年份與來源；不可跨國比較。 */
export function GbSmallAreaBoundariesLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const color = BOUNDARY_GRAY[t.isDark ? "dark" : "light"];
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbSmallAreaTitle")} />
    {GB_SMALL_AREA_TYPES.map((type) => (
      <LegendRow key={type.value} swatch={<SwatchLine color={color} width={1} />}>{i18n.t(GB_SMALL_AREA_LEGEND_KEYS[type.value])}</LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.urban.gbSmallAreaNiLevel")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbSmallAreaNotComparable")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbSmallAreaZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbCoverage")}</LegendNote>
  </div>;
}


/** 英國海域界線（UKHO）：9 類線，色與線型同地圖（虛線＝L-2 界線 [4,3]）。 */
export function GbMaritimeLimitsLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbMaritimeTitle")} />
    {GB_MARITIME_LIMIT_TYPES.map((type) => (
      <LegendRow key={type.value} swatch={<SwatchLine color={gbMaritimeLimitColor(type, t.isDark)} width={LINE_WIDTH[type.width][1]} dash={type.dashed ? LINE_DASH.boundary : undefined} />}>
        {i18n.t(GB_MARITIME_LEGEND_KEYS[type.value])}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.urban.gbMaritimeClosingZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbMaritimeCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbMaritimeIllustrative")}</LegendNote>
  </div>;
}


/** 英國建成區（OS Open Built Up Areas）：單一中性藍灰面。 */
export function GbBuiltUpAreasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbBuiltUpTitle")} />
    <LegendRow swatch={<SwatchSquare color={GB_BUILT_UP_COLOR} />}>{i18n.t("legend.urban.gbBuiltUpRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.urban.gbNiNotCovered")}</LegendNote>
  </div>;
}


/** 英國綠地四層（OS Open Greenspace，同一檔依 category／function 拆層）：每層列自己的 function 類別。 */
export function GbGreenspaceLegend({ layerKey }: { layerKey: GbGreenspaceKey }) {
  const i18n = useLocale();
  const cfg = GB_GREENSPACE_CATEGORIES[layerKey];
  return <div>
    <LegendTitle zh={i18n.t(GB_GREENSPACE_TITLE_KEYS[layerKey])} />
    {cfg.functions.map((f) => (
      <LegendRow key={f.value} swatch={<SwatchSquare color={f.color} />}>{i18n.t(GB_GREENSPACE_LEGEND_FN_KEYS[f.id])}</LegendRow>
    ))}
    {layerKey === "gbGolfCourses" ? null : <DenseHeatmapLegendRow layers={[layerKey]} />}
    {layerKey === "gbSportsFacilities" ? <LegendNote>{i18n.t("legend.urban.gbSportsGolfMoved")}</LegendNote> : null}
    {layerKey === "gbCemeteries" ? <LegendNote>{i18n.t("legend.urban.gbReligiousNote")}</LegendNote> : null}
    <LegendNote>{i18n.t(layerKey === "gbGolfCourses" ? "legend.urban.gbGolfZoom" : "legend.urban.gbGreenspaceZoom", { zoom: cfg.minzoom })}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbNiNotCovered")}</LegendNote>
  </div>;
}

const GB_SMALL_AREA_LEGEND_KEYS = {
  LSOA21: "legend.urban.gbSmallAreaLSOA21",
  DZ22: "legend.urban.gbSmallAreaDZ22",
  DZ21: "legend.urban.gbSmallAreaDZ21",
  SDZ21: "legend.urban.gbSmallAreaSDZ21",
} as const;

const GB_MARITIME_LEGEND_KEYS: Record<GbMaritimeLimitKind, MessageKey> = {
  baseline: "legend.urban.gbMaritimeBaseline",
  closing_line: "legend.urban.gbMaritimeClosingLine",
  six_nm: "legend.urban.gbMaritimeSixNm",
  territorial_sea: "legend.urban.gbMaritimeTerritorialSea",
  eez: "legend.urban.gbMaritimeEez",
  continental_shelf: "legend.urban.gbMaritimeContinentalShelf",
  boundary: "legend.urban.gbMaritimeBoundary",
  median_line: "legend.urban.gbMaritimeMedianLine",
  national_limit: "legend.urban.gbMaritimeNationalLimit",
};

const GB_GREENSPACE_LEGEND_FN_KEYS: Record<GbGreenspaceFunctionId, MessageKey> = {
  Park: "legend.urban.gbFnPark", Play: "legend.urban.gbFnPlay", Allotment: "legend.urban.gbFnAllotment",
  PlayingField: "legend.urban.gbFnPlayingField", OtherSports: "legend.urban.gbFnOtherSports", Tennis: "legend.urban.gbFnTennis",
  Bowling: "legend.urban.gbFnBowling", Golf: "legend.urban.gbFnGolf", Cemetery: "legend.urban.gbFnCemetery", Religious: "legend.urban.gbFnReligious",
};

const GB_GREENSPACE_TITLE_KEYS: Record<GbGreenspaceKey, MessageKey> = {
  gbGreenspace: "legend.urban.gbGreenspaceTitle",
  gbSportsFacilities: "legend.urban.gbSportsTitle",
  gbGolfCourses: "legend.urban.gbGolfTitle",
  gbCemeteries: "legend.urban.gbCemeteriesTitle",
};
