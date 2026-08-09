import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  schoolLevelGroupOf, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS,
  REGION_TYPE_COLORS, type RegionType, CAMPUS_LEVEL_COLORS,
  DISTRICT_COLORS, DISTRICT_SENIOR_CYCLE_COLORS, DISTRICT_DISCLAIMER,
  linSpecsLabel, type DistrictK12Level,
} from "../../data/educationTypes";

// 本檔 Title 為極簡本地版（同 funeralPanels / religionPanels 慣例）。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/**
 * 學校點位（4,315 點，6 個 layer 共用）。
 * `school_level` 有 9 種原始值 → 用 schoolLevelGroupOf() fold 成 5 級才對得上圖層分色；
 * 未知值回 null（不硬塞顏色，走 fallback 藍）。
 */
export function SchoolPanel({ props }: { props: Record<string, unknown> }) {
  const level = str(props.school_level);
  const group = schoolLevelGroupOf(level);
  const accentColor = group ? SCHOOL_LEVEL_COLORS[group] : "#42a5f5";
  const city = str(props.city);
  const district = str(props.district);
  // ⚠️ region_type 的 key 在全部 4,315 筆都存在，非偏遠的 3,163 筆值是 JSON null
  //    → str() 轉空字串後 Row 自動不渲染，不會印出「null」。
  const regionType = str(props.region_type);
  const isRegionType = (v: string): v is RegionType => v in REGION_TYPE_COLORS;

  return (
    <>
      <Title color={accentColor}>{str(props.school_name) || "學校"}</Title>
      <Row
        label="學制"
        value={group ? `${SCHOOL_LEVEL_LABELS[group]}｜${level}` : level}
        color={accentColor}
      />
      {str(props.system_type) ? <Row label="體系" value={str(props.system_type)} /> : null}
      {isRegionType(regionType) ? (
        <Row label="偏遠地區" value={regionType} color={REGION_TYPE_COLORS[regionType]} />
      ) : null}
      <Row label="行政區" value={[city, district].filter(Boolean).join(" ")} />
      <Row label="地址" value={str(props.address)} />
      <Row label="電話" value={str(props.phone)} />
      <Row label="網站" value={str(props.website)} />
    </>
  );
}

/**
 * 校地範圍面（campus_polygon PMTiles，濾除 non_school 後 4,324 面）。
 * ⚠️ campus 的 `school_level` 是**英文代碼 10 類**，與 schools.geojson 的中文欄位不是同一套
 *    → 取色走 CAMPUS_LEVEL_COLORS（與圖層 campusLevelColorExpr 同一份，含 fallback #90a4ae），
 *    顯示則直接用上游備好的 `school_level_zh`。
 */
export function EduCampusPanel({ props }: { props: Record<string, unknown> }) {
  const levelZh = str(props.school_level_zh);
  const accentColor = CAMPUS_LEVEL_COLORS[str(props.school_level)] ?? "#90a4ae";
  const areaHa = typeof props.area_ha === "number" ? props.area_ha : null;
  const isBranch = props.is_branch === true || props.is_branch === "true" || props.is_branch === 1;

  return (
    <>
      <Title color={accentColor}>{str(props.school_name) || "校地範圍"}</Title>
      <Row label="學制" value={levelZh} color={accentColor} />
      {areaHa != null ? <Row label="校地面積" value={`${areaHa.toFixed(2)} 公頃`} /> : null}
      <Row label="縣市" value={str(props.county)} />
      {isBranch ? <Row label="分校／分部" value="是" /> : null}
      <Note>校地範圍為官方圖資，<b>澎湖／金門無資料</b></Note>
    </>
  );
}

/**
 * 國中小學區面（school_district_k12 PMTiles，860 面）。
 * 國小／國中共用本 panel —— 兩層欄位契約完全相同，差別只在 Mapbox filter 的 `level`。
 *
 * 🔴 `lin_specs`（鄰別）**不能直接印**：只有 village_partial 的 654 筆有值，
 *    village_full 的 206 筆是**空字串**（不是 null）→ 一律走 linSpecsLabel()。
 * 🔴 這層不是精確邊界（村里 polygon 無法表達鄰級切分），且面與面重疊是制度事實
 *    → DISTRICT_DISCLAIMER 為上游明確要求的必顯欄位。
 */
export function EduDistrictK12Panel({ props }: { props: Record<string, unknown> }) {
  const level: DistrictK12Level = props.level === "junior" ? "junior" : "elementary";
  const accentColor = DISTRICT_COLORS[level].full;
  const county = str(props.county);
  const precision = str(props.precision);
  const villageCount = typeof props.village_count === "number" ? props.village_count : null;
  const areaKm2 = typeof props.area_km2 === "number" ? props.area_km2 : null;
  // ⚠️ PMTiles 的 boolean 多半原樣保留，但照 EduCampusPanel 的 is_branch 前例做三態容錯
  const isShared = props.is_shared === true || props.is_shared === "true" || props.is_shared === 1;

  return (
    <>
      <Title color={accentColor}>{str(props.school) || "學區"}</Title>
      <Row
        label="學制"
        value={level === "junior" ? "國中學區" : "國小學區"}
        color={accentColor}
      />
      <Row label="縣市" value={county} />
      {villageCount != null ? <Row label="涵蓋里數" value={`${villageCount} 里`} /> : null}
      <Row label="里名" value={str(props.villages)} />
      <Row
        label="邊界精度"
        value={precision === "village_full" ? "整里皆屬" : precision === "village_partial" ? "部分鄰屬" : precision}
      />
      <Row label="鄰別" value={linSpecsLabel(props.lin_specs, props.precision)} />
      {isShared ? (
        <Row label="共同學區" value="⚠️ 該里同時屬其他學校（共同學區）" color="#ffb74d" />
      ) : null}
      {areaKm2 != null ? <Row label="面積" value={`${areaKm2.toFixed(2)} km²`} /> : null}
      <Note>{DISTRICT_DISCLAIMER}</Note>
      {county === "臺北市" ? <Note>臺北市資料為 110 學年度</Note> : null}
    </>
  );
}

/**
 * 高中就學區（school_district_senior.geojson，15 面）。
 * ⚠️ **縣市級**就學區，與國中小學區（里級）不是同一種粒度，不要放在一起比較。
 *
 * ⚠️ `district_no` 上游給的是**字串**（實測 15 筆全 str）→ 不能用 typeof === "number"。
 * `cross_district_rules` 最長 685 字 → 小字 + 捲動容器，避免撐爆面板。
 */
export function EduDistrictSeniorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const no = Number(props.district_no);
  const accentColor = Number.isFinite(no)
    ? DISTRICT_SENIOR_CYCLE_COLORS[no % DISTRICT_SENIOR_CYCLE_COLORS.length]!
    : DISTRICT_SENIOR_CYCLE_COLORS[0];
  const countyCount = typeof props.county_count === "number" ? props.county_count : null;
  const areaKm2 = typeof props.area_km2 === "number" ? props.area_km2 : null;
  const counties = str(props.counties);
  const rules = str(props.cross_district_rules);

  return (
    <>
      <Title color={accentColor}>
        {Number.isFinite(no) ? `${str(props.district)}（第 ${no} 區）` : str(props.district) || "高中就學區"}
      </Title>
      <Row
        label="涵蓋縣市"
        value={counties && countyCount != null ? `${counties}（${countyCount} 縣市）` : counties}
      />
      {areaKm2 != null ? <Row label="面積" value={`${areaKm2.toFixed(2)} km²`} /> : null}
      {rules ? (
        <>
          <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textMuted }}>跨區就讀規則</div>
          <div
            style={{
              marginTop: 2,
              maxHeight: 140,
              overflowY: "auto",
              fontSize: FONT_SIZE.xs,
              lineHeight: 1.6,
              color: t.textStrong,
              wordBreak: "break-word",
            }}
          >
            {rules}
          </div>
        </>
      ) : null}
      <Note>{DISTRICT_DISCLAIMER}</Note>
      <Note>本層為 <b>縣市級</b>就學區（全國 15 區），與國中小學區的<b>里級</b>粒度不同。</Note>
    </>
  );
}
