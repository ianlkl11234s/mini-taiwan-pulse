import { useEffect, useState } from "react";
import { RADIUS, FONT_SIZE, COLORS } from "../../styles/designTokens";
import { medIsochroneColor, medIsochroneLabel, MEDICAL_ISOCHRONE_NOTE } from "../../data/medicalIsochroneTypes";
import { medicalColorByCat } from "../../data/medicalPOITypes";
import { emergencyHospitalColor, emergencyHospitalLevelOf, EMERGENCY_HOSPITAL_DATA_AS_OF } from "../../data/emergencyHospitalTypes";
import {
  classifyErCongestion, ER_LEVEL_COLORS, ER_LEVEL_LABELS, ER_CONGESTION_THRESHOLDS,
} from "../../data/erCongestionTypes";
import { fetchErHospital24h } from "../../data/erHospitalLoader";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { Row, SourceFooter } from "./shared";
import { DARK_FEATURE, useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";

/** 等同 toLocaleString 預設的完整日期時間 */
const DT_FULL: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false };

const LTC_ABC_LABEL: Record<string, string> = {
  A: "A 社區整合型",
  B: "B 複合型",
  C: "C 巷弄長照站",
};

/** tile 無來源欄的兩層，補衛福部官方出處（依 analytics data-catalog aed／long_term_care） */
const MEDICAL_RAW_SOURCES = {
  aed: { labelKey: "popup.medical.sourceAed", url: "https://data.gov.tw/dataset/12063" },
  ltc: { labelKey: "popup.medical.sourceLtc", url: "https://data.gov.tw/dataset/88270" },
} as const;

/** 健保特約院所（醫院／診所／藥局）：tile 保留官方欄位、無 med_cat；機構類型中文名同 scripts/preprocess/merge_medical_poi.py 的 NHI_LABEL */
const NHI_LABEL: Record<string, string> = {
  hospital_medical_center: "醫學中心", hospital_regional: "區域醫院", hospital_district: "地區醫院",
  clinic: "診所", pharmacy: "藥局", home_nursing: "居家護理所", health_center: "衛生所", rehab_home: "精神復健機構",
  lab: "醫事檢驗所", speech_therapy: "語言治療所", physical_therapy: "物理治療所", midwifery: "助產所",
  medical_radiology: "醫事放射所", occupational_therapy: "職能治療所", other_nhi: "其他特約",
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/**
 * AED（medical_aed_v2）與長照（medical_ltc_v2）的 PMTiles 保留官方原始欄位（PlaceName、Name…），
 * 沒有合併腳本產的 med_cat／name 等小寫欄位（長照 269 筆中只有 2 筆有）。這裡依欄位形狀補成 panel 讀的欄位。
 * 只對應官方欄位；長照的 County／District 是行政區代碼（如 10013），不當名稱顯示，縣市資訊已在地址內。
 */
export function normalizeMedicalPOIProps(props: Record<string, unknown>): Record<string, unknown> {
  if (props.med_cat) return props;
  if ("AEDID" in props || "PlaceName" in props) {
    return {
      ...props,
      med_cat: "aed",
      name: str(props.PlaceName),
      place_type: str(props.PlaceType),
      place_category: str(props.PlaceCategory),
      county: str(props.County),
      district: str(props.District),
      address: str(props.Address),
      aed_location: str(props.AEDLocationDesc) || str(props.AEDLocation),
      phone: str(props.EmergencyPhone),
    };
  }
  if ("ABCType" in props || "OrgCode" in props) {
    const beds = Number(props.OpenBeds);
    return {
      ...props,
      med_cat: "ltc",
      name: str(props.Name),
      abc_type: str(props.ABCType),
      address: str(props.Address),
      phone: str(props.Phone),
      service_items: str(props.ServiceItems),
      // 非住宿型單位的 OpenBeds 恆為 0（不適用），不顯示成「空床 0」
      ...(Number.isFinite(beds) && beds > 0 ? { open_beds: beds } : {}),
    };
  }
  // 健保特約院所（醫院 geojson、藥局／診所 PMTiles）：有 facility_id＋category，沒有 med_cat
  if ("facility_id" in props && typeof props.category === "string") {
    const cat = props.category;
    const medCat = cat.startsWith("hospital_") ? "hospital" : cat === "clinic" ? "clinic" : cat === "pharmacy" ? "pharmacy" : "other_medical";
    return {
      ...props,
      med_cat: medCat,
      name: str(props.name),
      county: str(props.county),
      address: str(props.address),
      phone: str(props.phone),
      category_label: NHI_LABEL[cat] ?? cat,
      specialties: str(props.specialties),
    };
  }
  return props;
}

export function MedicalPOIPanel({ props: rawProps }: { props: Record<string, unknown> }) {
  const props = normalizeMedicalPOIProps(rawProps);
  const nhiDid = "facility_id" in rawProps ? str(rawProps.source_did).split(",")[0] : "";
  const rawSrc =
    props !== rawProps && (props.med_cat === "aed" || props.med_cat === "ltc")
      ? MEDICAL_RAW_SOURCES[props.med_cat]
      : props !== rawProps && nhiDid
        ? { labelKey: "popup.medical.sourceNhi" as const, url: `https://data.gov.tw/dataset/${nhiDid}` }
        : null;
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const medCat = String(props.med_cat ?? "");
  const color = medicalColorByCat(medCat);
  const title = String(props.name ?? tr("popup.medical.medicalSite"));
  const county = String(props.county ?? "");
  const address = String(props.address ?? "");
  const phone = String(props.phone ?? "");
  const specialties = String(props.specialties ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{title}</div>
      </div>
      {medCat === "hospital" || medCat === "clinic" || medCat === "other_medical" ? (
        <>
          <Row field="type" value={String(props.category_label ?? "")} color={color} />
          <Row field="county" value={placeName(county, i18n)} />
          <Row field="address" value={address} />
          <Row field="phone" value={phone} />
          {specialties ? (
            <Row label={tr("popup.medical.specialties")} value={specialties.length > 80 ? specialties.slice(0, 80) + "…" : specialties} />
          ) : null}
        </>
      ) : null}
      {medCat === "pharmacy" ? (
        <>
          <Row field="type" value={tr("popup.medical.nhiPharmacy")} color={color} />
          <Row field="county" value={placeName(county, i18n)} />
          <Row field="address" value={address} />
          <Row field="phone" value={phone} />
        </>
      ) : null}
      {medCat === "aed" ? (
        <>
          <Row label={tr("popup.medical.placeCategory")} value={String(props.place_category ?? "")} color={color} />
          <Row label={tr("popup.medical.placeType")} value={String(props.place_type ?? "")} />
          <Row field="county" value={placeName(county, i18n)} />
          <Row field="district" value={placeTown(county, String(props.district ?? ""), i18n)} />
          <Row field="address" value={address} />
          <Row label={tr("popup.medical.aedLocation")} value={String(props.aed_location ?? "")} />
          <Row label={tr("popup.medical.emergencyPhone")} value={phone} />
        </>
      ) : null}
      {medCat === "ltc" ? (
        <>
          <Row
            label={tr("popup.field.type")}
            value={enumLabel("medicalLtc", String(props.abc_type ?? ""), LTC_ABC_LABEL[String(props.abc_type ?? "")] ?? String(props.abc_type ?? ""), i18n)}
            color={color}
          />
          {typeof props.open_beds === "number" ? <Row label={tr("popup.medical.openBeds")} value={`${props.open_beds}`} /> : null}
          <Row field="county" value={placeName(county, i18n)} />
          <Row field="address" value={address} />
          <Row field="phone" value={phone} />
          {props.service_items ? (
            <Row
              field="serviceItems"
              value={String(props.service_items).length > 60 ? String(props.service_items).slice(0, 60) + "…" : String(props.service_items)}
            />
          ) : null}
        </>
      ) : null}
      <SourceFooter props={rawSrc ? { source_org: tr(rawSrc.labelKey), source_url: rawSrc.url, license: tr("popup.infra.toiletLicense") } : rawProps} />
    </>
  );
}

/** 急救責任醫院分級 popup —— 分級空值顯示「未標分級」，不留白、不當一般級。 */
export function EmergencyHospitalLevelPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const level = emergencyHospitalLevelOf(props.level_group);
  const color = emergencyHospitalColor(level.value, t === DARK_FEATURE);
  const levelText = enumLabel("emergencyHospitalLevel", level.value, level.label, i18n);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? tr("popup.medical.emergencyHospital"))}
        </div>
      </div>
      <Row label={tr("popup.medical.emergencyLevel")} value={levelText} color={color} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.4 }}>
        {level.value === "unrated" ? `${tr("popup.medical.emergencyUnratedNote")} ` : ""}
        {tr("popup.medical.emergencyDataNote", { asOf: EMERGENCY_HOSPITAL_DATA_AS_OF })}
      </div>
    </>
  );
}

export function MedicalIsochronePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const level = String(props.level ?? "");
  const minutes = props.min_minutes != null ? Number(props.min_minutes) : null;
  const accentColor = medIsochroneColor(level);
  const nearest = String(props.nearest_name ?? "");
  const nearestCat = String(props.nearest_category ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {enumLabel("medicalIsochrone", level, medIsochroneLabel(level), i18n)}
        </div>
      </div>
      {minutes != null && <Row label={tr("popup.medical.driveToNearest")} value={tr("popup.medical.minutes", { value: minutes.toFixed(1) })} color={accentColor} />}
      {nearest && <Row label={tr("popup.medical.nearestHospital")} value={nearest} />}
      {nearestCat && <Row label={tr("popup.medical.hospitalTier")} value={nearestCat.replace("hospital_", "").replace("_", " ")} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 6, lineHeight: 1.4 }}>
        ⚠️ {enumLabel("medicalNote", "isochrone", MEDICAL_ISOCHRONE_NOTE, i18n)}
      </div>
    </>
  );
}

/** 急診壅塞 popup — 醫院量能 + 24h「等一般病床」折線（async 骨架比照 GroundwaterPanel） */
export function EmergencyHospitalPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr, formatNumber, formatDateTime } = i18n;
  const hospId = String(props.hosp_id ?? "");
  const title = String(props.hosp_name ?? tr("popup.medical.erHospital"));
  const area = String(props.area_name ?? "");
  const levelName = String(props.level_name ?? "");
  const inform = String(props.inform ?? "");
  const waitGeneral = props.wait_general_cnt == null ? null : Number(props.wait_general_cnt);
  const waitSee = props.wait_see_cnt == null ? null : Number(props.wait_see_cnt);
  const waitBed = props.wait_bed_cnt == null ? null : Number(props.wait_bed_cnt);
  const waitIcu = props.wait_icu_cnt == null ? null : Number(props.wait_icu_cnt);
  const obsTs = props.observed_ts == null ? null : Number(props.observed_ts);

  const level = classifyErCongestion(waitGeneral);
  const levelColor = ER_LEVEL_COLORS[level];

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!hospId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchErHospital24h(hospId)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows
          .filter((r) => r.wait_general_cnt != null)
          .map((r) => ({ t: Number(r.observed_ts), v: Number(r.wait_general_cnt) })));
      })
      .catch((e) => console.warn("[EmergencyHospital] 24h fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [hospId]);

  const fmt = (v: number | null) => (v == null ? "—" : formatNumber(v));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: levelColor, flexShrink: 0, boxShadow: `0 0 6px ${levelColor}` }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{title}</div>
      </div>
      <Row field="county" value={area} />
      <Row field="tier" value={levelName} />
      <Row label={tr("popup.medical.erCongestion")} value={tr("popup.medical.erCongestionValue", { level: enumLabel("erLevel", level, ER_LEVEL_LABELS[level], i18n), count: fmt(waitGeneral) })} color={levelColor} />
      <Row label={tr("popup.medical.waitSee")} value={fmt(waitSee)} />
      <Row label={tr("popup.medical.waitBed")} value={fmt(waitBed)} />
      <Row label={tr("popup.medical.waitIcu")} value={fmt(waitIcu)} color={waitIcu != null && waitIcu > 0 ? "#ffffff" : undefined} />
      {inform ? <Row label={tr("popup.medical.informFlag")} value={inform} /> : null}
      {obsTs != null && (
        <Row field="observedAt" value={(i18n.active === "zh-TW" ? formatDateTime(new Date(obsTs * 1000), DT_FULL).slice(5, 16) : formatDateTime(new Date(obsTs * 1000), { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }))} color="rgba(255,255,255,0.35)" />
      )}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: 0.5 }}>
        {tr("popup.medical.trend")}
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, padding: "8px 4px", textAlign: "center" }}>
          {tr("popup.common.loading")}
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit={tr("popup.medical.bedGap")}
          lineColor={levelColor}
          warningValue={ER_CONGESTION_THRESHOLDS.congested}
          warningLabel={tr("popup.medical.severe")}
          height={120}
        />
      )}
    </>
  );
}
