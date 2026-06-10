import { AGRI_POI_TYPES } from "../../data/agriPOITypes";
import { AGRI_COMPANY_TYPES } from "../../data/agriCompanyTypes";
import { ECO_NETWORK_ZONE_TYPES } from "../../data/ecoNetworkZoneTypes";
import { SOIL_FERTILITY_METRICS } from "../../data/agriSoilFertilityMetrics";
import { Row } from "./shared";

export function AgriSoilPanel({ props }: { props: Record<string, unknown> }) {
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#8d6e63", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {soilType || soilClass || "土壤分類"}
        </div>
      </div>
      <Row label="地區" value={region} />
      <Row label="土類" value={soilClass} />
      <Row label="土系" value={series} />
      <Row label="表土質地" value={texture} />
      <Row label="坡度相" value={slope} />
      <Row label="調查區" value={survey} />
      <Row label="圖幅" value={sheet === "-" ? "" : sheet} />
      <Row label="面積" value={areaHa ? `${areaHa} 公頃` : ""} />
    </>
  );
}

export function AgriSoilFertilityPanel({ props }: { props: Record<string, unknown> }) {
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
      text: grade ? `${numText} (${grade.label})` : numText,
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#00897b", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          土壤肥力 250m 網格
        </div>
      </div>
      <Row label="pH (H2O)" value={ph.text} color={ph.color} />
      <Row label="有機質 OM" value={om.text} color={om.color} />
      <Row label="CEC" value={cec.text} color={cec.color} />
      <Row label="Mehlich-3 P" value={m3p.text} color={m3p.color} />
      <Row label="Mehlich-3 K" value={m3k.text} color={m3k.color} />
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 6, lineHeight: 1.5 }}>
        ※ 0 值表示該項未測（多數網格只測 pH / OM）
      </div>
    </>
  );
}

export function AgriLeisureFarmZonesPanel({ props }: { props: Record<string, unknown> }) {
  const name = String(props["休區名"] ?? props["LANAME"] ?? "");
  const keyCode = String(props["KeyCode"] ?? "");
  const aa45 = String(props["AA45"] ?? "");
  const aa46 = String(props["AA46"] ?? "");
  const areaHa = typeof props.area_ha === "number" ? (props.area_ha as number).toFixed(2) : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#66bb6a", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {name || "休閒農業區"}
        </div>
      </div>
      <Row label="代碼" value={keyCode} />
      <Row label="縣市碼" value={aa45} />
      <Row label="鄉鎮碼" value={aa46} />
      <Row label="面積" value={areaHa ? `${areaHa} 公頃` : ""} />
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
  const cropNameZh = String(props.crop_name_zh ?? "").replace(/\s*適栽性等級分布圖$/, "").replace(/\s*栽性等級分布圖$/, "");
  const cropNameEn = String(props.crop_name_en ?? "");
  const kindLabel = String(props.kind_label ?? "");
  const kindInfo = CROP_KIND_INFO[kindLabel] ?? { color: "#9e9e9e", label: kindLabel };
  const areaHa = typeof props.area_ha === "number" ? (props.area_ha as number).toFixed(2) : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: kindInfo.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {cropNameZh || cropNameEn || "作物適栽"}
        </div>
      </div>
      <Row label="適栽性" value={kindInfo.label} color={kindInfo.color} />
      <Row label="作物 EN" value={cropNameEn} />
      <Row label="面積" value={areaHa ? `${areaHa} 公頃` : ""} />
    </>
  );
}

export function AgriRuralRegenPanel({ props }: { props: Record<string, unknown> }) {
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ffb74d", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {community || "農村再生社區"}
        </div>
      </div>
      <Row label="行政區" value={region} />
      <Row label="計畫" value={plan} />
      <Row label="核定時" value={String(props["核定時"] ?? "")} />
      <Row label="計畫年" value={String(props["計畫年"] ?? "")} />
      <Row label="分署" value={String(props["分署"] ?? "")} />
      <Row label="狀態" value={note} color={note === "已核定" ? "#7efcb0" : undefined} />
      <Row label="面積" value={areaHa ? `${areaHa} 公頃` : ""} />
    </>
  );
}

export function AgriPOIPanel({ props }: { props: Record<string, unknown> }) {
  const poiType = String(props.poi_type ?? "");
  const t = AGRI_POI_TYPES.find((x) => x.id === poiType);
  const meta = t ? { color: t.color, label: t.labelZh } : { color: "#9e9e9e", label: poiType };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.poi_name ?? "Unknown")}
        </div>
      </div>
      <Row label="類型" value={meta.label} color={meta.color} />
      <Row label="資料集" value={String(props.source_dataset_id ?? "")} />
      <Row label="行政區" value={String(props.TOWNID ?? "")} />
      <Row label="緯度" value={typeof props.lat === "number" ? props.lat.toFixed(5) : String(props.lat ?? "")} />
      <Row label="經度" value={typeof props.lon === "number" ? props.lon.toFixed(5) : String(props.lon ?? "")} />
    </>
  );
}

export function AgriCompanyPanel({ props }: { props: Record<string, unknown> }) {
  const bt = String(props.business_type ?? "");
  const t = AGRI_COMPANY_TYPES.find((x) => x.id === bt);
  const meta = t ? { color: t.color, label: t.labelZh } : { color: "#9e9e9e", label: bt };
  const capital = Number(props["資本總額"] ?? 0);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props["公司名稱"] ?? "Unknown")}
        </div>
      </div>
      <Row label="類別" value={meta.label} color={meta.color} />
      <Row label="統一編號" value={String(props["統一編號"] ?? "")} />
      <Row label="負責人" value={String(props["負責人"] ?? "")} />
      <Row label="地址" value={String(props["公司地址"] ?? "")} />
      {capital > 0 ? <Row label="資本額" value={`${capital.toLocaleString()} 元`} /> : null}
      <Row label="狀態" value={String(props["公司狀態"] ?? "")} />
    </>
  );
}

export function FarmRoadsPanel({ props }: { props: Record<string, unknown> }) {
  const len = Number(props.Lenth);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 12, height: 2, borderRadius: 1, background: "#7a8670", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.NAME ?? "農路")}
        </div>
      </div>
      <Row label="縣市" value={String(props.County ?? "")} />
      <Row label="鄉鎮" value={String(props.Town ?? "")} />
      {Number.isFinite(len) ? <Row label="長度" value={`${len.toFixed(0)} m`} /> : null}
    </>
  );
}

export function EcoNetworkZonesPanel({ props }: { props: Record<string, unknown> }) {
  const zone = String(props.Zone ?? "");
  const zt = ECO_NETWORK_ZONE_TYPES.find((z) => z.zone === zone);
  const color = zt?.color ?? "#9e9e9e";
  const ha = Number(props.Area_ha);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {zone || "國土綠網分區"}
        </div>
      </div>
      <Row label="分區" value={zt?.label ?? zone} color={color} />
      {Number.isFinite(ha) ? <Row label="面積" value={`${Math.round(ha).toLocaleString()} 公頃`} /> : null}
    </>
  );
}
