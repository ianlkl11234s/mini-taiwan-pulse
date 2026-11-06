// 加拿大第 3 波（環境氣候、災害）＋人口網格 popup。欄位規格 SSOT 在 data/caEnvTypes.ts 的 CA_*_POPUP；
// 畫法共用 caPanels 的 SpecPanel，來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { SpecPanel } from "./caPanels";
import { LIGHT_FEATURE, useFeatureTheme } from "./featureTheme";
import { caPopGridColors } from "../../hooks/useCaEnvLayers";
import { caText, type CaCat } from "../../data/caInfraTypes";
import { caQuakeLiveStatus } from "../../data/caLiveQuakesLoader";
import {
  CA_AQHI_COLOR, CA_AQHI_POPUP, CA_AQHI_SOURCE, CA_CLIMATE_POPUP, CA_CLIMATE_SOURCE, CA_CLIMATE_STATUSES, CA_ENV_FETCHED_AT, CA_NPRI_GROUPS,
  CA_NPRI_POPUP, CA_NPRI_SOURCE, CA_POP_GRID_BREAKS, CA_POP_GRID_POPUP, CA_POP_GRID_SOURCE, CA_QUAKE_COLOR, CA_QUAKE_LIVE_POPUP, CA_QUAKE_LIVE_SOURCE, CA_QUAKE_POPUP, CA_QUAKE_SOURCE,
  CA_RADIATION_COLOR, CA_RADIATION_POPUP, CA_RADIATION_SOURCE, CA_WSER_POPUP, CA_WSER_SOURCE, CA_WSER_STATUSES,
} from "../../data/caEnvTypes";

type P = { props: Record<string, unknown> };
const catColor = (cats: readonly CaCat[], v: unknown) => cats.find((c) => c.values.includes(caText(v)))?.color ?? cats[cats.length - 1]!.color;

export function CaClimateStationsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_CLIMATE_POPUP} source={CA_CLIMATE_SOURCE} color={catColor(CA_CLIMATE_STATUSES, props.status)} fetchedAt={CA_ENV_FETCHED_AT} />;
}

export function CaAqhiStationsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_AQHI_POPUP} source={CA_AQHI_SOURCE} color={CA_AQHI_COLOR} fetchedAt={CA_ENV_FETCHED_AT} />;
}

export function CaRadiationStationsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_RADIATION_POPUP} source={CA_RADIATION_SOURCE} color={CA_RADIATION_COLOR} fetchedAt={CA_ENV_FETCHED_AT} />;
}

export function CaNpriFacilitiesPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_NPRI_POPUP} source={CA_NPRI_SOURCE} color={catColor(CA_NPRI_GROUPS, props.sector_group)} fetchedAt={CA_ENV_FETCHED_AT} />;
}

export function CaWastewaterSystemsPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_WSER_POPUP} source={CA_WSER_SOURCE} color={catColor(CA_WSER_STATUSES, props.status)} fetchedAt={CA_ENV_FETCHED_AT} />;
}

export function CaEarthquakesPanel({ props }: P) {
  return <SpecPanel props={props} spec={CA_QUAKE_POPUP} source={CA_QUAKE_SOURCE} color={CA_QUAKE_COLOR} fetchedAt={CA_ENV_FETCHED_AT} />;
}

/** 即時地震：資料日期＝這份快照的抓取日（UTC）。 */
export function CaEarthquakesLivePanel({ props }: P) {
  const fetchedAt = caQuakeLiveStatus.get().fetchedAt?.slice(0, 10) ?? CA_ENV_FETCHED_AT;
  return <SpecPanel props={props} spec={CA_QUAKE_LIVE_POPUP} source={CA_QUAKE_LIVE_SOURCE} color={CA_QUAKE_COLOR} fetchedAt={fetchedAt} />;
}

/** 人口網格：標題色＝該格密度級距色（跟圖面同一組色盤）。 */
export function CaPopulationGridPanel({ props }: P) {
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const colors = caPopGridColors(isDark);
  const d = Number(caText(props.density));
  let idx = 0;
  if (Number.isFinite(d)) CA_POP_GRID_BREAKS.forEach((b, i) => { if (d >= b.min) idx = i; });
  return <SpecPanel props={props} spec={CA_POP_GRID_POPUP} source={CA_POP_GRID_SOURCE} color={colors[idx]!} fetchedAt={CA_ENV_FETCHED_AT} />;
}
