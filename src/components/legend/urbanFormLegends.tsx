// Legend sub-components (urbanFormLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { mapSeamColor } from "../../map/mapStyleScale";
import { usePaletteRamp } from "../../state/layerPalette";
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { jpHeightCatalogStore } from "../../map/jpHeightLifecycle";
import { getLoadedJpHeightCatalog } from "../../data/jpHeightCatalog";
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchSquare, useLegendTheme } from "./legendKit";
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
import { BUILDING_VALUE_BANDS, BUILDING_VALUE_NON_MARKET_COLOR, PROPERTY_VALUE_ATTRIBUTION, resolvePropertyValueScale, formatWanTwd, resolvePropertyValueGridMode, PROPERTY_VALUE_PER_CAPITA_BANDS, PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR, PROPERTY_VALUE_PER_CAPITA_MIN_POP } from "../../data/propertyValueTypes";
import { PROPERTY_VALUE_ADMIN_COLORS, PROPERTY_VALUE_ADMIN_LEVELS, PROPERTY_VALUE_ADMIN_MISSING_COLOR, formatPropertyValueTwd, resolvePropertyValueAdminLevel } from "../../data/propertyValueAdminTypes";
import { URBAN_FORM_GRID_MODES, URBAN_FORM_GRID_ATTRIBUTION_GBA, URBAN_FORM_GRID_ATTRIBUTION_META } from "../../data/urbanFormGridTypes";
import { URBAN_ZONING_CATEGORIES } from "../../data/urbanZoningTypes";
import { NON_URBAN_ZONING_CODES } from "../../data/nonUrbanZoningTypes";
import { DenseHeatmapLegendRow, FireCatRows, UrbanDotRow } from "./legendShared";

// ── 日本人口網格（9 種指標／年份，兩套色階隨 select 切換）──
// 斷點跨年份固定（見 data/jpPopulationMeshModes.ts）：同一個顏色在 2020 與 2070
// 代表同一個人數／比率級距，切年份才能真的看出人口消退。
// ratio65 多一列「未公開（遮罩）」—— 官方對極小人口 mesh 的年齡細分抹成 0，
// 那不是「最年輕」而是「查無資料」，圖例必須講明。

export function JpPopulationMeshLegend({ modeIdx }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const idx = modeIdx ?? 0;
  const mode = jpPopulationMeshMode(idx);
  const isRatio = mode.metric === "ratio65";
  const meshColors = usePaletteRamp("jpPopulationMesh1km", t.isDark, jpPopulationMeshBuckets(idx).length, undefined, isRatio ? JP_POPULATION_MESH_RATIO65_DEFAULT_PALETTE : undefined);
  return (
    <div>
      <LegendTitle zh={`人口網格 · ${mode.label}`} en="人口メッシュ" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {isRatio ? "65 歲以上比率（1km 格）" : "總人口（人／1km 格）"}
      </div>
      <FireCatRows
        square
        cats={[
          ...jpPopulationMeshBuckets(idx, meshColors).map((b) => ({ color: b.color, label: b.label })),
          ...(isRatio
            ? [{ color: JP_POPULATION_MESH_MASK.color, label: JP_POPULATION_MESH_MASK.label }]
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

  // 一列圓點色塊 + 標籤
  const dotRow = (color: string, label: string) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SwatchDot color={color} opacity={0.9} />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{label}</span>
    </div>
  );

  let subhead = "狀態 STATUS";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "樹種 SPECIES（前 10 大）";
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: s.name })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  } else if (colorModeIdx === 2) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = [
      { color: "#2e7d32", label: "存續 persisted" },
      { color: "#e53935", label: "消失 disappeared" },
      { color: "#9ccc65", label: "新增 appeared" },
    ];
  }

  return (
    <div>
      <LegendTitle zh="行道樹變化" en="Street Tree Diff" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => dotRow(it.color, it.label))}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          半透明點 = 疑似重編號（非真消失/新增）
        </LegendNote>
      </div>
      <DenseHeatmapLegendRow layers={["streetTreesTaipeiDiff"]} />
    </div>
  );
}

// 受保護樹木圖例：依染色模式（0=樹齡 5 級冷→暖 1=城市 8 色）切換顯示內容。
export function ProtectedTreesNationalLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const rows = colorModeIdx === 1
    ? PROTECTED_TREE_CITIES.map((c) => ({ color: c.color, label: c.name }))
    : [
        ...PROTECTED_TREE_AGE_BANDS.map((b) => ({ color: b.color, label: b.label })),
        { color: URBAN_MISSING_COLOR, label: "樹齡未知" },
      ];
  return (
    <div>
      <LegendTitle zh="受保護樹木" en="Protected Trees" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {colorModeIdx === 1 ? "城市 CITY" : "推估樹齡 AGE"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          點大小 ∝ 胸徑 dbh
        </LegendNote>
      </div>
    </div>
  );
}

// 河濱喬木圖例：樹種前 10 大 + 其他灰。
export function RiversideTreesTaipeiLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="河濱喬木" en="Riverside Trees" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>樹種 SPECIES（前 10 大）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RIVERSIDE_TREE_SPECIES.map((s) => <UrbanDotRow key={s.name} color={s.color} label={s.name} />)}
        <UrbanDotRow color={RIVERSIDE_TREE_OTHER_COLOR} label="其他 Other" />
      </div>
      <DenseHeatmapLegendRow layers={["riversideTreesTaipei"]} />
    </div>
  );
}

// 行道樹三時點圖例：依染色模式（0=軌跡 7 類 1=樹種 2=胸徑 3=樹高）切換顯示內容。
// 軌跡色票 SSOT = urbanOpenSpaceTypes.ts；樹種/胸徑/樹高沿用 streetTreeColors.ts（跨層視覺可比）。
export function StreetTrees3epochLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  let subhead = "軌跡 TRAJECTORY（2022/2024/2026）";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "樹種 SPECIES（前 10 大）";
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: s.name })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  } else if (colorModeIdx === 2) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = STREET_TREE_3EPOCH_TRAJ.map((c) => ({ color: c.color, label: `${c.label} (${c.code})` }));
  }
  return (
    <div>
      <LegendTitle zh="行道樹三時點" en="Street Tree 3-Epoch" />
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
  let subhead = "樹種 SPECIES（前 10 大）";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 2) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "城市 CITY";
    rows = STREET_TREE_NATIONAL_CITIES.map((c) => ({ color: c.color, label: c.label }));
  } else {
    rows = [
      ...STREET_TREE_NATIONAL_SPECIES.map((s) => ({ color: s.color, label: s.label })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  }
  return (
    <div>
      <LegendTitle zh="行道樹全國" en="Street Trees TW" />
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
  return (
    <div>
      <LegendTitle zh="人行道樹穴" en="Tree Pits" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TREE_PIT_TYPES.map((p) => <UrbanDotRow key={p.name} color={p.color} label={p.name} />)}
      </div>
    </div>
  );
}

// GBA 建物輪廓圖例：依顯示模式（0=高度分級 1=資料來源 2=3D 立體沿用高度色階 3=夜景燈光
// 4=估值）切換內容 + 必掛署名。估值模式額外掛實價登錄署名 + 非市場建物灰色說明。
export function BuildingsGbaLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const subhead = modeIdx === 4 ? "估值 VALUE（單棟）"
    : modeIdx === 3 ? "夜景燈光 NIGHT LIGHTS"
    : modeIdx === 1 ? "資料來源 SOURCE"
    : "高度 HEIGHT";
  const rows = modeIdx === 4
    ? BUILDING_VALUE_BANDS.map((b) => ({ color: b.color, label: b.label }))
    : modeIdx === 3
    ? BUILDING_NIGHT_LEGEND
    : modeIdx === 1
    ? BUILDING_SRC_LABELS.map((s) => ({ color: s.color, label: s.label }))
    : BUILDING_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  return (
    <div>
      <LegendTitle zh="建物輪廓" en="Buildings" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} square />)}
        {modeIdx === 4 && (
          <UrbanDotRow color={BUILDING_VALUE_NON_MARKET_COLOR} label="未估值（非市場建物）" square />
        )}
      </div>
      {modeIdx === 3 && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          樓層越高光越亮 · 橘白交錯 · 建議搭深色底圖
        </LegendNote>
      )}
      {modeIdx === 4 && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          房+地合計市值（土地價已含在實價單價內）· 全台市場合計 ≈ 204 兆 · z13+ 才可逐棟看
        </LegendNote>
      )}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {modeIdx === 4 ? PROPERTY_VALUE_ATTRIBUTION : BUILDINGS_GBA_ATTRIBUTION}
      </LegendNote>
    </div>
  );
}

export function PropertyValueAdminLegend({ levelIdx }: { levelIdx: number }) {
  const t = useLegendTheme();
  const level = resolvePropertyValueAdminLevel(levelIdx);
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  const bounds = [0, ...config.breaks];
  return (
    <div>
      <LegendTitle zh={`不動產總市值 · ${config.label}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {PROPERTY_VALUE_ADMIN_COLORS.map((color, index) => {
          const lower = formatPropertyValueTwd(bounds[index]!);
          const upper = config.breaks[index];
          return <LegendRow key={color} swatch={<SwatchSquare color={color} stroke={mapSeamColor(t.isDark)} />}>{upper ? `${lower} – < ${formatPropertyValueTwd(upper)}` : `${lower} 以上`}</LegendRow>;
        })}
        <LegendRow swatch={<SwatchSquare color={PROPERTY_VALUE_ADMIN_MISSING_COLOR} stroke={mapSeamColor(t.isDark)} />}>來源缺值（不是 0）</LegendRow>
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        市場交易建物模型估值聚合；{level === "township" ? "鄉鎮市區界自 z6 顯示。" : "19 / 22 縣市有數值。"}
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
  const scale = resolvePropertyValueScale(scaleIdx);
  const perCapita = resolvePropertyValueGridMode(scaleIdx, modeIdx) === 1;
  const perCapitaColors = usePaletteRamp("propertyValueGrid", t.isDark, 8, "propertyValueGridPerCapitaPalette");
  const totalColors = usePaletteRamp("propertyValueGrid", t.isDark, 9, "propertyValueGridPalette");
  if (perCapita) {
    return (
      <div>
        <LegendTitle zh={`人均市值網格 · ${scale.shortLabel}`} en="Per-Capita Value" />
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          每 {scale.shortLabel} 格總市值 ÷ 人口（萬元/人）
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <UrbanDotRow color={PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR} label={`人口 < ${PROPERTY_VALUE_PER_CAPITA_MIN_POP}（統計不可靠，半透明）`} square />
          {PROPERTY_VALUE_PER_CAPITA_BANDS.map((b, i) => <UrbanDotRow key={b.label} color={perCapitaColors[i]!} label={b.label} square />)}
        </div>
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          越往高階 = 平均每人名下壓的房產越多（人少錢多）；越往低階 = 人多攤薄。
          人口為最小統計區面積加權估計。
        </LegendNote>
        {extruded && (
          <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
            3D 高度仍是「總市值」（量體）、顏色才是人均（強度）—— 高而高階色 = 人少錢多、高而低階色 = 人多攤薄。
          </LegendNote>
        )}
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          {PROPERTY_VALUE_ATTRIBUTION}
        </LegendNote>
      </div>
    );
  }
  return (
    <div>
      <LegendTitle zh={`不動產總市值網格 · ${scale.shortLabel}`} en="Property Value" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        每 {scale.shortLabel} 格總市值（不是單價）{extruded ? " · 3D 高度同步" : ""}
      </div>
      {/* 9 級（R7 色盤選單，預設 YlOrBr）：UrbanDotRow 的 swatch 自帶 1px 白 60% 細邊框 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <LegendRow swatch={<SwatchSquare color={totalColors[0]!} opacity={0.04} />}>0（格內僅非市場建物，淡出顯示）</LegendRow>
        {scale.bands.map((b, i) => <UrbanDotRow key={b.label} color={totalColors[i]!} label={b.label} square />)}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        越往高階 = 這 {scale.shortLabel} 內壓了越多錢（量體 × 單價）。
        想看「每 m² 多貴」請開房地產買賣熱力圖。
      </LegendNote>
      {extruded && (
        <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
          高度：≤ {formatWanTwd(scale.heightFloorWan)}貼地、全台最高格（{formatWanTwd(scale.heightMaxWan)}）滿格，
          不封頂 —— 極端值直接刺出來。顏色看分佈、高度看極值。
          對比 γ 調中低值高度、整體高度調滿格公尺數。
        </LegendNote>
      )}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {PROPERTY_VALUE_ATTRIBUTION}
      </LegendNote>
    </div>
  );
}

// 都市紋理網格圖例：依顯示模式（0-5）切換該模式的分級色帶；0 值格淡出的四個模式
// （棟數/平均高度/總量體/建蔽率）額外補一行「無建物」淡色說明。雙署名必掛（GBA + Meta/WRI）。
export function UrbanFormGridLegend({ modeIdx = 5 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const mode = URBAN_FORM_GRID_MODES[modeIdx] ?? URBAN_FORM_GRID_MODES[URBAN_FORM_GRID_MODES.length - 1]!;
  return (
    <div>
      <LegendTitle zh="都市紋理網格" en="Urban Form" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{mode.label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode.zeroFade && <UrbanDotRow color={t.textDim} label="0（無建物，淡出顯示）" square />}
        {mode.bands.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} square />)}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        500m 網格統計，建物 centroid 歸屬 + 樹冠 ≥3m 閾值之近似值
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
  return (
    <div>
      <LegendTitle zh="土地使用分區" en="Zoning" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {URBAN_ZONING_CATEGORIES.map((c) => <UrbanDotRow key={c.value} color={c.color} label={c.label} />)}
      </div>
    </div>
  );
}

// 非都市土地使用分區圖例：zone_code 11 碼（色票 SSOT = nonUrbanZoningTypes.ts）。
// 11 列單欄太長 → 兩欄排版；與都計分區同色系（農業黃綠 / 工業紫 / 保育綠 / 公設藍）。
export function NonUrbanZoningLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="非都市土地使用分區" en="Non-Urban" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {NON_URBAN_ZONING_CODES.map((c) => (
          <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchSquare color={c.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{c.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        18 縣市（北市・嘉義市全境都市計畫故無）；與都計分區互補成全國拼圖
      </LegendNote>
    </div>
  );
}

// 樹冠高度圖例：綠色漸層條 0m → 30m+（色帶與 raster PNG 預烤 colormap 一致）。
export function CanopyHeightLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="樹冠高度" en="Canopy Height" />
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${CANOPY_HEIGHT_RAMP.join(", ")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
        <span>0 m</span>
        <span>40 m+</span>
      </div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        Meta/WRI 2024 · ~20m 解析度
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        © Meta & WRI · Tolan et al. 2024 · CC-BY 4.0
      </LegendNote>
    </div>
  );
}

function JpHeightCoverageNote({ kind }: { kind: "buildings" | "canopy" }) {
  const state = useSyncExternalStore(jpHeightCatalogStore.subscribe, jpHeightCatalogStore.getSnapshot);
  const loaded = getLoadedJpHeightCatalog();
  const regions = loaded && loaded.status !== "unavailable"
    ? loaded.catalog.regions.filter((region) => region.status === "ready" && region[kind]) : [];
  const active = state.activeSourceIds.filter((id) => kind === "canopy" ? id.startsWith("jp-canopy-height") : id.startsWith("jp-building-height")).length;
  const canopyOverviewActive = kind === "canopy" && state.activeSourceIds.includes("jp-canopy-height--overview");
  const canopyOverview = loaded && loaded.status !== "unavailable" ? loaded.catalog.canopyOverview : undefined;
  const canopyResolution = canopyOverview?.pixelSizeProjectedM === undefined ? "解析度未提供" : `約 ${canopyOverview.pixelSizeProjectedM} m 投影像素`;
  return <div style={{ fontSize: FONT_SIZE.xs, lineHeight: 1.5, marginTop: 5 }}>
    {state.status === "loading" ? "正在讀取日本資料覆蓋清冊…" : state.status === "unavailable" ? `覆蓋清冊無法載入：${state.error ?? "請重試"}` : <>
      <div>已接入 {regions.length} 個區域 · 目前顯示 {active} 個分片</div>
      <div>{regions.length === 0 ? "尚無可用分片" : "區域清單依目前視野與點擊資訊顯示"}</div>
      {canopyOverviewActive && <div>目前使用樹冠概覽補足無區域 detail 的視野；{canopyResolution}，{canopyOverview?.coverage === "source-coverage" ? "來源涵蓋範圍" : "部分區域覆蓋"}。</div>}
      {state.error && <div>{state.error}</div>}
      {state.status === "legacy" && <div>清冊尚未安裝，目前僅使用東京本地試點。</div>}
      {state.cappedRegionIds.length > 0 && <div>目前視野還有 {state.cappedRegionIds.length} 個分片未載入；請放大地圖查看，不會把缺片當成無建物。</div>}
      {active === 0 && <div>目前視野或縮放沒有可顯示的已處理資料。</div>}
      <div>各區僅部分覆蓋；空白不代表沒有建物或樹木。</div>
    </>}
  </div>;
}

export function JpBuildingHeightLegend() {
  return (
    <div>
      <LegendTitle zh="建物高度" en="PLATEAU" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {JP_BUILDING_HEIGHT_BANDS.map((band) => <LegendRow key={band.label} swatch={<SwatchSquare color={band.color} />}>{band.label}</LegendRow>)}
        <LegendRow swatch={<SwatchSquare color="#9e9e9e" />}>高度未提供：中性 2D 平面</LegendRow>
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        遠景：10km／1km／250m 網格的高度中位數；z13+：單棟建物輪廓。PLATEAU 各城市年度不同，詳見點擊資訊。
      </LegendNote>
      <JpHeightCoverageNote kind="buildings" />
    </div>
  );
}

export function JpCanopyHeightLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="日本樹冠高度" en="CHMv2" />
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${JP_CANOPY_HEIGHT_RAMP.join(", ")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}><span>0 m</span><span>40 m+</span></div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        Meta/WRI CHMv2 2026 · 模型估計值 · 約 19.1 m 投影像素（非原始單木輪廓）
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>© Meta & WRI · CC BY 4.0 · 影像日期依地點而異</LegendNote>
      <JpHeightCoverageNote kind="canopy" />
    </div>
  );
}

// 樹冠巨木圖例：依離最近道路/步道/林道距離 5 級（近→遠 = 黃→深紅）。
export function CanopyGiantsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="樹冠巨木" en="Canopy Giants" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        離最近道路/步道/林道
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CANOPY_GIANT_DIST_BANDS.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          ≥ 45m 樹冠 · 7,823 點
        </LegendNote>
      </div>
    </div>
  );
}

// 台北公園圖例：category 7 類。
export function ParksTaipeiLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="公園" en="Parks" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TAIPEI_PARK_CATEGORIES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
        <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
          點大小 ∝ 面積（log）
        </LegendNote>
      </div>
    </div>
  );
}

export function EcoNetworkZonesLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="國土綠網分區" en="Eco Network" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ECO_NETWORK_ZONE_TYPES.map((z) => (
          <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={z.color} stroke={THEMED_PAINT_COLORS.ecoNetworkOutline[isDark ? "dark" : "light"]} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDefault }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 房地產 Legend（3 類價格色帶，依開啟類別顯示；色票/domain 單一真實來源 = RE_PALETTES）──

const RE_LEGEND_ROWS: { keys: (keyof LayerVisibility)[]; label: string; palette: "rental" | "sale" | "presale" }[] = [
  { keys: ["realEstateRentalGrid", "realEstateRentalPoint"], label: "🏠 租賃 單價", palette: "rental" },
  { keys: ["realEstateSaleGrid", "realEstateSalePoint"], label: "🏢 買賣 單價", palette: "sale" },
  { keys: ["realEstatePresaleGrid", "realEstatePresalePoint"], label: "🏗️ 預售 單價", palette: "presale" },
];

export function RealEstateLegend({ isDark = true, visibility, overlayParams }: { isDark?: boolean; visibility: LayerVisibility; overlayParams: Record<string, number> }) {
  const t = useLegendTheme();
  const excl = !!overlayParams.realEstateExcludeTaipei;
  const rentalGridColors = usePaletteRamp("realEstateRentalGrid", isDark, RE_PALETTES.rental.colors.length);
  const presaleGridColors = usePaletteRamp("realEstatePresaleGrid", isDark, RE_PALETTES.presale.colors.length);
  const active = RE_LEGEND_ROWS.filter((r) => r.keys.some((k) => visibility[k]));
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={`房地產單價（NT$/m²）${excl ? " · 排除雙北" : ""}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map((r) => {
          const p = RE_PALETTES[r.palette];
          const [lo, hi] = excl ? p.domainExcl : p.domain;
          // R7：租賃／預售「網格」改讀色盤選單；3D 點仍是原色票。網格與點同時開 → 兩條色帶分開標
          const gridColors = r.palette === "rental" ? rentalGridColors : r.palette === "presale" ? presaleGridColors : null;
          const gridOn = !!gridColors && !!visibility[r.keys[0]!];
          const pointOn = !!visibility[r.keys[1]!];
          const bars: { tag: string; colors: readonly string[] }[] = [];
          if (gridOn) bars.push({ tag: "網格", colors: gridColors! });
          if (!gridColors || pointOn) bars.push({ tag: "3D 點", colors: p.colors });
          return (
            <div key={r.label}>
              <div style={{ fontSize: FONT_SIZE.xs, color: t.textDefault, marginBottom: 2 }}>{r.label}</div>
              {bars.map((b) => (
                <div key={b.tag} style={{ marginBottom: bars.length > 1 ? 3 : 0 }}>
                  {bars.length > 1 && <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{b.tag}</div>}
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
