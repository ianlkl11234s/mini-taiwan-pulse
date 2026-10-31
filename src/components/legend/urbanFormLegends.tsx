// Legend sub-components (urbanFormLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { BOUNDARY_GRAY, LINE_DASH, LINE_WIDTH, mapSeamColor } from "../../map/mapStyleScale";
import { KR_ADMIN_ATTRIBUTION_SHORT, KR_ADMIN_VERSION } from "../../data/krAdminTypes";
import { GB_LAD_ATTRIBUTION, GB_LAD_VERSION, GB_SMALL_AREA_TYPES } from "../../data/gbAdminTypes";
import { GB_MARITIME_ATTRIBUTION, GB_MARITIME_LIMIT_TYPES, GB_MARITIME_SOURCE_DATE, gbMaritimeLimitColor, type GbMaritimeLimitKind } from "../../data/gbMaritimeLimitTypes";
import { GB_BUILT_UP_COLOR, GB_BUILT_UP_VERSION, GB_GREENSPACE_CATEGORIES, GB_GREENSPACE_VERSION, GB_OS_ATTRIBUTION, type GbGreenspaceFunctionId, type GbGreenspaceKey } from "../../data/gbOpenSpaceTypes";
import { usePaletteRamp } from "../../state/layerPalette";
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { jpHeightCatalogStore } from "../../map/jpHeightLifecycle";
import { getLoadedJpHeightCatalog } from "../../data/jpHeightCatalog";
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { ECO_NETWORK_ZONE_TYPES } from "../../data/ecoNetworkZoneTypes";
import { RE_PALETTES } from "../../map/overlayRegistry";
import { jpPopulationMeshMode, jpPopulationMeshBuckets, JP_POPULATION_MESH_MASK, JP_POPULATION_MESH_RATIO65_DEFAULT_PALETTE } from "../../data/jpPopulationMeshModes";
import { STREET_TREE_SPECIES, STREET_TREE_OTHER_COLOR, STREET_TREE_DIAMETER_BANDS, STREET_TREE_HEIGHT_BANDS } from "../../data/streetTreeColors";
import { PROTECTED_TREE_AGE_BANDS, PROTECTED_TREE_CITIES, RIVERSIDE_TREE_SPECIES, RIVERSIDE_TREE_OTHER_COLOR, TAIPEI_PARK_CATEGORIES, URBAN_MISSING_COLOR, STREET_TREE_3EPOCH_TRAJ, CANOPY_HEIGHT_RAMP, STREET_TREE_NATIONAL_SPECIES, STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES } from "../../data/urbanOpenSpaceTypes";
import { CANOPY_GIANT_DIST_BANDS } from "../../data/canopyGiantsTypes";
import { BUILDING_HEIGHT_BANDS, BUILDING_SRC_LABELS, BUILDINGS_GBA_ATTRIBUTION, BUILDING_NIGHT_LEGEND } from "../../data/buildingsGbaTypes";
import { JP_BUILDING_HEIGHT_BANDS, JP_CANOPY_HEIGHT_RAMP } from "../../data/jpHeightTypes";
import { BUILDING_VALUE_BANDS, BUILDING_VALUE_NON_MARKET_COLOR, resolvePropertyValueScale, formatWanTwd, resolvePropertyValueGridMode, PROPERTY_VALUE_PER_CAPITA_BANDS, PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR, PROPERTY_VALUE_PER_CAPITA_MIN_POP } from "../../data/propertyValueTypes";
import { PROPERTY_VALUE_ADMIN_COLORS, PROPERTY_VALUE_ADMIN_LEVELS, PROPERTY_VALUE_ADMIN_MISSING_COLOR, formatPropertyValueTwd, resolvePropertyValueAdminLevel } from "../../data/propertyValueAdminTypes";
import { URBAN_FORM_GRID_MODES, URBAN_FORM_GRID_ATTRIBUTION_GBA, URBAN_FORM_GRID_ATTRIBUTION_META } from "../../data/urbanFormGridTypes";
import { URBAN_ZONING_CATEGORIES } from "../../data/urbanZoningTypes";
import { NON_URBAN_ZONING_CODES } from "../../data/nonUrbanZoningTypes";
import { DenseHeatmapLegendRow, FireCatRows, UrbanDotRow } from "./legendShared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName } from "../../i18n/placeText";
import type { MessageKey } from "../../i18n/keys";

type LocaleI18n = ReturnType<typeof useLocale>;

/** 資料表裡的中文標籤（級距、樹種、分區…）→ 目前語系；查不到原樣回傳（純數字／單位標籤本來就不用翻）。 */
const dataLabel = (zh: string, i18n: LocaleI18n) => enumLabel("legendUrban", zh, zh, i18n);

/**
 * 金額（元）→ 外文介面顯示：英文 million／billion／trillion，日文 万／億／兆（皆為新臺幣）。
 * 中文介面不經過這裡，沿用資料層 formatWanTwd／formatPropertyValueTwd。
 */
function formatNtd(ntd: number, i18n: LocaleI18n): string {
  const { t, active, formatNumber } = i18n;
  const fixed = (n: number, d: number) => formatNumber(n, { maximumFractionDigits: d });
  const auto = (n: number) => fixed(n, n < 100 ? 2 : n < 1000 ? 1 : 0);
  if (ntd >= 1e12) return t("legend.urban.amountHuge", { n: fixed(ntd / 1e12, 2) });
  if (active === "ja") {
    if (ntd >= 1e8) return t("legend.urban.amountLarge", { n: auto(ntd / 1e8) });
    if (ntd >= 1e4) return t("legend.urban.amountSmall", { n: formatNumber(Math.round(ntd / 1e4)) });
  } else {
    if (ntd >= 1e9) return t("legend.urban.amountLarge", { n: auto(ntd / 1e9) });
    if (ntd >= 1e6) return t("legend.urban.amountSmall", { n: formatNumber(ntd / 1e6, { maximumFractionDigits: 1 }) });
  }
  return t("legend.urban.amountDollar", { n: formatNumber(Math.round(ntd)) });
}

/** 萬元 → 顯示字串 */
function moneyWan(wan: number, i18n: LocaleI18n): string {
  if (i18n.active === "zh-TW") return formatWanTwd(wan);
  return Number.isFinite(wan) && wan > 0 ? formatNtd(wan * 1e4, i18n) : "";
}

/** 元 → 顯示字串（行政區總市值） */
function moneyYuan(value: number, i18n: LocaleI18n): string {
  if (i18n.active === "zh-TW") return formatPropertyValueTwd(value);
  return Number.isFinite(value) ? formatNtd(value, i18n) : i18n.t("legend.common.noData");
}

// ── 日本人口網格（9 種指標／年份，兩套色階隨 select 切換）──
// 斷點跨年份固定（見 data/jpPopulationMeshModes.ts）：同一個顏色在 2020 與 2070
// 代表同一個人數／比率級距，切年份才能真的看出人口消退。
// ratio65 多一列「未公開（遮罩）」—— 官方對極小人口 mesh 的年齡細分抹成 0，
// 那不是「最年輕」而是「查無資料」，圖例必須講明。

export function JpPopulationMeshLegend({ modeIdx }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const idx = modeIdx ?? 0;
  const mode = jpPopulationMeshMode(idx);
  const isRatio = mode.metric === "ratio65";
  const meshColors = usePaletteRamp("jpPopulationMesh1km", t.isDark, jpPopulationMeshBuckets(idx).length, undefined, isRatio ? JP_POPULATION_MESH_RATIO65_DEFAULT_PALETTE : undefined);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.jpMeshTitle", { mode: dataLabel(mode.label, i18n) })} en="人口メッシュ" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {isRatio ? i18n.t("legend.urban.jpMeshRatioHead") : i18n.t("legend.urban.jpMeshPopHead")}
      </div>
      <FireCatRows
        square
        cats={[
          ...jpPopulationMeshBuckets(idx, meshColors).map((b) => ({ color: b.color, label: dataLabel(b.label, i18n) })),
          ...(isRatio
            ? [{ color: JP_POPULATION_MESH_MASK.color, label: enumLabel("jpMeshMask", "masked", JP_POPULATION_MESH_MASK.label, i18n) }]
            : []),
        ]}
      />
    </div>
  );
}

// 行道樹變化圖例：依染色模式（0=狀態 1=樹種 2=胸徑 3=樹高）切換顯示內容。
// 色票資料 = src/data/streetTreeColors.ts（與 overlayRegistry 配色同一 SSOT）。
export function StreetTreesTaipeiDiffLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();

  // 一列圓點色塊 + 標籤
  const dotRow = (color: string, label: string) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SwatchDot color={color} opacity={0.9} />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{label}</span>
    </div>
  );

  let subhead: string = i18n.t("legend.urban.subStatus");
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = i18n.t("legend.urban.subSpeciesTop10");
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: dataLabel(s.name, i18n) })),
      { color: STREET_TREE_OTHER_COLOR, label: i18n.t("legend.urban.otherBilingual") },
    ];
  } else if (colorModeIdx === 2) {
    subhead = i18n.t("legend.urban.subDiameter");
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = i18n.t("legend.urban.subHeight");
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = [
      { color: "#2e7d32", label: i18n.t("legend.urban.diffPersisted") },
      { color: "#e53935", label: i18n.t("legend.urban.diffDisappeared") },
      { color: "#9ccc65", label: i18n.t("legend.urban.diffAppeared") },
    ];
  }

  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.streetTreeDiffTitle")} en="Street Tree Diff" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => dotRow(it.color, it.label))}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.diffNote")}
        </LegendNote>
      </div>
      <DenseHeatmapLegendRow layers={["streetTreesTaipeiDiff"]} />
    </div>
  );
}

// 受保護樹木圖例：依染色模式（0=樹齡 5 級冷→暖 1=城市 8 色）切換顯示內容。
export function ProtectedTreesNationalLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = colorModeIdx === 1
    ? PROTECTED_TREE_CITIES.map((c) => ({ color: c.color, label: placeName(c.name, i18n) }))
    : [
        ...PROTECTED_TREE_AGE_BANDS.map((b) => ({ color: b.color, label: dataLabel(b.label, i18n) })),
        { color: URBAN_MISSING_COLOR, label: i18n.t("legend.urban.ageUnknown") },
      ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.protectedTreesTitle")} en="Protected Trees" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {colorModeIdx === 1 ? i18n.t("legend.urban.subCity") : i18n.t("legend.urban.subAge")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.protectedSizeNote")}
        </LegendNote>
      </div>
    </div>
  );
}

// 河濱喬木圖例：樹種前 10 大 + 其他灰。
export function RiversideTreesTaipeiLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.riversideTitle")} en="Riverside Trees" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.urban.subSpeciesTop10")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RIVERSIDE_TREE_SPECIES.map((s) => <UrbanDotRow key={s.name} color={s.color} label={dataLabel(s.name, i18n)} />)}
        <UrbanDotRow color={RIVERSIDE_TREE_OTHER_COLOR} label={i18n.t("legend.urban.otherBilingual")} />
      </div>
      <DenseHeatmapLegendRow layers={["riversideTreesTaipei"]} />
    </div>
  );
}

// 行道樹三時點圖例：依染色模式（0=軌跡 7 類 1=樹種 2=胸徑 3=樹高）切換顯示內容。
// 軌跡色票 SSOT = urbanOpenSpaceTypes.ts；樹種/胸徑/樹高沿用 streetTreeColors.ts（跨層視覺可比）。
export function StreetTrees3epochLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  let subhead: string = i18n.t("legend.urban.subTraj");
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = i18n.t("legend.urban.subSpeciesTop10");
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: dataLabel(s.name, i18n) })),
      { color: STREET_TREE_OTHER_COLOR, label: i18n.t("legend.urban.otherBilingual") },
    ];
  } else if (colorModeIdx === 2) {
    subhead = i18n.t("legend.urban.subDiameter");
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = i18n.t("legend.urban.subHeight");
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = STREET_TREE_3EPOCH_TRAJ.map((c) => ({ color: c.color, label: `${enumLabel("urbanTreeTraj", c.code, c.label, i18n)} (${c.code})` }));
  }
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.street3Title")} en="Street Tree 3-Epoch" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
      </div>
      <DenseHeatmapLegendRow layers={["streetTreesTaipei3epoch"]} />
    </div>
  );
}

// 行道樹全國圖例：依染色模式（0=樹種前 10 大 1=胸徑 2=樹高 3=城市二色）切換顯示內容。
// 樹種/城市色票 SSOT = urbanOpenSpaceTypes.ts；胸徑/樹高沿用 streetTreeColors.ts（跨層視覺可比）。
export function StreetTreesNationalLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  let subhead: string = i18n.t("legend.urban.subSpeciesTop10");
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = i18n.t("legend.urban.subDiameter");
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 2) {
    subhead = i18n.t("legend.urban.subHeight");
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = i18n.t("legend.urban.subCity");
    rows = STREET_TREE_NATIONAL_CITIES.map((c) => ({ color: c.color, label: enumLabel("streetTreeCity", c.value, c.label, i18n) }));
  } else {
    rows = [
      ...STREET_TREE_NATIONAL_SPECIES.map((s) => ({ color: s.color, label: dataLabel(s.label, i18n) })),
      { color: STREET_TREE_OTHER_COLOR, label: i18n.t("legend.urban.otherBilingual") },
    ];
  }
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.streetNationalTitle")} en="Street Trees TW" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
      </div>
      <DenseHeatmapLegendRow layers={["streetTreesNational"]} />
    </div>
  );
}

// 人行道樹穴圖例：pit_type 二色（樹穴綠 / 花圃黃）。
export function TreePitsTaipeiLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.treePitsTitle")} en="Tree Pits" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.urban.subType")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TREE_PIT_TYPES.map((p) => <UrbanDotRow key={p.name} color={p.color} label={enumLabel("urbanPitType", p.name, p.name, i18n)} />)}
      </div>
    </div>
  );
}

// GBA 建物輪廓圖例：依顯示模式（0=高度分級 1=資料來源 2=3D 立體沿用高度色階 3=夜景燈光
// 4=估值）切換內容 + 必掛署名。估值模式額外掛實價登錄署名 + 非市場建物灰色說明。
export function BuildingsGbaLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const subhead = modeIdx === 4 ? i18n.t("legend.urban.subValue")
    : modeIdx === 3 ? i18n.t("legend.urban.subNight")
    : modeIdx === 1 ? i18n.t("legend.urban.subSource")
    : i18n.t("legend.urban.subHeightBare");
  const rows = modeIdx === 4
    ? BUILDING_VALUE_BANDS.map((b) => ({ color: b.color, label: dataLabel(b.label, i18n) }))
    : modeIdx === 3
    ? BUILDING_NIGHT_LEGEND.map((n) => ({ color: n.color, label: dataLabel(n.label, i18n) }))
    : modeIdx === 1
    ? BUILDING_SRC_LABELS.map((s) => ({ color: s.color, label: dataLabel(s.label, i18n) }))
    : BUILDING_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.buildingsTitle")} en="Buildings" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} square />)}
        {modeIdx === 4 && (
          <UrbanDotRow color={BUILDING_VALUE_NON_MARKET_COLOR} label={i18n.t("legend.urban.unvalued")} square />
        )}
      </div>
      {modeIdx === 3 && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.nightNote")}
        </LegendNote>
      )}
      {modeIdx === 4 && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.valueNote")}
        </LegendNote>
      )}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {modeIdx === 4 ? i18n.t("legend.urban.propertyValueAttribution") : BUILDINGS_GBA_ATTRIBUTION}
      </LegendNote>
    </div>
  );
}

export function PropertyValueAdminLegend({ levelIdx }: { levelIdx: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const level = resolvePropertyValueAdminLevel(levelIdx);
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  const bounds = [0, ...config.breaks];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.adminTitle", { level: dataLabel(config.label, i18n) })} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {PROPERTY_VALUE_ADMIN_COLORS.map((color, index) => {
          const lower = moneyYuan(bounds[index]!, i18n);
          const upper = config.breaks[index];
          return <LegendRow key={color} swatch={<SwatchSquare color={color} stroke={mapSeamColor(t.isDark)} />}>{upper ? i18n.t("legend.urban.adminRange", { lower, upper: moneyYuan(upper, i18n) }) : i18n.t("legend.urban.adminAbove", { lower })}</LegendRow>;
        })}
        <LegendRow swatch={<SwatchSquare color={PROPERTY_VALUE_ADMIN_MISSING_COLOR} stroke={mapSeamColor(t.isDark)} />}>{i18n.t("legend.urban.adminMissing")}</LegendRow>
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {level === "township" ? i18n.t("legend.urban.adminNoteTownship") : i18n.t("legend.urban.adminNoteCounty")}
      </LegendNote>
    </div>
  );
}

// 🏢 房地產總市值網格圖例：兩種上色模式（SSOT propertyValueTypes.ts）——
//   0 總市值：v_mkt 9 級 inferno，級距標籤與 3D 高度錨**隨手動選的網格大小換**
//     （粗格值域整體右移，共用細格斷點會全部爆頂）
//   1 人均市值：v_mkt/pop 8 級 viridis（僅 450m/1.5km；150m 磚無 pop，
//     resolvePropertyValueGridMode 會回退成總市值 → 圖例跟 paint 永遠同步）
export function PropertyValueGridLegend({ scaleIdx = 0, modeIdx = 0, extruded = false }: { scaleIdx?: number; modeIdx?: number; extruded?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const scale = resolvePropertyValueScale(scaleIdx);
  const perCapita = resolvePropertyValueGridMode(scaleIdx, modeIdx) === 1;
  const perCapitaColors = usePaletteRamp("propertyValueGrid", t.isDark, 8, "propertyValueGridPerCapitaPalette");
  const totalColors = usePaletteRamp("propertyValueGrid", t.isDark, 9, "propertyValueGridPalette");
  if (perCapita) {
    return (
      <div>
        <LegendTitle zh={i18n.t("legend.urban.perCapitaTitle", { scale: scale.shortLabel })} en="Per-Capita Value" />
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          {i18n.t("legend.urban.perCapitaHead", { scale: scale.shortLabel })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <UrbanDotRow color={PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR} label={i18n.t("legend.urban.lowPop", { min: PROPERTY_VALUE_PER_CAPITA_MIN_POP })} square />
          {PROPERTY_VALUE_PER_CAPITA_BANDS.map((b, i) => <UrbanDotRow key={b.label} color={perCapitaColors[i]!} label={dataLabel(b.label, i18n)} square />)}
        </div>
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.perCapitaNote")}
        </LegendNote>
        {extruded && (
          <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
            {i18n.t("legend.urban.perCapitaExtrudedNote")}
          </LegendNote>
        )}
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.propertyValueAttribution")}
        </LegendNote>
      </div>
    );
  }
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.totalTitle", { scale: scale.shortLabel })} en="Property Value" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {extruded ? i18n.t("legend.urban.gridHeadExtruded", { scale: scale.shortLabel }) : i18n.t("legend.urban.gridHead", { scale: scale.shortLabel })}
      </div>
      {/* 9 級（R7 色盤選單，預設 YlOrBr）：UrbanDotRow 的 swatch 自帶 1px 白 60% 細邊框 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <LegendRow swatch={<SwatchSquare color={totalColors[0]!} opacity={0.04} />}>{i18n.t("legend.urban.zeroCell")}</LegendRow>
        {scale.bands.map((b, i) => <UrbanDotRow key={b.label} color={totalColors[i]!} label={dataLabel(b.label, i18n)} square />)}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.gridNote", { scale: scale.shortLabel })}
      </LegendNote>
      {extruded && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.gridExtrudedNote", { floor: moneyWan(scale.heightFloorWan, i18n), max: moneyWan(scale.heightMaxWan, i18n) })}
        </LegendNote>
      )}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.propertyValueAttribution")}
      </LegendNote>
    </div>
  );
}

// 都市紋理網格圖例：依顯示模式（0-5）切換該模式的分級色帶；0 值格淡出的四個模式
// （棟數/平均高度/總量體/建蔽率）額外補一行「無建物」淡色說明。雙署名必掛（GBA + Meta/WRI）。
export function UrbanFormGridLegend({ modeIdx = 5 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const mode = URBAN_FORM_GRID_MODES[modeIdx] ?? URBAN_FORM_GRID_MODES[URBAN_FORM_GRID_MODES.length - 1]!;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.urbanFormTitle")} en="Urban Form" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{dataLabel(mode.label, i18n)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode.zeroFade && <UrbanDotRow color={t.textDim} label={i18n.t("legend.urban.urbanFormZero")} square />}
        {mode.bands.map((b) => <UrbanDotRow key={b.label} color={b.color} label={dataLabel(b.label, i18n)} square />)}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.urbanFormNote")}
      </LegendNote>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {URBAN_FORM_GRID_ATTRIBUTION_GBA}
      </LegendNote>
      <LegendNote style={{ lineHeight: 1.4 }}>
        {URBAN_FORM_GRID_ATTRIBUTION_META}
      </LegendNote>
    </div>
  );
}

// 土地使用分區圖例（北市 + 新北共用）：zone_category 9 類統一分色（色票 SSOT = urbanZoningTypes.ts）。
export function UrbanZoningLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.zoningTitle")} en="Zoning" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.urban.subCategory")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {URBAN_ZONING_CATEGORIES.map((c) => <UrbanDotRow key={c.value} color={c.color} label={enumLabel("urbanZoningCategory", c.value, c.label, i18n)} />)}
      </div>
    </div>
  );
}

// 非都市土地使用分區圖例：zone_code 11 碼（色票 SSOT = nonUrbanZoningTypes.ts）。
// 11 列單欄太長 → 兩欄排版；與都計分區同色系（農業黃綠 / 工業紫 / 保育綠 / 公設藍）。
export function NonUrbanZoningLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.nonUrbanTitle")} en="Non-Urban" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {NON_URBAN_ZONING_CODES.map((c) => (
          <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchSquare color={c.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{enumLabel("nonUrbanZoningCode", c.code, c.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.nonUrbanNote")}
      </LegendNote>
    </div>
  );
}

// 樹冠高度圖例：綠色漸層條 0m → 30m+（色帶與 raster PNG 預烤 colormap 一致）。
export function CanopyHeightLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.canopyTitle")} en="Canopy Height" />
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${CANOPY_HEIGHT_RAMP.join(", ")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
        <span>0 m</span>
        <span>40 m+</span>
      </div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.canopyRes")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        © Meta & WRI · Tolan et al. 2024 · CC-BY 4.0
      </LegendNote>
    </div>
  );
}

function JpHeightCoverageNote({ kind }: { kind: "buildings" | "canopy" }) {
  const i18n = useLocale();
  const state = useSyncExternalStore(jpHeightCatalogStore.subscribe, jpHeightCatalogStore.getSnapshot);
  const loaded = getLoadedJpHeightCatalog();
  const regions = loaded && loaded.status !== "unavailable"
    ? loaded.catalog.regions.filter((region) => region.status === "ready" && region[kind]) : [];
  const active = state.activeSourceIds.filter((id) => kind === "canopy" ? id.startsWith("jp-canopy-height") : id.startsWith("jp-building-height")).length;
  const canopyOverviewActive = kind === "canopy" && state.activeSourceIds.includes("jp-canopy-height--overview");
  const canopyOverview = loaded && loaded.status !== "unavailable" ? loaded.catalog.canopyOverview : undefined;
  const canopyResolution = canopyOverview?.pixelSizeProjectedM === undefined ? i18n.t("legend.urban.canopyResolutionUnknown") : i18n.t("legend.urban.canopyResolution", { m: canopyOverview.pixelSizeProjectedM });
  return <div style={{ fontSize: FONT_SIZE.xs, lineHeight: 1.5, marginTop: 5 }}>
    {state.status === "loading" ? i18n.t("legend.urban.jpCoverageLoading") : state.status === "unavailable" ? i18n.t("legend.urban.jpCoverageUnavailable", { error: state.error ?? i18n.t("legend.urban.jpCoverageRetry") }) : <>
      <div>{i18n.t("legend.urban.jpCoverageRegions", { regions: regions.length, active })}</div>
      <div>{regions.length === 0 ? i18n.t("legend.urban.jpCoverageNone") : i18n.t("legend.urban.jpCoverageList")}</div>
      {canopyOverviewActive && <div>{i18n.t("legend.urban.canopyOverview", { resolution: canopyResolution, coverage: canopyOverview?.coverage === "source-coverage" ? i18n.t("legend.urban.coverageSource") : i18n.t("legend.urban.coveragePartial") })}</div>}
      {state.error && <div>{state.error}</div>}
      {state.status === "legacy" && <div>{i18n.t("legend.urban.legacyCatalog")}</div>}
      {state.cappedRegionIds.length > 0 && <div>{i18n.t("legend.urban.cappedTiles", { count: state.cappedRegionIds.length })}</div>}
      {active === 0 && <div>{i18n.t("legend.urban.noTilesInView")}</div>}
      <div>{i18n.t("legend.urban.partialCoverageNote")}</div>
    </>}
  </div>;
}

export function JpBuildingHeightLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.jpBuildingTitle")} en="PLATEAU" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {JP_BUILDING_HEIGHT_BANDS.map((band) => <LegendRow key={band.label} swatch={<SwatchSquare color={band.color} />}>{band.label}</LegendRow>)}
        <LegendRow swatch={<SwatchSquare color="#9e9e9e" />}>{i18n.t("legend.urban.jpBuildingUnknown")}</LegendRow>
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.jpBuildingNote")}
      </LegendNote>
      <JpHeightCoverageNote kind="buildings" />
    </div>
  );
}

export function JpCanopyHeightLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.jpCanopyTitle")} en="CHMv2" />
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${JP_CANOPY_HEIGHT_RAMP.join(", ")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}><span>0 m</span><span>40 m+</span></div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.urban.jpCanopyNote")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>{i18n.t("legend.urban.jpCanopyDate")}</LegendNote>
      <JpHeightCoverageNote kind="canopy" />
    </div>
  );
}

// 樹冠巨木圖例：依離最近道路/步道/林道距離 5 級（近→遠 = 黃→深紅）。
export function CanopyGiantsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.giantsTitle")} en="Canopy Giants" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {i18n.t("legend.urban.giantsHead")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CANOPY_GIANT_DIST_BANDS.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.giantsNote")}
        </LegendNote>
      </div>
    </div>
  );
}

// 台北公園圖例：category 7 類。
export function ParksTaipeiLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.parksTitle")} en="Parks" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.urban.subCategory")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TAIPEI_PARK_CATEGORIES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={dataLabel(c.name, i18n)} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          {i18n.t("legend.urban.parksNote")}
        </LegendNote>
      </div>
    </div>
  );
}

export function EcoNetworkZonesLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.urban.ecoTitle")} en="Eco Network" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ECO_NETWORK_ZONE_TYPES.map((z) => (
          <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={z.color} stroke={THEMED_PAINT_COLORS.ecoNetworkOutline[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDefault }}>{dataLabel(z.label, i18n)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 房地產 Legend（3 類價格色帶，依開啟類別顯示；色票/domain 單一真實來源 = RE_PALETTES）──

const RE_LEGEND_ROWS: { keys: (keyof LayerVisibility)[]; labelKey: MessageKey; palette: "rental" | "sale" | "presale" }[] = [
  { keys: ["realEstateRentalGrid", "realEstateRentalPoint"], labelKey: "legend.urban.rePriceRental", palette: "rental" },
  { keys: ["realEstateSaleGrid", "realEstateSalePoint"], labelKey: "legend.urban.rePriceSale", palette: "sale" },
  { keys: ["realEstatePresaleGrid", "realEstatePresalePoint"], labelKey: "legend.urban.rePricePresale", palette: "presale" },
];

export function RealEstateLegend({ isDark = true, visibility, overlayParams }: { isDark?: boolean; visibility: LayerVisibility; overlayParams: Record<string, number> }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const excl = !!overlayParams.realEstateExcludeTaipei;
  const rentalGridColors = usePaletteRamp("realEstateRentalGrid", isDark, RE_PALETTES.rental.colors.length);
  const presaleGridColors = usePaletteRamp("realEstatePresaleGrid", isDark, RE_PALETTES.presale.colors.length);
  const active = RE_LEGEND_ROWS.filter((r) => r.keys.some((k) => visibility[k]));
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={excl ? i18n.t("legend.urban.reTitleExcl") : i18n.t("legend.urban.reTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map((r) => {
          const p = RE_PALETTES[r.palette];
          const [lo, hi] = excl ? p.domainExcl : p.domain;
          // R7：租賃／預售「網格」改讀色盤選單；3D 點仍是原色票。網格與點同時開 → 兩條色帶分開標
          const gridColors = r.palette === "rental" ? rentalGridColors : r.palette === "presale" ? presaleGridColors : null;
          const gridOn = !!gridColors && !!visibility[r.keys[0]!];
          const pointOn = !!visibility[r.keys[1]!];
          const bars: { tag: string; label: string; colors: readonly string[] }[] = [];
          if (gridOn) bars.push({ tag: "grid", label: i18n.t("legend.urban.reTagGrid"), colors: gridColors! });
          if (!gridColors || pointOn) bars.push({ tag: "point", label: i18n.t("legend.urban.reTagPoint"), colors: p.colors });
          return (
            <div key={r.palette}>
              <div style={{ fontSize: FONT_SIZE.xs, color: t.textDefault, marginBottom: 2 }}>{i18n.t(r.labelKey)}</div>
              {bars.map((b) => (
                <div key={b.tag} style={{ marginBottom: bars.length > 1 ? 3 : 0 }}>
                  {bars.length > 1 && <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{b.label}</div>}
                  <SwatchGradient gradient={`linear-gradient(to right, ${b.colors.join(", ")})`} stroke={mapSeamColor(isDark)} />
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 1 }}>
                <span>{lo.toLocaleString()}</span>
                <span>{hi.toLocaleString()}{excl ? "+" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 國土地理院 陰影起伏図（外部 raster）：單色地形陰影，文字說明即可。 */
export function JpGsiHillshadeLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.jpGsiHillshadeTitle")} />
    <LegendNote>{i18n.t("legend.urban.jpGsiHillshadeNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.jpGsiSource")}</LegendNote>
  </div>;
}

/** 國土地理院 色別標高図（外部 raster）：依標高著色，非精確數值。 */
export function JpGsiReliefLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.jpGsiReliefTitle")} />
    <LegendNote>{i18n.t("legend.urban.jpGsiReliefNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.jpGsiReliefSea")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.jpGsiSource")}</LegendNote>
  </div>;
}

/** 英國地方政府區 LAD（ONS May 2026）：單一中性灰界線，圖例只講範圍、版本與署名。 */
export function GbAdminBoundariesLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbLadTitle")} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{i18n.t("legend.urban.gbLadRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.urban.gbCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbDataVersion", { version: GB_LAD_VERSION })}</LegendNote>
    <LegendNote>{GB_LAD_ATTRIBUTION}</LegendNote>
  </div>;
}

const GB_SMALL_AREA_LEGEND_KEYS = {
  LSOA21: "legend.urban.gbSmallAreaLSOA21",
  DZ22: "legend.urban.gbSmallAreaDZ22",
  DZ21: "legend.urban.gbSmallAreaDZ21",
  SDZ21: "legend.urban.gbSmallAreaSDZ21",
} as const;

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
    {[...new Set(GB_SMALL_AREA_TYPES.map((type) => type.attribution))].map((text) => <LegendNote key={text}>{text}</LegendNote>)}
  </div>;
}

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
    <LegendNote>{i18n.t("legend.urban.gbDataVersion", { version: `UKHO ${GB_MARITIME_SOURCE_DATE}` })}</LegendNote>
    <LegendNote>{GB_MARITIME_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國建成區（OS Open Built Up Areas）：單一中性藍灰面。 */
export function GbBuiltUpAreasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.gbBuiltUpTitle")} />
    <LegendRow swatch={<SwatchSquare color={GB_BUILT_UP_COLOR} />}>{i18n.t("legend.urban.gbBuiltUpRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.urban.gbNiNotCovered")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbDataVersion", { version: GB_BUILT_UP_VERSION })}</LegendNote>
    <LegendNote>{GB_OS_ATTRIBUTION}</LegendNote>
  </div>;
}

const GB_GREENSPACE_LEGEND_FN_KEYS: Record<GbGreenspaceFunctionId, MessageKey> = {
  Park: "legend.urban.gbFnPark", Play: "legend.urban.gbFnPlay", Allotment: "legend.urban.gbFnAllotment",
  PlayingField: "legend.urban.gbFnPlayingField", OtherSports: "legend.urban.gbFnOtherSports", Tennis: "legend.urban.gbFnTennis",
  Bowling: "legend.urban.gbFnBowling", Golf: "legend.urban.gbFnGolf", Cemetery: "legend.urban.gbFnCemetery", Religious: "legend.urban.gbFnReligious",
};

const GB_GREENSPACE_TITLE_KEYS: Record<GbGreenspaceKey, MessageKey> = {
  gbGreenspace: "legend.urban.gbGreenspaceTitle",
  gbSportsFacilities: "legend.urban.gbSportsTitle",
  gbCemeteries: "legend.urban.gbCemeteriesTitle",
};

/** 英國綠地三層（OS Open Greenspace，同一檔依 category 拆層）：每層列自己的 function 類別。 */
export function GbGreenspaceLegend({ layerKey }: { layerKey: GbGreenspaceKey }) {
  const i18n = useLocale();
  const cfg = GB_GREENSPACE_CATEGORIES[layerKey];
  return <div>
    <LegendTitle zh={i18n.t(GB_GREENSPACE_TITLE_KEYS[layerKey])} />
    {cfg.functions.map((f) => (
      <LegendRow key={f.value} swatch={<SwatchSquare color={f.color} />}>{i18n.t(GB_GREENSPACE_LEGEND_FN_KEYS[f.id])}</LegendRow>
    ))}
    {layerKey === "gbSportsFacilities" ? <LegendRow swatch={<SwatchDot color={cfg.functions.find((f) => f.id === "Golf")!.color} />}>{i18n.t("legend.urban.gbGolfPoints")}</LegendRow> : null}
    <DenseHeatmapLegendRow layers={[layerKey]} />
    {layerKey === "gbCemeteries" ? <LegendNote>{i18n.t("legend.urban.gbReligiousNote")}</LegendNote> : null}
    <LegendNote>{i18n.t("legend.urban.gbGreenspaceZoom", { zoom: cfg.minzoom })}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbNiNotCovered")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbDataVersion", { version: GB_GREENSPACE_VERSION })}</LegendNote>
    <LegendNote>{GB_OS_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 南韓行政區界（admdongkor ver20261001）：單一中性灰界線，三層級共用；圖例講範圍、版本與署名。 */
export function KrAdminBoundariesLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={i18n.t("legend.urban.krAdminTitle")} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{i18n.t("legend.urban.krAdminRow")}</LegendRow>
    <LegendNote>{i18n.t("legend.urban.krCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.krEmdZoom")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.krDataVersion", { version: KR_ADMIN_VERSION })}</LegendNote>
    <LegendNote>{KR_ADMIN_ATTRIBUTION_SHORT}</LegendNote>
  </div>;
}
