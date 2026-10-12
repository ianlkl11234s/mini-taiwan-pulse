import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { Row, Title } from "./shared";
import { DARK_FEATURE, useFeatureTheme } from "./featureTheme";
import { usePaletteRamp } from "../../state/layerPalette";
import {
  STREET_TREE_3EPOCH_TRAJ,
  STREET_TREE_NATIONAL_SPECIES, STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES,
} from "../../data/urbanOpenSpaceTypes";
import { buildingHeightBandColor } from "../../data/buildingsGbaTypes";
import { jpBuildingHeightBandColor } from "../../data/jpHeightTypes";
import {
  BUILDING_VALUE_NON_MARKET_COLOR, PROPERTY_VALUE_APPROX_NOTE,
  PROPERTY_VALUE_PER_CAPITA_MIN_POP,
  formatWanTwd, priceSourceLabel, propertyValueBandColor, scaleFromGridId,
} from "../../data/propertyValueTypes";
import { GG_INDEX_BANDS, gridBandColor, URBAN_FORM_GRID_APPROX_NOTE } from "../../data/urbanFormGridTypes";
import { urbanZoningCategoryLabel, urbanZoningCategoryColor } from "../../data/urbanZoningTypes";
import { nonUrbanZoningCodeLabel, nonUrbanZoningCodeColor } from "../../data/nonUrbanZoningTypes";
import { formatPropertyValueTwd } from "../../data/propertyValueAdminTypes";

/** 數值 + 單位；非有限值回空字串（Row 對空值自動隱藏） */
function numUnit(v: unknown, unit: string, formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${formatNumber(n, { maximumFractionDigits: 1 })} ${unit}` : "";
}

/** 學名斜體副標（Title 下方一行；空值不渲染） */
function ScientificName({ children }: { children: string }) {
  const t = useFeatureTheme();
  if (!children) return null;
  return (
    <div style={{ fontSize: FONT_SIZE.sm, fontStyle: "italic", color: t.textMuted, marginTop: -4, marginBottom: 6 }}>
      {children}
    </div>
  );
}

/** status 三值 → 中文標籤（enumLabel 的中文正本）+ 代表色（存續 綠 / 消失 紅 / 新增 淺綠） */
const STATUS_TIER: Record<string, { label: string; color: string }> = {
  persisted: { label: "存續（2024→現在）", color: "#2e7d32" },
  disappeared: { label: "消失（2024 有、現在無）", color: "#e53935" },
  appeared: { label: "新增（2024 無、現在有）", color: "#9ccc65" },
};

export function StreetTreesTaipeiDiffPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const status = typeof props.status === "string" ? props.status : "";
  const known = STATUS_TIER[status];
  const tier = known
    ? { label: enumLabel("urbanTreeDiff", status, known.label, i18n), color: known.color }
    : { label: status || t("popup.urban.unknown"), color: "#9e9e9e" };
  const renumberSuspect = props.renumber_suspect === true;
  // 路名（附行政區）：Region 為主，Dist 括號附註
  const region = String(props.Region ?? "");
  const dist = String(props.Dist ?? "");
  const roadValue = region && dist ? t("popup.urban.nameWithSub", { main: region, sub: dist }) : region || dist;
  return (
    <>
      <Title color={tier.color}>{String(props.TreeType ?? t("popup.urban.streetTree"))}</Title>
      <Row field="status" value={tier.label} color={tier.color} />
      <Row label={t("popup.urban.roadName")} value={roadValue} />
      <Row label="TreeID" value={String(props.TreeID ?? "")} />
      <Row field="dbh" value={numUnit(props.Diameter, "cm", formatNumber)} />
      <Row field="treeHeight" value={numUnit(props.TreeHeight, "m", formatNumber)} />
      <Row field="surveyDate" value={String(props.SurveyDate ?? "")} />
      {renumberSuspect && (
        <Row label={t("popup.urban.hint")} value={t("popup.urban.renumberSuspectDiff")} color="#fbbf24" />
      )}
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        {t("popup.urban.diffNote")}
      </div>
    </>
  );
}

/** 受保護樹木（全國 6,544 點）：樹種 + 學名斜體 + 城市/地址 + 尺寸 + 推估樹齡 + 管理單位 */
export function ProtectedTreesNationalPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const sci = typeof props.species_scientific === "string" ? props.species_scientific : "";
  const city = String(props.city ?? "");
  const district = String(props.district ?? "");
  const cityValue = city && district ? t("popup.urban.nameWithSub", { main: city, sub: district }) : city || district;
  return (
    <>
      <Title color="#00695c">{String(props.species ?? t("popup.urban.protectedTree"))}</Title>
      <ScientificName>{sci}</ScientificName>
      <Row field="city" value={cityValue} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="dbh" value={numUnit(props.dbh_m, "m", formatNumber)} />
      <Row label={t("popup.urban.girth")} value={numUnit(props.girth_m, "m", formatNumber)} />
      <Row field="treeHeight" value={numUnit(props.height_m, "m", formatNumber)} />
      <Row label={t("popup.urban.crownArea")} value={numUnit(props.crown_area_m2, "m²", formatNumber)} />
      <Row label={t("popup.urban.estimatedAge")} value={numUnit(props.estimated_age_years, t("popup.urban.unitYear"), formatNumber)} />
      <Row field="managingAgency" value={String(props.manager ?? "")} />
    </>
  );
}

/** 台北河濱喬木（10,917 點）：樹種 + 學名/科別 + 河濱公園 + 尺寸 + 推估樹齡 + 調查日期 */
export function RiversideTreesTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const sci = typeof props.species_scientific === "string" ? props.species_scientific : "";
  const family = String(props.family ?? "");
  return (
    <>
      <Title color="#0288d1">{String(props.species ?? t("popup.urban.riversideTree"))}</Title>
      <ScientificName>{family ? (sci ? t("popup.urban.nameWithSub", { main: sci, sub: family }) : family) : sci}</ScientificName>
      <Row label={t("popup.urban.riversidePark")} value={String(props.park_name ?? "")} />
      <Row field="treeHeight" value={numUnit(props.height_m, "m", formatNumber)} />
      <Row field="dbh" value={numUnit(props.dbh_cm, "cm", formatNumber)} />
      <Row label={t("popup.urban.crownArea")} value={numUnit(props.crown_area_m2, "m²", formatNumber)} />
      <Row label={t("popup.urban.estimatedAge")} value={numUnit(props.estimated_age_years, t("popup.urban.unitYear"), formatNumber)} />
      <Row field="surveyDate" value={String(props.survey_date ?? "")} />
    </>
  );
}

/** 台北公園（2,917 點）：公園名 + 行政區 + 分類 + 面積（千分位）+ 兒童遊具有無 */
export function ParksTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const playground = props.has_playground === true ? t("popup.urban.has") : props.has_playground === false ? t("popup.urban.none") : "";
  return (
    <>
      <Title color="#7cb342">{String(props.name ?? t("popup.urban.park"))}</Title>
      <Row field="district" value={String(props.district ?? "")} />
      <Row field="classification" value={String(props.category ?? "")} />
      <Row field="area" value={numUnit(props.area_sqm, "m²", formatNumber)} />
      <Row label={t("popup.urban.playground")} value={playground} />
    </>
  );
}

// ── 行道樹三時點（105,675 點）──

/** traj badge：2022→2024→2026 三格存在/消失視覺（1=存在 綠框、0=無 灰框） */
function TrajBadge({ traj }: { traj: string }) {
  const { t } = useLocale();
  if (traj.length !== 3) return null;
  const years = ["2022", "2024", "2026"];
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
      {years.map((y, i) => {
        const present = traj[i] === "1";
        return (
          <div
            key={y}
            style={{
              padding: "2px 6px", borderRadius: 4, fontSize: FONT_SIZE.xs,
              background: present ? "rgba(46,125,50,0.22)" : "rgba(158,158,158,0.10)",
              border: `1px solid ${present ? "#2e7d32" : "rgba(158,158,158,0.5)"}`,
              color: present ? "#7cc47f" : "#9e9e9e",
            }}
          >
            {y} {present ? t("popup.urban.trajPresent") : t("popup.urban.trajGone")}
          </div>
        );
      })}
    </div>
  );
}

/** status_2224 / status_2426 期間變化 → 中文標籤 */
const EPOCH_STATUS_LABEL: Record<string, string> = {
  persisted: "存續",
  disappeared: "消失",
  appeared: "新增",
  absent: "不存在",
};

/**
 * 行道樹三時點：樹種 + traj badge + 兩期間狀態 + 路段 + 尺寸 + 公園樹 + renumber 警示。
 * traj 7 類標籤/色票 SSOT = urbanOpenSpaceTypes.ts（與 overlayRegistry / Legend 同源）。
 */
export function StreetTrees3epochPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const traj = typeof props.traj === "string" ? props.traj : "";
  const cat = STREET_TREE_3EPOCH_TRAJ.find((c) => c.code === traj);
  // 路段（附行政區）：region 為主，dist 括號附註（同 diff 層 Region/Dist 寫法）
  const region = String(props.region ?? "");
  const dist = String(props.dist ?? "");
  const roadValue = region && dist ? t("popup.urban.nameWithSub", { main: region, sub: dist }) : region || dist;
  const isPark = props.is_park === 1 ? t("popup.urban.yes") : props.is_park === 0 ? t("popup.urban.no") : "";
  const epochLabel = (v: unknown) => enumLabel("urbanTreeEpoch", String(v ?? ""), EPOCH_STATUS_LABEL[String(v ?? "")] ?? String(v ?? ""), i18n);
  // renumber_2224 / renumber_2426 為 0/1（PMTiles 屬性），任一為 1 → 疑似重編號警示
  const renumberEpochs = [
    props.renumber_2224 === 1 ? "2022→2024" : null,
    props.renumber_2426 === 1 ? "2024→2026" : null,
  ].filter((s): s is string => s !== null);
  return (
    <>
      <Title color={cat?.color ?? "#558b2f"}>{String(props.species ?? t("popup.urban.streetTree"))}</Title>
      <TrajBadge traj={traj} />
      <Row label={t("popup.urban.trajectory")} value={cat ? t("popup.urban.nameWithCode", { label: enumLabel("urbanTreeTraj", cat.code, cat.label, i18n), code: traj }) : traj} color={cat?.color} />
      <Row label="2022→2024" value={epochLabel(props.status_2224)} />
      <Row label="2024→2026" value={epochLabel(props.status_2426)} />
      <Row field="roadSection" value={roadValue} />
      <Row label="TreeID" value={String(props.tree_id ?? "")} />
      <Row field="dbh" value={numUnit(props.dbh_cm, "cm", formatNumber)} />
      <Row field="treeHeight" value={numUnit(props.height_m, "m", formatNumber)} />
      <Row label={t("popup.urban.parkTree")} value={isPark} />
      <Row field="surveyDate" value={String(props.survey_date ?? "")} />
      {renumberEpochs.length > 0 && (
        <Row label={t("popup.urban.hint")} value={t("popup.urban.renumberSuspectEpoch", { epochs: renumberEpochs.join(t("popup.urban.listSeparator")) })} color="#fbbf24" />
      )}
    </>
  );
}

// ── 行道樹全國分佈（210,436 點：台北 + 台中）──

/**
 * 行道樹全國：樹種（Title 帶樹種色，色票 SSOT = urbanOpenSpaceTypes.ts）+ 城市中文 + 行政區
 * + 地址 + 位置類型 + 尺寸 + 調查日 + 資料來源。city 欄位值 taipei/taichung → 中文顯示。
 */
export function StreetTreesNationalPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const species = String(props.species ?? "");
  const speciesColor = STREET_TREE_NATIONAL_SPECIES.find((s) => s.names.includes(species))?.color ?? "#43a047";
  const cityEntry = STREET_TREE_NATIONAL_CITIES.find((c) => c.value === props.city);
  const cityLabel = cityEntry ? enumLabel("streetTreeCity", cityEntry.value, cityEntry.label, i18n) : String(props.city ?? "");
  const district = String(props.district ?? "");
  const cityValue = cityLabel && district ? t("popup.urban.nameWithSub", { main: cityLabel, sub: district }) : cityLabel || district;
  return (
    <>
      <Title color={speciesColor}>{species || t("popup.urban.streetTree")}</Title>
      <Row field="city" value={cityValue} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={t("popup.urban.locationType")} value={String(props.location_type ?? "")} />
      <Row field="dbh" value={numUnit(props.dbh_cm, "cm", formatNumber)} />
      <Row field="treeHeight" value={numUnit(props.height_m, "m", formatNumber)} />
      <Row field="surveyDate" value={String(props.survey_date ?? "")} />
      <Row label={t("popup.common.sourceLabel")} value={String(props.source ?? "")} />
    </>
  );
}

// ── 台北人行道樹穴（56,720 面）──

/** 人行道樹穴：類型帶色（樹穴綠 / 花圃黃，色票 SSOT = urbanOpenSpaceTypes.ts）+ 行政區 + 面積（兩位小數）+ 編號 */
export function TreePitsTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const pitTypeRaw = String(props.pit_type ?? "");
  const pitType = pitTypeRaw ? enumLabel("urbanPitType", pitTypeRaw, pitTypeRaw, i18n) : "";
  const typeColor = TREE_PIT_TYPES.find((p) => p.name === pitTypeRaw)?.color ?? "#8d6e63";
  const area = Number(props.area_m2);
  return (
    <>
      <Title color={typeColor}>{pitType || t("popup.urban.treePit")}</Title>
      <Row field="type" value={pitType} color={typeColor} />
      <Row field="district" value={String(props.district ?? "")} />
      <Row field="area" value={Number.isFinite(area) ? `${area.toFixed(2)} m²` : ""} />
      <Row field="number" value={String(props.pit_id ?? "")} />
    </>
  );
}

// ── GBA 全台 3D 建物輪廓（152 萬棟）──

/**
 * 建物：高度 `h` + 樓層 `f`（上游 h÷3.2 算好的；缺值退回 round(h/3)）+ 資料來源
 * （src="osm" → OpenStreetMap，其餘 → GBA AI 推估）+ 估值三欄（`v` 萬元 / `ps` 價格來源 /
 * `nm` 非市場）+ RMSE 提醒（CC BY-NC 4.0）。
 *
 * 誠實度：nm=1 顯示「未估值（非市場建物）」而不顯示金額（該棟不計入 204 兆總值）；
 * ps=t/c 代表該棟所在網格無實價成交、是用鄉鎮/縣市中位價推的，必須讓使用者看到。
 */
export function BuildingsGbaPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const height = Number(props.h);
  const src = String(props.src ?? "");
  const sourceLabel = src === "osm" ? "OpenStreetMap" : t("popup.urban.sourceGba");
  const floorsRaw = Number(props.f);
  const floors = Number.isFinite(floorsRaw) && floorsRaw > 0
    ? floorsRaw
    : Number.isFinite(height) ? Math.max(1, Math.round(height / 3)) : null;
  const nonMarket = Number(props.nm) === 1;
  const value = Number(props.v);
  const hasValue = Number.isFinite(value) && value > 0;
  const color = nonMarket
    ? BUILDING_VALUE_NON_MARKET_COLOR
    : Number.isFinite(height) ? buildingHeightBandColor(height) : "#78909c";
  return (
    <>
      <Title color={color}>{t("popup.urban.building")}</Title>
      <Row label={t("popup.urban.height")} value={Number.isFinite(height) ? `${height.toFixed(1)} m` : ""} />
      <Row label={t("popup.urban.estimatedFloors")} value={floors != null ? t("popup.urban.floorsValue", { floors }) : ""} />
      <Row
        label={t("popup.urban.valuation")}
        value={nonMarket ? t("popup.urban.nonMarketValue") : hasValue ? formatWanTwd(value) : ""}
        color={nonMarket ? BUILDING_VALUE_NON_MARKET_COLOR : undefined}
      />
      {!nonMarket && hasValue && (
        <Row label={t("popup.urban.priceSource")} value={enumLabel("propertyPriceSource", String(props.ps ?? ""), priceSourceLabel(props.ps), i18n)} />
      )}
      <Row label={t("popup.common.sourceLabel")} value={sourceLabel} />
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        {t("popup.urban.heightNote")}
      </div>
      {!nonMarket && hasValue && (
        <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 4 }}>
          ⓘ {PROPERTY_VALUE_APPROX_NOTE}
        </div>
      )}
    </>
  );
}

/** PLATEAU 原始 height 欄位；null 不猜測高度，亦不顯示為 3D 建物。 */
export function JpBuildingHeightPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const na = t("popup.urban.notProvided");
  const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const text = (value: unknown) => typeof value === "string" && value ? value : na;
  const attribution = text(props.attribution);
  const license = text(props.license);
  const region = text(props.jp_region_label);
  if (props.cell_size_m != null) {
    const median = numeric(props.height_median);
    const p90 = numeric(props.height_p90);
    const count = numeric(props.building_count);
    const missing = numeric(props.missing_height_count);
    return <>
      <Title color={jpBuildingHeightBandColor(median)}>{t("popup.urban.gridSummaryTitle")}</Title>
      <Row field="region" value={region} />
      <Row field="gridScale" value={`${props.cell_size_m} m`} />
      <Row label={t("popup.urban.heightMedian")} value={median == null ? na : `${median.toFixed(1)} m`} />
      <Row label={t("popup.urban.heightP90")} value={p90 == null ? na : `${p90.toFixed(1)} m`} />
      <Row label={t("popup.urban.outlineCount")} value={count == null ? na : String(count)} />
      <Row label={t("popup.urban.validHeightCount")} value={String(props.valid_height_count ?? na)} />
      <Row label={t("popup.urban.heightMissing")} value={missing == null ? na : count ? t("popup.urban.missingCountPct", { count: missing, pct: (missing / count * 100).toFixed(1) }) : t("popup.urban.missingCount", { count: missing })} />
      <Row field="sourceYear" value={String(props.source_year ?? na)} />
      <Row field="license" value={`${license} · ${attribution}`} />
      <div style={{ fontSize: FONT_SIZE.sm, lineHeight: 1.5, marginTop: 6 }}>
        {t("popup.urban.gridSummaryNote")}
      </div>
    </>;
  }
  const height = numeric(props.height);
  const roof = text(props.geometry_method).toLowerCase().includes("roof");
  return <>
    <Title color={jpBuildingHeightBandColor(height)}>{roof ? t("popup.urban.plateauRoof") : t("popup.urban.plateauOutline")}</Title>
    <Row label={t("popup.urban.height")} value={height == null ? t("popup.urban.heightNaFlat") : `${height.toFixed(1)} m`} />
    <Row field="region" value={region} />
    <Row field="sourceYear" value={String(props.source_year ?? na)} />
    <Row label={t("popup.urban.heightMethod")} value={text(props.height_method)} />
    <Row label={t("popup.urban.outlineMethod")} value={text(props.geometry_method)} />
    <Row field="license" value={`${license} · ${attribution}`} />
  </>;
}

// ── 房地產總市值網格（150m 格，333,847 格）──

/**
 * 總市值網格：v_mkt 主數字 + 棟數 / 總樓地板面積 / 主要價格來源。三尺度共用本 panel，
 * 目前是哪個尺度由 `grid_id` 前綴反推（`G_` / `G450_` / `G1500_`），不必額外傳參。
 * 450m/1.5km（scale.hasPop）加「人口」「人均市值」兩列——**跟尺度走、不跟上色模式走**，
 * 總市值模式下點查也看得到人均；150m 磚無 pop，不顯示。
 * pop < PROPERTY_VALUE_PER_CAPITA_MIN_POP 人均標「樣本不足」（跟地圖灰格同一套門檻）。
 * ⚠️ 不顯示 v_all，也不做 v_mkt − v_all：v_all 未套 GFA 校正係數，可能小於 v_mkt，
 *    相減沒有意義（上游 admin_value.json meta.field_notes 明文警告）。
 */
export function PropertyValueAdminPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const level = props.admin_level === "township" ? t("popup.urban.levelTownship") : t("popup.urban.levelCounty");
  const value = Number(props.value_market_corrected);
  return (
    <>
      <Title color="#ec7014">{String(props.admin_name ?? t("popup.urban.propertyValueDefault"))}</Title>
      <Row label={t("popup.urban.adminLevel")} value={level} />
      {props.county_name && props.county_name !== props.admin_name ? <Row label={t("popup.urban.ownCounty")} value={String(props.county_name)} /> : null}
      <Row label={t("popup.urban.totalMarketValue")} value={formatPropertyValueTwd(value)} color="#ec7014" />
      <Row label={t("popup.urban.valuedBuildings")} value={numUnit(props.n_buildings, t("popup.urban.unitBuilding"), formatNumber)} />
      <Row label={t("popup.urban.totalFloorArea")} value={numUnit(props.gfa_m2, "m²", formatNumber)} />
      <Row label={t("popup.urban.adminCode")} value={String(props.admin_code ?? "")} />
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        {t("popup.urban.adminNote")}
      </div>
    </>
  );
}

export function PropertyValueGridPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const vMkt = Number(props.v_mkt);
  const scale = scaleFromGridId(props.grid_id);
  // R7：標題色跟地圖同一個色盤選單（總市值 9 階）
  const ramp = usePaletteRamp("propertyValueGrid", useFeatureTheme() === DARK_FEATURE, scale.bands.length, "propertyValueGridPalette");
  const color = propertyValueBandColor(scale.bands.map((b, i) => ({ ...b, color: ramp[i] ?? b.color })), vMkt);
  const pop = Number(props.pop);
  const hasPop = scale.hasPop && Number.isFinite(pop);
  const perCapitaValue = !hasPop ? ""
    : pop < PROPERTY_VALUE_PER_CAPITA_MIN_POP ? t("popup.urban.insufficientSample", { min: PROPERTY_VALUE_PER_CAPITA_MIN_POP })
    : vMkt > 0 ? t("popup.urban.perPerson", { value: formatWanTwd(vMkt / pop) })
    : "0";
  return (
    <>
      <Title color={color}>{t("popup.urban.gridTitle", { scale: scale.shortLabel })}</Title>
      <Row label={t("popup.urban.totalMarketValue")} value={Number.isFinite(vMkt) && vMkt > 0 ? formatWanTwd(vMkt) : t("popup.urban.zeroNonMarketOnly")} />
      {hasPop && (
        <>
          <Row label={t("popup.urban.population")} value={pop > 0 ? t("popup.urban.popApprox", { count: formatNumber(Math.round(pop)) }) : t("popup.urban.popZero")} />
          <Row label={t("popup.urban.perCapitaValue")} value={perCapitaValue} />
        </>
      )}
      <Row label={t("popup.urban.buildingCount")} value={numUnit(props.n_bld, t("popup.urban.unitBuilding"), formatNumber)} />
      <Row label={t("popup.urban.totalFloorArea")} value={numUnit(props.gfa, "m²", formatNumber)} />
      <Row label={t("popup.urban.mainPriceSource")} value={enumLabel("propertyPriceSource", String(props.ps_dom ?? ""), priceSourceLabel(props.ps_dom), i18n)} />
      <Row label={t("popup.urban.gridId")} value={String(props.grid_id ?? "")} />
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        {t("popup.urban.gridNote", { scale: scale.shortLabel })}
      </div>
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 4 }}>
        ⓘ {PROPERTY_VALUE_APPROX_NOTE}
      </div>
    </>
  );
}

// ── 都市紋理網格（500m 格，145,119 格；六欄全列）──

/** 都市紋理：棟數/平均高度/總量體/建蔽率/樹冠覆蓋/灰綠指數 六值全列；Title 依 gg_index 上色。 */
export function UrbanFormGridPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const ggIndex = Number(props.gg_index);
  const color = Number.isFinite(ggIndex) ? gridBandColor(GG_INDEX_BANDS, ggIndex) : "#8d9c6b";
  return (
    <>
      <Title color={color}>{t("popup.urban.urbanFormGrid")}</Title>
      <Row label={t("popup.urban.buildingsCount")} value={numUnit(props.bld_count, t("popup.urban.unitBuilding"), formatNumber)} />
      <Row label={t("popup.urban.avgHeight")} value={numUnit(props.avg_height, "m", formatNumber)} />
      <Row label={t("popup.urban.totalVolume")} value={numUnit(props.total_vol, t("popup.urban.unitWanM3"), formatNumber)} />
      <Row label={t("popup.urban.builtRatio")} value={numUnit(props.built_pct, "%", formatNumber)} />
      <Row label={t("popup.urban.canopyCover")} value={numUnit(props.canopy_pct, "%", formatNumber)} />
      <Row label={t("popup.urban.ggIndex")} value={Number.isFinite(ggIndex) ? ggIndex.toFixed(1) : ""} />
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        ⓘ {URBAN_FORM_GRID_APPROX_NOTE}
      </div>
    </>
  );
}

// ── 都市計畫土地使用分區（北市 15,518 + 新北 34,190 面；北市 / 新北兩 layerType 共用本 panel）──

/**
 * 土地使用分區：Title 走 fallback 鏈 zone_name → zone_raw → zone_short → 分類 label
 * （北市 zone_name 齊全；新北 zone_name/zone_short 全空、原始分區名在 zone_raw——見上游 handoff §2）；
 * "nan"/"null" 字面字串一律視為缺值（北市範圍框 meta-polygon 遺留，上游 UZ-5 待清）。
 * zone_category 9 類色票 SSOT = urbanZoningTypes.ts（與 overlayRegistry / Legend 同源）。
 */
const zoneText = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s && s !== "nan" && s !== "null" ? s : "";
};

/**
 * 非都市土地使用分區 popup（區域計畫法 11 種法定分區）。
 * 與 UrbanZoningPanel 分開寫：本層欄位是 zone_code/zone_name/county/town，
 * 沒有都計分區的 zone_short / plan_level / city。
 */
export function NonUrbanZoningPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const code = zoneText(props.zone_code);
  const color = nonUrbanZoningCodeColor(code);
  const title = zoneText(props.zone_name)
    || (code ? enumLabel("nonUrbanZoningCode", code, nonUrbanZoningCodeLabel(code), i18n) : nonUrbanZoningCodeLabel(code))
    || t("popup.urban.nonUrbanZoningDefault");
  const town = zoneText(props.town);
  return (
    <>
      <Title color={color}>{title}</Title>
      <Row field="code" value={code} color={color} />
      <Row field="county" value={zoneText(props.county)} />
      {town ? <Row field="township" value={town} /> : null}
      {/* zone_category（agricultural / slope_conservation…）是英文粗分類，跟 zone_name 資訊重複
          且未中文化，不入 popup —— 11 碼的中文名本身就是分類 */}
    </>
  );
}

export function UrbanZoningPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const category = String(props.zone_category ?? "");
  const color = urbanZoningCategoryColor(category);
  const categoryLabel = category ? enumLabel("urbanZoningCategory", category, urbanZoningCategoryLabel(category), i18n) : urbanZoningCategoryLabel(category);
  const title =
    zoneText(props.zone_name) || zoneText(props.zone_raw) || zoneText(props.zone_short) ||
    categoryLabel || t("popup.urban.zoningDefault");
  return (
    <>
      <Title color={color}>{title}</Title>
      <Row field="classification" value={categoryLabel} color={color} />
      <Row label={t("popup.urban.shortName")} value={zoneText(props.zone_short)} />
      <Row field="code" value={zoneText(props.zone_code)} />
      <Row field="city" value={zoneText(props.city)} />
      <Row label={t("popup.urban.planLevel")} value={zoneText(props.plan_level)} />
    </>
  );
}
