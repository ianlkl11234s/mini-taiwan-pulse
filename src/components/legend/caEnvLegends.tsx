// 加拿大第 3 波圖例（氣象站、AQHI、輻射監測站、NPRI、污水處理系統、歷史地震）＋人口網格。
// 色票、類別、備註與署名 SSOT 在 data/caEnvTypes.ts；未涵蓋的省份寫「未涵蓋」，人口網格標「GHSL 模型推估、非普查」。
import { useSyncExternalStore, type ReactNode } from "react";
import { caQuakeLiveStatus } from "../../data/caLiveQuakesLoader";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchSteps, useLegendTheme } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { usePaletteRamp } from "../../state/layerPalette";
import { JMA_QUAKE_RADIUS_STOPS } from "../../data/jmaTypes";
import { pickL3, type CaCat, type CaSource, type L3 } from "../../data/caInfraTypes";
import {
  CA_AQHI_COLOR, CA_AQHI_NOTES, CA_AQHI_SOURCE, CA_CLIMATE_NOTES, CA_CLIMATE_SOURCE, CA_CLIMATE_STATUSES, CA_NPRI_GROUPS, CA_NPRI_NOTES,
  CA_NPRI_SOURCE, CA_POP_GRID_BREAKS, CA_POP_GRID_NOTES, CA_POP_GRID_SOURCE, CA_QUAKE_COLOR, CA_QUAKE_LIVE_DAYS, CA_QUAKE_LIVE_NOTES, CA_QUAKE_LIVE_SOURCE, CA_QUAKE_LIVE_TYPES, CA_QUAKE_NOTES, CA_QUAKE_SOURCE,
  CA_RADIATION_COLOR, CA_RADIATION_NOTES, CA_RADIATION_SOURCE, CA_WSER_BANDS, CA_WSER_NOTES, CA_WSER_SOURCE, CA_WSER_STATUSES,
} from "../../data/caEnvTypes";

function useTitle(key: string): { title: string; pick: (t: L3) => string } {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return { title: name ? localizeLayerName(key, name, i18n).primary : key, pick: (t: L3) => pickL3(t, i18n.locale) };
}
const SUB = (text: string): ReactNode => <LegendTitle zh={text} style={{ marginTop: 6, marginBottom: 2 }} />;
function Cats({ cats, pick }: { cats: readonly CaCat[]; pick: (t: L3) => string }) {
  return <>{cats.map((c) => <LegendRow key={c.id} swatch={<SwatchDot color={c.color} />}>{pick(c.label)}</LegendRow>)}</>;
}
function Notes({ notes, source, pick }: { notes: readonly L3[]; source: CaSource; pick: (t: L3) => string }) {
  return <>
    {notes.map((n, i) => <LegendNote key={i}>{pick(n)}</LegendNote>)}
    <LegendNote>{source.short}</LegendNote>
  </>;
}

export function CaClimateStationsLegend() {
  const { title, pick } = useTitle("caClimateStations");
  return <div>
    <LegendTitle zh={title} />
    <Cats cats={CA_CLIMATE_STATUSES} pick={pick} />
    <Notes notes={CA_CLIMATE_NOTES} source={CA_CLIMATE_SOURCE} pick={pick} />
  </div>;
}

export function CaAqhiStationsLegend() {
  const { title, pick } = useTitle("caAqhiStations");
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchDot color={CA_AQHI_COLOR} />}>{pick({ zh: "AQHI 發布地點", en: "AQHI location", ja: "AQHI 発表地点" })}</LegendRow>
    <Notes notes={CA_AQHI_NOTES} source={CA_AQHI_SOURCE} pick={pick} />
  </div>;
}

export function CaRadiationStationsLegend() {
  const { title, pick } = useTitle("caRadiationStations");
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchDot color={CA_RADIATION_COLOR} />}>{pick({ zh: "CRMN 監測站", en: "CRMN station", ja: "CRMN 監視局" })}</LegendRow>
    <Notes notes={CA_RADIATION_NOTES} source={CA_RADIATION_SOURCE} pick={pick} />
  </div>;
}

export function CaNpriFacilitiesLegend() {
  const { title, pick } = useTitle("caNpriFacilities");
  return <div>
    <LegendTitle zh={title} />
    {SUB(pick({ zh: "產業群（z10 起點色）", en: "Sector group (point colour from z10)", ja: "業種グループ（z10 から点の色）" }))}
    <Cats cats={CA_NPRI_GROUPS} pick={pick} />
    <Notes notes={CA_NPRI_NOTES} source={CA_NPRI_SOURCE} pick={pick} />
    <DenseHeatmapLegendRow layers={["caNpriFacilities"]} />
  </div>;
}

export function CaWastewaterSystemsLegend() {
  const { title, pick } = useTitle("caWastewaterSystems");
  return <div>
    <LegendTitle zh={title} />
    <Cats cats={CA_WSER_STATUSES} pick={pick} />
    <LegendSizeRow fill={CA_WSER_STATUSES[0]!.color} title={pick({ zh: "日均放流量（m³）", en: "Average daily effluent (m³)", ja: "日平均放流量（m³）" })} items={CA_WSER_BANDS.map((b) => ({ r: b.radius, label: b.label }))} />
    <Notes notes={CA_WSER_NOTES} source={CA_WSER_SOURCE} pick={pick} />
  </div>;
}

export function CaEarthquakesLegend() {
  const { title, pick } = useTitle("caEarthquakes");
  return <div>
    <LegendTitle zh={`${title}（1985–2019）`} />
    <LegendSizeRow fill={CA_QUAKE_COLOR} title={pick({ zh: "規模", en: "Magnitude", ja: "マグニチュード" })} items={JMA_QUAKE_RADIUS_STOPS.map(([m, px]) => ({ r: px, label: `M${m}` }))} />
    <Notes notes={CA_QUAKE_NOTES} source={CA_QUAKE_SOURCE} pick={pick} />
    <DenseHeatmapLegendRow layers={["caEarthquakes"]} />
  </div>;
}

/** 即時地震：筆數與最新事件讀 loader 狀態 store；失敗時寫原因（圖面已清空，不留舊資料）。 */
export function CaEarthquakesLiveLegend() {
  const { title, pick } = useTitle("caEarthquakesLive");
  const st = useSyncExternalStore(caQuakeLiveStatus.subscribe, caQuakeLiveStatus.get);
  const status = st.state === "error"
    ? pick({ zh: `讀取失敗（${st.error}），稍後自動重試`, en: `Failed to load (${st.error}); retrying automatically`, ja: `読み込み失敗（${st.error}）、自動で再試行` })
    : st.state === "ready"
      ? pick({
        zh: `最近 ${CA_QUAKE_LIVE_DAYS} 天 ${st.count.toLocaleString("en-US")} 筆${st.latest ? `；最新 ${st.latest.slice(0, 16).replace("T", " ")} UTC` : ""}`,
        en: `${st.count.toLocaleString("en-US")} events in the last ${CA_QUAKE_LIVE_DAYS} days${st.latest ? `; latest ${st.latest.slice(0, 16).replace("T", " ")} UTC` : ""}`,
        ja: `直近 ${CA_QUAKE_LIVE_DAYS} 日 ${st.count.toLocaleString("en-US")} 件${st.latest ? `、最新 ${st.latest.slice(0, 16).replace("T", " ")} UTC` : ""}`,
      })
      : pick({ zh: "載入中…", en: "Loading…", ja: "読み込み中…" });
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{status}</LegendNote>
    <LegendSizeRow fill={CA_QUAKE_COLOR} title={pick({ zh: "規模", en: "Magnitude", ja: "マグニチュード" })} items={JMA_QUAKE_RADIUS_STOPS.map(([m, px]) => ({ r: px, label: `M${m}` }))} />
    {SUB(pick({ zh: "事件類型（可在圖層設定篩選）", en: "Event type (filter in layer settings)", ja: "種別（レイヤー設定で絞り込み）" }))}
    <Cats cats={CA_QUAKE_LIVE_TYPES} pick={pick} />
    <Notes notes={CA_QUAKE_LIVE_NOTES} source={CA_QUAKE_LIVE_SOURCE} pick={pick} />
  </div>;
}

export function CaPopulationGridLegend() {
  const { title, pick } = useTitle("caPopulationGrid");
  const t = useLegendTheme();
  const colors = usePaletteRamp("caPopulationGrid", t.isDark, CA_POP_GRID_BREAKS.length);
  return <div>
    <LegendTitle zh={title} />
    {SUB(pick({ zh: "人口密度（人／km²）", en: "Population density (per km²)", ja: "人口密度（人／km²）" }))}
    <SwatchSteps colors={colors} breaks={[...CA_POP_GRID_BREAKS.map((b) => b.min.toLocaleString("en-US")), "+"]} />
    <Notes notes={CA_POP_GRID_NOTES} source={CA_POP_GRID_SOURCE} pick={pick} />
  </div>;
}
