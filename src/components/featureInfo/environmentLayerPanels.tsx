// 環境氣候 popup：水質與污水 4 層（#490）＋第二波 9 層（海域水質、RPI 河段推估、PM2.5 手動站、戴奧辛、
// 焚化廠、核安會輻射、放流水、CEMS、紫外線）。上游 feature 的 source 欄位含內部表名或根本沒有（即時 RPC），
// 故 panel 自帶人類可讀來源並自掛 SourceFooter。null 一律顯示原因，不當 0。
import { useEffect, useState } from "react";
import type { PanelProps } from "./registry";
import { PopupDetails, PopupScroll, Row, SourceFooter, Title, formatTaiwanTime } from "./shared";
import {
  DRINKING_WATER_ZONE_TYPES, ENVIRONMENT_LAYER_COLORS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR,
  SEWAGE_GEOCODE_QUALITY_LABELS, SEWAGE_UNCERTAIN_QUALITIES, WATER_QUALITY_STATION_TYPE_LABELS, WATER_QUALITY_STATION_TYPES,
  CEMS_CODE2_LEAD_LABELS, CEMS_STATUSES, CWA_UV_LEVELS, ENV_ALERT_COLOR, ENV_STALE_COLOR, ENV_VALUE_FLAG_LABELS,
  NUSC_GAMMA_HIGH_USVH, OSM_ODBL_ATTRIBUTION, RIVER_RPI_TIDAL_LABELS, RIVER_RPI_ASSIGN_METHOD_LABELS, RIVER_RPI_DIRECTION_LABELS,
  RIVER_RPI_REASSIGN_METHOD, riverRpiReviewNotes, SEA_WATER_CLASSES, WATER_EFFLUENT_COORD_SOURCE_LABELS,
  WATER_EFFLUENT_STATUSES,
} from "../../data/environmentLayerTypes";
import { fetchCemsItems, fetchWaterEffluentItems, type CemsItem, type EffluentItem } from "../../data/environmentLiveLoaders";

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

// ══════════════════════════════════════════════════════════════════
//  第二波（2026-10-02）
// ══════════════════════════════════════════════════════════════════

function fmt(value: number, digits = 2): string {
  return value.toLocaleString("zh-TW", { maximumFractionDigits: digits });
}

function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value;
}

/** 測值＋上游旗標：lt_dl 時數值是偵測極限；null 依旗標說原因（ND／未測／未申報…），不寫 0。 */
function flagged(value: unknown, flag: unknown, unit: string, digits = 2): string {
  const n = number(value);
  const f = text(flag);
  const reason = f ? ENV_VALUE_FLAG_LABELS[f] ?? "有註記" : "";
  if (f === "lt_dl") return n == null ? "低於偵測極限" : `${withUnit(`<${fmt(n, digits)}`, unit)}（低於偵測極限）`;
  if (n == null) return reason || "未測";
  return reason ? `${withUnit(fmt(n, digits), unit)}（${reason}）` : withUnit(fmt(n, digits), unit);
}

function bool(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

export function SeaWaterQualityStationsPanel({ props }: PanelProps) {
  const cls = SEA_WATER_CLASSES.find((row) => row.value === props.water_quality_class);
  const stale = bool(props.is_stale) === true || props.latest_sample_date == null;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : cls?.color ?? ENVIRONMENT_LAYER_COLORS.seaWaterQualityStations}>{text(props.station_name, "海域水質測站")}</Title>
    <Row label="海域" value={text(props.sample_area)} />
    <Row label="海域分類" value={cls?.label ?? "未提供"} color={cls?.color} />
    <Row label="最新採樣" value={day(props.latest_sample_date) || "無採樣紀錄"} />
    {stale && <Row label="狀態" value="最新採樣已過期或無採樣，顏色不代表現況" color={ENV_STALE_COLOR} />}
    <Row label="水溫" value={flagged(props.water_temp_c, props.water_temp_c_flag, "°C", 1)} />
    <Row label="pH" value={flagged(props.ph, props.ph_flag, "", 2)} />
    <Row label="溶氧 DO" value={flagged(props.do_ele_mgl, props.do_ele_mgl_flag, "mg/L")} title="電極法；滴定法測值目前全為空" />
    <Row label="懸浮固體 SS" value={flagged(props.ss_mgl, props.ss_mgl_flag, "mg/L")} />
    <Row label="氨氮 NH3-N" value={flagged(props.nh3_n_mgl, props.nh3_n_mgl_flag, "mg/L", 3)} />
    <Row label="縣市" value={text(props.county)} />
    <PopupDetails summary="說明與限制">
      <Row label="分類" value="甲乙丙為海域環境分類（依用途劃定），不是單次採樣好壞" />
      <Row label="更新" value="約每季採樣；資料集約半年至一季更新" />
      <Row label="採樣次數" value={number(props.n_samples) == null ? "" : `${fmt(number(props.n_samples)!, 0)} 次（自 ${day(props.first_sample_date)}）`} />
      <Row label="站號" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: "海洋委員會海洋保育署 國家海域水質測站", source_url: "https://data.gov.tw/dataset/155934", license: LICENSE }} />
  </>;
}

function rpiTarget(props: Record<string, unknown>): string {
  const node = text(props.to_node);
  if (node.startsWith("confluence:")) return `匯入${node.slice("confluence:".length)}`;
  if (node === "mouth") return "河口";
  if (node === "unknown") return "下游終點未定";
  return text(props.to_station_name, "下一站");
}

/** 最下游段（無下一站）延伸到匯流點／河口：中間沒有測站；延伸到河口者可能受潮汐影響（未以潮位驗證）。 */
function rpiDownstreamNote(props: Record<string, unknown>): string {
  const node = text(props.to_node);
  if (node === "mouth") return "下游沒有測站，延伸至河口；近河口段可能受潮汐影響（未以潮位資料驗證）";
  if (node.startsWith("confluence:") || node === "unknown") return "下游沒有測站，延伸至河道終點";
  return "";
}

function rpiAssignment(props: Record<string, unknown>): string {
  const raw = text(props.river_raw);
  const assigned = text(props.river_assigned, text(props.river_name));
  if (props.assign_method === RIVER_RPI_REASSIGN_METHOD && raw && assigned && raw !== assigned) {
    return `環境部登記為${raw}，依位置對應至${assigned}`;
  }
  return "";
}

export function RiverRpiSegmentsPanel({ props }: PanelProps) {
  const latest = RIVER_RPI_CLASSES.find((row) => row.value === props.class_latest);
  const mean = RIVER_RPI_CLASSES.find((row) => row.value === props.class_12m_mean);
  const rpi = number(props.rpi_latest);
  const rpiMean = number(props.rpi_12m_mean);
  const length = number(props.length_km);
  const distance = number(props.assign_distance_m);
  const direction = text(props.direction);
  const reviewNotes = riverRpiReviewNotes(props.review_flags);
  const method = RIVER_RPI_ASSIGN_METHOD_LABELS[text(props.assign_method)];
  return <>
    <Title color={latest?.color ?? RIVER_RPI_NO_DATA_COLOR}>{`${text(props.river_name, "河段")}（推估河段）`}</Title>
    <Row label="河段" value={`${text(props.from_station_name, "上游測站")} → ${rpiTarget(props)}`} />
    <Row label="河名" value={rpiAssignment(props)} />
    <Row label="流域" value={text(props.basin)} />
    <Row label="最新 RPI" value={rpi == null ? "無資料（不代表乾淨）" : `${fmt(rpi)}（${latest?.label ?? "無等級"}）`} color={latest?.color} />
    <Row label="採樣日" value={day(props.rpi_latest_date)} />
    <Row label="近 12 月平均" value={rpiMean == null ? "無樣本（不代表乾淨）" : `${fmt(rpiMean)}（${mean?.label ?? "無等級"}，${fmt(number(props.n_samples_12m) ?? 0, 0)} 次）`} color={mean?.color} />
    <Row label="長度" value={length == null ? "" : `${fmt(length)} 公里`} />
    <Row label="感潮" value={RIVER_RPI_TIDAL_LABELS[text(props.tidal)] ?? "未判定"} />
    <Row label="流向" value={direction === "verified" ? "" : (RIVER_RPI_DIRECTION_LABELS[direction] ?? "未驗證")} />
    <Row label="待複核" value={reviewNotes.join("；")} />
    <PopupDetails summary="推估方法與限制">
      <Row label="方法" value="以上游測站代表其下游至下一站，非連續監測、非空間內插" />
      <Row label="河名對應" value={method == null ? "" : `${method}${distance == null ? "" : `（測站距河道 ${fmt(distance, 0)} 公尺）`}`} />
      <Row label="流向" value={direction === "verified" ? (RIVER_RPI_DIRECTION_LABELS.verified ?? "") : ""} />
      <Row label="下游" value={rpiDownstreamNote(props)} />
      <Row label="感潮段" value="受潮汐影響的河段，單一採樣的 RPI 代表性較差；感潮只在淡水河、高屏溪判定，已確認感潮段地圖以虛線表示，其餘流域未判定" />
      <Row label="範圍" value="全台有 RPI 測站的河川；沒有測站的河川不著色，不代表乾淨" />
    </PopupDetails>
    <SourceFooter props={{ source_org: `環境部河川水質監測（RPI）＋經濟部水利署河道面與流域範圍＋${OSM_ODBL_ATTRIBUTION}`, source_url: "https://data.gov.tw/dataset/6078", license: `${LICENSE}；河川中心線 ODbL 1.0` }} />
  </>;
}

export function Pm25ManualStationsPanel({ props }: PanelProps) {
  const mean = number(props.mean_12m_ugm3);
  const latest = number(props.latest_pm25_ugm3);
  const active = bool(props.is_active);
  const nValid = number(props.n_valid_12m);
  const meanFlag = text(props.mean_12m_flag);
  return <>
    <Title color={active === false || mean == null ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.pm25ManualStations}>{`${text(props.station_name, "PM2.5 手動站")}（手動採樣）`}</Title>
    <Row label="近 12 月平均" value={mean == null ? (ENV_VALUE_FLAG_LABELS[meanFlag] ?? "無有效樣本") : `${fmt(mean)} μg/m3`} />
    <Row label="有效樣本" value={nValid == null ? "" : `${fmt(nValid, 0)} 筆（${text(props.mean_12m_window)}）`} />
    <Row label="最近一筆" value={latest == null ? "無有效值" : `${fmt(latest, 1)} μg/m3（${day(props.latest_valid_date)}）`} />
    <Row label="站況" value={active === true ? "採樣中" : active === false ? "已停測（中空灰點）" : ""} color={active === false ? ENV_STALE_COLOR : undefined} />
    <Row label="縣市" value={text(props.county)} />
    <Row label="位置" value={text(props.location_note, "座標為同名空品自動站座標")} />
    <PopupDetails summary="說明與限制">
      <Row label="採樣" value={text(props.sampling_note, "手動採樣約每 3 天 1 筆日平均，非即時")} />
      <Row label="累計" value={number(props.n_records) == null ? "" : `${fmt(number(props.n_records)!, 0)} 筆（自 ${day(props.first_record_date)}）`} />
      <Row label="顏色" value="色與微型感測 PM2.5 五級同源，改成連續漸層；不是 AQI" />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部 細懸浮微粒手動監測（aqx_p_10）", source_url: "https://data.gov.tw/dataset/6343", license: LICENSE }} />
  </>;
}

export function DioxinStationsPanel({ props }: PanelProps) {
  const teq = number(props.latest_teq_pg_m3);
  const stale = bool(props.is_stale) === true;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.dioxinStations}>{text(props.station_name, "戴奧辛測站")}</Title>
    <Row label="最新濃度" value={teq == null ? "無有效值" : `${fmt(teq, 4)} pg I-TEQ/m3`} />
    <Row label="採樣日" value={day(props.latest_sample_date)} />
    {stale && <Row label="狀態" value="最新採樣已過期（中空灰點），不代表現況" color={ENV_STALE_COLOR} />}
    <Row label="採樣地址" value={text(props.sample_address)} />
    <Row label="樣本數" value={number(props.n_samples) == null ? "" : `${fmt(number(props.n_samples)!, 0)} 次（自 ${day(props.first_sample_date)}）`} />
    <Row label="縣市" value={text(props.county)} />
    <Row label="位置" value={text(props.location_note)} />
    <PopupDetails summary="說明與限制">
      <Row label="採樣" value={text(props.sampling_note, "定期採樣，約每半年 1–2 次，非即時")} />
      <Row label="顏色" value="序列色只表相對高低，未與標準比對" />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部 空氣中戴奧辛（doxair_s_01）", source_url: "https://data.gov.tw/dataset/6353", license: LICENSE }} />
  </>;
}

function incineratorFurnaces(props: Record<string, unknown>) {
  return [1, 2, 3, 4].map((no) => {
    const value = props[`dioxin_f${no}_ng_teq_nm3`];
    const flag = props[`dioxin_f${no}_flag`];
    const date = day(props[`dioxin_f${no}_test_date`]);
    if (value == null && (flag == null || flag === "no_test") && !date) return null;
    return { no, label: `${["一", "二", "三", "四"][no - 1]}號爐`, value: `${flagged(value, flag, "ng-TEQ/Nm3", 3)}${date ? `（${date}）` : ""}` };
  }).filter((row): row is { no: number; label: string; value: string } => row != null);
}

export function IncineratorEmissionsPanel({ props }: PanelProps) {
  const max = number(props.dioxin_max_ng_teq_nm3);
  const unusual = bool(props.unusual_output);
  return <>
    <Title color={ENVIRONMENT_LAYER_COLORS.incineratorEmissions}>{text(props.plant_name, "焚化廠")}</Title>
    <Row label="申報月" value={text(props.latest_month)} />
    <Row label="氮氧化物 NOx" value={flagged(props.nox_ppm, props.nox_ppm_flag, "ppm", 1)} />
    <Row label="硫氧化物 SOx" value={flagged(props.sox_ppm, props.sox_ppm_flag, "ppm", 2)} />
    <Row label="氯化氫 HCl" value={flagged(props.hcl_ppm, props.hcl_ppm_flag, "ppm", 2)} />
    <Row label="COx" value={flagged(props.cox_ppm, props.cox_ppm_flag, "ppm", 2)} />
    <Row label="粒狀物" value={props.dust_mg_nm3 == null ? "未申報" : flagged(props.dust_mg_nm3, props.dust_mg_nm3_flag, "mg/Nm3", 2)} />
    <Row label="不透光率" value={flagged(props.opacity_pct, props.opacity_pct_flag, "%", 2)} />
    <Row label="戴奧辛（各爐最大）" value={max == null ? "無有效檢測" : `${fmt(max, 3)} ng-TEQ/Nm3`} />
    {incineratorFurnaces(props).map((row) => <Row key={row.no} label={`　${row.label}`} value={row.value} />)}
    {unusual != null && <Row label="異常排放申報" value={unusual ? "該月有申報" : "該月無"} color={unusual ? ENV_ALERT_COLOR : undefined} />}
    <Row label="縣市" value={text(props.county)} />
    <PopupDetails summary="說明與限制">
      <Row label="更新" value="每月（環境部月報，約延遲 1–2 個月）；戴奧辛為各爐最近一次有效檢測" />
      <Row label="比對" value="資料集未附排放標準，本圖不判定是否超標；顏色以 NOx 相對高低著色" />
      <Row label="位置" value={text(props.location_note)} />
      <Row label="申報期間" value={number(props.n_months) == null ? "" : `${fmt(number(props.n_months)!, 0)} 個月（自 ${text(props.first_month)}）`} />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部 焚化廠空污監測（fac_s_04）", source_url: "https://data.gov.tw/dataset/6368", license: LICENSE }} />
  </>;
}

// ── 即時 4 層 ───────────────────────────────────────────────────

export function NuscGammaRadiationPanel({ props }: PanelProps) {
  const dose = number(props.dose_usvh);
  const stale = bool(props.is_stale) === true;
  const high = dose != null && dose >= NUSC_GAMMA_HIGH_USVH;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.nuscGammaRadiation}>{text(props.station_name, "環境輻射監測站")}</Title>
    <Row label="劑量率" value={dose == null ? "無讀值" : `${fmt(dose, 3)} μSv/h`} color={high ? ENV_ALERT_COLOR : undefined} />
    <Row label="觀測時間" value={formatTaiwanTime(text(props.observed_at) || null) || "無"} mono />
    {stale && <Row label="狀態" value="超過 30 分鐘未更新（中空灰點），不是即時值" color={ENV_STALE_COLOR} />}
    {high && <Row label="提醒" value="高於一般背景，請以核安會公告為準" color={ENV_ALERT_COLOR} />}
    <PopupDetails summary="說明與限制">
      <Row label="背景值" value="一般環境背景約 0.04–0.14 μSv/h（地質、海拔、降雨會影響）" />
      <Row label="更新" value="每 15 分鐘；地圖每 15 分鐘重抓" />
      <Row label="區別" value="核安會全國環境輻射監測網；與台電核電廠周界監測（災害・核安）為不同測站網" />
      <Row label="站碼" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: "核能安全委員會 輻射偵測中心 全國環境輻射即時監測", source_url: "https://data.gov.tw/dataset/119233", license: LICENSE, fetched_at: formatTaiwanTime(text(props.updated_at) || null) }} />
  </>;
}

/** popup 開啟時才用設施代號拉全部測項（地圖只帶彙總）；loading／錯誤各自顯示，不畫假資料。 */
function useLiveItems<T>(cno: string, fetcher: (cno: string) => Promise<T[]>) {
  const [state, setState] = useState<{ items: T[] | null; error: string | null }>({ items: null, error: null });
  useEffect(() => {
    if (!cno) { setState({ items: [], error: null }); return; }
    let cancelled = false;
    setState({ items: null, error: null });
    fetcher(cno)
      .then((items) => { if (!cancelled) setState({ items, error: null }); })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[envLive] 測項明細載入失敗:", err);
        setState({ items: null, error: "資料服務回應失敗，請稍後再試" });
      });
    return () => { cancelled = true; };
  }, [cno, fetcher]);
  return state;
}

function effluentItemRow(item: EffluentItem, index: number) {
  const value = item.value == null ? "無值" : withUnit(fmt(item.value, 3), item.unit ?? "");
  const std = item.std1 != null || item.std2 != null ? `；標準 ${[item.std1, item.std2].filter((v) => v != null).join("–")}` : "";
  return <Row key={index} label={`${item.item ?? "測項"}${item.outlet_no ? `（${item.outlet_no}）` : ""}`} value={`${value}・${item.status ?? "狀態未提供"}${std}`}
    color={item.is_exceed ? ENV_ALERT_COLOR : item.status && item.status !== "正常值" ? WATER_EFFLUENT_STATUSES[1].color : undefined} />;
}

export function WaterEffluentLivePanel({ props }: PanelProps) {
  const status = text(props.status);
  const meta = WATER_EFFLUENT_STATUSES.find((row) => row.value === status);
  const { items, error } = useLiveItems(text(props.cno), fetchWaterEffluentItems);
  const flaggedItems = (items ?? []).filter((item) => item.is_exceed || (item.status && item.status !== "正常值"));
  const normalItems = (items ?? []).filter((item) => !(item.is_exceed || (item.status && item.status !== "正常值")));
  return <>
    <Title color={status === "stale" ? ENV_STALE_COLOR : meta?.color ?? ENVIRONMENT_LAYER_COLORS.waterEffluentLive}>{text(props.facility_name, "放流水監測設施")}</Title>
    <Row label="狀態" value={status === "stale" ? "資料逾時（超過 3 小時未更新）" : meta?.label ?? "未知"} color={status === "stale" ? ENV_STALE_COLOR : meta?.color} />
    <Row label="觀測時間" value={formatTaiwanTime(text(props.observed_at) || null) || "無"} mono />
    <Row label="測項" value={`${fmt(number(props.item_count) ?? 0, 0)} 項；超限 ${fmt(number(props.exceed_count) ?? 0, 0)}、異常 ${fmt(number(props.abnormal_count) ?? 0, 0)}`} />
    <Row label="縣市" value={text(props.county)} />
    <Row label="座標來源" value={WATER_EFFLUENT_COORD_SOURCE_LABELS[text(props.coord_source)] ?? "未提供"} />
    {error && <Row label="測項明細" value={error} color={ENV_ALERT_COLOR} />}
    {!error && items == null && <Row label="測項明細" value="載入中…" />}
    {flaggedItems.map(effluentItemRow)}
    {normalItems.length > 0 && <PopupDetails summary={`其他 ${normalItems.length} 項（正常值）`}><PopupScroll>{normalItems.map(effluentItemRow)}</PopupScroll></PopupDetails>}
    <PopupDetails summary="說明與限制">
      <Row label="判定" value="超標以上游狀態「超限值」為準，不自行用標準值推算" />
      <Row label="更新" value="每小時；地圖每小時重抓；部分縣市上游停更會顯示逾時" />
      <Row label="管制編號" value={text(props.cno)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部 水量水質自動監測連線放流水即時資料", source_url: "https://data.gov.tw/dataset/35105", license: LICENSE }} />
  </>;
}

const CEMS_SOURCE_LABELS: Record<string, string> = { stack_1h: "煙道", flare_1h: "燃燒塔" };

function cemsItemRow(item: CemsItem, index: number) {
  const value = item.value == null ? "無值" : withUnit(fmt(item.value, 2), item.unit ?? "");
  const std = item.std_value != null ? `；標準 ${fmt(item.std_value, 2)}` : "";
  return <Row key={index} label={`${item.item ?? item.item_code ?? "測項"}${item.point_no ? `（${item.point_no}）` : ""}`}
    value={`${value}${std}・${item.code2_desc ?? "狀態未提供"}`} color={item.is_exceed ? ENV_ALERT_COLOR : undefined} />;
}

export function CemsStackLivePanel({ props }: PanelProps) {
  const status = text(props.status);
  const meta = CEMS_STATUSES.find((row) => row.value === status);
  const summary = text(props.code2_summary).split("、").filter(Boolean).map((part) => {
    const [lead, n] = part.split("×");
    return `${CEMS_CODE2_LEAD_LABELS[lead ?? ""] ?? "其他"} ${n ?? ""} 項`;
  }).join("、");
  const { items, error } = useLiveItems(text(props.cno), fetchCemsItems);
  const exceedItems = (items ?? []).filter((item) => item.is_exceed);
  const otherItems = (items ?? []).filter((item) => !item.is_exceed);
  return <>
    <Title color={status === "stale" ? ENV_STALE_COLOR : meta?.color ?? ENVIRONMENT_LAYER_COLORS.cemsStackLive}>{text(props.facility_name, "CEMS 監測設施")}</Title>
    <Row label="狀態" value={status === "stale" ? "資料逾時（超過 6 小時未更新）" : status === "unknown" ? "運轉狀態未提供" : meta?.label ?? "未知"} color={status === "stale" || status === "unknown" ? ENV_STALE_COLOR : meta?.color} />
    <Row label="觀測時間" value={formatTaiwanTime(text(props.observed_at) || null) || "無"} mono />
    <Row label="延遲" value="上游約延遲 4–5 小時，觀測時間不是現在" />
    <Row label="運轉狀態" value={summary} />
    <Row label="測項" value={`${fmt(number(props.item_count) ?? 0, 0)} 項；逾限 ${fmt(number(props.exceed_count) ?? 0, 0)}`} />
    <Row label="監測類別" value={text(props.sources).split("、").map((src) => CEMS_SOURCE_LABELS[src] ?? src).join("、")} />
    <Row label="縣市" value={text(props.county)} />
    {error && <Row label="測項明細" value={error} color={ENV_ALERT_COLOR} />}
    {!error && items == null && <Row label="測項明細" value="載入中…" />}
    {exceedItems.map(cemsItemRow)}
    {otherItems.length > 0 && <PopupDetails summary={`其他 ${otherItems.length} 項`}><PopupScroll>{otherItems.map(cemsItemRow)}</PopupScroll></PopupDetails>}
    <PopupDetails summary="說明與限制">
      <Row label="判定" value="逾限依上游狀態碼「數值逾限」；運轉狀態取各測項狀態碼首碼（N 運轉、F 暫停、G 歲修…）" />
      <Row label="座標" value="環境部列管設施座標；對不上列管表的設施不畫" />
      <Row label="管制編號" value={text(props.cno)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: "環境部 固定污染源 CEMS 連續自動監測", source_url: "https://data.gov.tw/dataset/31968", license: LICENSE }} />
  </>;
}

export function CwaUvDailyPanel({ props }: PanelProps) {
  const level = CWA_UV_LEVELS.find((row) => row.value === props.uv_level);
  const uv = number(props.uv_index);
  const stale = bool(props.is_stale) === true;
  return <>
    <Title color={stale || !level ? ENV_STALE_COLOR : level.color}>{`${text(props.station_name, "紫外線測站")}（前一天最大值）`}</Title>
    <Row label="紫外線指數" value={uv == null ? "缺值" : fmt(uv, 1)} />
    <Row label="等級" value={level?.label ?? "缺值"} color={level?.color} />
    <Row label="日期" value={`${day(props.obs_date)}（前一天最大值，非即時）`} />
    {stale && <Row label="狀態" value="資料超過 2 天未更新（中空灰點）" color={ENV_STALE_COLOR} />}
    <Row label="縣市" value={text(props.county)} />
    <PopupDetails summary="說明與限制">
      <Row label="資料" value="氣象署每日公布各站前一天紫外線指數最大值，不是現在的紫外線" />
      <Row label="更新" value="每日；地圖每 6 小時重抓" />
      <Row label="站號" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: "中央氣象署 紫外線指數（O-A0005-001）", source_url: "https://data.gov.tw/dataset/9039", license: LICENSE, fetched_at: formatTaiwanTime(text(props.collected_at) || null) }} />
  </>;
}
