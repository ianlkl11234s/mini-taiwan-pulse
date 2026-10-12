// Legend sub-components (civicServiceLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { BOUNDARY_GRAY, mapSeamColor } from "../../map/mapStyleScale";
import { usePaletteRamp } from "../../state/layerPalette";
import { THEMED_PAINT_COLORS, GOV_SERVICE_PAINT_COLORS } from "../../map/layerPaintColors";
import { JpMedicalStatus } from "../JpMedicalStatus";
import { JP_MEDICAL_AREA_LEVELS, JP_MEDICAL_CARE_GROUPS, JP_MEDICAL_CATEGORIES, JP_MEDICAL_GRID_BANDS } from "../../data/jpMedicalTypes";
import { JP_POLICE_FACILITY_TYPES, JP_POLICE_DEGRADED_COLOR, JP_POLICE_ATTRIBUTION } from "../../data/jpPoliceFacilityTypes";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { MEDICAL_POI_TYPES, medicalPoiColor } from "../../data/medicalPOITypes";
import { ACCESSIBILITY_STATUS_COLORS, BICYCLE_SUPPORT_COLORS } from "../../data/publicLifePalette";
import { JP_SCHOOL_TYPES } from "../../data/jpSchoolTypes";
import { ANIMAL_WELFARE_POINT_TYPES } from "../../data/animalWelfarePointsTypes";
import { WELFARE_LAYER_COLORS, NURSING_HOME_TYPES, ELDERLY_ATTR_GROUPS, DISABILITY_USAGE_BUCKETS, DISABILITY_USAGE_NA_LABEL, WELFARE_MISSING_COLOR, LTC_SERVICE_TYPES, CHILD_SERVICE_CLASSES, MENTAL_HEALTH_TYPES } from "../../data/welfareTypes";
import { SCHOOL_LEVEL_ORDER, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS, SCHOOL_LEVEL_COUNTS, REGION_TYPES, REGION_TYPE_COLORS, REGION_TYPE_COUNTS, CAMPUS_LEGEND_ROWS, CAMPUS_AREA_BUCKETS, DISTRICT_COLORS, DISTRICT_PRECISION_COUNTS, DISTRICT_DISCLAIMER, KINDERGARTEN_OWNERSHIP_COLORS, KINDERGARTEN_OWNERSHIP_COUNTS, CRAM_CATEGORY_ORDER, CRAM_CATEGORY_COLORS, CRAM_CATEGORY_LABELS, CRAM_CATEGORY_COUNTS, UNIVERSITY_BUBBLE_COLOR, UNIVERSITY_NO_DATA_COLOR, UNIVERSITY_STUDENTS_COUNTS, AFTERSCHOOL_CARE_COUNT, MUTUAL_CARE_COUNT, EDUCATION_LAYER_COLORS, type DistrictK12Level } from "../../data/educationTypes";
import { MEDICAL_ISOCHRONE_BANDS, MEDICAL_ISOCHRONE_NOTE } from "../../data/medicalIsochroneTypes";
import { DenseHeatmapLegendRow, FireCatRows, Swatch } from "./legendShared";

// ── 日本學校（学校分類 13 類，靜態無模式切換）──
// 13 列單欄太長 → 兩欄排版（比照非都市土地使用分區）；13 類已窮盡 56,807 筆，
// 故不列「その他」。色票 SSOT: data/jpSchoolTypes.ts（排列＝學制階梯，同階梯同色系）。

export function JpSchoolsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="學校類型 学校分類" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {JP_SCHOOL_TYPES.map((c) => (
          <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={c.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{c.label}</span>
          </div>
        ))}
      </div>
      <DenseHeatmapLegendRow layers={["jpSchools"]} />
    </div>
  );
}

export function AnimalAdoptionLegend() {
  const t = useLegendTheme();
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch color="#f59e0b" round /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>犬為主</span></div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><Swatch color="#a855f7" round /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>貓為主</span></div>
    <LegendNote style={{ marginTop: 4 }}>圓圈大小＝待認領養掛牌數；每日快照</LegendNote>
  </div>;
}

export function AnimalShelterPressureLegend() {
  const t = useLegendTheme();
  return <div>
    <div style={{ height: 8, borderRadius: 4, background: "linear-gradient(90deg, #d1fae5, #86efac, #facc15, #f97316, #dc2626)" }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      <span>低</span><span>80%</span><span>滿載 100%</span><span>超載</span>
    </div>
    <LegendNote style={{ marginTop: 4 }}>最新官方月報容量使用率；沒有官方值的縣市透明。</LegendNote>
  </div>;
}

export function AnimalWelfarePointsLegend() {
  const t = useLegendTheme();
  return <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    {ANIMAL_WELFARE_POINT_TYPES.map((item) => <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Swatch color={item.color} round />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{item.label}</span>
    </div>)}
    <LegendNote style={{ marginTop: 3 }}>服務來源涵蓋不一；未列點不表示該縣市沒有服務。</LegendNote>
  </div>;
}

export function GovServiceOfficeLegend() {
  const rows = [
    { color: GOV_SERVICE_PAINT_COLORS.district_office, label: "公所 District Office" },
    { color: GOV_SERVICE_PAINT_COLORS.household_registration, label: "戶政事務所 Household Reg." },
    { color: GOV_SERVICE_PAINT_COLORS.land_office, label: "地政事務所 Land Office" },
  ];
  return (
    <div>
      <LegendTitle zh="機關便民據點" en="Gov Service" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <LegendRow key={it.label} swatch={<SwatchDot color={it.color} />}>{it.label}</LegendRow>)}
      </div>
    </div>
  );
}

export function PublicToiletLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#7e57c2", label: "特優級 Excellent" },
    { color: "#ab47bc", label: "優等級 Superior" },
    { color: "#ffb300", label: "普通級 Ordinary" },
    { color: "#e53935", label: "不合格 Failed" },
  ];
  return (
    <div>
      <LegendTitle zh="公廁清潔評鑑" en="Toilet Grade" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
      <DenseHeatmapLegendRow layers={["publicToilets"]} />
    </div>
  );
}

// ── 🤝 社福長照 Legend（9 層同構家族，一個元件涵蓋全部 key）──
// 色票與筆數一律取自 welfareTypes.ts（分色 SSOT），本檔不重寫任何色碼或數字。

const WELFARE_KEYS: (keyof LayerVisibility)[] = [
  "welfareNursingHomes", "welfareElderlyHomes", "welfareDisability",
  "welfareLtcInstitutions", "welfareChildcare", "welfareChildServices",
  "welfareGovOffices", "welfareMentalHealth", "welfareSocialWorkOrgs",
];

export function WelfareLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const label = (s: string) => (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{s}</div>
  );
  const note = (s: React.ReactNode) => (
    <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>{s}</LegendNote>
  );
  const rows = (items: { key: string; color: string; label: string }[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((i) => (
        <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={i.color} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <LegendTitle zh="社福長照" en="Welfare" />

      {visibility.welfareNursingHomes && (
        <>
          {label("護理機構・型別（圓圈大小＝總床數）")}
          {rows(NURSING_HOME_TYPES.map((n) => ({ key: n.value, color: n.color, label: n.label })))}
          {note("居家護理所沒有床位，畫成最小點是事實不是資料缺漏；產後護理之家的床數在產後／嬰兒室兩欄")}
        </>
      )}

      {visibility.welfareElderlyHomes && (
        <div style={{ marginTop: visibility.welfareNursingHomes ? 5 : 0 }}>
          {label("老人住宿機構・公私別（圓圈大小＝核定床數）")}
          {rows(ELDERLY_ATTR_GROUPS.map((g) => ({ key: g.value, color: g.color, label: `${g.label} (${g.count.toLocaleString()})` })))}
        </div>
      )}

      {visibility.welfareDisability && (
        <div style={{ marginTop: 5 }}>
          {label("身障福利機構・使用率（實際安置／核定量）")}
          {rows([
            ...DISABILITY_USAGE_BUCKETS.map((b) => ({
              key: b.value, color: b.color, label: `${b.label} (${b.count})`,
            })),
            { key: "na", color: WELFARE_MISSING_COLOR, label: DISABILITY_USAGE_NA_LABEL },
          ])}
          {note("灰色是「上游未提供核定量」或「核定量為 0」（多為不收容的福利服務中心）—— 不是使用率 0%")}
        </div>
      )}

      {visibility.welfareLtcInstitutions && (
        <div style={{ marginTop: 5 }}>
          {label("長照立案機構・服務型態")}
          {rows(LTC_SERVICE_TYPES.map((s) => ({ key: s.value, color: s.color, label: `${s.label} (${s.count.toLocaleString()})` })))}
          {note(<>這是<b>立案機構</b>（長照服務法）；醫療主題的「長照機構」是長照 2.0 <b>特約單位</b>，兩套體系不可相加</>)}
        </div>
      )}

      {visibility.welfareChildServices && (
        <div style={{ marginTop: 5 }}>
          {label("兒少服務・類別")}
          {rows(CHILD_SERVICE_CLASSES.map((c) => ({ key: c.value, color: c.color, label: `${c.label} (${c.count.toLocaleString()})` })))}
          {note("早期療育含醫院／診所，與醫療主題重疊；另有 29 筆行動據點與保密安置機構結構性無地址，不在圖上")}
        </div>
      )}

      {visibility.welfareMentalHealth && (
        <div style={{ marginTop: 5 }}>
          {label("心理衛生機構・類別")}
          {rows(MENTAL_HEALTH_TYPES.map((m) => ({ key: m.value, color: m.color, label: `${m.label} (${m.count})` })))}
        </div>
      )}

      {visibility.welfareChildcare && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareChildcare} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>托嬰中心 (1,578)</span>
        </div>
      )}
      {visibility.welfareChildcare && note("名單約 21 個月舊；不含居家托育（保母），該類無全國資料源")}

      {visibility.welfareGovOffices && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareGovOffices} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>公部門社福據點 (151)</span>
        </div>
      )}
      {visibility.welfareGovOffices && note("已排除社福服務中心 162 處（在「基礎建設 › 公共設施 › 社福中心」）—— 兩層零重疊，要算全部請相加")}

      {visibility.welfareSocialWorkOrgs && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareSocialWorkOrgs} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>社福團體 (587)</span>
        </div>
      )}
      {visibility.welfareSocialWorkOrgs && note(<>⚠️ 是<b>登記組織</b>不是服務設施，地址多為辦公室 —— 不可當服務可近性指標</>)}

      {WELFARE_KEYS.some((k) => visibility[k]) && (
        <LegendNote style={{ marginTop: 5, lineHeight: 1.4 }}>
          放大到 z15 以上時，98 筆只解析到路段／區中心的點會變淡並加粗描邊（概略位置，非門牌）
        </LegendNote>
      )}
    </div>
  );
}

// ── 🎓 教育 Legend（學制 5 級 / 偏遠 3 級 / 校地面 6 組 / 幼兒園公私立 / 補習班 5 組 / 大專學生數）──
// 色票與筆數一律取自 educationTypes.ts（分色 SSOT），本檔不重寫任何色碼或數字。
// 🔴 分級色塊只在「依學制上色」的 6 層裡的點層開；eduRemoteSchools 是照 region_type 上色，
//    它的圖例是偏遠 3 級那段，混在一起會與畫面上的顏色對不起來。

const EDU_LEVEL_KEYS: (keyof LayerVisibility)[] = [
  "schools", "eduSchoolElementary", "eduSchoolJunior",
  "eduSchoolSenior", "eduSchoolUniversity", "eduSchoolSpecial",
];

// 學區面（k12）圖例列定義 —— 色票取自 DISTRICT_COLORS，本檔不重寫任何 hex。
// 🔴 只列「實際開啟那一級」：國小／國中的面完全疊合，兩級都列會與畫面上的顏色對不起來。
const EDU_LEVEL_LAYER_KEYS = {
  elementary: "eduSchoolElementary", junior: "eduSchoolJunior", senior: "eduSchoolSenior",
  university: "eduSchoolUniversity", special: "eduSchoolSpecial",
} as const;

const EDU_DISTRICT_K12_ROWS: { key: keyof LayerVisibility; label: string; level: DistrictK12Level }[] = [
  { key: "eduDistrictElementary", label: "國小學區", level: "elementary" },
  { key: "eduDistrictJunior", label: "國中學區", level: "junior" },
];

const EDU_KINDERGARTEN_OWNERSHIPS = ["公立", "私立"] as const;

// 單色 POI 兩層：只有「開了哪層就列哪列」一種語意，色票取自 EDUCATION_LAYER_COLORS
const EDU_CARE_ROWS: { key: keyof LayerVisibility; color: string; label: string }[] = [
  { key: "eduAfterschoolCare", color: EDUCATION_LAYER_COLORS.eduAfterschoolCare, label: `兒童課後照顧中心 ${AFTERSCHOOL_CARE_COUNT.toLocaleString()}` },
  { key: "eduMutualCare", color: EDUCATION_LAYER_COLORS.eduMutualCare, label: `互助教保服務中心 ${MUTUAL_CARE_COUNT.toLocaleString()}（全數私立）` },
];

export function EducationLegend({ isDark = true, visibility, schoolLevelColor = 0 }: { isDark?: boolean; visibility: LayerVisibility; schoolLevelColor?: number }) {
  const t = useLegendTheme();
  const showLevels = EDU_LEVEL_KEYS.some((k) => visibility[k]);
  const k12DistrictRows = EDU_DISTRICT_K12_ROWS
    .filter((r) => visibility[r.key])
    .flatMap((r) => [
      { id: `${r.key}-full`, color: DISTRICT_COLORS[r.level].full, label: `${r.label}：整里皆屬` },
      { id: `${r.key}-partial`, color: DISTRICT_COLORS[r.level].partial, label: `${r.label}：部分鄰屬` },
    ]);
  const showK12District = k12DistrictRows.length > 0;
  // W1 的 8 個學校／校地層有沒有開 —— 同時決定 (a) 學區段的 marginTop 要不要留間距、
  // (b) 🔴 頁尾「學校點位為 113 學年度」要不要出現（單開學區面時它會敘述一個沒開的圖層）
  const showSchoolSections = showLevels || !!visibility.eduRemoteSchools
    || !!visibility.eduCampusPolygon || !!visibility.eduCampusArea;
  // W1+W2（學校／校地／學區）有沒有任一段落 —— 純粹決定 W3 段落的 marginTop
  const showW1W2 = showSchoolSections || showK12District || !!visibility.eduDistrictSenior;
  const careRows = EDU_CARE_ROWS.filter((r) => visibility[r.key]);
  // 🔴 幼托四層共用同一套 geocode precision → interpolated 說明只出現一次，不逐層重複
  const showChildcare = !!visibility.eduKindergarten || !!visibility.eduCramSchool
    || careRows.length > 0;
  return (
    <div>
      <LegendTitle zh="教育" en="Education" />

      {showLevels && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>學制分級</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {SCHOOL_LEVEL_ORDER.map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {visibility.schools && schoolLevelColor === 0 && <Swatch color={THEMED_PAINT_COLORS.school[isDark ? "dark" : "light"]} round />}
                {(!visibility.schools || schoolLevelColor !== 0 || visibility[EDU_LEVEL_LAYER_KEYS[g]]) && <Swatch color={SCHOOL_LEVEL_COLORS[g]} round />}
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>
                  {SCHOOL_LEVEL_LABELS[g]} {SCHOOL_LEVEL_COUNTS[g].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            國小／國中含附設班（附設國小 42、附設國中 228）；大專含空大進修 10、宗教研修 9
          </LegendNote>
        </>
      )}

      {visibility.eduRemoteSchools && (
        <div style={{ marginTop: showLevels ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            偏遠地區學校・偏遠程度
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {REGION_TYPES.map((r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={REGION_TYPE_COLORS[r]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                  {r} {REGION_TYPE_COUNTS[r].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibility.eduCampusPolygon && (
        <div style={{ marginTop: showLevels || visibility.eduRemoteSchools ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            校地面（校園範圍）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CAMPUS_LEGEND_ROWS.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={row.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{row.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            低倍率（約 zoom 7.5 以下）不顯示；澎湖、金門 0 筆（來源圖資死鏈），空白不代表當地沒有學校
          </LegendNote>
        </div>
      )}

      {/* 校地面積面量圖 —— 與上一段同一份切片，色階與筆數一律取自 CAMPUS_AREA_BUCKETS */}
      {visibility.eduCampusArea && (
        <div style={{ marginTop: showLevels || visibility.eduRemoteSchools || visibility.eduCampusPolygon ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            校地面積分級
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CAMPUS_AREA_BUCKETS.map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={b.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{b.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            與「校地範圍」是同一份資料的兩種讀法：那層按學制分色，本層按面積分級
          </LegendNote>
          {/* 🔴 切片層級的限制跟著這份 PMTiles 走 —— 單開本層時上一段的註記不會出現，故必須重述 */}
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            低倍率（約 zoom 7.5 以下）不顯示；澎湖、金門 0 筆（來源圖資死鏈），空白不代表當地沒有學校
          </LegendNote>
        </div>
      )}

      {showK12District && (
        <div style={{ marginTop: showSchoolSections ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            國中小學區・面的精確度
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {k12DistrictRows.map((row) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={row.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{row.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 3, lineHeight: 1.4 }}>
            <div>{DISTRICT_DISCLAIMER}</div>
            <div>僅臺北、新北、臺中、新竹市 4 縣市有公告；其餘 11 縣市空白是「無資料」不是「無學區」</div>
            <div>面與面重疊是制度事實：共同學區 292 面，一個里可同時屬 2-3 校，未去重</div>
            <div>
              淡色 = 該里只有部分「鄰」屬本校（{DISTRICT_PRECISION_COUNTS.village_partial} 面），實際歸屬見 popup 的鄰別
            </div>
            <div>臺北為 110 學年度，其餘三縣市較新</div>
          </div>
        </div>
      )}

      {visibility.eduDistrictSenior && (
        <div style={{ marginTop: showSchoolSections || showK12District ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            高中就學區（縣市級・15 區）
          </div>
          {/* 🔴 15 色列不完也沒語意 → 不列色塊，改一行說明顏色的用途 */}
          <LegendNote style={{ lineHeight: 1.4 }}>
            顏色為 5 色循環，只用來區分相鄰區域，本身沒有語意
          </LegendNote>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {DISTRICT_DISCLAIMER}
          </LegendNote>
        </div>
      )}

      {visibility.eduKindergarten && (
        <div style={{ marginTop: showW1W2 ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            幼兒園・公私立
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {EDU_KINDERGARTEN_OWNERSHIPS.map((o) => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={KINDERGARTEN_OWNERSHIP_COLORS[o]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                  {o} {KINDERGARTEN_OWNERSHIP_COUNTS[o].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibility.eduCramSchool && (
        <div style={{ marginTop: showW1W2 || visibility.eduKindergarten ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            短期補習班・類別（14 種原始值歸為 5 組）
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {CRAM_CATEGORY_ORDER.map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Swatch color={CRAM_CATEGORY_COLORS[g]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>
                  {CRAM_CATEGORY_LABELS[g]} {CRAM_CATEGORY_COUNTS[g].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            短期補習班為每日更新的資料源，此為 2026-08-07 快照；低倍率（約 zoom 7.5 以下）不顯示，
            且切片在 zoom 15 以下有抽稀（放大才看得到完整密度，點少不代表該區補習班少）
          </LegendNote>
        </div>
      )}

      {careRows.length > 0 && (
        <div style={{ marginTop: showW1W2 || visibility.eduKindergarten || visibility.eduCramSchool ? 5 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {careRows.map((row) => (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={row.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showChildcare && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          半透明的點 = 位置為同路段內插的估計值（全體 84 筆），其餘為門牌精確或官方座標
        </LegendNote>
      )}

      {visibility.eduUniversityStudents && (
        <div style={{ marginTop: showW1W2 || showChildcare ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            大專校別學生數（{UNIVERSITY_STUDENTS_COUNTS.total} 校）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Swatch color={UNIVERSITY_BUBBLE_COLOR} round />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                有學生數統計 {UNIVERSITY_STUDENTS_COUNTS.withValue}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Swatch color={UNIVERSITY_NO_DATA_COLOR} round />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                無學生數統計 {UNIVERSITY_STUDENTS_COUNTS.nullValue}
              </span>
            </div>
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            圓大小反映學生數（368 ~ 34,941 人），最小尺寸另有下限
          </LegendNote>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            灰點 21 所無學生數統計（進修學院／空大歸母校、宗教研修不在統計範圍），不是 0 人
          </LegendNote>
        </div>
      )}

      {showSchoolSections && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          學校點位為 113 學年度
        </LegendNote>
      )}
    </div>
  );
}

export function MedicalIsochroneLegend() {
  return (
    <div>
      <LegendTitle zh="醫療等時圈" en="Medical Isochrone" />
      <FireCatRows
        cats={MEDICAL_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {MEDICAL_ISOCHRONE_NOTE}
      </LegendNote>
    </div>
  );
}

export function MedicalLegend({ visibility, isDark = true }: { visibility: LayerVisibility; isDark?: boolean }) {
  const t = useLegendTheme();
  // 只列出目前開啟的醫療 layer
  const shown = MEDICAL_POI_TYPES.filter((it) => visibility[it.visKey]);
  if (shown.length === 0) return null;
  return (
    <div>
      <LegendTitle zh="醫療據點" en="Medical" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={medicalPoiColor(it.id, isDark)} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
      {(visibility.medClinic || visibility.medAED || visibility.medLTC) && <DenseHeatmapLegendRow layers={["medClinic", "medAED", "medLTC"]} />}
    </div>
  );
}

// ── 警政司法民防 17 layer 共用圖例 ──
const POLICE_JUSTICE_LEGEND: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "line" | "square" }[] = [
  { key: "policeStation", color: "#1e40af", label: "警察機關", shape: "circle" },
  { key: "womenChildWarning", color: "#ec4899", label: "婦幼警示點", shape: "circle" },
  { key: "speedCamera", color: "#dc2626", label: "測速照相", shape: "circle" },
  { key: "speedZoneSegment", color: "#b91c1c", label: "區間測速路段", shape: "line" },
  { key: "court", color: "#7c3aed", label: "法院", shape: "circle" },
  { key: "prosecutorsOffice", color: "#a855f7", label: "檢察署", shape: "circle" },
  { key: "correctionalFacility", color: "#374151", label: "矯正機關", shape: "circle" },
  { key: "courtJurisdiction", color: "#c4b5fd", label: "法院管轄區（縣市）", shape: "square" },
  { key: "crimeAreaMonthly", color: "#991b1b", label: "鄉鎮犯罪 choropleth", shape: "square" },
  { key: "theftTaoyuan", color: "#f59e0b", label: "桃園竊盜", shape: "circle" },
  { key: "trafficAccidentYearly", color: "#fb7185", label: "A1 死亡事故（年度）", shape: "circle" },
  { key: "accidentTaipei", color: "#fda4af", label: "北市事故點 (A1/A2)", shape: "circle" },
  { key: "a1AccidentRealtime", color: "#ef4444", label: "A1 即時死亡事故", shape: "circle" },
  { key: "investigationBureau", color: "#0f766e", label: "調查局", shape: "circle" },
  { key: "antiCorruptionOffice", color: "#14b8a6", label: "廉政（中央/地方）", shape: "circle" },
  { key: "immigrationOffice", color: "#0ea5e9", label: "移民署服務站", shape: "circle" },
  { key: "coastGuardStation", color: "#0284c7", label: "海巡（巡防/漁港）", shape: "circle" },
  { key: "civilDefenseShelter", color: "#64748b", label: "防空避難所", shape: "circle" },
];

// ── 警察覆蓋分析 isochrone — overlap_count 色階 ──
const ISO_OVERLAP_BANDS: { c: string; l: string }[] = [
  { c: "#fee2e2", l: "1 站覆蓋" },
  { c: "#fca5a5", l: "2 站重疊" },
  { c: "#f87171", l: "3~4 站" },
  { c: "#ef4444", l: "5~7 站" },
  { c: "#dc2626", l: "8~11 站" },
  { c: "#991b1b", l: "12~19 站" },
  { c: "#7f1d1d", l: "20+ 站（市中心多重保護）" },
];

export function PoliceIsochroneLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const anyOn = visibility.policeIsoSubstation || visibility.policeIsoPrecinct || visibility.policeIsoCityDept;
  if (!anyOn) return null;
  return (
    <div>
      <LegendTitle zh="警察覆蓋 · 重疊計數" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {ISO_OVERLAP_BANDS.map((b) => (
          <div key={b.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={b.c} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{b.l}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 5, lineHeight: 1.4 }}>
        每個面塊算「被幾個 station 同時覆蓋」，市中心通常 20+ 站重疊。
      </LegendNote>
    </div>
  );
}

export function PoliceJusticeLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const active = POLICE_JUSTICE_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh="警政司法民防" en="Law & Order" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {active.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: r.shape === "line" ? 18 : 10,
                height: r.shape === "line" ? 3 : 10,
                background: r.color,
                borderRadius: r.shape === "circle" ? RADIUS.full : r.shape === "square" ? RADIUS.sm : 0,
                border: "1px solid rgba(255,255,255,0.4)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* 警察階層細分 — 開啟 policeStation 時顯示 */}
      {visibility.policeStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>警察階層（大小+色深）</div>
          {[
            { c: "#0a1e6b", s: 14, l: "警政署（總部）" },
            { c: "#1e3a8a", s: 11, l: "縣市警察局" },
            { c: "#1e40af", s: 9, l: "分局" },
            { c: "#3b82f6", s: 6, l: "派出所" },
            { c: "#dc2626", s: 8, l: "專業警隊（紅）" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 測速限速 — 開啟 speedCamera 時顯示 */}
      {visibility.speedCamera && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>限速越低 圈越大</div>
          {[
            { s: 14, l: "≤30 km/h（學校區）" },
            { s: 10, l: "40~50（市區）" },
            { s: 7, l: "60~80（省道）" },
            { s: 5, l: "≥90（國道）" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: "#dc2626", border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* A1 即時 30 天滾動 — 開啟 a1AccidentRealtime 時顯示 */}
      {visibility.a1AccidentRealtime && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>過去 30 天滾動</div>
          {[
            { c: "#ef4444", s: 14, l: "當天 (<24h)+漣漪" },
            { c: "#dc2626", s: 9, l: "本週 (1~7天)" },
            { c: "#7f1d1d", s: 5, l: "30 天內" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 法院階層 */}
      {visibility.court && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>法院階層</div>
          {[
            { c: "#4c1d95", s: 14, l: "最高法院 (2)" },
            { c: "#6d28d9", s: 11, l: "高等法院 (6)" },
            { c: "#7c3aed", s: 10, l: "高等行政 (3)" },
            { c: "#a855f7", s: 9, l: "智財商業 / 少家事" },
            { c: "#c4b5fd", s: 7, l: "地方法院 (22)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 檢察署階層 */}
      {visibility.prosecutorsOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>檢察署階層</div>
          {[
            { c: "#581c87", s: 13, l: "最高檢察署 (1)" },
            { c: "#7e22ce", s: 10, l: "高等檢察署 (6)" },
            { c: "#c084fc", s: 7, l: "地方檢察署 (22)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 矯正機關階層 */}
      {visibility.correctionalFacility && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>矯正機關</div>
          {[
            { c: "#111827", s: 14, l: "監獄 (29)" },
            { c: "#374151", s: 11, l: "看守所 (12)" },
            { c: "#7c3aed", s: 9, l: "戒治所 (4)" },
            { c: "#0d9488", s: 9, l: "矯正學校 (4)" },
            { c: "#0ea5e9", s: 8, l: "少年觀護所 (2)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 調查局階層 */}
      {visibility.investigationBureau && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>調查局</div>
          {[
            { c: "#064e3b", s: 11, l: "縣市調查處 (10)" },
            { c: "#0f766e", s: 7, l: "調查站 / 其他 (19)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 廉政階層 */}
      {visibility.antiCorruptionOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>廉政</div>
          {[
            { c: "#134e4a", s: 10, l: "中央 central (43)" },
            { c: "#5eead4", s: 6, l: "地方 local (23)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 海巡分類 */}
      {visibility.coastGuardStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>海巡</div>
          {[
            { c: "#0c4a6e", s: 11, l: "海洋分署 (17)" },
            { c: "#38bdf8", s: 6, l: "巡防隊 (252)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}
      {visibility.accidentTaipei && <DenseHeatmapLegendRow layers={["accidentTaipei"]} />}
    </div>
  );
}

export function JpPoliceFacilitiesLegend() {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 320 }}>
    <div style={{ marginBottom: 4 }}>警察設施 警察施設</div>
    {JP_POLICE_FACILITY_TYPES.map(c => <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <SwatchDot color={c.color} />{c.label}
    </div>)}
    <div style={{ marginTop: 5 }}><SwatchDot color="transparent" stroke={JP_POLICE_DEGRADED_COLOR} strokeWidth={2} /> 橘色外框＝約略位置（22 點）；地址只解析到丁目／町域。</div>
    <div>NPA 官方名冊：13,196 筆</div>
    <div>地圖可顯示：13,195 點；無座標：1 筆（原始地址缺漏）</div>
    <div>資料時點：2025-04-01</div>
    <div style={{ marginTop: 5 }}>{JP_POLICE_ATTRIBUTION}</div>
    <DenseHeatmapLegendRow layers={["jpPoliceFacilities"]} />
  </div>;
}

export function JpMedicalLegend({ layerKey }: { layerKey: string }) {
  const t = useLegendTheme();
  const facility = JP_MEDICAL_CATEGORIES.find(item => item.key === layerKey);
  const care = JP_MEDICAL_CARE_GROUPS.find(item => item.key === layerKey);
  const area = JP_MEDICAL_AREA_LEVELS.find(item => item.key === layerKey);
  // R7：醫療／照護低縮放格讀共用的網格色盤選單（醫療圈層沒有色盤，結果不使用）
  const gridColors = usePaletteRamp(layerKey, t.isDark, JP_MEDICAL_GRID_BANDS.length);
  const kind = facility ? "facilities" : care ? "care" : "areas";
  const row = facility ?? care ?? area;
  if (!row) return null;
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, lineHeight: 1.5 }}>
    <strong>{row.label}</strong>
    <div style={{ margin: "4px 0" }}><JpMedicalStatus kind={kind} layerKey={layerKey} /></div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {kind === "areas" ? <SwatchSquare color={row.color} stroke={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} /> : <SwatchDot color={row.color} />}{row.label}
    </div>
    {kind !== "areas" && <>
      <div style={{ color: t.textDim, marginTop: 5 }}>zoom &lt; 8：10 km 等面積格內筆數</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 3 }}>
        {JP_MEDICAL_GRID_BANDS.map((band, i) => <span key={band.min} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <SwatchSquare color={gridColors[i]!} stroke={mapSeamColor(t.isDark)} />{band.label}
        </span>)}
      </div>
    </>}
    <div style={{ color: t.textDim, marginTop: 5 }}>{kind === "areas"
      ? "国土数値情報 A38 · 2020 歷史版。這是行政規劃邊界，不是設施服務範圍；人口／面積不可按 polygon part 加總。"
      : kind === "care"
      ? "厚生労働省 H17。低縮放每格加總目前開啟分類的服務登記；不是容量、服務人次或唯一機構數。zoom ≥ 8 每個圓點是一筆完整服務登記；同址可有多筆。"
      : "厚生労働省 Navii。低縮放每格加總目前開啟分類的可繪製設施；不是病床數、容量或服務範圍。zoom ≥ 8 每個圓點是一筆完整可繪製設施；缺座標另列。助產所來源僅涵蓋 45 縣；公告時段非即時可接診。"}</div>
  </div>;
}

export function PublicLifeOsmLegend({ label, color, extra }: { label: string; color: string; extra?: string }) {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><SwatchDot color={color} />{label}</div>
    <div style={{ marginTop: 5 }}>© OpenStreetMap contributors (ODbL) · snapshot exploration，非完整官方清冊。</div>
    {extra && <div style={{ marginTop: 3 }}>{extra}</div>}
  </div>;
}

export function GovernmentLifeLegend({ label, color, source, extra }: { label: string; color: string; source: string; extra: string }) {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><SwatchDot color={color} />{label}</div>
    <div style={{ marginTop: 5 }}>{source} · 政府資料開放授權條款第1版。</div>
    <div style={{ marginTop: 3 }}>{extra}</div>
  </div>;
}

export function BicycleSupportLegend() {
  const t = useLegendTheme();
  const items = [[BICYCLE_SUPPORT_COLORS.repair, "維修"], [BICYCLE_SUPPORT_COLORS.air, "打氣"], [BICYCLE_SUPPORT_COLORS.parking, "停車"], [BICYCLE_SUPPORT_COLORS.water, "飲水"], [BICYCLE_SUPPORT_COLORS.toilet, "公廁"], [BICYCLE_SUPPORT_COLORS.other, "其他"]];
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {items.map(([c, l]) => <div key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchDot color={c!} />{l}</div>)}
    <div style={{ marginTop: 5 }}>OSM snapshot exploration；同點多類時依維修、打氣、停車、飲水、公廁順序著色，非完整官方清冊。</div>
    <DenseHeatmapLegendRow layers={["bicycleSupport"]} />
  </div>;
}

export function AccessibleParkLegend() {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {[[ACCESSIBILITY_STATUS_COLORS.yes, 'yes'], [ACCESSIBILITY_STATUS_COLORS.limited, 'limited'], [ACCESSIBILITY_STATUS_COLORS.no, 'no'], [ACCESSIBILITY_STATUS_COLORS.unknown, 'unknown']].map(([c, l]) => <div key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchDot color={c!} />{l}</div>)}
    <div style={{ marginTop: 5 }}>OSM snapshot exploration；unknown 不等於 false，非完整官方清冊。</div>
    <DenseHeatmapLegendRow layers={["accessibleParkFacilities"]} />
  </div>;
}

export function PublicLifeCoverageLegend() {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {[['#e2e8f0', '0'], ['#bfdbfe', '1–4'], ['#60a5fa', '5–14'], ['#1d4ed8', '15+']].map(([c, l]) => <div key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchSquare color={c!} />觀測數 {l}</div>)}
    <div style={{ marginTop: 5 }}>OSM 映射密度，不是服務品質、人口覆蓋或道路可達性。</div>
  </div>;
}
