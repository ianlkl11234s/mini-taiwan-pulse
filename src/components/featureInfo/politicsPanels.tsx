// 政治 Politics popup：2026 選舉活動（owner-only）、2024 投開票所、2026 議員選區（公開）。色票與代碼 SSOT = src/data/electionEventsTypes.ts
import { Row, SourceFooter, Title, formatTaiwanMinute } from "./shared";
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
import {
  POLLING_LEAD_COLOR,
  POLLING_PRECISIONS,
  POLLING_SOURCE_URL,
  pollingLead,
  pollingNumber,
} from "../../data/pollingStationsTypes";
import { COUNCIL_DISTRICT_COLOR, formatMemberUnits } from "../../data/councilDistrictsLoader";

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

// ── 2024 投開票所（公開）──
const POLLING_PRECISION_KEY = {
  poi_name: "popup.politics.polling.precision.poi_name",
  address_door: "popup.politics.polling.precision.address_door",
  tgos_door: "popup.politics.polling.precision.tgos_door",
  google: "popup.politics.polling.precision.google",
  road: "popup.politics.polling.precision.road",
} as const;
const POLLING_PARTY_KEY = {
  dpp: "popup.politics.polling.party.dpp",
  kmt: "popup.politics.polling.party.kmt",
  tpp: "popup.politics.polling.party.tpp",
} as const;

/** 「票數（得票率%）」；缺值回空字串（Row 會整列隱藏） */
export function formatPartyVotes(
  votes: unknown,
  pct: unknown,
  formatNumber: (n: number, o?: Intl.NumberFormatOptions) => string,
): string {
  const v = pollingNumber(votes);
  const p = pollingNumber(pct);
  if (v === null) return "";
  return p === null ? formatNumber(v) : `${formatNumber(v)}（${formatNumber(p, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%）`;
}

export function PollingStationPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const lead = pollingLead(props);
  const accent = POLLING_LEAD_COLOR[lead];
  const precision = oneOf(props.precision, POLLING_PRECISIONS);
  const electors = pollingNumber(props.pres24_electors);
  const turnout = pollingNumber(props.pres24_turnout);
  const place = placeName(`${str(props.county)}${str(props.town)}`, i18n);
  return (
    <>
      <Title color={accent}>{str(props.name) || t("popup.politics.polling.fallbackTitle")}</Title>
      <Row field="address" value={str(props.address)} />
      <Row field="countyDistrict" value={place} />
      <Row field="village" value={str(props.village)} />
      <Row label={t("popup.politics.polling.stationNo")} value={str(props.station_no)} mono />
      <Row label={t("popup.politics.polling.precision")} value={precision ? t(POLLING_PRECISION_KEY[precision]) : ""} />
      <Row label={t("popup.politics.polling.electors")} value={electors === null ? "" : formatNumber(electors)} mono />
      <Row
        label={t("popup.politics.polling.turnout")}
        value={turnout === null || turnout < 0 ? "" : `${formatNumber(turnout, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
        mono
      />
      {(["dpp", "kmt", "tpp"] as const).map((k) => (
        <Row
          key={k}
          label={t(POLLING_PARTY_KEY[k])}
          value={formatPartyVotes(props[`pres24_${k}_votes`], props[`pres24_${k}_pct`], formatNumber)}
          color={lead === k ? POLLING_LEAD_COLOR[k] : undefined}
          mono
        />
      ))}
      <SourceFooter props={{ source: t("popup.politics.polling.source"), license: "OGDL-1.0", source_url: POLLING_SOURCE_URL }} />
    </>
  );
}

// ── 2026 議員選區（公開）──
function PanelNote({ children }: { children: string }) {
  const theme = useFeatureTheme();
  return (
    <div className="fi-row" style={{ padding: "4px 0", fontSize: FONT_SIZE.sm, lineHeight: 1.4, color: theme.textMuted }}>
      {children}
    </div>
  );
}

export function CouncilDistrictPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const seats = pollingNumber(props.seats);
  const area = pollingNumber(props.area_km2);
  return (
    <>
      <Title color={COUNCIL_DISTRICT_COLOR}>{str(props.district_name) || t("popup.politics.council.fallbackTitle")}</Title>
      <Row field="county" value={placeName(str(props.county), i18n)} />
      <Row label={t("popup.politics.council.seats")} value={seats === null ? "" : formatNumber(seats)} mono />
      <Row label={t("popup.politics.council.members")} value={formatMemberUnits(props.member_units)} />
      <Row label={t("popup.politics.council.area")} value={area === null ? "" : `${formatNumber(area, { maximumFractionDigits: 1 })} km²`} mono />
      {str(props.caveat) && <PanelNote>{str(props.caveat)}</PanelNote>}
      <SourceFooter
        props={{
          source: t("popup.politics.council.source", { basis: str(props.basis) || "A0046" }),
          license: "OGDL-1.0",
          source_url: str(props.source_url),
        }}
      />
    </>
  );
}

