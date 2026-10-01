// 水質與污水 4 層 popup（環境部 RPI 測站／水質測站／內政部污水處理廠／環境部飲用水水源水質保護區）。
// 上游 feature 的 source 欄位含內部表名，故 panel 自帶人類可讀來源並自掛 SourceFooter。
import type { PanelProps } from "./registry";
import { PopupDetails, Row, SourceFooter, Title } from "./shared";
import {
  DRINKING_WATER_ZONE_TYPES, ENVIRONMENT_LAYER_COLORS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR,
  SEWAGE_GEOCODE_QUALITY_LABELS, SEWAGE_UNCERTAIN_QUALITIES, WATER_QUALITY_STATION_TYPE_LABELS, WATER_QUALITY_STATION_TYPES,
} from "../../data/environmentLayerTypes";

const LICENSE = "政府資料開放授權條款第1版";

function text(value: unknown, fallback = ""): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
  return String(value);
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function day(value: unknown): string {
  return text(value).slice(0, 10);
}

/** 低於偵測極限（*_censored='<'）時數值是極限值，不是實測值。 */
function measured(value: unknown, censored: unknown, unit: string): string {
  const parsed = number(value);
  if (parsed == null) return "未測";
  return `${censored === "<" ? "<" : ""}${parsed.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} ${unit}`;
}

function place(...parts: unknown[]): string {
  return parts.map((part) => text(part)).filter(Boolean).join(" ");
}

export function RiverRpiStationsPanel({ props }: PanelProps) {
  const rpi = number(props.latest_rpi);
  const cls = RIVER_RPI_CLASSES.find((row) => row.value === props.latest_class);
  const mean = number(props.rpi_12m_mean);
  const samples = number(props.n_samples_12m);
  const anyCensored = ["latest_do_censored", "latest_bod5_censored", "latest_ss_censored", "latest_nh3_n_censored"].some((key) => props[key] === "<");
  return <>
    <Title color={cls?.color ?? RIVER_RPI_NO_DATA_COLOR}>{text(props.site_name, "河川水質測站")}</Title>
    <Row label="RPI" value={rpi == null ? "無資料（不代表乾淨）" : rpi.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} color={rpi == null ? RIVER_RPI_NO_DATA_COLOR : undefined} />
    <Row label="污染等級" value={cls?.label ?? "無資料"} color={cls?.color} />
    <Row label="採樣日" value={day(props.latest_rpi_date) || day(props.sample_date) || "無資料"} />
    <Row label="溶氧 DO" value={measured(props.latest_do, props.latest_do_censored, "mg/L")} />
    <Row label="BOD5" value={measured(props.latest_bod5, props.latest_bod5_censored, "mg/L")} />
    <Row label="懸浮固體 SS" value={measured(props.latest_ss, props.latest_ss_censored, "mg/L")} />
    <Row label="氨氮 NH3-N" value={measured(props.latest_nh3_n, props.latest_nh3_n_censored, "mg/L")} />
    <Row label="近 12 月平均" value={mean == null ? "無樣本（不代表乾淨）" : `${mean.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}（${samples ?? 0} 次採樣）`} />
    <Row label="河川" value={text(props.river)} />
    <Row label="流域" value={text(props.basin)} />
    <Row label="縣市鄉鎮" value={place(props.county, props.township)} />
    <PopupDetails summary="說明與限制">
      <Row label="等級規則" value="RPI ≤2 未（稍）受污染；≤3 輕度；≤6 中度；>6 嚴重（環境部分級）" />
      {anyCensored && <Row label="「<」" value="低於偵測極限，數值為極限值而非實測值" />}
      <Row label="更新" value="每月更新，約延遲 2 個月；測項與 RPI 取同一次採樣" />
      <Row label="近 12 月窗" value={text(props.rpi_12m_window)} />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部河川水質監測（WQX_P_01）", source_url: "https://data.gov.tw/dataset/6078", license: LICENSE, fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function WaterQualityStationsPanel({ props }: PanelProps) {
  const type = text(props.station_type);
  const color = WATER_QUALITY_STATION_TYPES.find((row) => row.value === type)?.color ?? ENVIRONMENT_LAYER_COLORS.waterQualityStations;
  const readings = number(props.n_readings);
  return <>
    <Title color={color}>{text(props.name, "水質監測站")}</Title>
    <Row label="類型" value={WATER_QUALITY_STATION_TYPE_LABELS[type] ?? "未分類"} color={color} />
    <Row label="最新採樣" value={day(props.latest_sample_date) || "無讀值（不代表乾淨）"} />
    <Row label="讀值筆數" value={readings == null ? "" : `${readings.toLocaleString("zh-TW")} 筆`} />
    <Row label="站況" value={props.is_active === true ? "啟用" : props.is_active === false ? "停用／未啟用" : ""} />
    <Row label="管理機關" value={text(props.agency)} />
    <Row label="河川" value={text(props.river)} />
    <Row label="流域／分區" value={text(props.basin)} />
    <Row label="縣市鄉鎮" value={place(props.county, props.township)} />
    <SourceFooter props={{ source_org: `${text(props.agency, "環境部、水利署")} 水質監測站`, license: LICENSE, fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function SewageTreatmentPlantsPanel({ props }: PanelProps) {
  const quality = text(props.geocode_quality);
  const uncertain = (SEWAGE_UNCERTAIN_QUALITIES as readonly string[]).includes(quality);
  return <>
    <Title color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants}>{text(props.name, "公共污水處理廠")}</Title>
    {uncertain && <Row label="位置" value="位置不確定：地址只定位到區域中心或約略位置" color={RIVER_RPI_NO_DATA_COLOR} />}
    <Row label="縣市" value={text(props.county)} />
    <Row label="地址" value={text(props.address)} />
    <Row label="定位精度" value={SEWAGE_GEOCODE_QUALITY_LABELS[quality] ?? "未提供"} />
    <SourceFooter props={{ source_org: "內政部 公共污水處理廠（地址經 Google 定位）", source_url: "https://data.gov.tw/dataset/26496", license: LICENSE, fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function DrinkingWaterProtectionZonesPanel({ props }: PanelProps) {
  const zone = DRINKING_WATER_ZONE_TYPES.find((row) => row.value === props.zone_type);
  return <>
    <Title color={zone?.color ?? ENVIRONMENT_LAYER_COLORS.drinkingWaterProtectionZones}>{text(props.name, "飲用水水源水質保護區")}</Title>
    <Row label="區域類型" value={zone?.label ?? text(props.zone_type, "未提供")} color={zone?.color} />
    <Row label="劃設範圍" value={text(props.delineation)} />
    <Row label="水體分類" value={text(props.water_body_class)} />
    <Row label="取水口" value={text(props.intake_name)} />
    <Row label="縣市" value={text(props.county)} />
    <Row label="流域" value={text(props.basin)} />
    <Row label="法源" value={text(props.legal_basis)} />
    <Row label="提醒" value="環境部依飲用水管理條例公告；不同於水利署依自來水法劃設的自來水水質水量保護區。" />
    <SourceFooter props={{ source_org: "環境部 全國飲用水水源水質保護區範圍圖（GISEPA_P_13，2026-07-20 版）", source_url: "https://data.gov.tw/dataset/6377", license: LICENSE, fetched_at: day(props.retrieved_at) }} />
  </>;
}
