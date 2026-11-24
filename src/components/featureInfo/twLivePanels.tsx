// 台灣圖層延伸 B8：登革熱聚集區、航船布告、大潮與長浪警戒的 popup（色票 SSOT = src/data/twLiveTypes.ts）。
import { PopupDetails, Row, SourceFooter, Title, formatTaiwanMinute, numOrNull } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import type { MessageKey } from "../../i18n/keys";
import {
  DENGUE_COLOR, NAV_KINDS, NAV_KIND_COLOR, NAV_KIND_IDS, NAV_OTHER_COLOR,
  TIDE_LEVEL_COLOR, TIDE_UNKNOWN_COLOR, type NavKind,
} from "../../data/twLiveTypes";
import { navWindows } from "../../data/twLiveSnapshots";
import { placeName } from "../../i18n/placeText";

const str = (v: unknown): string => (typeof v === "string" && v !== "null" ? v : "");

// i18n key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）
const NAV_KIND_KEY: Record<string, MessageKey> = {
  obstruction: "legend.twLive.navKind.obstruction",
  firing: "legend.twLive.navKind.firing",
  aton: "legend.twLive.navKind.aton",
  windfarm: "legend.twLive.navKind.windfarm",
};
const TIDE_STATUS_KEY: Record<string, MessageKey> = {
  低於警戒: "popup.twLive.tideStatus.below",
  潮位注意: "popup.twLive.tideStatus.springWatch",
  潮位警戒: "popup.twLive.tideStatus.springWarning",
  暴潮警戒: "popup.twLive.tideStatus.surgeWarning",
  長浪警戒: "popup.twLive.tideStatus.swellWarning",
  巨浪警戒: "popup.twLive.tideStatus.highWaveWarning",
};
const MATCH_KEY: Record<string, MessageKey> = {
  exact_name: "popup.twLive.match.exact",
  exact_name_variant: "popup.twLive.match.exact",
  name_substring: "popup.twLive.match.substring",
  max_tide_crosscheck: "popup.twLive.match.crosscheck",
  "O-B0079_2024_station_coords": "popup.twLive.match.oldStationList",
};

/** YYYYMMDD → YYYY-MM-DD */
function ymd(v: unknown): string {
  const s = str(v);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
}

export function DengueClusterPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const cases = numOrNull(props.case_count);
  return (
    <>
      <Title color={DENGUE_COLOR}>{t("popup.twLive.dengue.title")}</Title>
      <Row field="countyDistrict" value={[placeName(`${str(props.county)}${str(props.town)}`, i18n), str(props.village)].filter(Boolean).join(" ")} />
      <Row label={t("popup.twLive.dengue.cases")} value={cases == null ? "" : t("popup.twLive.dengue.casesValue", { count: cases })} mono />
      <Row label={t("popup.twLive.dengue.released")} value={ymd(props.snapshot_date)} mono />
      <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: theme.textMuted }}>{t("popup.twLive.dengue.note")}</div>
      <SourceFooter props={{ source_org: t("popup.twLive.dengue.source"), source_url: "https://data.gov.tw/dataset/179291", fetched_at: str(props.retrieved_at) }} />
    </>
  );
}

export function NavNoticePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const kind = str(props.notice_kind);
  const kindIdx = (NAV_KINDS as readonly string[]).indexOf(kind);
  const kindId = kindIdx >= 0 ? NAV_KIND_IDS[kindIdx]! : "";
  const color = kindIdx >= 0 ? NAV_KIND_COLOR[kind as NavKind] : NAV_OTHER_COLOR;
  const permanent = str(props.lifetime) === "永久";
  const windows = navWindows(props.windows);
  const web = str(props.web_url);
  const pdf = str(props.pdf_url);
  const radius = numOrNull(props.radius);
  return (
    <>
      <Title color={color}>{str(props.title) || kind}</Title>
      <Row field="type" value={kindId ? t(NAV_KIND_KEY[kindId]!) : kind} color={color} />
      <Row label={t("popup.twLive.nav.lifetime")} value={permanent ? t("legend.twLive.navLifetime.permanent") : t("legend.twLive.navLifetime.temporary")} />
      <Row label={t("popup.twLive.nav.start")} value={formatTaiwanMinute(str(props.start_at) || null)} mono />
      <Row label={t("popup.twLive.nav.end")} value={permanent ? t("popup.twLive.nav.noEnd") : formatTaiwanMinute(str(props.end_at) || null)} mono />
      {windows.length > 0 && (
        <Row
          label={t("popup.twLive.nav.windows")}
          value={windows.slice(0, 3).map((w) => `${formatTaiwanMinute(w.from)}–${formatTaiwanMinute(w.to)}`).join("、") + (windows.length > 3 ? t("popup.twLive.nav.moreWindows", { count: windows.length - 3 }) : "")}
          mono
        />
      )}
      {(numOrNull(props.dup_count) ?? 1) > 1 && (
        <Row label={t("popup.twLive.nav.sameArea")} value={t("popup.twLive.nav.sameAreaValue", { count: (numOrNull(props.dup_count) ?? 1) - 1, codes: str(props.dup_codes) })} />
      )}
      <Row label={t("popup.twLive.nav.dept")} value={str(props.dept)} />
      <Row label={t("popup.twLive.nav.code")} value={[str(props.notice_code), str(props.shape_name)].filter(Boolean).join(" · ")} mono />
      {props.geometry_derived === true && radius != null && (
        <Row label={t("popup.twLive.nav.shape")} value={t("popup.twLive.nav.derived", { radius, unit: str(props.radius_unit) })} />
      )}
      {str(props.info) && (
        <PopupDetails summary={t("popup.twLive.nav.info")}>
          <div style={{ whiteSpace: "pre-wrap", fontSize: FONT_SIZE.sm, color: theme.textMuted, lineHeight: 1.4 }}>{str(props.info)}</div>
        </PopupDetails>
      )}
      {(web || pdf) && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base, display: "flex", gap: 12 }}>
          {web && <a href={web} target="_blank" rel="noopener noreferrer" style={{ color: theme.link, textDecoration: "none" }}>{t("popup.twLive.nav.web")}</a>}
          {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" style={{ color: theme.link, textDecoration: "none" }}>{t("popup.twLive.nav.pdf")}</a>}
        </div>
      )}
      <SourceFooter props={{ source_org: t("popup.twLive.nav.source"), source_url: "https://data.gov.tw/dataset/179037", fetched_at: str(props.snapshot_at) }} />
    </>
  );
}

export function TideSwellAlertPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const kind = str(props.kind);
  const level = numOrNull(props.alert_level);
  const color = level === 0 || level === 1 || level === 2 ? TIDE_LEVEL_COLOR[level] : TIDE_UNKNOWN_COLOR;
  const status = str(props.warning_status);
  const height = numOrNull(props.max_height_m);
  const spring = numOrNull(props.spring_criteria_m);
  const surge = numOrNull(props.surge_criteria_m);
  const match = str(props.match_method);
  const station = [str(props.station_name), str(props.station_id)].filter(Boolean).join(" · ");
  return (
    <>
      <Title color={color}>{`${str(props.site_name)} ${kind === "swell" ? t("legend.twLive.tideKind.swell") : t("legend.twLive.tideKind.spring")}`}</Title>
      <Row label={t("popup.twLive.tide.status")} value={TIDE_STATUS_KEY[status] ? t(TIDE_STATUS_KEY[status]!) : status} color={color} />
      <Row
        label={kind === "swell" ? t("popup.twLive.tide.maxWave") : t("popup.twLive.tide.maxTide")}
        value={height == null ? "" : `${height.toFixed(2)} m`}
        mono
      />
      {spring != null && <Row label={t("popup.twLive.tide.springCriteria")} value={`${spring.toFixed(2)} m`} mono />}
      {surge != null && <Row label={t("popup.twLive.tide.surgeCriteria")} value={`${surge.toFixed(2)} m`} mono />}
      <Row label={t("popup.twLive.tide.window")} value={`${formatTaiwanMinute(str(props.obs_start) || null)}–${formatTaiwanMinute(str(props.obs_end) || null)}`} mono />
      <Row label={t("popup.twLive.tide.station")} value={station} />
      <Row label={t("popup.twLive.tide.match")} value={MATCH_KEY[match] ? t(MATCH_KEY[match]!) : match} />
      <SourceFooter props={{ source_org: t("popup.twLive.tide.source", { dataset: str(props.source_dataset) }), source_url: "https://opendata.cwa.gov.tw/", fetched_at: str(props.data_sent) }} />
    </>
  );
}
