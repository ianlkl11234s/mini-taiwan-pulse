import { Row, Title } from "./shared";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import {
  schoolLevelGroupOf, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS,
  REGION_TYPE_COLORS, type RegionType, CAMPUS_LEVEL_COLORS,
  DISTRICT_COLORS, DISTRICT_SENIOR_CYCLE_COLORS, DISTRICT_DISCLAIMER,
  type DistrictK12Level,
  KINDERGARTEN_OWNERSHIP_COLORS, cramCategoryGroupOf,
  CRAM_CATEGORY_COLORS, CRAM_CATEGORY_LABELS,
  GEOCODE_PRECISION_LABELS, UNIVERSITY_BUBBLE_COLOR, UNIVERSITY_NO_DATA_COLOR,
  EDUCATION_LAYER_COLORS,
} from "../../data/educationTypes";

function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

/** 翻譯字串內的 `<b>…</b>` 轉成粗體（說明框備註用；字串來自 JSON，不含使用者輸入） */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(<b>.*?<\/b>)/).map((part, i) =>
        part.startsWith("<b>") ? <b key={i}>{part.slice(3, -4)}</b> : part,
      )}
    </>
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
  const i18n = useLocale();
  const p = str(precision);
  return <Row field="positionAccuracy" value={p ? enumLabel("educationGeocode", p, GEOCODE_PRECISION_LABELS[p] ?? p, i18n) : ""} />;
}

/**
 * 學校點位（4,315 點，6 個 layer 共用）。
 * `school_level` 有 9 種原始值 → 用 schoolLevelGroupOf() fold 成 5 級才對得上圖層分色；
 * 未知值回 null（不硬塞顏色，走 fallback 藍）。
 */
export function SchoolPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
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
      <Title color={accentColor}>{str(props.school_name) || t("popup.education.school")}</Title>
      <Row
        label={t("popup.education.schoolSystem")}
        value={group
          ? `${enumLabel("educationSchoolGroup", group, SCHOOL_LEVEL_LABELS[group], i18n)}｜${enumLabel("educationSchoolLevel", level, level, i18n)}`
          : level ? enumLabel("educationSchoolLevel", level, level, i18n) : ""}
        color={accentColor}
      />
      {str(props.system_type) ? <Row label={t("popup.education.systemType")} value={str(props.system_type)} /> : null}
      {isRegionType(regionType) ? (
        <Row label={t("popup.education.remoteArea")} value={enumLabel("educationRegionType", regionType, regionType, i18n)} color={REGION_TYPE_COLORS[regionType]} />
      ) : null}
      <Row field="district" value={[city, district].filter(Boolean).join(" ")} />
      <Row field="address" value={str(props.address)} />
      <Row field="phone" value={str(props.phone)} />
      <Row label={t("popup.education.website")} value={str(props.website)} />
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
  const i18n = useLocale();
  const { t } = i18n;
  const levelCode = str(props.school_level);
  const levelZh = str(props.school_level_zh);
  const levelLabel = levelCode && levelZh ? enumLabel("educationCampusLevel", levelCode, levelZh, i18n) : levelZh;
  const accentColor = CAMPUS_LEVEL_COLORS[str(props.school_level)] ?? "#90a4ae";
  const areaHa = typeof props.area_ha === "number" ? props.area_ha : null;
  const isBranch = props.is_branch === true || props.is_branch === "true" || props.is_branch === 1;

  return (
    <>
      <Title color={accentColor}>{str(props.school_name) || t("popup.education.campusDefault")}</Title>
      <Row label={t("popup.education.schoolSystem")} value={levelLabel} color={accentColor} />
      {areaHa != null ? <Row label={t("popup.education.campusArea")} value={t("popup.education.hectares", { value: areaHa.toFixed(2) })} /> : null}
      <Row field="county" value={str(props.county)} />
      {isBranch ? <Row label={t("popup.education.branchCampus")} value={t("popup.common.yes")} /> : null}
      <Note><Rich text={t("popup.education.campusNote")} /></Note>
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
  const i18n = useLocale();
  const { t } = i18n;
  const level: DistrictK12Level = props.level === "junior" ? "junior" : "elementary";
  const accentColor = DISTRICT_COLORS[level].full;
  const county = str(props.county);
  const precision = str(props.precision);
  const villageCount = typeof props.village_count === "number" ? props.village_count : null;
  const areaKm2 = typeof props.area_km2 === "number" ? props.area_km2 : null;
  // ⚠️ PMTiles 的 boolean 多半原樣保留，但照 EduCampusPanel 的 is_branch 前例做三態容錯
  const isShared = props.is_shared === true || props.is_shared === "true" || props.is_shared === 1;
  // 鄰別：只有 village_partial 有值；village_full 是空字串 → 顯示「整里皆屬本校」（同 linSpecsLabel 的規則）
  const linSpecs = typeof props.lin_specs === "string" ? props.lin_specs.trim() : "";
  const linLabel = linSpecs || (props.precision === "village_full" ? t("popup.education.wholeVillageThis") : "—");

  return (
    <>
      <Title color={accentColor}>{str(props.school) || t("popup.education.districtDefault")}</Title>
      <Row
        label={t("popup.education.schoolSystem")}
        value={level === "junior" ? t("popup.education.juniorDistrict") : t("popup.education.elementaryDistrict")}
        color={accentColor}
      />
      <Row field="county" value={county} />
      {villageCount != null ? <Row label={t("popup.education.villageCoverage")} value={t("popup.education.villageCount", { count: villageCount })} /> : null}
      <Row label={t("popup.education.villageNames")} value={str(props.villages)} />
      <Row
        label={t("popup.education.boundaryPrecision")}
        value={precision === "village_full" || precision === "village_partial" ? enumLabel("educationDistrictPrecision", precision, precision === "village_full" ? "整里皆屬" : "部分鄰屬", i18n) : precision}
      />
      <Row label={t("popup.education.linSpecs")} value={linLabel} />
      {isShared ? (
        <Row label={t("popup.education.sharedDistrict")} value={t("popup.education.sharedDistrictValue")} color="#ffb74d" />
      ) : null}
      {areaKm2 != null ? <Row field="area" value={`${areaKm2.toFixed(2)} km²`} /> : null}
      <Note>{enumLabel("educationNote", "districtDisclaimer", DISTRICT_DISCLAIMER, i18n)}</Note>
      {county === "臺北市" ? <Note>{t("popup.education.taipei110")}</Note> : null}
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
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
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
        {Number.isFinite(no) ? t("popup.education.seniorTitle", { district: str(props.district), no }) : str(props.district) || t("popup.education.seniorDefault")}
      </Title>
      <Row
        label={t("popup.education.coveredCounties")}
        value={counties && countyCount != null ? t("popup.education.countiesWithCount", { counties, count: countyCount }) : counties}
      />
      {areaKm2 != null ? <Row field="area" value={`${areaKm2.toFixed(2)} km²`} /> : null}
      {rules ? (
        <>
          <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textMuted }}>{t("popup.education.crossDistrictRules")}</div>
          <div
            style={{
              marginTop: 2,
              maxHeight: 140,
              overflowY: "auto",
              fontSize: FONT_SIZE.xs,
              lineHeight: 1.6,
              color: theme.textStrong,
              wordBreak: "break-word",
            }}
          >
            {rules}
          </div>
        </>
      ) : null}
      <Note>{enumLabel("educationNote", "districtDisclaimer", DISTRICT_DISCLAIMER, i18n)}</Note>
      <Note><Rich text={t("popup.education.seniorNote")} /></Note>
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
  const i18n = useLocale();
  const { t } = i18n;
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
      <Title color={accentColor}>{str(props["學校名稱"]) || t("popup.education.kindergartenDefault")}</Title>
      {ownership ? <Row label={t("popup.education.ownership")} value={enumLabel("educationOwnership", ownership, ownership, i18n)} color={accentColor} /> : null}
      <Row field="district" value={[city, district].filter(Boolean).join(" ")} />
      <Row field="address" value={stripBracketPrefix(props["地址"])} />
      <Row field="phone" value={str(props["電話"])} />
      <Row field="code" value={str(props["代碼"] ?? props["學校代碼"])} />
      {academicYear ? <Row label={t("popup.education.academicYear")} value={t("popup.education.academicYearValue", { year: academicYear })} /> : null}
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
  const { t } = useLocale();
  const accentColor = EDUCATION_LAYER_COLORS.eduAfterschoolCare;

  return (
    <>
      <Title color={accentColor}>{str(props["名稱"]) || t("popup.education.afterschoolDefault")}</Title>
      <Row field="county" value={str(props["縣市"])} />
      <Row field="address" value={stripBracketPrefix(props["地址"])} />
      <Row field="phone" value={str(props["電話"])} />
      <Row label={t("popup.education.licensedAt")} value={licenseDateLabel(props["立案時間"])} />
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
  const i18n = useLocale();
  const { t } = i18n;
  const category = str(props["短期補習班類別"]);
  const group = cramCategoryGroupOf(category);
  const accentColor = group ? CRAM_CATEGORY_COLORS[group] : CRAM_CATEGORY_COLORS.other;

  return (
    <>
      <Title color={accentColor}>{str(props["短期補習班名稱"]) || t("popup.education.cramDefault")}</Title>
      <Row
        field="category"
        value={group
          ? `${enumLabel("educationCramGroup", group, CRAM_CATEGORY_LABELS[group], i18n)}｜${enumLabel("educationCramCategory", category, category, i18n)}`
          : category ? enumLabel("educationCramCategory", category, category, i18n) : ""}
        color={accentColor}
      />
      <Row field="county" value={str(props.county) || str(props["地區縣市"])} />
      <Row field="address" value={stripBracketPrefix(props["地址"])} />
      <Row label={t("popup.education.licensedAt")} value={licenseDateLabel(props["立案時間"])} />
      <Row label={t("popup.education.email")} value={str(props["電子郵件"])} />
      <GeocodeRow precision={props.precision} />
      <Note>{t("popup.education.cramNote")}</Note>
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
  const { t, formatNumber } = useLocale();
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
      ? t("popup.education.noStudentStats")
      : male != null && female != null
        ? t("popup.education.studentsWithGender", { total: formatNumber(Math.round(total)), male: formatNumber(Math.round(male)), female: formatNumber(Math.round(female)) })
        : t("popup.education.studentsTotal", { total: formatNumber(Math.round(total)) });

  return (
    <>
      <Title color={accentColor}>{str(props.school_name) || t("popup.education.universityDefault")}</Title>
      <Row label={t("popup.education.schoolSystem")} value={str(props.school_level)} />
      <Row field="district" value={[city, district].filter(Boolean).join(" ")} />
      <Row label={t("popup.education.studentCount")} value={totalLabel} color={accentColor} />
      {academicYear ? <Row label={t("popup.education.academicYear")} value={t("popup.education.academicYearValue", { year: academicYear })} /> : null}
      {total == null ? (
        <Note>
          <Rich text={t("popup.education.noStudentNote")} />
        </Note>
      ) : null}
    </>
  );
}
