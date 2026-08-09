import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  schoolLevelGroupOf, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS,
  REGION_TYPE_COLORS, type RegionType, CAMPUS_LEVEL_COLORS,
  DISTRICT_COLORS, DISTRICT_SENIOR_CYCLE_COLORS, DISTRICT_DISCLAIMER,
  linSpecsLabel, type DistrictK12Level,
  KINDERGARTEN_OWNERSHIP_COLORS, cramCategoryGroupOf,
  CRAM_CATEGORY_COLORS, CRAM_CATEGORY_LABELS,
  GEOCODE_PRECISION_LABELS, UNIVERSITY_BUBBLE_COLOR, UNIVERSITY_NO_DATA_COLOR,
  EDUCATION_LAYER_COLORS,
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
 * 去掉教育部名冊欄位開頭的 `[NN]` / `[237]` 方括號代碼前綴（縣市代碼／郵遞區號）。
 *
 * ⚠️ **只用於顯示**。上游 geocode 刻意保留這個前綴（拿掉 offline 命中率掉到 0%，
 * 見 `pipelines/education/_shared/normalize_address.py`）—— 別去動資料本身。
 *
 * 實測：kindergartens 的 `縣市名稱`／`地址` 6,689 筆**全部**帶前綴（「[01]新北市」），
 * mutual_care 的 `縣市名稱` 則完全沒有 → 兩層共用 panel 時本函式對後者是 no-op。
 */
function stripBracketPrefix(v: unknown): string {
  return str(v).replace(/^\[[^\]]*\]\s*/, "");
}

/**
 * `立案時間` 是**純數字**，而且兩份資料的紀年不同 —— 直接印會變成無意義的「1020812」。
 *
 * - cram_schools：8 位**西元** YYYYMMDD（實測 17,137 筆全 8 位，19530701 ~ 20260807）
 * - afterschool_care：6-7 位**民國** YYYMMDD（實測 880427 ~ 1140908；6 位 5 筆、7 位 777 筆）
 *
 * 位數以外的值原樣回傳（上游若改格式，寧可印原始值也不要算出錯的日期）。
 */
function licenseDateLabel(v: unknown): string {
  const s = str(v);
  if (!/^\d{6,8}$/.test(s)) return s;
  const [y, md] =
    s.length === 8
      ? [Number(s.slice(0, 4)), s.slice(4)]
      : [Number(s.slice(0, s.length - 4)) + 1911, s.slice(-4)];
  return `${y}-${md.slice(0, 2)}-${md.slice(2)}`;
}

/** 四份中文欄位資料共用的 geocode 精度列（`interpolated` 那句本身已含 ⚠️） */
function GeocodeRow({ precision }: { precision: unknown }) {
  const p = str(precision);
  return <Row label="定位精度" value={GEOCODE_PRECISION_LABELS[p] ?? p} />;
}

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

/**
 * 幼兒園（6,689 點）與互助教保服務中心（148 點）**共用** —— 兩份欄位幾乎相同
 * （`學校名稱`／`公/私立`／`縣市名稱`／`鄉鎮市區名稱`／`地址`／`電話`／`學年度`／`precision`）。
 *
 * ⚠️ 這兩份保留上游**原始中文欄位名**，popup 直接取中文 key（別跟 university_students 的英文欄位搞混）。
 * ⚠️ 兩份唯一的差異在代碼欄：kindergartens 是 `代碼`、mutual_care 是 `學校代碼` → `??` 容錯。
 * ⚠️ kindergartens 的 `縣市名稱`／`地址` 全數帶 `[NN]` 前綴 → 顯示前走 stripBracketPrefix()。
 */
export function EduKindergartenPanel({ props }: { props: Record<string, unknown> }) {
  const ownership = str(props["公/私立"]);
  const isOwnership = (v: string): v is keyof typeof KINDERGARTEN_OWNERSHIP_COLORS =>
    v in KINDERGARTEN_OWNERSHIP_COLORS;
  const accentColor = isOwnership(ownership)
    ? KINDERGARTEN_OWNERSHIP_COLORS[ownership]
    : EDUCATION_LAYER_COLORS.eduKindergarten;
  const city = stripBracketPrefix(props["縣市名稱"]);
  const district = str(props["鄉鎮市區名稱"]);
  const academicYear = str(props["學年度"]);

  return (
    <>
      <Title color={accentColor}>{str(props["學校名稱"]) || "幼兒園"}</Title>
      {ownership ? <Row label="公私立" value={ownership} color={accentColor} /> : null}
      <Row label="行政區" value={[city, district].filter(Boolean).join(" ")} />
      <Row label="地址" value={stripBracketPrefix(props["地址"])} />
      <Row label="電話" value={str(props["電話"])} />
      <Row label="代碼" value={str(props["代碼"] ?? props["學校代碼"])} />
      {academicYear ? <Row label="學年度" value={`${academicYear} 學年度`} /> : null}
      <GeocodeRow precision={props.precision} />
    </>
  );
}

/**
 * 兒童課後照顧服務中心（782 點）。
 * ⚠️ schema 與幼兒園**不同**：名稱欄是 `名稱`（非「學校名稱」）、縣市欄是 `縣市`（非「縣市名稱」），
 *    所以不能共用 EduKindergartenPanel。
 * ⚠️ `立案時間` 是 6-7 位**民國** YYYMMDD 數字 → 走 licenseDateLabel()。
 */
export function EduAfterschoolCarePanel({ props }: { props: Record<string, unknown> }) {
  const accentColor = EDUCATION_LAYER_COLORS.eduAfterschoolCare;

  return (
    <>
      <Title color={accentColor}>{str(props["名稱"]) || "課後照顧中心"}</Title>
      <Row label="縣市" value={str(props["縣市"])} />
      <Row label="地址" value={stripBracketPrefix(props["地址"])} />
      <Row label="電話" value={str(props["電話"])} />
      <Row label="立案時間" value={licenseDateLabel(props["立案時間"])} />
      <GeocodeRow precision={props.precision} />
    </>
  );
}

/**
 * 短期補習班（17,137 點，PMTiles）。
 *
 * 🔴 **絕對不要顯示 `各地短期補習班數量`**（= educationTypes.CRAM_FORBIDDEN_POPUP_FIELD）：
 *    那欄每一列的值都是全國總數 17772，不是該縣市數量，印出來會直接誤導。
 *    本 panel 逐欄列舉、不 iterate props，故不會外洩該欄。
 * ⚠️ `地區縣市` 的值是**機關名**（「臺南市政府」）→ 顯示改用上游清洗好的 `county`，機關名當 fallback。
 * ⚠️ `立案時間` 是 8 位**西元** YYYYMMDD（與課後照顧的民國紀年不同）→ 走 licenseDateLabel()。
 */
export function EduCramSchoolPanel({ props }: { props: Record<string, unknown> }) {
  const category = str(props["短期補習班類別"]);
  const group = cramCategoryGroupOf(category);
  const accentColor = group ? CRAM_CATEGORY_COLORS[group] : CRAM_CATEGORY_COLORS.other;

  return (
    <>
      <Title color={accentColor}>{str(props["短期補習班名稱"]) || "短期補習班"}</Title>
      <Row
        label="類別"
        value={group ? `${CRAM_CATEGORY_LABELS[group]}｜${category}` : category}
        color={accentColor}
      />
      <Row label="縣市" value={str(props.county) || str(props["地區縣市"])} />
      <Row label="地址" value={stripBracketPrefix(props["地址"])} />
      <Row label="立案時間" value={licenseDateLabel(props["立案時間"])} />
      <Row label="電子郵件" value={str(props["電子郵件"])} />
      <GeocodeRow precision={props.precision} />
      <Note>短期補習班為每日更新的資料源，此為 2026-08-07 快照</Note>
    </>
  );
}

/**
 * 大專校別學生數（159 點 bubble）。
 * ⚠️ 這份是**英文欄位**（`school_name`／`students_total`…），與上面四份中文欄位不是同一套。
 * ⚠️ 沒有 `precision` 欄（座標來自 schools 名冊而非 geocode）→ 不放定位精度列。
 *
 * 🔴 21 筆 `students_total` 是 null，**不能印 null 也不能當 0** —— 改顯示「無學生數統計」
 *    並說明三種成因（進修學院／空大 10 歸母校、宗教研修學院 9 不在統計、停辦改名 2）。
 */
export function EduUniversityStudentsPanel({ props }: { props: Record<string, unknown> }) {
  const total = typeof props.students_total === "number" ? props.students_total : null;
  const male = typeof props.students_male === "number" ? props.students_male : null;
  const female = typeof props.students_female === "number" ? props.students_female : null;
  const accentColor = total == null ? UNIVERSITY_NO_DATA_COLOR : UNIVERSITY_BUBBLE_COLOR;
  const city = str(props.city);
  const district = str(props.district);
  const academicYear = str(props.academic_year);
  // 上游是 float（16784.0）→ 四捨五入再千分位，避免印出「16784.0 人」
  const totalLabel =
    total == null
      ? "無學生數統計"
      : male != null && female != null
        ? `${Math.round(total).toLocaleString()} 人（男 ${Math.round(male).toLocaleString()}／女 ${Math.round(female).toLocaleString()}）`
        : `${Math.round(total).toLocaleString()} 人`;

  return (
    <>
      <Title color={accentColor}>{str(props.school_name) || "大專校院"}</Title>
      <Row label="學制" value={str(props.school_level)} />
      <Row label="行政區" value={[city, district].filter(Boolean).join(" ")} />
      <Row label="學生數" value={totalLabel} color={accentColor} />
      {academicYear ? <Row label="學年度" value={`${academicYear} 學年度`} /> : null}
      {total == null ? (
        <Note>
          全國 159 校中有 <b>21 校無學生數</b>：進修學院／空大 10 校（學生數歸母校統計）、
          宗教研修學院 9 校（不在教育部統計範圍）、停辦或改名 2 校。<b>不是 0 人。</b>
        </Note>
      ) : null}
    </>
  );
}
