import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { AGRI_POI_TYPES } from "../../data/agriPOITypes";
import { AGRI_COMPANY_TYPES } from "../../data/agriCompanyTypes";
import { ECO_NETWORK_ZONE_TYPES } from "../../data/ecoNetworkZoneTypes";
import { SOIL_FERTILITY_METRICS } from "../../data/agriSoilFertilityMetrics";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

export function AgriSoilPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const region = String(props["地區"] ?? "");
  const sheet = String(props["圖幅名稱"] ?? "");
  const survey = String(props["調查區"] ?? "");
  const soilClass = String(props["土類"] ?? "");
  const series = String(props["土系"] ?? "");
  const soilType = String(props["土型"] ?? "");
  const texture = String(props["表土質地"] ?? "");
  const slope = String(props["坡度相"] ?? "");
  const areaHa = typeof props.area_ha === "number" ? (props.area_ha as number).toFixed(2) : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#8d6e63", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {soilType || soilClass || tr("popup.agri.soilDefault")}
        </div>
      </div>
      <Row label={tr("popup.agri.region")} value={region} />
      <Row label={tr("popup.agri.soilClass")} value={soilClass} />
      <Row label={tr("popup.agri.soilSeries")} value={series} />
      <Row label={tr("popup.agri.topsoilTexture")} value={texture} />
      <Row label={tr("popup.agri.slopePhase")} value={slope} />
      <Row label={tr("popup.agri.surveyArea")} value={survey} />
      <Row label={tr("popup.agri.mapSheet")} value={sheet === "-" ? "" : sheet} />
      <Row field="area" value={areaHa ? tr("popup.agri.hectares", { value: areaHa }) : ""} />
    </>
  );
}

export function AgriSoilFertilityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const num = (k: string): number | null => {
    const v = props[k];
    return typeof v === "number" && v !== 0 ? v : null;
  };
  // 把數值轉「6.23 (微酸)」格式（用 metric 自帶的 classify）
  const fmtWithGrade = (key: string, metricKey: keyof typeof SOIL_FERTILITY_METRICS, unit?: string) => {
    const v = num(key);
    if (v == null) return { text: "", color: undefined as string | undefined };
    const grade = SOIL_FERTILITY_METRICS[metricKey].classify(v);
    const numText = v.toFixed(2) + (unit ? ` ${unit}` : "");
    return {
      text: grade ? `${numText} (${enumLabel("agriSoilGrade", grade.label, grade.label, i18n)})` : numText,
      color: grade?.color,
    };
  };
  const ph = fmtWithGrade("pH_H2O", "pH");
  const om = fmtWithGrade("OM_OMU", "OM", "%");
  const cec = fmtWithGrade("CEC", "CEC", "cmol(+)/kg");
  const m3p = fmtWithGrade("M3_P", "M3_P", "mg/kg");
  const m3k = fmtWithGrade("M3_K", "M3_K", "mg/kg");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#00897b", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {tr("popup.agri.soilFertilityTitle")}
        </div>
      </div>
      <Row label="pH (H2O)" value={ph.text} color={ph.color} />
      <Row label={tr("popup.agri.organicMatter")} value={om.text} color={om.color} />
      <Row label="CEC" value={cec.text} color={cec.color} />
      <Row label="Mehlich-3 P" value={m3p.text} color={m3p.color} />
      <Row label="Mehlich-3 K" value={m3k.text} color={m3k.color} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.5 }}>
        {tr("popup.agri.zeroNote")}
      </div>
    </>
  );
}

export function AgriLeisureFarmZonesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const name = String(props["休區名"] ?? props["LANAME"] ?? "");
  const keyCode = String(props["KeyCode"] ?? "");
  const aa45 = String(props["AA45"] ?? "");
  const aa46 = String(props["AA46"] ?? "");
  const areaHa = typeof props.area_ha === "number" ? (props.area_ha as number).toFixed(2) : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#66bb6a", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {name || tr("popup.agri.leisureDefault")}
        </div>
      </div>
      <Row field="code" value={keyCode} />
      <Row label={tr("popup.agri.countyCode")} value={aa45} />
      <Row label={tr("popup.agri.townshipCode")} value={aa46} />
      <Row field="area" value={areaHa ? tr("popup.agri.hectares", { value: areaHa }) : ""} />
    </>
  );
}

// 作物適栽 4 級 kind 配色（與 LegendPanel CROP_KIND_ITEMS 同源）
const CROP_KIND_INFO: Record<string, { color: string; label: string }> = {
  "1_premium":    { color: "#1b5e20", label: "最適 Premium" },
  "2_suitable":   { color: "#66bb6a", label: "適栽 Suitable" },
  "3_marginal":   { color: "#fff59d", label: "次適 Marginal" },
  "4_unsuitable": { color: "#ef9a9a", label: "不適 Unsuitable" },
};

export function AgriCropSuitabilityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const cropNameZh = String(props.crop_name_zh ?? "").replace(/\s*適栽性等級分布圖$/, "").replace(/\s*栽性等級分布圖$/, "");
  const cropNameEn = String(props.crop_name_en ?? "");
  const kindLabel = String(props.kind_label ?? "");
  const kindInfo = CROP_KIND_INFO[kindLabel]
    ? { ...CROP_KIND_INFO[kindLabel], label: enumLabel("agriCropKind", kindLabel, CROP_KIND_INFO[kindLabel].label, i18n) }
    : { color: "#9e9e9e", label: kindLabel };
  const areaHa = typeof props.area_ha === "number" ? (props.area_ha as number).toFixed(2) : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: kindInfo.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {cropNameZh || cropNameEn || tr("popup.agri.cropDefault")}
        </div>
      </div>
      <Row label={tr("popup.agri.suitability")} value={kindInfo.label} color={kindInfo.color} />
      <Row label={tr("popup.agri.cropEn")} value={cropNameEn} />
      <Row field="area" value={areaHa ? tr("popup.agri.hectares", { value: areaHa }) : ""} />
    </>
  );
}

export function AgriRuralRegenPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const community = String(props["社區名"] ?? "");
  const plan = String(props["計畫名"] ?? "");
  const county = String(props["縣市"] ?? "");
  const town = String(props["鄉鎮"] ?? "");
  const village = String(props["村里"] ?? "");
  const note = String(props["NOTE"] ?? "");
  const region = [county, town, village].filter(Boolean).join("");
  const areaHaRaw = props.area_ha;
  const areaHa = typeof areaHaRaw === "number" ? areaHaRaw.toFixed(2) : String(areaHaRaw ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#ffb74d", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {community || tr("popup.agri.regenDefault")}
        </div>
      </div>
      <Row field="district" value={region} />
      <Row label={tr("popup.agri.plan")} value={plan} />
      <Row label={tr("popup.agri.approvedAt")} value={String(props["核定時"] ?? "")} />
      <Row label={tr("popup.agri.planYear")} value={String(props["計畫年"] ?? "")} />
      <Row label={tr("popup.agri.branch")} value={String(props["分署"] ?? "")} />
      <Row field="status" value={note} color={note === "已核定" ? "#7efcb0" : undefined} />
      <Row field="area" value={areaHa ? tr("popup.agri.hectares", { value: areaHa }) : ""} />
    </>
  );
}

export function AgriPOIPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const poiType = String(props.poi_type ?? "");
  const typeDef = AGRI_POI_TYPES.find((x) => x.id === poiType);
  const meta = typeDef ? { color: typeDef.color, label: enumLabel("agriPoiType", poiType, typeDef.labelZh, i18n) } : { color: "#9e9e9e", label: poiType };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.poi_name ?? "Unknown")}
        </div>
      </div>
      <Row field="type" value={meta.label} color={meta.color} />
      <Row field="dataset" value={String(props.source_dataset_id ?? "")} />
      <Row field="district" value={String(props.TOWNID ?? "")} />
      <Row field="latitude" value={typeof props.lat === "number" ? props.lat.toFixed(5) : String(props.lat ?? "")} />
      <Row field="longitude" value={typeof props.lon === "number" ? props.lon.toFixed(5) : String(props.lon ?? "")} />
    </>
  );
}

export function AgriCompanyPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const bt = String(props.business_type ?? "");
  const typeDef = AGRI_COMPANY_TYPES.find((x) => x.id === bt);
  const meta = typeDef ? { color: typeDef.color, label: enumLabel("agriCompanyType", bt, typeDef.labelZh, i18n) } : { color: "#9e9e9e", label: bt };
  const capital = Number(props["資本總額"] ?? 0);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props["公司名稱"] ?? "Unknown")}
        </div>
      </div>
      <Row field="category" value={meta.label} color={meta.color} />
      <Row field="businessId" value={String(props["統一編號"] ?? "")} />
      <Row label={tr("popup.agri.manager")} value={String(props["負責人"] ?? "")} />
      <Row field="address" value={String(props["公司地址"] ?? "")} />
      {capital > 0 ? <Row field="capital" value={tr("popup.agri.yuan", { value: i18n.formatNumber(capital) })} /> : null}
      <Row field="status" value={String(props["公司狀態"] ?? "")} />
    </>
  );
}

export function FarmRoadsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const len = Number(props.Lenth);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 12, height: 2, borderRadius: RADIUS.sm, background: "#7a8670", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.NAME ?? tr("popup.agri.roadDefault"))}
        </div>
      </div>
      <Row field="county" value={String(props.County ?? "")} />
      <Row field="township" value={String(props.Town ?? "")} />
      {Number.isFinite(len) ? <Row field="length" value={`${len.toFixed(0)} m`} /> : null}
    </>
  );
}

export function EcoNetworkZonesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const zone = String(props.Zone ?? "");
  const zt = ECO_NETWORK_ZONE_TYPES.find((z) => z.zone === zone);
  const color = zt?.color ?? "#9e9e9e";
  const ha = Number(props.Area_ha);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {zone ? enumLabel("ecoNetworkZone", zone, zone, i18n) : tr("popup.agri.ecoDefault")}
        </div>
      </div>
      <Row label={tr("popup.agri.zone")} value={enumLabel("ecoNetworkZone", zone, zt?.label ?? zone, i18n)} color={color} />
      {Number.isFinite(ha) ? <Row field="area" value={tr("popup.agri.hectares", { value: i18n.formatNumber(Math.round(ha)) })} /> : null}
    </>
  );
}

/**
 * FTW 田區（PMTiles `fields`，386,829 面）。
 *
 * 欄位語意真值來源：taipei-gis-analytics/docs/data-catalog/agriculture/ftw_fields_2025.md
 * （欄位表 ＋「已知陷阱」段），數值範圍以該 pipeline 的 parquet SSOT 實測覆核。
 * 切片只帶 tippecanoe 白名單的 4 欄：field_id / confidence_mean / area_ha / source_tile。
 *
 * ⚠️ confidence_mean **不可畫成 0~100% 進度條**：實測值域是 [0.500001, 0.580953]
 *    （catalog 的「已知陷阱」明載 confidence 上限只到 0.6），模型未做 0~1 校準，
 *    0.5 是篩選門檻不是「五成把握」。因此只標數字並註明區間。
 * ⚠️ 這是衛星 AI 推論結果，**不是法定農業分區**，且會把公園／規則形狀空地誤判為田區
 *    （catalog 明載會高估）→ 面板底部必須揭露，不能讓使用者當權威農地面積用。
 */
export function AgricultureFieldPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const areaHa = Number(props.area_ha);
  const conf = Number(props.confidence_mean);
  const tile = String(props.source_tile ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#7cb342", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {Number.isFinite(areaHa) ? tr("popup.agri.hectares", { value: areaHa.toFixed(3) }) : tr("popup.agri.fieldDefault")}
        </div>
      </div>
      {Number.isFinite(conf) ? (
        <Row label={tr("popup.agri.modelConfidence")} value={tr("popup.agri.confidenceValue", { value: conf.toFixed(3) })} />
      ) : null}
      {tile && <Row label={tr("popup.agri.sourceSheet")} value={tile} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.5 }}>
        {tr("popup.agri.ftwNote")}
      </div>
    </>
  );
}
