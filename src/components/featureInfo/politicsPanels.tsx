// 政治 Politics popup：2026 選舉活動（owner-only）。色票與代碼 SSOT = src/data/electionEventsTypes.ts
import { Row, Title, formatTaiwanMinute } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import {
  ELECTION_CAMP_COLOR,
  ELECTION_PRECISIONS,
  ELECTION_STATUSES,
  electionCampKey,
  electionClaimantKey,
  electionSources,
  formatCrowdNumber,
  parseJsonArray,
} from "../../data/electionEventsTypes";

// i18n key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）
const STATUS_KEY = {
  scheduled: "popup.politics.status.scheduled",
  changed: "popup.politics.status.changed",
  postponed: "popup.politics.status.postponed",
  cancelled: "popup.politics.status.cancelled",
  held: "popup.politics.status.held",
} as const;
const TIER_KEY = { L: "popup.politics.tier.L", M: "popup.politics.tier.M", S: "popup.politics.tier.S" } as const;
const PRECISION_KEY = {
  address: "popup.politics.precision.address",
  landmark: "popup.politics.precision.landmark",
  intersection: "popup.politics.precision.intersection",
} as const;
const CLAIMANT_KEY = {
  organizer: "popup.politics.claimant.organizer",
  party_press: "popup.politics.claimant.party_press",
  media_estimate: "popup.politics.claimant.media_estimate",
  police_estimate: "popup.politics.claimant.police_estimate",
  unknown: "popup.politics.claimant.unknown",
} as const;

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = str(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/** 台北時間的「時:分」 */
function taipeiHm(iso: string, intl: (d: Date, o: Intl.DateTimeFormatOptions) => string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : intl(d, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
}

export function ElectionEventPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber, formatDateTime, active } = i18n;
  const theme = useFeatureTheme();
  const accent = ELECTION_CAMP_COLOR[electionCampKey(props.camp)];

  const startsAt = str(props.starts_at);
  const endsAt = str(props.ends_at);
  const when = startsAt
    ? `${formatTaiwanMinute(startsAt)}${endsAt ? `–${taipeiHm(endsAt, (d, o) => formatDateTime(d, o))}` : ""}`
    : str(props.event_date);

  const status = oneOf(props.event_status, ELECTION_STATUSES);
  const tier = oneOf(props.scale_tier, ["L", "M", "S"] as const);

  const hostName = str(props.host_name);
  const hostOffice = str(props.host_office);
  const host = hostName && hostOffice ? `${hostName}（${hostOffice}）` : hostName || hostOffice;

  const parties = parseJsonArray<string>(props.camp_parties).map(String).filter(Boolean);
  const isJoint = props.is_joint === true || props.is_joint === "true";
  const camp = isJoint && parties.length > 1
    ? `${parties.join("、")}${t("popup.politics.joint")}`
    : str(props.camp);

  const precision = oneOf(props.location_precision, ELECTION_PRECISIONS);
  const notes = [
    precision ? t(PRECISION_KEY[precision]) : "",
    str(props.point_role) === "start_point" ? t("popup.politics.startPoint") : "",
  ].filter(Boolean);
  const place = placeName(`${str(props.city)}${str(props.town)}`, i18n);
  const locationText = str(props.location_text);
  const location = locationText ? `${locationText}${notes.length ? `（${notes.join("・")}）` : ""}` : "";

  const crowdRaw = Number(props.reported_crowd);
  const crowd = props.reported_crowd !== null && props.reported_crowd !== undefined && props.reported_crowd !== "" && Number.isFinite(crowdRaw) && crowdRaw > 0
    ? t(CLAIMANT_KEY[electionClaimantKey(props.crowd_claimant)], { n: formatCrowdNumber(crowdRaw, active, formatNumber) })
    : "";

  const guests = parseJsonArray<unknown>(props.guests).map(String).filter(Boolean).join("、");
  const sources = electionSources(props.sources);
  const firstSeen = str(props.first_seen_at);

  return (
    <>
      <Title color={accent}>{str(props.event_name) || t("popup.politics.fallbackTitle")}</Title>
      <Row label={t("popup.politics.when")} value={when} mono />
      {status && <Row field="status" value={t(STATUS_KEY[status])} />}
      <Row label={t("popup.politics.host")} value={host} />
      <Row label={t("popup.politics.camp")} value={camp} color={accent} />
      <Row field="type" value={str(props.event_type)} />
      {tier && <Row label={t("popup.politics.scale")} value={t(TIER_KEY[tier])} />}
      <Row field="countyDistrict" value={place} />
      <Row label={t("popup.politics.location")} value={location} />
      <Row label={t("popup.politics.crowd")} value={crowd} />
      <Row label={t("popup.politics.guests")} value={guests} />
      {sources.length > 0 && (
        <div className="fi-row" style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, lineHeight: 1.3 }}>
          <span style={{ color: theme.textMuted, flexShrink: 0, minWidth: 56, fontSize: FONT_SIZE.sm }}>{t("popup.politics.sources")}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {sources.map((s, i) => (
              <a
                key={`${s.url}:${i}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.link, wordBreak: "break-all" }}
              >
                {s.source || t("popup.politics.sourceLink", { index: i + 1 })}
              </a>
            ))}
          </span>
        </div>
      )}
      {firstSeen && <Row label={t("popup.politics.firstSeen")} value={formatTaiwanMinute(firstSeen)} mono />}
    </>
  );
}
