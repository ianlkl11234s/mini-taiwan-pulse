// 日本氣象廳（JMA）即時 4 層 popup。時間一律顯示日本時間（JST）；null 寫「無觀測」，不當 0。
// feature 只有 view 欄位、沒有來源欄位 → panel 自掛人類可讀出典的 SourceFooter。
import type { PanelProps } from "./registry";
import { PopupDetails, PopupScroll, Row, SourceFooter, Title } from "./shared";
import {
  JMA_INTENSITY_CLASSES, JMA_LAYER_COLORS, JMA_LICENSE, JMA_MISSING_COLOR, JMA_SOURCE_URL, JMA_VOLCANO_LEVELS,
  JMA_WARNING_LEVELS, formatJst, jmaIntensityLabel,
} from "../../data/jmaTypes";
import { getLatestJmaWarnings, type JmaWarningArea } from "../../data/jmaLiveLoaders";

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

function measure(value: unknown, unit: string, digits = 1): string {
  const n = num(value);
  return n == null ? "無觀測" : `${n.toLocaleString("zh-TW", { maximumFractionDigits: digits })} ${unit}`;
}

/** AMeDAS 風向 16 方位（1＝北北東 … 16＝北，0＝靜穩）。 */
const WIND_DIRS = ["靜穩", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西", "北"];

function windDir(value: unknown): string {
  const n = num(value);
  if (n == null) return "";
  return WIND_DIRS[n] ?? String(n);
}

function Footer({ fetchedAt }: { fetchedAt?: unknown }) {
  return <SourceFooter props={{ source_org: `${ORG}（防災情報 bosai JSON）`, source_url: JMA_SOURCE_URL, license: JMA_LICENSE, fetched_at: formatJst(fetchedAt) }} />;
}

export function JmaAmedasPanel({ props }: PanelProps) {
  const gauge = props.has_snow_gauge === true || props.has_snow_gauge === "true";
  const wind = measure(props.wind, "m/s");
  const dir = windDir(props.wind_dir);
  return <>
    <Title color={JMA_LAYER_COLORS.jmaAmedas}>{text(props.station_name, "AMeDAS 觀測站")}</Title>
    <Row label="觀測時間" value={formatJst(props.observed_at) || "無"} mono />
    <Row label="氣溫" value={measure(props.temp, "°C")} />
    <Row label="前 10 分鐘雨量" value={measure(props.precip10m, "mm")} />
    <Row label="前 1 小時雨量" value={measure(props.precip1h, "mm")} />
    <Row label="前 3 小時雨量" value={measure(props.precip3h, "mm")} />
    <Row label="前 24 小時雨量" value={measure(props.precip24h, "mm")} />
    <Row label="風速" value={dir && wind !== "無觀測" ? `${wind}（${dir}）` : wind} />
    <Row label="最大瞬間風速" value={measure(props.gust, "m/s")} />
    <Row label="濕度" value={measure(props.humidity, "%", 0)} />
    <Row label="氣壓" value={measure(props.pressure, "hPa")} />
    <Row label="前 1 小時日照" value={measure(props.sun1h, "小時")} />
    {gauge ? <>
      <Row label="積雪深" value={measure(props.snow, "cm", 0)} color={num(props.snow) == null ? JMA_MISSING_COLOR : undefined} />
      <Row label="降雪量 1／6／12／24 小時" value={[props.snow1h, props.snow6h, props.snow12h, props.snow24h].map((v) => measure(v, "cm", 0)).join("／")} />
    </> : <Row label="積雪深" value="此站無積雪計" />}
    <PopupDetails summary="站點與說明">
      <Row label="站名（英）" value={text(props.station_name_en)} />
      <Row label="站號" value={text(props.station_id)} mono />
      <Row label="海拔" value={measure(props.alt_m, "m", 0)} />
      <Row label="說明" value="「無觀測」＝該要素此站未觀測或品質碼缺，不是 0；每 10 分鐘更新" />
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
  const area = areaFor(props);
  const place = [text(props.pref_name), text(props.city_name), text(props.ward_name)].filter(Boolean).join(" ");
  const level = JMA_WARNING_LEVELS.find((l) => l.value === area?.level);
  const first = area?.rows[0];
  return <>
    <Title color={level?.color ?? JMA_LAYER_COLORS.jmaWarnings}>{place || "市区町村"}</Title>
    {!area ? <Row label="狀態" value="目前快照沒有對到此區的發表中警報・注意報（可能剛解除，請重新開啟圖層）" /> : <>
      <Row label="最高級別" value={level?.label ?? "未知"} color={level?.color} />
      {area.areaName && <Row label="氣象廳區域" value={area.areaName} />}
      <PopupScroll>
        {area.rows.map((row, i) => {
          const lv = JMA_WARNING_LEVELS.find((l) => l.value === row.level);
          return <Row key={`${row.area_code}-${row.kind_code}-${i}`}
            label={row.kind_name ?? `種類代碼 ${row.kind_code ?? "?"}`}
            value={`${row.status ?? ""}${row.area_name && row.area_name !== area.areaName ? `（${row.area_name}）` : ""}`}
            color={lv?.color} />;
        })}
      </PopupScroll>
      <Row label="發表時間" value={formatJst(first?.report_datetime) || "無"} mono />
      {first?.office_name && <Row label="發表官署" value={first.office_name} />}
    </>}
    <PopupDetails summary="說明與限制">
      <Row label="對應" value="以氣象廳市町村等區域（class20）對市区町村界；政令市分區（如横浜市北部／南部）整市著色，popup 列出各分區" />
      <Row label="更新" value="每 5 分鐘；以最新一版發表時刻（control_datetime）為準" />
      <Row label="市区町村コード" value={text(props.admin_code)} mono />
    </PopupDetails>
    <Footer fetchedAt={first?.control_datetime} />
  </>;
}

export function JmaQuakesPanel({ props }: PanelProps) {
  const intensity = text(props.max_intensity) || null;
  const color = JMA_INTENSITY_CLASSES.find((c) => c.value === intensity)?.color ?? JMA_MISSING_COLOR;
  const mag = num(props.magnitude);
  const depth = num(props.depth_km);
  const byPref = text(props.intensity_by_pref);
  return <>
    <Title color={color}>{text(props.hypocenter_name, "震源未定")}</Title>
    <Row label="發生時間" value={formatJst(props.origin_time) || "未發表"} mono />
    <Row label="規模" value={mag == null ? "未發表" : `M${mag.toFixed(1)}`} />
    <Row label="深度" value={depth == null ? "未發表" : `${depth.toLocaleString("zh-TW")} km`} />
    <Row label="最大震度" value={jmaIntensityLabel(intensity)} color={color} />
    <Row label="情報種類" value={text(props.title)} />
    <Row label="發表時間" value={formatJst(props.report_time) || "無"} mono />
    <PopupDetails summary="各地震度與說明">
      {byPref && <Row label="各都道府縣震度（原始）" value={byPref.length > 400 ? `${byPref.slice(0, 400)}…` : byPref} />}
      <Row label="說明" value="同一地震只顯示最新一報；震度速報階段尚無震源座標，不會畫在地圖上。近 7 天、每 2 分鐘更新" />
      <Row label="事件 ID" value={text(props.event_id)} mono />
    </PopupDetails>
    <Footer fetchedAt={props.report_time} />
  </>;
}

export function JmaVolcanoesPanel({ props }: PanelProps) {
  const level = JMA_VOLCANO_LEVELS.find((l) => l.value === text(props.level)) ?? JMA_VOLCANO_LEVELS[5];
  return <>
    <Title color={level.color}>{text(props.volcano_name, "火山")}</Title>
    <Row label="噴火警戒" value={level.label} color={level.color} />
    <Row label="原文" value={text(props.level_name, "未提供")} />
    {text(props.warning_kind) && <Row label="警報種類" value={text(props.warning_kind)} />}
    <Row label="發表時間" value={formatJst(props.report_time) || "無"} mono />
    <PopupDetails summary="說明">
      <Row label="判讀" value="警戒レベル取自原文「レベルN」或代碼 11–15；未導入レベル的火山以警報原文為準" />
      <Row label="火山代碼" value={text(props.volcano_code)} mono />
    </PopupDetails>
    <Footer fetchedAt={props.report_time} />
  </>;
}
