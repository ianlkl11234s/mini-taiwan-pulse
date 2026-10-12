// 日本氣象廳（JMA）即時 4 層 popup。時間一律顯示日本時間（JST）；null 寫「無觀測」，不當 0。
// feature 只有 view 欄位、沒有來源欄位 → panel 自掛人類可讀出典的 SourceFooter。
import type { PanelProps } from "./registry";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { PopupDetails, PopupScroll, Row, SourceFooter, Title } from "./shared";
import {
  JMA_INTENSITY_CLASSES, JMA_LAYER_COLORS, JMA_LICENSE, JMA_MISSING_COLOR, JMA_SOURCE_URL, JMA_VOLCANO_LEVELS,
  JMA_WARNING_LEVELS, formatJst, jmaIntensityLabel,
} from "../../data/jmaTypes";
import { getLatestJmaWarnings, type JmaWarningArea } from "../../data/jmaLiveLoaders";

type I18n = Pick<LocaleSnapshot, "t" | "formatNumber">;

const ORG = "気象庁";

function text(value: unknown, fallback = ""): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
  return String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function measure(value: unknown, unit: string, digits: number, { t: tr, formatNumber }: I18n): string {
  const n = num(value);
  return n == null ? tr("popup.jma.noObservation") : `${formatNumber(n, { maximumFractionDigits: digits })} ${unit}`;
}

/** AMeDAS 風向 16 方位（1＝北北東 … 16＝北，0＝靜穩）。 */
const WIND_DIR_KEYS = [
  "popup.jma.windCalm", "popup.jma.windNne", "popup.jma.windNe", "popup.jma.windEne", "popup.jma.windE", "popup.jma.windEse", "popup.jma.windSe", "popup.jma.windSse", "popup.jma.windS",
  "popup.jma.windSsw", "popup.jma.windSw", "popup.jma.windWsw", "popup.jma.windW", "popup.jma.windWnw", "popup.jma.windNw", "popup.jma.windNnw", "popup.jma.windN",
] as const;

function windDir(value: unknown, tr: I18n["t"]): string {
  const n = num(value);
  if (n == null) return "";
  const key = WIND_DIR_KEYS[n];
  return key ? tr(key) : String(n);
}

function Footer({ fetchedAt }: { fetchedAt?: unknown }) {
  const { t: tr } = useLocale();
  return <SourceFooter props={{ source_org: tr("popup.jma.footerOrg", { org: ORG }), source_url: JMA_SOURCE_URL, license: JMA_LICENSE, fetched_at: formatJst(fetchedAt) }} />;
}

export function JmaAmedasPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const measure_ = (v: unknown, unit: string, digits = 1) => measure(v, unit, digits, i18n);
  const gauge = props.has_snow_gauge === true || props.has_snow_gauge === "true";
  const wind = measure_(props.wind, "m/s");
  const dir = windDir(props.wind_dir, tr);
  return <>
    <Title color={JMA_LAYER_COLORS.jmaAmedas}>{text(props.station_name, tr("popup.jma.amedasStation"))}</Title>
    <Row field="observedAt" value={formatJst(props.observed_at) || tr("popup.jma.noData")} mono />
    <Row label={tr("popup.jma.temp")} value={measure_(props.temp, "°C")} />
    <Row label={tr("popup.jma.precip10")} value={measure_(props.precip10m, "mm")} />
    <Row label={tr("popup.jma.precip1h")} value={measure_(props.precip1h, "mm")} />
    <Row label={tr("popup.jma.precip3h")} value={measure_(props.precip3h, "mm")} />
    <Row label={tr("popup.jma.precip24h")} value={measure_(props.precip24h, "mm")} />
    <Row label={tr("popup.jma.wind")} value={dir && num(props.wind) != null ? `${wind}（${dir}）` : wind} />
    <Row label={tr("popup.jma.gust")} value={measure_(props.gust, "m/s")} />
    <Row label={tr("popup.jma.humidity")} value={measure_(props.humidity, "%", 0)} />
    <Row label={tr("popup.jma.pressure")} value={measure_(props.pressure, "hPa")} />
    <Row label={tr("popup.jma.sun1h")} value={measure_(props.sun1h, tr("popup.jma.hours"))} />
    {gauge ? <>
      <Row label={tr("popup.jma.snowDepth")} value={measure_(props.snow, "cm", 0)} color={num(props.snow) == null ? JMA_MISSING_COLOR : undefined} />
      <Row label={tr("popup.jma.snowfall")} value={[props.snow1h, props.snow6h, props.snow12h, props.snow24h].map((v) => measure_(v, "cm", 0)).join("／")} />
    </> : <Row label={tr("popup.jma.snowDepth")} value={tr("popup.jma.noSnowGauge")} />}
    <PopupDetails summary={tr("popup.jma.detailsStation")}>
      <Row label={tr("popup.jma.stationNameEn")} value={text(props.station_name_en)} />
      <Row field="stationNo" value={text(props.station_id)} mono />
      <Row field="elevation" value={measure_(props.alt_m, "m", 0)} />
      <Row field="description" value={tr("popup.jma.amedasNote")} />
    </PopupDetails>
    <Footer fetchedAt={props.observed_at} />
  </>;
}

function areaFor(props: Record<string, unknown>): JmaWarningArea | null {
  const snapshot = getLatestJmaWarnings();
  if (!snapshot) return null;
  const code = text(props.admin_code);
  return snapshot.areas.get(code) ?? snapshot.cityNameKeys.get(`${code.slice(0, 2)}${text(props.city_name)}`) ?? null;
}

export function JmaWarningsPanel({ props }: PanelProps) {
  const { t: tr } = useLocale();
  const area = areaFor(props);
  const place = [text(props.pref_name), text(props.city_name), text(props.ward_name)].filter(Boolean).join(" ");
  const level = JMA_WARNING_LEVELS.find((l) => l.value === area?.level);
  const first = area?.rows[0];
  return <>
    <Title color={level?.color ?? JMA_LAYER_COLORS.jmaWarnings}>{place || tr("popup.jma.cityFallback")}</Title>
    {!area ? <Row field="status" value={tr("popup.jma.noWarningNow")} /> : <>
      <Row label={tr("popup.jma.areaLevel")} value={level?.label ?? tr("popup.jma.unknown")} color={level?.color} />
      {area.areaName && <Row label={tr("popup.jma.jmaArea")} value={area.areaName} />}
      <PopupScroll>
        {area.rows.map((row, i) => {
          const lv = JMA_WARNING_LEVELS.find((l) => l.value === row.level);
          return <Row key={`${row.area_code}-${row.kind_code}-${i}`}
            label={row.kind_name ?? tr("popup.jma.kindCode", { code: row.kind_code ?? "?" })}
            value={`${row.status ?? ""}${row.area_name && row.area_name !== area.areaName ? `（${row.area_name}）` : ""}`}
            color={lv?.color} />;
        })}
      </PopupScroll>
      <Row label={tr("popup.jma.reportTime")} value={formatJst(first?.report_datetime) || tr("popup.jma.noData")} mono />
      {first?.office_name && <Row label={tr("popup.jma.office")} value={first.office_name} />}
    </>}
    <PopupDetails summary={tr("popup.jma.detailsNotes")}>
      <Row label={tr("popup.jma.mapping")} value={tr("popup.jma.mappingNote")} />
      <Row field="updated" value={tr("popup.jma.warningUpdated")} />
      <Row label={tr("popup.jma.cityCode")} value={text(props.admin_code)} mono />
    </PopupDetails>
    <Footer fetchedAt={first?.control_datetime} />
  </>;
}

export function JmaQuakesPanel({ props }: PanelProps) {
  const { t: tr, formatNumber } = useLocale();
  const intensity = text(props.max_intensity) || null;
  const color = JMA_INTENSITY_CLASSES.find((c) => c.value === intensity)?.color ?? JMA_MISSING_COLOR;
  const mag = num(props.magnitude);
  const depth = num(props.depth_km);
  const byPref = text(props.intensity_by_pref);
  return <>
    <Title color={color}>{text(props.hypocenter_name, tr("popup.jma.hypocenterTbd"))}</Title>
    <Row field="occurredAt" value={formatJst(props.origin_time) || tr("popup.jma.notIssued")} mono />
    <Row label={tr("popup.jma.magnitude")} value={mag == null ? tr("popup.jma.notIssued") : `M${mag.toFixed(1)}`} />
    <Row label={tr("popup.jma.depth")} value={depth == null ? tr("popup.jma.notIssued") : `${formatNumber(depth)} km`} />
    <Row label={tr("popup.jma.maxIntensity")} value={jmaIntensityLabel(intensity)} color={color} />
    <Row label={tr("popup.jma.infoType")} value={text(props.title)} />
    <Row label={tr("popup.jma.reportTime")} value={formatJst(props.report_time) || tr("popup.jma.noData")} mono />
    <PopupDetails summary={tr("popup.jma.detailsQuake")}>
      {byPref && <Row label={tr("popup.jma.intensityByPref")} value={byPref.length > 400 ? `${byPref.slice(0, 400)}…` : byPref} />}
      <Row field="description" value={tr("popup.jma.quakeNote")} />
      <Row label={tr("popup.jma.eventId")} value={text(props.event_id)} mono />
    </PopupDetails>
    <Footer fetchedAt={props.report_time} />
  </>;
}

export function JmaVolcanoesPanel({ props }: PanelProps) {
  const { t: tr } = useLocale();
  const level = JMA_VOLCANO_LEVELS.find((l) => l.value === text(props.level)) ?? JMA_VOLCANO_LEVELS[5];
  return <>
    <Title color={level.color}>{text(props.volcano_name, tr("popup.jma.volcano"))}</Title>
    <Row label={tr("popup.jma.volcanoAlert")} value={level.label} color={level.color} />
    <Row label={tr("popup.jma.original")} value={text(props.level_name, tr("popup.jma.notProvided"))} />
    {text(props.warning_kind) && <Row label={tr("popup.jma.warningKind")} value={text(props.warning_kind)} />}
    <Row label={tr("popup.jma.reportTime")} value={formatJst(props.report_time) || tr("popup.jma.noData")} mono />
    <PopupDetails summary={tr("popup.jma.details")}>
      <Row label={tr("popup.jma.reading")} value={tr("popup.jma.volcanoNote")} />
      <Row label={tr("popup.jma.volcanoCode")} value={text(props.volcano_code)} mono />
    </PopupDetails>
    <Footer fetchedAt={props.report_time} />
  </>;
}
