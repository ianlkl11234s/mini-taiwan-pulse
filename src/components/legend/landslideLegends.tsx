// 崩塌 4 層圖例（legendKit；色票與地圖 paint 同源，皆 import landslideTypes）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import {
  ANNUAL_MISSING_YEARS_NOTE, ANNUAL_V2_NOTE, ANNUAL_ZOOM_NOTE, DOD_RISK_OPTIONS, HIGHWAY_CATEGORY_GROUPS, LANDSLIDE_LAYER_COLORS,
} from "../../data/landslideTypes";

const DOD_NOTE = "年度版本 111–115 年逐年增加處數（36→94），不是同一組範圍；風險等級為來源分級，沒有數值警戒值。";

export function LandslideDodAreasLegend() {
  return <div>
    <LegendTitle zh="大規模崩塌潛勢區" en="Large-scale Landslide Areas" />
    {DOD_RISK_OPTIONS.map((option) => <LegendRow key={option.value} swatch={<SwatchSquare color={option.color} />}>{option.label}</LegendRow>)}
    <LegendNote>{DOD_NOTE}點開看保全住戶與聚落。農業部農村發展及水土保持署（data.gov.tw）· 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}

export function LandslideDodImpactLegend() {
  return <div>
    <LegendTitle zh="大規模崩塌影響範圍" en="Landslide Impact Zones" />
    {DOD_RISK_OPTIONS.map((option) => <LegendRow key={option.value} swatch={<SwatchLine color={option.color} dash={[3, 2]} />}>{option.label}</LegendRow>)}
    <LegendNote>與潛勢區共用年度版本選單；虛線外框＋淡色填色。{DOD_NOTE}</LegendNote>
  </div>;
}

export function HighwayDisasterHistoryLegend() {
  return <div>
    <LegendTitle zh="省道歷史災情" en="Highway Disaster History" />
    {HIGHWAY_CATEGORY_GROUPS.map((option) => <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>{option.label}</LegendRow>)}
    <LegendNote>2018 年起通報筆數暴增約 10 倍，疑為通報制度改變，不代表災害增加；跨年比較請留意。2026 年至 10/04 為不完整年度；未通報不等於沒有災情。低縮放以熱區顯示。交通部公路局（data.gov.tw 31020）· 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}

export function LandslideAnnualLegend() {
  return <div>
    <LegendTitle zh="年度全島崩塌地" en="Annual Landslide Inventory" />
    <LegendRow swatch={<SwatchSquare color={LANDSLIDE_LAYER_COLORS.landslideAnnual} />}>所選年份的崩塌地範圍</LegendRow>
    <LegendNote>{ANNUAL_ZOOM_NOTE}{ANNUAL_MISSING_YEARS_NOTE}{ANNUAL_V2_NOTE}農業部農村發展及水土保持署（衛星影像判釋）· 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}
