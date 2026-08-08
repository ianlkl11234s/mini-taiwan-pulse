import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  schoolLevelGroupOf, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS,
  REGION_TYPE_COLORS, type RegionType, CAMPUS_LEVEL_COLORS,
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
