// 菲律賓圖例（2026-11-13 第 0–1 波）：行政邊界、人口密度（未涵蓋＝灰）、規格驅動 8 層。SSOT：data/phDataLayers.ts。
import { useSyncExternalStore, type ReactNode } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme, LegendRestrictions } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  PH_ADMIN_NOTES, PH_DENSITY_LABELS, PH_NOT_COVERED_COLOR, PH_POPULATION_NOTES, PH_POPULATION_SOURCE,
  PH_SPEC_BY_KEY, phText, pickL3, type PhCat, type PhLayerSpec,
} from "../../data/phDataLayers";
import type { PhDataKey, PhRasterKey } from "../../data/phDataKeys";
import { PH_RASTER_BY_KEY } from "../../data/phWavesLayers";
import { phDensityColors } from "../../hooks/usePhLayers";
import { FONT_SIZE } from "../../styles/designTokens";
import { MICRO_SENSOR_PM25_BANDS } from "../../data/microSensorTypes";
import { PH_OPENAQ_HIDE_AFTER_DAYS, PH_OPENAQ_MONITOR_RING, PH_OPENAQ_NO_DATA_COLOR, PH_OPENAQ_NOTES, phOpenaqStatus } from "../../data/openaqLoader";
import { PH_OPENAQ_STALE_FACTOR } from "../../hooks/usePhOpenaqAirLayer";
import type { L3 } from "../../data/caInfraTypes";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function PhAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("phAdminBoundaries");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pickL3({ zh: "行政區界（區域、省、市鎮、村里擇一）", en: "Boundary (region / province / city-municipality / barangay)", ja: "行政区域界（地方・州・市町・バランガイから選択）" }, locale)}</LegendRow>
    {PH_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

export function PhPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("phPopulation");
  const t = useLegendTheme();
  const colors = phDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²）", en: "Population density (people/km²)", ja: "人口密度（人／km²）" }, locale)}</LegendNote>
    {PH_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={PH_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {PH_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(PH_POPULATION_SOURCE.short, locale)}</LegendNote>
  </div>;
}

function catSwatch(spec: PhLayerSpec<string>, c: PhCat | null, color: string): ReactNode {
  const parts = c?.parts ? spec.parts.filter((p) => c.parts!.includes(p.id)) : spec.parts;
  const part = parts[0]!;
  if (part.geom === "fill") return <SwatchSquare color={color} outline={part.fillOpacity === 0} />;
  if (part.geom === "point" && part.hollow && !part.hollow.when) return <SwatchDot color={color} opacity={0} stroke={color} strokeWidth={1.5} />;
  if (part.geom === "line") return <SwatchLine color={color} width={LINE_WIDTH.standard[1]} dash={part.dashed ? [2, 1.5] : undefined} />;
  return <SwatchDot color={color} />;
}

/** 規格驅動 8 層：分類列（線／點依子圖層）、大小級距、白框補缺、備註、署名。 */
export function PhDataLegend({ layerKey }: { layerKey: PhDataKey }) {
  return <PhSpecLegend spec={PH_SPEC_BY_KEY[layerKey]} />;
}

/** 依規格畫圖例（他國重用，2026-11-13 越南）；`extraParts`：同一層另有其他 PMTiles 的子圖層（署名在圖層「說明・來源」）。 */
export function PhSpecLegend({ spec, extraParts = [] }: { spec: PhLayerSpec<string>; extraParts?: PhLayerSpec<string>["parts"] }) {
  const { locale } = useLocale();
  const title = useLayerTitle(spec.key);
  const all = { ...spec, parts: [...spec.parts, ...extraParts] };
  const ring = all.parts.find((p) => p.ring)?.ring;
  const dashed = all.parts.find((p) => p.dashed);
  // 部分空心（`when` 條件）另列一行說明；整層空心已由分類列的 swatch 表示
  const hollow = all.parts.find((p) => p.hollow?.when)?.hollow;
  return <div>
    <LegendTitle zh={spec.legendTitleNote ? `${title}（${pickL3(spec.legendTitleNote, locale)}）` : title} />
    {spec.cats.map((c) => <LegendRow key={c.id} swatch={catSwatch(all, c, c.color)}>{pickL3(c.label, locale)}</LegendRow>)}
    {spec.otherLabel ? <LegendRow swatch={catSwatch(all, null, spec.otherColor ?? spec.color)}>{pickL3(spec.otherLabel, locale)}</LegendRow> : null}
    {dashed && spec.dashLabel !== null ? <LegendRow swatch={<SwatchLine color={spec.color} width={LINE_WIDTH.standard[1]} dash={[2, 1.5]} />}>{pickL3(spec.dashLabel ?? { zh: "虛線：地下、海底電纜", en: "Dashed: underground / submarine cable", ja: "破線：地中・海底ケーブル" }, locale)}</LegendRow> : null}
    {spec.sizeLegend?.map((s) => <LegendSizeRow key={s.prop} title={pickL3(s.title, locale)} items={s.bands.map((b) => ({ r: b.radius, label: typeof b.label === "string" ? b.label : pickL3(b.label, locale) }))} fill={spec.color} numeric={s.bands.every((b) => typeof b.label === "string")} />)}
    {hollow ? <LegendRow swatch={<SwatchDot color={spec.color} opacity={0} stroke={spec.color} strokeWidth={1.5} />}>{pickL3(hollow.label, locale)}</LegendRow> : null}
    {ring ? <LegendRow swatch={<SwatchDot color={spec.color} stroke="#ffffff" strokeWidth={2} />}>{pickL3(ring.label, locale)}</LegendRow> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendRestrictions layers={[spec.key]} />
  </div>;
}

/** Raster 4 層（2026-11-16）：山體陰影畫明暗漸層，其餘照上游 color-relief 色帶分段。 */
export function PhRasterLegend({ layerKey }: { layerKey: PhRasterKey }) {
  const { locale } = useLocale();
  const spec = PH_RASTER_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  return <div>
    <LegendTitle zh={title} />
    {spec.steps
      ? <SwatchSteps colors={spec.steps.map((x) => x.color)} breaks={spec.steps.map((x) => x.label)} />
      : <SwatchGradient gradient="linear-gradient(90deg, #000000, #ffffff)" labels={[pickL3({ zh: "背光坡", en: "Shaded", ja: "陰" }, locale), pickL3({ zh: "向光坡", en: "Lit", ja: "陽" }, locale)]} />}
    {spec.notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

/**
 * 即時空品（OpenAQ）：PM2.5 五級色比照 LASS 微型感測（MICRO_SENSOR_PM25_BANDS），缺值灰＝無資料（不是 0）；
 * 低價感測器與官方監測站分開符號；過舊淡化；站數與錯誤讀 loader 狀態 store。
 */
export function PhOpenaqAirLegend() {
  const { locale } = useLocale();
  const pick = (x: L3) => pickL3(x, locale);
  const title = useLayerTitle("phOpenaqAir");
  const lt = useLegendTheme();
  const st = useSyncExternalStore(phOpenaqStatus.subscribe, phOpenaqStatus.get);
  const sm = st.summary;
  // 站數一行：圖例一律顯示（不是 LegendNote，popup 開著時也看得到；LG-9 只收起註記與來源）
  const shownLine = st.state === "error"
    ? pick({ zh: `讀取失敗（${st.error}），稍後自動重試`, en: `Failed to load (${st.error}); retrying automatically`, ja: `読み込み失敗（${st.error}）、自動で再試行` })
    : st.state === "ready" && sm
      ? pick({
        zh: `顯示 ${sm.shown} 站；隱藏 ${sm.hidden} 站（近 ${PH_OPENAQ_HIDE_AFTER_DAYS} 天無資料${sm.monitorsHidden > 0 ? `，含 ${sm.monitorsHidden} 個官方站` : ""}）`,
        en: `${sm.shown} shown; ${sm.hidden} hidden (no data in ${PH_OPENAQ_HIDE_AFTER_DAYS} days${sm.monitorsHidden > 0 ? `, incl. ${sm.monitorsHidden} official` : ""})`,
        ja: `表示 ${sm.shown} 局；非表示 ${sm.hidden} 局（直近 ${PH_OPENAQ_HIDE_AFTER_DAYS} 日データなし${sm.monitorsHidden > 0 ? `、公式局 ${sm.monitorsHidden} を含む` : ""}）`,
      })
      : pick({ zh: "載入中…", en: "Loading…", ja: "読み込み中…" });
  const breakdown = st.state === "ready" && sm
    ? pick({ zh: `3 小時內 ${sm.fresh}、過舊 ${sm.stale}、無 PM2.5 ${sm.noData}`, en: `Within 3 h ${sm.fresh}, stale ${sm.stale}, no PM2.5 ${sm.noData}`, ja: `3 時間以内 ${sm.fresh}、古い ${sm.stale}、PM2.5 なし ${sm.noData}` })
    : null;
  const line = (text: string) => <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: lt.textDim, lineHeight: 1.4 }}>{text}</div>;
  return <div>
    <LegendTitle zh={title} />
    {line(shownLine)}
    {breakdown ? <LegendNote>{breakdown}</LegendNote> : null}
    <LegendNote>PM2.5（µg/m³）</LegendNote>
    {MICRO_SENSOR_PM25_BANDS.map((b) => <LegendRow key={b.label} swatch={<SwatchDot color={b.color} />}>{b.label}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={PH_OPENAQ_NO_DATA_COLOR} />}>{pick({ zh: "無資料（不是 0）", en: "No data (not zero)", ja: "データなし（0 ではない）" })}</LegendRow>
    <LegendRow swatch={<SwatchDot color={MICRO_SENSOR_PM25_BANDS[1]!.color} opacity={0.9 * PH_OPENAQ_STALE_FACTOR} />}>{pick({ zh: "淡色：超過 3 小時未更新", en: "Faded: not updated for 3+ hours", ja: "淡色：3 時間以上未更新" })}</LegendRow>
    <LegendRow swatch={<SwatchDot color={MICRO_SENSOR_PM25_BANDS[0]!.color} stroke={PH_OPENAQ_MONITOR_RING} strokeWidth={2} />}>{pick({ zh: "官方監測站（白框）", en: "Official monitor (white ring)", ja: "公式測定局（白枠）" })}</LegendRow>
    {/* 低價感測器不畫色點（會被誤讀成 0–15 那一級）；改一行說明，popup 開著時也顯示 */}
    {line(pick({ zh: "多為低價感測器、非官方測站，數值未經校正", en: "Mostly low-cost sensors, not official monitors; readings are uncalibrated", ja: "主に低価格センサーで公式測定局ではなく、値は未校正" }))}
    {PH_OPENAQ_NOTES.map((n, i) => <LegendNote key={i}>{pick(n)}</LegendNote>)}
  </div>;
}
