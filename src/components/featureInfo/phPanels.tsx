// 菲律賓圖層 popup（2026-11-13 第 0–1 波）。規格與署名 SSOT 在 data/phDataLayers.ts；
// 來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。空值列由 Row 自動隱藏，不寫 0。
import { useEffect, useMemo, useState, type FC } from "react";
import { Badge, Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { TimeseriesSparkline } from "../TimeseriesSparkline";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { microSensorPm25Color } from "../../data/microSensorTypes";
import {
  PH_OPENAQ_NO_DATA_COLOR, PH_OPENAQ_NOTES, PH_OPENAQ_SOURCE, fetchPhOpenaqSeries, finiteOrNull, phOpenaqIsStale, type PhOpenaqSeriesPoint,
} from "../../data/openaqLoader";
import { useLocale } from "../../state/localeStore";
import { caText } from "../../data/caInfraTypes";
import {
  PH_ADMIN_COLOR, PH_ADMIN_LEVEL_LABELS, PH_ADMIN_SOURCE, PH_DATA_SPECS, PH_FETCHED_AT, PH_NOT_COVERED_COLOR, PH_POP_STATUS,
  PH_POPULATION_SOURCE, PH_URBAN_CLASS, phCatOf, phText, pickL3, type L3, type PhField, type PhLayerSpec, type PhAdminLevel,
} from "../../data/phDataLayers";
import type { PhDataKey } from "../../data/phDataKeys";

type P = { props: Record<string, unknown> };

function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

function AdminRows({ props, pick }: { props: Record<string, unknown>; pick: (t: L3) => string }) {
  const level = caText(props.level) as PhAdminLevel;
  return <>
    {PH_ADMIN_LEVEL_LABELS[level] ? <Row label={pick({ zh: "層級", en: "Level", ja: "階層" })} value={pick(PH_ADMIN_LEVEL_LABELS[level])} /> : null}
    {level !== "region" ? <Row label={pick({ zh: "所屬區域", en: "Region", ja: "所属地方" })} value={caText(props.region_name)} /> : null}
    {level === "municipality" || level === "barangay" ? <Row label={pick({ zh: "所屬省", en: "Province", ja: "所属州" })} value={caText(props.province_name)} /> : null}
    {level === "barangay" ? <Row label={pick({ zh: "所屬市鎮", en: "City / municipality", ja: "所属市町" })} value={caText(props.municipality_name)} /> : null}
  </>;
}

/** 行政邊界：名稱、層級、上層行政區、PSGC 代碼。 */
export function PhAdminBoundariesPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  return <>
    <Title color={PH_ADMIN_COLOR}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <SourceFooter props={{ source_org: phText(PH_ADMIN_SOURCE.org, locale), source_url: PH_ADMIN_SOURCE.url, license: phText(PH_ADMIN_SOURCE.license, locale), fetched_at: PH_FETCHED_AT }} />
  </>;
}

/** 人口：2024 普查人口與密度；未涵蓋寫「未涵蓋」不寫 0；合併值另註。 */
export function PhPopulationPanel({ props }: P) {
  const { locale } = useLocale();
  const pick = (t: L3) => pickL3(t, locale);
  const status = caText(props.pop_status);
  const notCovered = status === "not_covered";
  const noData = pick({ zh: "未涵蓋", en: "Not covered", ja: "未収録" });
  const pop = notCovered ? "" : fmtNum(props.population);
  const density = notCovered ? "" : fmtNum(props.density_per_km2, 1);
  return <>
    <Title color={notCovered ? PH_NOT_COVERED_COLOR : "#f59e0b"}>{caText(props.name) || pick({ zh: "行政區", en: "Administrative area", ja: "行政区域" })}</Title>
    <AdminRows props={props} pick={pick} />
    <Row label={pick({ zh: "2024 人口", en: "Population 2024", ja: "2024 年人口" })} value={pop || noData} />
    <Row label={pick({ zh: "人口密度", en: "Density", ja: "人口密度" })} value={density ? `${density} ${pick({ zh: "人／km²", en: "people/km²", ja: "人／km²" })}` : noData} />
    {PH_POP_STATUS[status] ? <Row label={pick({ zh: "人口來源", en: "Population basis", ja: "人口の根拠" })} value={pick(PH_POP_STATUS[status]!)} /> : null}
    {PH_URBAN_CLASS[caText(props.urban_class)] ? <Row label={pick({ zh: "都市／鄉村", en: "Urban / rural", ja: "都市・農村" })} value={pick(PH_URBAN_CLASS[caText(props.urban_class)]!)} /> : null}
    <SourceFooter props={{ source_org: phText(PH_POPULATION_SOURCE.org, locale), source_url: PH_POPULATION_SOURCE.url, license: phText(PH_POPULATION_SOURCE.license, locale), fetched_at: PH_FETCHED_AT }} />
  </>;
}

/** 上游的空值字樣（GFI 的 'nan'、'None'、NAMRIA 的 '..'）一律當空值，不顯示。 */
const EMPTY_TOKENS = new Set(["nan", "NaN", "None", "null", "..", "…"]);

function formatField(f: PhField, props: Record<string, unknown>, locale: string): string {
  const raw = EMPTY_TOKENS.has(caText(props[f.prop])) ? "" : props[f.prop];
  if (f.unlessSameAs && caText(raw) === caText(props[f.unlessSameAs])) return "";
  if (f.kind === "year") {
    // GFI 數值欄是字串（'2004.0'）：轉數字後取整，不加千分位
    const n = Number(caText(raw));
    return caText(raw) !== "" && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
  }
  if (f.kind === "num") {
    const s = fmtNum(raw, f.digits ?? 0);
    return s ? `${s}${f.unit ? ` ${phText(f.unit, locale)}` : ""}` : "";
  }
  const s = caText(raw);
  if (!s) return "";
  if (f.map?.[s]) return pickL3(f.map[s]!, locale);
  return s;
}

export function makePhPanel(spec: PhLayerSpec<string>): FC<P> {
  return function PhDataPanel({ props }) {
    const { locale } = useLocale();
    const cat = phCatOf(spec, props);
    let title = spec.title.props.map((p) => caText(props[p])).find(Boolean);
    if (!title && spec.title.fallbackBy) {
      const t = spec.title.fallbackBy.map[caText(props[spec.title.fallbackBy.prop])];
      if (t) title = pickL3(t, locale);
    }
    return <>
      <Title color={cat?.color ?? spec.otherColor ?? spec.color}>{title || pickL3(spec.title.fallback, locale)}</Title>
      {spec.fields.map((f) => <Row key={f.prop} label={pickL3(f.label, locale)} value={formatField(f, props, locale)} mono={f.kind === "code"} />)}
      {spec.popupNotes.filter((n) => !n.when || n.when(props)).map((n, i) => <Row key={i} label={locale === "en" ? "Note" : locale === "ja" ? "備考" : "備註"} value={pickL3(n.text, locale)} />)}
      <SourceFooter props={{ source_org: phText(spec.sourceOrg, locale), source_url: spec.sourceUrl, license: phText(spec.license, locale), fetched_at: spec.fetchedAt }} />
    </>;
  };
}

export const PH_DATA_PANELS = Object.fromEntries(PH_DATA_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<PhDataKey, FC<P>>;

// ── 即時空品（OpenAQ）：比照 LASS 微型感測 MicroSensorPanel（PM2.5 大字＋其他參數列），加低價感測器標示、過舊、近 7 天走勢與每站署名 ──

const MANILA_TIME: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

function PhOpenaqTrend({ locationId, pick }: { locationId: number; pick: (t: L3) => string }) {
  const t = useFeatureTheme();
  const [points, setPoints] = useState<PhOpenaqSeriesPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setFailed(false);
    fetchPhOpenaqSeries(locationId, 7)
      .then((p) => { if (!cancelled) setPoints(p); })
      .catch((err: unknown) => {
        console.warn("[PhOpenaq] series failed:", err);
        if (!cancelled) { setPoints([]); setFailed(true); }
      });
    return () => { cancelled = true; };
  }, [locationId]);
  // 時間軸固定給滿 7 天：資料從 2026-11-18 才開始收，前面的空白要看得見
  const domain = useMemo(() => { const to = Math.floor(Date.now() / 1000); return { from: to - 7 * 86_400, to }; }, [locationId]);
  const note = (text: string, color: string) => <div style={{ padding: "6px 2px", color, fontSize: FONT_SIZE.sm }}>{text}</div>;
  return <div style={{ marginTop: 8 }}>
    <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, marginBottom: 2 }}>{pick({ zh: "近 7 天 PM2.5（µg/m³）", en: "PM2.5, last 7 days (µg/m³)", ja: "直近 7 日の PM2.5（µg/m³）" })}</div>
    {points == null ? note(pick({ zh: "載入中…", en: "Loading…", ja: "読み込み中…" }), t.textDim)
      : failed ? note(pick({ zh: "走勢讀取失敗", en: "Failed to load trend", ja: "推移の読み込みに失敗" }), t.warn)
        : points.length < 2 ? note(pick({ zh: "近 7 天無資料", en: "No data in the last 7 days", ja: "直近 7 日のデータなし" }), t.textDim)
          : <TimeseriesSparkline data={points} timeDomain={domain} unit="µg/m³" lineColor="#7e57c2" height={110} gapSec={3 * 3600} showTooltip />}
  </div>;
}

/** 即時空品：低價感測器／官方監測站標示、PM2.5（缺值寫「無資料」不寫 0）、過舊（>3h）警示、走勢、每站署名＋OpenAQ。 */
export function PhOpenaqAirPanel({ props }: P) {
  const t = useFeatureTheme();
  const { locale, formatDateTime } = useLocale();
  const pick = (x: L3) => pickL3(x, locale);
  const now = Date.now();
  const pm25 = finiteOrNull(props.pm25);
  const pm25At = caText(props.pm25_observed_at) || null;
  const isMonitor = props.is_monitor === true || props.is_monitor === "true";
  const stale = pm25 != null && phOpenaqIsStale(pm25At, now);
  const color = pm25 == null ? PH_OPENAQ_NO_DATA_COLOR : microSensorPm25Color(pm25);
  const noData = pick({ zh: "無資料", en: "No data", ja: "データなし" });
  const fmtTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? `${formatDateTime(d, MANILA_TIME)} ${pick({ zh: "（馬尼拉時間）", en: "(Manila time)", ja: "（マニラ時間）" })}` : "";
  };
  const val = (k: string, unit: string, digits = 1) => {
    const v = finiteOrNull(props[k]);
    return v == null ? "" : `${v.toFixed(digits)} ${unit}`;
  };
  const license = caText(props.license_names);
  const attribution = caText(props.attribution_name) || caText(props.owner_name) || caText(props.provider_name);
  const locationId = finiteOrNull(props.location_id);
  return <>
    <Title color={color}>{caText(props.name) || pick({ zh: "空品測站", en: "Air quality station", ja: "大気測定点" })}</Title>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 6px" }}>
      {isMonitor
        ? <Badge label={pick({ zh: "官方監測站", en: "Official monitor", ja: "公式測定局" })} on color="#2563eb" />
        : <Badge label={pick({ zh: "低價感測器・非官方測站", en: "Low-cost sensor · not an official monitor", ja: "低価格センサー・公式測定局ではない" })} on color="#b45309" />}
      {stale ? <Badge label={pick({ zh: "超過 3 小時未更新", en: "Not updated for 3+ hours", ja: "3 時間以上未更新" })} on color="#6b7280" /> : null}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 8px", background: t.bgSubtle, borderRadius: RADIUS.md }}>
      <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color: pm25 == null ? t.textDim : color }}>{pm25 != null ? pm25.toFixed(1) : noData}</span>
      <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>PM2.5 µg/m³</span>
    </div>
    <Row label={pick({ zh: "PM2.5 量測時間", en: "PM2.5 measured", ja: "PM2.5 測定時刻" })} value={fmtTime(pm25At) || noData} />
    <Row label="PM10" value={val("pm10", "µg/m³")} />
    <Row label="PM1" value={val("pm1", "µg/m³")} />
    <Row label={pick({ zh: "溫度", en: "Temperature", ja: "気温" })} value={val("temperature", "°C")} />
    <Row label={pick({ zh: "相對濕度", en: "Relative humidity", ja: "相対湿度" })} value={val("humidity", "%", 0)} />
    <Row label={pick({ zh: "0.3 µm 微粒數", en: "Particles ≥0.3 µm", ja: "0.3 µm 粒子数" })} value={val("um003", "particles/cm³", 0)} />
    <Row label={pick({ zh: "地點", en: "Locality", ja: "所在地" })} value={caText(props.locality) === "N/A" ? "" : caText(props.locality)} />
    <Row label={pick({ zh: "設備商", en: "Provider", ja: "提供元" })} value={caText(props.provider_name)} />
    <Row label={pick({ zh: "設置者", en: "Owner", ja: "設置者" })} value={caText(props.owner_name)} />
    {locationId != null ? <PhOpenaqTrend locationId={locationId} pick={pick} /> : null}
    {PH_OPENAQ_NOTES.slice(0, 1).map((n, i) => <div key={i} style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: t.textDim }}>{pick(n)}</div>)}
    <SourceFooter props={{
      source_org: `${attribution ? `${attribution} via ` : ""}OpenAQ`,
      source_url: locationId != null ? `https://explore.openaq.org/locations/${locationId}` : PH_OPENAQ_SOURCE.url,
      attribution_href: caText(props.attribution_url),
      license: license || pick({ zh: "OpenAQ 未提供授權資訊", en: "License not provided by OpenAQ", ja: "OpenAQ にライセンス情報なし" }),
    }} />
  </>;
}
