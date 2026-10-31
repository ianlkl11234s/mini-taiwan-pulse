// Legend sub-components (civicServiceLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { BOUNDARY_GRAY, mapSeamColor } from "../../map/mapStyleScale";
import { usePaletteRamp } from "../../state/layerPalette";
import { THEMED_PAINT_COLORS, GOV_SERVICE_PAINT_COLORS } from "../../map/layerPaintColors";
import { JpMedicalStatus } from "../JpMedicalStatus";
import { JP_MEDICAL_AREA_LEVELS, JP_MEDICAL_CARE_GROUPS, JP_MEDICAL_CATEGORIES, JP_MEDICAL_GRID_BANDS } from "../../data/jpMedicalTypes";
import { JP_POLICE_FACILITY_TYPES, JP_POLICE_DEGRADED_COLOR, JP_POLICE_ATTRIBUTION } from "../../data/jpPoliceFacilityTypes";
import { JP_EVACUATION_SITE_TYPES, JP_EVACUATION_ATTRIBUTION } from "../../data/jpEvacuationSiteTypes";
import { JP_PUBLIC_OFFICE_CLASSES, JP_PUBLIC_OFFICE_ATTRIBUTION } from "../../data/jpPublicOfficeTypes";
import { JP_BUS_STOP_CLASSES, JP_BUS_STOP_ATTRIBUTION } from "../../data/jpBusStopTypes";
import { JP_LANDSLIDE_ZONES, JP_LANDSLIDE_ATTRIBUTION, JP_LANDSLIDE_FEATURE_COUNT } from "../../data/jpLandslideWarningTypes";
import { JP_ZONING_CLASSES, JP_ZONING_ATTRIBUTION, JP_ZONING_FEATURE_COUNT } from "../../data/jpZoningUseDistrictTypes";
import { JP_FOREST_FUNCTION_TYPES, JP_FOREST_BLANK_COLOR, JP_FOREST_ATTRIBUTION } from "../../data/jpNationalForestTypes";
import { JP_WELFARE_ATTRIBUTION, JP_WELFARE_LAYER_MAJOR, jpWelfareCategoriesOf, jpWelfareGroupsOf, type JpWelfareLayerKey } from "../../data/jpWelfareFacilityTypes";
import { JP_INLAND_FLOOD_DEPTH_CLASSES, JP_INLAND_FLOOD_ATTRIBUTION, JP_INLAND_FLOOD_STEPS } from "../../data/jpInlandFloodTypes";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { MEDICAL_POI_TYPES, medicalPoiColor } from "../../data/medicalPOITypes";
import { EMERGENCY_HOSPITAL_LEVELS, EMERGENCY_HOSPITAL_DATA_AS_OF } from "../../data/emergencyHospitalTypes";
import { ACCESSIBILITY_STATUS_COLORS, BICYCLE_SUPPORT_COLORS } from "../../data/publicLifePalette";
import { JP_SCHOOL_TYPES } from "../../data/jpSchoolTypes";
import { ANIMAL_WELFARE_POINT_TYPES } from "../../data/animalWelfarePointsTypes";
import { WELFARE_LAYER_COLORS, NURSING_HOME_TYPES, ELDERLY_ATTR_GROUPS, DISABILITY_USAGE_BUCKETS, WELFARE_MISSING_COLOR, LTC_SERVICE_TYPES, CHILD_SERVICE_CLASSES, MENTAL_HEALTH_TYPES } from "../../data/welfareTypes";
import { SCHOOL_LEVEL_ORDER, SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_LABELS, SCHOOL_LEVEL_COUNTS, REGION_TYPES, REGION_TYPE_COLORS, REGION_TYPE_COUNTS, CAMPUS_LEGEND_ROWS, CAMPUS_AREA_BUCKETS, DISTRICT_COLORS, DISTRICT_PRECISION_COUNTS, DISTRICT_DISCLAIMER, KINDERGARTEN_OWNERSHIP_COLORS, KINDERGARTEN_OWNERSHIP_COUNTS, CRAM_CATEGORY_ORDER, CRAM_CATEGORY_COLORS, CRAM_CATEGORY_LABELS, CRAM_CATEGORY_COUNTS, UNIVERSITY_BUBBLE_COLOR, UNIVERSITY_NO_DATA_COLOR, UNIVERSITY_STUDENTS_COUNTS, AFTERSCHOOL_CARE_COUNT, MUTUAL_CARE_COUNT, EDUCATION_LAYER_COLORS, type DistrictK12Level } from "../../data/educationTypes";
import { MEDICAL_ISOCHRONE_BANDS, MEDICAL_ISOCHRONE_NOTE } from "../../data/medicalIsochroneTypes";
import { DenseHeatmapLegendRow, FireCatRows, Swatch } from "./legendShared";
import { useLocale } from "../../state/localeStore";
import { displayRocYear, enumLabel } from "../../i18n/dataText";
import type { MessageKey } from "../../i18n/keys";

// ── 日本學校（学校分類 13 類，靜態無模式切換）──
// 13 列單欄太長 → 兩欄排版（比照非都市土地使用分區）；13 類已窮盡 56,807 筆，
// 故不列「その他」。色票 SSOT: data/jpSchoolTypes.ts（排列＝學制階梯，同階梯同色系）。

export function JpSchoolsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.jpSchoolsTitle")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {JP_SCHOOL_TYPES.map((c) => (
          <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SwatchDot color={c.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{enumLabel("jpSchoolClass", c.value, c.label, i18n)}</span>
          </div>
        ))}
      </div>
      <DenseHeatmapLegendRow layers={["jpSchools"]} />
    </div>
  );
}

export function AnimalAdoptionLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch color="#f59e0b" round /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.civic.adoptDog")}</span></div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><Swatch color="#a855f7" round /><span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.civic.adoptCat")}</span></div>
    <LegendNote style={{ marginTop: 4 }}>{i18n.t("legend.civic.adoptNote")}</LegendNote>
  </div>;
}

export function AnimalShelterPressureLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div>
    <div style={{ height: 8, borderRadius: 4, background: "linear-gradient(90deg, #d1fae5, #86efac, #facc15, #f97316, #dc2626)" }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      <span>{i18n.t("legend.common.low")}</span><span>80%</span><span>{i18n.t("legend.civic.pressureFull")}</span><span>{i18n.t("legend.civic.pressureOver")}</span>
    </div>
    <LegendNote style={{ marginTop: 4 }}>{i18n.t("legend.civic.pressureNote")}</LegendNote>
  </div>;
}

export function AnimalWelfarePointsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    {ANIMAL_WELFARE_POINT_TYPES.map((item) => <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Swatch color={item.color} round />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("animalWelfarePointType", item.value, item.label, i18n)}</span>
    </div>)}
    <LegendNote style={{ marginTop: 3 }}>{i18n.t("legend.civic.welfarePointsNote")}</LegendNote>
  </div>;
}

export function GovServiceOfficeLegend() {
  const i18n = useLocale();
  const rows = [
    { code: "district_office", color: GOV_SERVICE_PAINT_COLORS.district_office, label: "公所 District Office" },
    { code: "household_registration", color: GOV_SERVICE_PAINT_COLORS.household_registration, label: "戶政事務所 Household Reg." },
    { code: "land_office", color: GOV_SERVICE_PAINT_COLORS.land_office, label: "地政事務所 Land Office" },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.govServiceTitle")} en="Gov Service" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <LegendRow key={it.label} swatch={<SwatchDot color={it.color} />}>{enumLabel("infraGovOffice", it.code, it.label, i18n)}</LegendRow>)}
      </div>
    </div>
  );
}

export function PublicToiletLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = [
    { code: "特優級", color: "#7e57c2", label: "特優級 Excellent" },
    { code: "優等級", color: "#ab47bc", label: "優等級 Superior" },
    { code: "普通級", color: "#ffb300", label: "普通級 Ordinary" },
    { code: "不合格", color: "#e53935", label: "不合格 Failed" },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.toiletTitle")} en="Toilet Grade" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("infraToiletGrade", it.code, it.label, i18n)}</span>
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
  const i18n = useLocale();
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
      <LegendTitle zh={i18n.t("legend.civic.welfareTitle")} en="Welfare" />

      {visibility.welfareNursingHomes && (
        <>
          {label(i18n.t("legend.civic.nursingLabel"))}
          {rows(NURSING_HOME_TYPES.map((n) => ({ key: n.value, color: n.color, label: enumLabel("welfareNursing", n.value, n.label, i18n) })))}
          {note(i18n.t("legend.civic.nursingNote"))}
        </>
      )}

      {visibility.welfareElderlyHomes && (
        <div style={{ marginTop: visibility.welfareNursingHomes ? 5 : 0 }}>
          {label(i18n.t("legend.civic.elderlyLabel"))}
          {rows(ELDERLY_ATTR_GROUPS.map((g) => ({ key: g.value, color: g.color, label: `${enumLabel("welfareElderlyAttr", g.value, g.label, i18n)} (${i18n.formatNumber(g.count)})` })))}
        </div>
      )}

      {visibility.welfareDisability && (
        <div style={{ marginTop: 5 }}>
          {label(i18n.t("legend.civic.disabilityLabel"))}
          {rows([
            ...DISABILITY_USAGE_BUCKETS.map((b) => ({
              key: b.value, color: b.color, label: `${enumLabel("welfareDisabilityUsage", b.value, b.label, i18n)} (${b.count})`,
            })),
            { key: "na", color: WELFARE_MISSING_COLOR, label: i18n.t("legend.civic.disabilityNa") },
          ])}
          {note(i18n.t("legend.civic.disabilityNote"))}
        </div>
      )}

      {visibility.welfareLtcInstitutions && (
        <div style={{ marginTop: 5 }}>
          {label(i18n.t("legend.civic.ltcLabel"))}
          {rows(LTC_SERVICE_TYPES.map((s) => ({ key: s.value, color: s.color, label: `${enumLabel("welfareLtc", s.value, s.label, i18n)} (${i18n.formatNumber(s.count)})` })))}
          {note(<>{i18n.t("legend.civic.ltcNoteA")}<b>{i18n.t("legend.civic.ltcNoteB")}</b>{i18n.t("legend.civic.ltcNoteC")}<b>{i18n.t("legend.civic.ltcNoteD")}</b>{i18n.t("legend.civic.ltcNoteE")}</>)}
        </div>
      )}

      {visibility.welfareChildServices && (
        <div style={{ marginTop: 5 }}>
          {label(i18n.t("legend.civic.childServiceLabel"))}
          {rows(CHILD_SERVICE_CLASSES.map((c) => ({ key: c.value, color: c.color, label: `${enumLabel("welfareChildService", c.value, c.label, i18n)} (${i18n.formatNumber(c.count)})` })))}
          {note(i18n.t("legend.civic.childServiceNote"))}
        </div>
      )}

      {visibility.welfareMentalHealth && (
        <div style={{ marginTop: 5 }}>
          {label(i18n.t("legend.civic.mentalLabel"))}
          {rows(MENTAL_HEALTH_TYPES.map((m) => ({ key: m.value, color: m.color, label: `${enumLabel("welfareMentalHealth", m.value, m.label, i18n)} (${m.count})` })))}
        </div>
      )}

      {visibility.welfareChildcare && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareChildcare} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.civic.childcareName")}</span>
        </div>
      )}
      {visibility.welfareChildcare && note(i18n.t("legend.civic.childcareNote"))}

      {visibility.welfareGovOffices && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareGovOffices} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.civic.govOfficesName")}</span>
        </div>
      )}
      {visibility.welfareGovOffices && note(i18n.t("legend.civic.govOfficesNote"))}

      {visibility.welfareSocialWorkOrgs && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={WELFARE_LAYER_COLORS.welfareSocialWorkOrgs} round />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.civic.socialOrgsName")}</span>
        </div>
      )}
      {visibility.welfareSocialWorkOrgs && note(<>{i18n.t("legend.civic.orgNoteA")}<b>{i18n.t("legend.civic.orgNoteB")}</b>{i18n.t("legend.civic.orgNoteC")}</>)}

      {WELFARE_KEYS.some((k) => visibility[k]) && (
        <LegendNote style={{ marginTop: 5, lineHeight: 1.4 }}>
          {i18n.t("legend.civic.approxNote")}
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

const EDU_DISTRICT_K12_ROWS: { key: keyof LayerVisibility; fullKey: MessageKey; partialKey: MessageKey; level: DistrictK12Level }[] = [
  { key: "eduDistrictElementary", fullKey: "legend.civic.eduDistrictElementaryFull", partialKey: "legend.civic.eduDistrictElementaryPartial", level: "elementary" },
  { key: "eduDistrictJunior", fullKey: "legend.civic.eduDistrictJuniorFull", partialKey: "legend.civic.eduDistrictJuniorPartial", level: "junior" },
];

const EDU_KINDERGARTEN_OWNERSHIPS = ["公立", "私立"] as const;

// 單色 POI 兩層：只有「開了哪層就列哪列」一種語意，色票取自 EDUCATION_LAYER_COLORS
const EDU_CARE_ROWS: { key: keyof LayerVisibility; color: string; labelKey: MessageKey; count: number }[] = [
  { key: "eduAfterschoolCare", color: EDUCATION_LAYER_COLORS.eduAfterschoolCare, labelKey: "legend.civic.eduAfterschoolCare", count: AFTERSCHOOL_CARE_COUNT },
  { key: "eduMutualCare", color: EDUCATION_LAYER_COLORS.eduMutualCare, labelKey: "legend.civic.eduMutualCare", count: MUTUAL_CARE_COUNT },
];

export function EducationLegend({ isDark = true, visibility, schoolLevelColor = 0 }: { isDark?: boolean; visibility: LayerVisibility; schoolLevelColor?: number }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const showLevels = EDU_LEVEL_KEYS.some((k) => visibility[k]);
  const k12DistrictRows = EDU_DISTRICT_K12_ROWS
    .filter((r) => visibility[r.key])
    .flatMap((r) => [
      { id: `${r.key}-full`, color: DISTRICT_COLORS[r.level].full, label: i18n.t(r.fullKey) },
      { id: `${r.key}-partial`, color: DISTRICT_COLORS[r.level].partial, label: i18n.t(r.partialKey) },
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
      <LegendTitle zh={i18n.t("legend.civic.eduTitle")} en="Education" />

      {showLevels && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.civic.eduLevels")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {SCHOOL_LEVEL_ORDER.map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {visibility.schools && schoolLevelColor === 0 && <Swatch color={THEMED_PAINT_COLORS.school[isDark ? "dark" : "light"]} round />}
                {(!visibility.schools || schoolLevelColor !== 0 || visibility[EDU_LEVEL_LAYER_KEYS[g]]) && <Swatch color={SCHOOL_LEVEL_COLORS[g]} round />}
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>
                  {enumLabel("educationSchoolGroup", g, SCHOOL_LEVEL_LABELS[g], i18n)} {i18n.formatNumber(SCHOOL_LEVEL_COUNTS[g])}
                </span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduLevelNote")}
          </LegendNote>
        </>
      )}

      {visibility.eduRemoteSchools && (
        <div style={{ marginTop: showLevels ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduRemoteLabel")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {REGION_TYPES.map((r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={REGION_TYPE_COLORS[r]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                  {enumLabel("educationRegionType", r, r, i18n)} {i18n.formatNumber(REGION_TYPE_COUNTS[r])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibility.eduCampusPolygon && (
        <div style={{ marginTop: showLevels || visibility.eduRemoteSchools ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduCampusLabel")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CAMPUS_LEGEND_ROWS.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={row.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendCampus", row.label, row.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduLowZoomNote")}
          </LegendNote>
        </div>
      )}

      {/* 校地面積面量圖 —— 與上一段同一份切片，色階與筆數一律取自 CAMPUS_AREA_BUCKETS */}
      {visibility.eduCampusArea && (
        <div style={{ marginTop: showLevels || visibility.eduRemoteSchools || visibility.eduCampusPolygon ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduAreaLabel")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CAMPUS_AREA_BUCKETS.map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={b.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendCampusArea", b.label, b.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduAreaNote")}
          </LegendNote>
          {/* 🔴 切片層級的限制跟著這份 PMTiles 走 —— 單開本層時上一段的註記不會出現，故必須重述 */}
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduLowZoomNote")}
          </LegendNote>
        </div>
      )}

      {showK12District && (
        <div style={{ marginTop: showSchoolSections ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduK12Label")}
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
            <div>{enumLabel("educationNote", "districtDisclaimer", DISTRICT_DISCLAIMER, i18n)}</div>
            <div>{i18n.t("legend.civic.eduDistrictNote1")}</div>
            <div>{i18n.t("legend.civic.eduDistrictNote2")}</div>
            <div>
              {i18n.t("legend.civic.eduDistrictPartial", { n: DISTRICT_PRECISION_COUNTS.village_partial })}
            </div>
            <div>{i18n.t("legend.civic.eduDistrictNote4", { year: displayRocYear(110, i18n) })}</div>
          </div>
        </div>
      )}

      {visibility.eduDistrictSenior && (
        <div style={{ marginTop: showSchoolSections || showK12District ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduSeniorLabel")}
          </div>
          {/* 🔴 15 色列不完也沒語意 → 不列色塊，改一行說明顏色的用途 */}
          <LegendNote style={{ lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduSeniorNote")}
          </LegendNote>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {enumLabel("educationNote", "districtDisclaimer", DISTRICT_DISCLAIMER, i18n)}
          </LegendNote>
        </div>
      )}

      {visibility.eduKindergarten && (
        <div style={{ marginTop: showW1W2 ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduKindergartenLabel")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {EDU_KINDERGARTEN_OWNERSHIPS.map((o) => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={KINDERGARTEN_OWNERSHIP_COLORS[o]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                  {enumLabel("educationOwnership", o, o, i18n)} {i18n.formatNumber(KINDERGARTEN_OWNERSHIP_COUNTS[o])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibility.eduCramSchool && (
        <div style={{ marginTop: showW1W2 || visibility.eduKindergarten ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduCramLabel")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {CRAM_CATEGORY_ORDER.map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Swatch color={CRAM_CATEGORY_COLORS[g]} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>
                  {enumLabel("educationCramGroup", g, CRAM_CATEGORY_LABELS[g], i18n)} {i18n.formatNumber(CRAM_CATEGORY_COUNTS[g])}
                </span>
              </div>
            ))}
          </div>
          <DenseHeatmapLegendRow layers={["eduCramSchool"]} />
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduCramNote")}
          </LegendNote>
        </div>
      )}

      {careRows.length > 0 && (
        <div style={{ marginTop: showW1W2 || visibility.eduKindergarten || visibility.eduCramSchool ? 5 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {careRows.map((row) => (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={row.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(row.labelKey, { n: i18n.formatNumber(row.count) })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showChildcare && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          {i18n.t("legend.civic.eduInterpolatedNote")}
        </LegendNote>
      )}

      {visibility.eduUniversityStudents && (
        <div style={{ marginTop: showW1W2 || showChildcare ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.civic.eduUniLabel", { n: UNIVERSITY_STUDENTS_COUNTS.total })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Swatch color={UNIVERSITY_BUBBLE_COLOR} round />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                {i18n.t("legend.civic.eduUniWith", { n: UNIVERSITY_STUDENTS_COUNTS.withValue })}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Swatch color={UNIVERSITY_NO_DATA_COLOR} round />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
                {i18n.t("legend.civic.eduUniWithout", { n: UNIVERSITY_STUDENTS_COUNTS.nullValue })}
              </span>
            </div>
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduUniNote1")}
          </LegendNote>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.civic.eduUniNote2")}
          </LegendNote>
        </div>
      )}

      {showSchoolSections && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          {i18n.t("legend.civic.eduSchoolYear", { year: displayRocYear(113, i18n) })}
        </LegendNote>
      )}
    </div>
  );
}

export function MedicalIsochroneLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.medIsoTitle")} en="Medical Isochrone" />
      <FireCatRows
        cats={MEDICAL_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: enumLabel("medicalIsochrone", b.level, b.label, i18n) }))}
        square
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {enumLabel("medicalNote", "isochrone", MEDICAL_ISOCHRONE_NOTE, i18n)}
      </LegendNote>
    </div>
  );
}

/** 急救責任醫院分級圖例：三級序列 + 未標分級灰（色票 SSOT: data/emergencyHospitalTypes.ts）。 */
export function EmergencyHospitalLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.emergencyHospitalTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {EMERGENCY_HOSPITAL_LEVELS.map((l) => (
          <div key={l.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={isDark ? l.dark : l.light} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {enumLabel("emergencyHospitalLevel", l.value, l.label, i18n)} · {i18n.formatNumber(l.count)}
            </span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4 }}>
        {i18n.t("legend.civic.emergencyHospitalNote1")}<br />
        {i18n.t("legend.civic.emergencyHospitalNote2", { asOf: EMERGENCY_HOSPITAL_DATA_AS_OF })}
      </LegendNote>
    </div>
  );
}

export function MedicalLegend({ visibility, isDark = true }: { visibility: LayerVisibility; isDark?: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  // 只列出目前開啟的醫療 layer
  const shown = MEDICAL_POI_TYPES.filter((it) => visibility[it.visKey]);
  if (shown.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.medicalTitle")} en="Medical" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={medicalPoiColor(it.id, isDark)} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {enumLabel("medicalPoiType", it.id, it.labelZh, i18n)}
              {i18n.active === "zh-TW" && <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>}
            </span>
          </div>
        ))}
      </div>
      {(visibility.medClinic || visibility.medAED || visibility.medLTC) && <DenseHeatmapLegendRow layers={["medClinic", "medAED", "medLTC"]} />}
    </div>
  );
}

// ── 警政司法民防 17 layer 共用圖例 ──
const POLICE_JUSTICE_LEGEND: { key: keyof LayerVisibility; color: string; labelKey: MessageKey; shape: "circle" | "line" | "square" }[] = [
  { key: "policeStation", color: "#1e40af", labelKey: "legend.civic.pjPoliceStation", shape: "circle" },
  { key: "womenChildWarning", color: "#ec4899", labelKey: "legend.civic.pjWomenChildWarning", shape: "circle" },
  { key: "speedCamera", color: "#dc2626", labelKey: "legend.civic.pjSpeedCamera", shape: "circle" },
  { key: "speedZoneSegment", color: "#b91c1c", labelKey: "legend.civic.pjSpeedZoneSegment", shape: "line" },
  { key: "court", color: "#7c3aed", labelKey: "legend.civic.pjCourt", shape: "circle" },
  { key: "prosecutorsOffice", color: "#a855f7", labelKey: "legend.civic.pjProsecutorsOffice", shape: "circle" },
  { key: "correctionalFacility", color: "#374151", labelKey: "legend.civic.pjCorrectionalFacility", shape: "circle" },
  { key: "courtJurisdiction", color: "#c4b5fd", labelKey: "legend.civic.pjCourtJurisdiction", shape: "square" },
  { key: "theftTaoyuan", color: "#f59e0b", labelKey: "legend.civic.pjTheftTaoyuan", shape: "circle" },
  { key: "trafficAccidentYearly", color: "#fb7185", labelKey: "legend.civic.pjTrafficAccidentYearly", shape: "circle" },
  { key: "accidentTaipei", color: "#fda4af", labelKey: "legend.civic.pjAccidentTaipei", shape: "circle" },
  { key: "a1AccidentRealtime", color: "#ef4444", labelKey: "legend.civic.pjA1AccidentRealtime", shape: "circle" },
  { key: "investigationBureau", color: "#0f766e", labelKey: "legend.civic.pjInvestigationBureau", shape: "circle" },
  { key: "antiCorruptionOffice", color: "#14b8a6", labelKey: "legend.civic.pjAntiCorruptionOffice", shape: "circle" },
  { key: "immigrationOffice", color: "#0ea5e9", labelKey: "legend.civic.pjImmigrationOffice", shape: "circle" },
  { key: "coastGuardStation", color: "#0284c7", labelKey: "legend.civic.pjCoastGuardStation", shape: "circle" },
  { key: "civilDefenseShelter", color: "#64748b", labelKey: "legend.civic.pjCivilDefenseShelter", shape: "circle" },
];

// ── 警察覆蓋分析 isochrone — overlap_count 色階 ──
const ISO_OVERLAP_BANDS: { c: string; l: MessageKey }[] = [
  { c: "#fee2e2", l: "legend.civic.pjIso1" },
  { c: "#fca5a5", l: "legend.civic.pjIso2" },
  { c: "#f87171", l: "legend.civic.pjIso3" },
  { c: "#ef4444", l: "legend.civic.pjIso4" },
  { c: "#dc2626", l: "legend.civic.pjIso5" },
  { c: "#991b1b", l: "legend.civic.pjIso6" },
  { c: "#7f1d1d", l: "legend.civic.pjIso7" },
];

export function PoliceIsochroneLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const anyOn = visibility.policeIsoSubstation || visibility.policeIsoPrecinct || visibility.policeIsoCityDept;
  if (!anyOn) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.pjIsoTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {ISO_OVERLAP_BANDS.map((b) => (
          <div key={b.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={b.c} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(b.l)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 5, lineHeight: 1.4 }}>
        {i18n.t("legend.civic.pjIsoNote")}
      </LegendNote>
    </div>
  );
}

export function PoliceJusticeLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const active = POLICE_JUSTICE_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.civic.pjTitle")} en="Law & Order" />
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
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.labelKey)}</span>
          </div>
        ))}
      </div>

      {/* 防空避難熱區（§3.8 V-1：z<10 畫密度熱區） */}
      {visibility.civilDefenseShelter && <DenseHeatmapLegendRow layers={["civilDefenseShelter"]} />}

      {/* 警察階層細分 — 開啟 policeStation 時顯示 */}
      {visibility.policeStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjPoliceTier")}</div>
          {[
            { c: "#0a1e6b", s: 14, l: "legend.civic.pjPoliceHq" as const },
            { c: "#1e3a8a", s: 11, l: "legend.civic.pjPoliceCity" as const },
            { c: "#1e40af", s: 9, l: "legend.civic.pjPrecinct" as const },
            { c: "#3b82f6", s: 6, l: "legend.civic.pjSubstation" as const },
            { c: "#dc2626", s: 8, l: "legend.civic.pjSpecialized" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 測速限速 — 開啟 speedCamera 時顯示 */}
      {visibility.speedCamera && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjSpeedTier")}</div>
          {[
            { s: 14, l: "legend.civic.pjSpeed30" as const },
            { s: 10, l: "legend.civic.pjSpeed40" as const },
            { s: 7, l: "legend.civic.pjSpeed60" as const },
            { s: 5, l: "legend.civic.pjSpeed90" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: "#dc2626", border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 測速類型 — 顏色同 overlayRegistry speedCamera 的 facility_subtype（§3.8 V-4，可在設定面板篩選） */}
      {visibility.speedCamera && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjSpeedCat")}</div>
          {[
            { c: "#dc2626", l: "legend.civic.pjSpeedGeneral" as const },
            { c: "#7f1d1d", l: "legend.civic.pjSpeedFreeway" as const },
            { c: "#fb7185", l: "legend.civic.pjSpeedRedLight" as const },
            { c: "#facc15", l: "legend.civic.pjSpeedRailway" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <SwatchDot color={r.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 桃園竊盜案件類型 — 顏色同 overlayRegistry theftTaoyuan 的 case_type（§3.8 V-4，可篩選） */}
      {visibility.theftTaoyuan && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjTheftCat")}</div>
          {[
            { c: "#f59e0b", l: "legend.civic.pjTheftHouse" as const },
            { c: "#fb923c", l: "legend.civic.pjTheftCar" as const },
            { c: "#fbbf24", l: "legend.civic.pjTheftMoto" as const },
            { c: "#fde047", l: "legend.civic.pjTheftBike" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <SwatchDot color={r.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* A1 即時 30 天滾動 — 開啟 a1AccidentRealtime 時顯示 */}
      {visibility.a1AccidentRealtime && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjA1Tier")}</div>
          {[
            { c: "#ef4444", s: 14, l: "legend.civic.pjA1Today" as const },
            { c: "#dc2626", s: 9, l: "legend.civic.pjA1Week" as const },
            { c: "#7f1d1d", s: 5, l: "legend.civic.pjA1Month" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 法院階層 */}
      {visibility.court && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjCourtTier")}</div>
          {[
            { c: "#4c1d95", s: 14, l: "legend.civic.pjCourtSupreme" as const },
            { c: "#6d28d9", s: 11, l: "legend.civic.pjCourtHigh" as const },
            { c: "#7c3aed", s: 10, l: "legend.civic.pjCourtAdmin" as const },
            { c: "#a855f7", s: 9, l: "legend.civic.pjCourtIpc" as const },
            { c: "#c4b5fd", s: 7, l: "legend.civic.pjCourtDistrict" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 檢察署階層 */}
      {visibility.prosecutorsOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjProsTier")}</div>
          {[
            { c: "#581c87", s: 13, l: "legend.civic.pjProsSupreme" as const },
            { c: "#7e22ce", s: 10, l: "legend.civic.pjProsHigh" as const },
            { c: "#c084fc", s: 7, l: "legend.civic.pjProsDistrict" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 矯正機關階層 */}
      {visibility.correctionalFacility && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjCorrectionalFacility")}</div>
          {[
            { c: "#111827", s: 14, l: "legend.civic.pjCorrPrison" as const },
            { c: "#374151", s: 11, l: "legend.civic.pjCorrDetention" as const },
            { c: "#7c3aed", s: 9, l: "legend.civic.pjCorrDrug" as const },
            { c: "#0d9488", s: 9, l: "legend.civic.pjCorrSchool" as const },
            { c: "#0ea5e9", s: 8, l: "legend.civic.pjCorrJuvenile" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 調查局階層 */}
      {visibility.investigationBureau && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjInvestigationBureau")}</div>
          {[
            { c: "#064e3b", s: 11, l: "legend.civic.pjInvCity" as const },
            { c: "#0f766e", s: 7, l: "legend.civic.pjInvStation" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 廉政階層 */}
      {visibility.antiCorruptionOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjAcTier")}</div>
          {[
            { c: "#134e4a", s: 10, l: "legend.civic.pjAcCentral" as const },
            { c: "#5eead4", s: 6, l: "legend.civic.pjAcLocal" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 海巡分類 */}
      {visibility.coastGuardStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>{i18n.t("legend.civic.pjCgTier")}</div>
          {[
            { c: "#0c4a6e", s: 11, l: "legend.civic.pjCgOcean" as const },
            { c: "#38bdf8", s: 6, l: "legend.civic.pjCgPatrol" as const },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.l)}</span>
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
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 320 }}>
    <div style={{ marginBottom: 4 }}>{i18n.t("legend.civic.jpPoliceTitle")}</div>
    {JP_POLICE_FACILITY_TYPES.map(c => <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <SwatchDot color={c.color} />{enumLabel("jpPoliceFacility", c.value, c.label, i18n)}
    </div>)}
    <div style={{ marginTop: 5 }}><SwatchDot color="transparent" stroke={JP_POLICE_DEGRADED_COLOR} strokeWidth={2} /> {i18n.t("legend.civic.jpPoliceDegraded")}</div>
    <div>{i18n.t("legend.civic.jpPoliceRoster")}</div>
    <div>{i18n.t("legend.civic.jpPoliceMapped")}</div>
    <div>{i18n.t("legend.civic.jpPoliceDate")}</div>
    <div style={{ marginTop: 5 }}>{JP_POLICE_ATTRIBUTION}</div>
    <DenseHeatmapLegendRow layers={["jpPoliceFacilities"]} />
  </div>;
}

/** 日本避難場所：兩色＝兩種法定場所（不可相加）；警語依 GSI 頁面原文要旨。 */
export function JpEvacuationSitesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpEvacTitle")} />
    {JP_EVACUATION_SITE_TYPES.map(c => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{enumLabel("jpEvacSite", c.value, c.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpEvacLegal")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpEvacFilterNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpEvacStale")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpEvacDate")}</LegendNote>
    <LegendNote>{JP_EVACUATION_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={["jpEvacuationSites"]} />
  </div>;
}

/** 日本役所與公民館：5 類分色，集會施設預設隱藏；2022-04 基準。 */
export function JpPublicOfficesLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpOfficeTitle")} />
    {JP_PUBLIC_OFFICE_CLASSES.map(c => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{enumLabel("jpPublicOfficeClass", c.value, c.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpOfficeHidden")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpOfficeBasis")}</LegendNote>
    <LegendNote>{JP_PUBLIC_OFFICE_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={["jpPublicOffices"]} />
  </div>;
}

/** 日本公車站：bus_class 5 色；2022 年度版，不含デマンドバス與高速バス。 */
export function JpBusStopsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpBusTitle")} />
    {JP_BUS_STOP_CLASSES.map(c => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{enumLabel("jpBusClass", c.value, c.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpBusCount")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpBusScope")}</LegendNote>
    <LegendNote>{JP_BUS_STOP_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={["jpBusStops"]} />
  </div>;
}

/** 日本土砂災害警戒區域（A33）：黃／紅兩區；紅區在黃區之內、概略位置、非法定圖書。 */
export function JpLandslideWarningAreasLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpLandslideTitle")} />
    {JP_LANDSLIDE_ZONES.map(z => <LegendRow key={z.value} swatch={<SwatchSquare color={z.color} />}>{enumLabel("jpLandslideZone", z.value, z.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpLandslideNested")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpLandslideAccuracy")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpLandslidePre")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpLandslideVintage", { count: i18n.formatNumber(JP_LANDSLIDE_FEATURE_COUNT) })}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpLandslideZoom")}</LegendNote>
    <LegendNote>{JP_LANDSLIDE_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 日本內水浸水想定區域（A51）：浸水深 8 級；只涵蓋 28 市町村、想定最大規模降雨；無資料≠無風險。 */
export function JpInlandFloodAreasLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const colors = usePaletteRamp("jpInlandFloodAreas", t.isDark, JP_INLAND_FLOOD_STEPS);
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpInlandFloodTitle")} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>{i18n.t("legend.civic.jpInlandFloodDepthHead")}</div>
    {JP_INLAND_FLOOD_DEPTH_CLASSES.map((c, i) => <LegendRow key={c.value} swatch={<SwatchSquare color={colors[i]!} />}>{enumLabel("jpInlandFloodDepth", c.value, c.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpInlandFloodScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpInlandFloodScenario")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpInlandFloodNoData")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpInlandFloodDistinct")}</LegendNote>
    <LegendNote>{JP_INLAND_FLOOD_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 日本用途地域（A55）：13 類；無決定不畫、猪名川町／延岡市未涵蓋、區域外沒有面是正常的。 */
export function JpZoningUseDistrictsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpZoningTitle")} />
    {JP_ZONING_CLASSES.map(c => <LegendRow key={c.code} swatch={<SwatchSquare color={c.color} />}>{enumLabel("jpZoningClass", c.code, c.label, i18n)}</LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpZoningNoDecision")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpZoningMissing")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpZoningOutside")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpZoningDisclaimer")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpZoningVintage", { count: i18n.formatNumber(JP_ZONING_FEATURE_COUNT) })}</LegendNote>
    <LegendNote>{JP_ZONING_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 日本国有林：機能類型 6 類加空白；僅國有林，民有林不在內。 */
export function JpNationalForestsLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.civic.jpForestTitle")} />
    {JP_FOREST_FUNCTION_TYPES.map(f => <LegendRow key={f.value} swatch={<SwatchSquare color={f.color} />}>{enumLabel("jpForestFunction", f.value, f.label, i18n)}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={JP_FOREST_BLANK_COLOR} />}>{i18n.t("legend.civic.jpForestBlank")}</LegendRow>
    <LegendNote>{i18n.t("legend.civic.jpForestScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpForestMerged")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpForestProtected")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpForestZoom")}</LegendNote>
    <LegendNote>{JP_FOREST_ATTRIBUTION}</LegendNote>
  </div>;
}

export function JpMedicalLegend({ layerKey }: { layerKey: string }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const facility = JP_MEDICAL_CATEGORIES.find(item => item.key === layerKey);
  const care = JP_MEDICAL_CARE_GROUPS.find(item => item.key === layerKey);
  const area = JP_MEDICAL_AREA_LEVELS.find(item => item.key === layerKey);
  // R7：醫療／照護低縮放格讀共用的網格色盤選單（醫療圈層沒有色盤，結果不使用）
  const gridColors = usePaletteRamp(layerKey, t.isDark, JP_MEDICAL_GRID_BANDS.length);
  const kind = facility ? "facilities" : care ? "care" : "areas";
  const row = facility ?? care ?? area;
  if (!row) return null;
  const rowLabel = facility ? enumLabel("jpMedicalCategory", facility.value, facility.label, i18n)
    : care ? enumLabel("jpMedicalCareGroup", care.key, care.label, i18n)
    : enumLabel("jpMedicalAreaLevel", area!.key, area!.label, i18n);
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, lineHeight: 1.5 }}>
    <strong>{rowLabel}</strong>
    <div style={{ margin: "4px 0" }}><JpMedicalStatus kind={kind} layerKey={layerKey} /></div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {kind === "areas" ? <SwatchSquare color={row.color} stroke={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} /> : <SwatchDot color={row.color} />}{rowLabel}
    </div>
    {kind !== "areas" && <>
      <div style={{ color: t.textDim, marginTop: 5 }}>{i18n.t("legend.civic.jpMedicalGridNote")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px", marginTop: 3 }}>
        {JP_MEDICAL_GRID_BANDS.map((band, i) => <span key={band.min} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <SwatchSquare color={gridColors[i]!} stroke={mapSeamColor(t.isDark)} />{band.label}
        </span>)}
      </div>
    </>}
    <div style={{ color: t.textDim, marginTop: 5 }}>{kind === "areas"
      ? i18n.t("legend.civic.jpMedicalAreasNote")
      : kind === "care"
      ? i18n.t("legend.civic.jpMedicalCareNote")
      : i18n.t("legend.civic.jpMedicalFacilitiesNote")}</div>
  </div>;
}

export function PublicLifeOsmLegend({ label, color, extra }: { label: string; color: string; extra?: string }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><SwatchDot color={color} />{label}</div>
    <div style={{ marginTop: 5 }}>{i18n.t("legend.civic.osmSnapshot")}</div>
    {extra && <div style={{ marginTop: 3 }}>{extra}</div>}
  </div>;
}

export function GovernmentLifeLegend({ label, color, source, extra }: { label: string; color: string; source: string; extra: string }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><SwatchDot color={color} />{label}</div>
    <div style={{ marginTop: 5 }}>{i18n.t("legend.civic.govLicense", { source })}</div>
    <div style={{ marginTop: 3 }}>{extra}</div>
  </div>;
}

export function BicycleSupportLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const items = [[BICYCLE_SUPPORT_COLORS.repair, "維修", "repair"], [BICYCLE_SUPPORT_COLORS.air, "打氣", "air"], [BICYCLE_SUPPORT_COLORS.parking, "停車", "parking"], [BICYCLE_SUPPORT_COLORS.water, "飲水", "water"], [BICYCLE_SUPPORT_COLORS.toilet, "公廁", "toilet"]] as const;
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {items.map(([c, l, code]) => <div key={code} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchDot color={c} />{enumLabel("publicLifeBicycleCategory", code, l, i18n)}</div>)}
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchDot color={BICYCLE_SUPPORT_COLORS.other} />{i18n.t("legend.common.other")}</div>
    <div style={{ marginTop: 5 }}>{i18n.t("legend.civic.bicycleNote")}</div>
    <DenseHeatmapLegendRow layers={["bicycleSupport"]} />
  </div>;
}

export function AccessibleParkLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {[[ACCESSIBILITY_STATUS_COLORS.yes, 'yes'], [ACCESSIBILITY_STATUS_COLORS.limited, 'limited'], [ACCESSIBILITY_STATUS_COLORS.no, 'no'], [ACCESSIBILITY_STATUS_COLORS.unknown, 'unknown']].map(([c, l]) => <div key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchDot color={c!} />{l}</div>)}
    <div style={{ marginTop: 5 }}>{i18n.t("legend.civic.accessibleNote")}</div>
    <DenseHeatmapLegendRow layers={["accessibleParkFacilities"]} />
  </div>;
}

export function PublicLifeCoverageLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
    {[['#e2e8f0', '0'], ['#bfdbfe', '1–4'], ['#60a5fa', '5–14'], ['#1d4ed8', '15+']].map(([c, l]) => <div key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}><SwatchSquare color={c!} />{i18n.t("legend.civic.coverageCount", { range: l! })}</div>)}
    <div style={{ marginTop: 5 }}>{i18n.t("legend.civic.coverageNote")}</div>
  </div>;
}

/** 日本障礙／兒童福祉設施（P14）：依性質色組列出所含中分類；自治體未提供≠沒有；預設不畫代表點。 */
export function JpWelfareFacilitiesLegend({ layerKey }: { layerKey: JpWelfareLayerKey }) {
  const i18n = useLocale();
  const major = JP_WELFARE_LAYER_MAJOR[layerKey];
  const cats = jpWelfareCategoriesOf(major);
  return <div>
    <LegendTitle zh={i18n.t(major === "disability" ? "legend.civic.jpWelfareDisabilityTitle" : "legend.civic.jpWelfareChildTitle")} />
    {jpWelfareGroupsOf(major).map(g => <LegendRow key={g.value} swatch={<SwatchDot color={g.color} />}>
      {cats.filter(c => c.group === g.value).map(c => enumLabel("jpWelfareCategory", c.code, c.label, i18n)).join("、")}
    </LegendRow>)}
    <LegendNote>{i18n.t("legend.civic.jpWelfareMissing")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpWelfareAccuracy")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpWelfareLicense")}</LegendNote>
    <LegendNote>{i18n.t("legend.civic.jpWelfareStale")}</LegendNote>
    <LegendNote>{JP_WELFARE_ATTRIBUTION}</LegendNote>
    <DenseHeatmapLegendRow layers={[layerKey]} />
  </div>;
}
