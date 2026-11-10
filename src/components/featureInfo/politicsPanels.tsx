import { useState } from "react";
// 政治 Politics popup：2026 選舉活動（owner-only）、2024 投開票所、2026 議員選區（公開）。色票與代碼 SSOT = src/data/electionEventsTypes.ts
import { Row, SourceFooter, Title, formatTaiwanMinute } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import {
  ELECTION_APPROX_PRECISIONS,
  ELECTION_CAMP_COLOR,
  ELECTION_PRECISIONS,
  ELECTION_STATUSES,
  type ElectionApproxPrecision,
  electionCampKey,
  electionClaimantKey,
  electionSettlementName,
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
  settlement: "popup.politics.precision.settlement",
  town_centroid: "popup.politics.precision.town_centroid",
  city_centroid: "popup.politics.precision.city_centroid",
} as const;
/** 代表點的一句說明（單場） */
const PRECISION_NOTE_KEY = {
  settlement: "popup.politics.precisionNote.settlement",
  town_centroid: "popup.politics.precisionNote.town_centroid",
  city_centroid: "popup.politics.precisionNote.city_centroid",
} as const;
/** 代表點的一句說明（同一代表點多場清單） */
const PRECISION_GROUP_NOTE_KEY = {
  settlement: "popup.politics.precisionGroupNote.settlement",
  town_centroid: "popup.politics.precisionGroupNote.town_centroid",
  city_centroid: "popup.politics.precisionGroupNote.city_centroid",
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

/** 代表點說明裡的地名：鄉鎮市區代表點寫鄉鎮，縣市代表點寫縣市，聚落寫「縣市＋鄉鎮」 */
function approxPlace(precision: ElectionApproxPrecision, props: Record<string, unknown>, i18n: ReturnType<typeof useLocale>): string {
  const city = str(props.city);
  const town = str(props.town);
  if (precision === "city_centroid") return placeName(city, i18n);
  return placeName(`${city}${town}`, i18n) || placeName(city, i18n);
}

/**
 * 「定位」說明文字（單場 single／多場 group）。聚落代表點有聚落名時寫聚落名，沒有時寫縣市區（mig 515 前的資料）。
 */
export function electionPrecisionNote(
  precision: ElectionApproxPrecision,
  props: Record<string, unknown>,
  i18n: ReturnType<typeof useLocale>,
  mode: "single" | "group",
): string {
  const settlement = electionSettlementName(props);
  if (precision === "settlement" && settlement) {
    return mode === "single"
      ? i18n.t("popup.politics.precisionNote.settlementNamed", { name: settlement })
      : i18n.t("popup.politics.precisionGroupNote.settlementNamed", { name: settlement });
  }
  const place = approxPlace(precision, props, i18n);
  return mode === "single"
    ? i18n.t(PRECISION_NOTE_KEY[precision], { place })
    : i18n.t(PRECISION_GROUP_NOTE_KEY[precision], { place });
}

/** 「定位」列：精度名稱 chip＋一句說明（代表點才顯示，場館級寫在地點後面） */
function PrecisionRow({ precision, note, extra }: { precision: ElectionApproxPrecision; note: string; extra?: string }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  return (
    <div className="fi-row" style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, lineHeight: 1.3 }}>
      <span style={{ color: theme.textMuted, flexShrink: 0, minWidth: 56, fontSize: FONT_SIZE.sm }}>{t("popup.politics.positioning")}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span>
          <span style={{ display: "inline-block", padding: "0 5px", border: `1px solid ${theme.border}`, borderRadius: RADIUS.sm, color: theme.textStrong, fontSize: FONT_SIZE.sm }}>
            {t(PRECISION_KEY[precision])}
          </span>
        </span>
        <span style={{ color: theme.textDim, fontSize: FONT_SIZE.sm }}>{note}</span>
        {extra && <span style={{ color: theme.textDim, fontSize: FONT_SIZE.sm }}>{extra}</span>}
      </span>
    </div>
  );
}

/** 「MM/DD」（台北日）：清單用 */
function shortDate(props: Record<string, unknown>, formatDateTime: (d: Date, o: Intl.DateTimeFormatOptions) => string): string {
  const ts = Number(props.start_ts);
  if (!Number.isFinite(ts)) return str(props.event_date);
  return formatDateTime(new Date(ts * 1000), { month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" });
}

/**
 * 同一代表點 2 場以上（hook 合成的 `_grp` 圖徵）：標題「地名・N 場」＋定位說明＋場次清單；點一場切到單場內容。
 */
function ElectionGroupPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatDateTime } = i18n;
  const theme = useFeatureTheme();
  const events = parseJsonArray<Record<string, unknown>>(props.events).filter((e) => e && typeof e === "object");
  const approx = oneOf(props.location_precision, ELECTION_APPROX_PRECISIONS);
  // FeatureInfoPanel 不以 feature 當 key：換一組代表點時歸零（同 AnalysisResultPanel）
  const signature = events.map((e) => str(e.event_id)).join(",");
  const [selected, setSelected] = useState<{ signature: string; id: string | null }>({ signature, id: null });
  const selectedId = selected.signature === signature ? selected.id : null;
  const current = selectedId === null ? null : events.find((e) => str(e.event_id) === selectedId) ?? null;

  if (current) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelected({ signature, id: null })}
          style={{ background: "none", border: "none", padding: "0 0 4px", cursor: "pointer", color: theme.link, fontSize: FONT_SIZE.sm }}
        >
          {t("popup.politics.group.back", { count: events.length })}
        </button>
        <ElectionEventPanel props={current} />
      </>
    );
  }

  const area = approx ? approxPlace(approx, props, i18n) : placeName(`${str(props.city)}${str(props.town)}`, i18n);
  const settlement = electionSettlementName(props);
  const place = settlement ? t("popup.politics.group.placeWithSettlement", { place: area, name: settlement }) : area;
  return (
    <>
      <Title color={ELECTION_CAMP_COLOR.other}>{t("popup.politics.group.title", { place, count: events.length })}</Title>
      {approx && <PrecisionRow precision={approx} note={electionPrecisionNote(approx, props, i18n, "group")} />}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
        {events.map((e, i) => {
          const past = e._past === 1 || e._past === "1";
          // 取消／延期照實際狀態標示；已過時間但未標已舉辦的用中性字樣（review F044）
          const status = oneOf(e.event_status, ELECTION_STATUSES);
          const suffix = status === "cancelled" || status === "postponed"
            ? t("popup.politics.group.statusSuffix", { status: t(STATUS_KEY[status]) })
            : !past ? ""
              : status === "held" ? t("popup.politics.group.pastSuffix") : t("popup.politics.group.pastTimeSuffix");
          const tier = oneOf(e.scale_tier, ["L", "M", "S"] as const);
          const name = str(e.event_name) || t("popup.politics.fallbackTitle");
          return (
            <button
              key={`${str(e.event_id)}:${i}`}
              type="button"
              onClick={() => setSelected({ signature, id: str(e.event_id) })}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 0", background: "none", border: "none",
                borderTop: i > 0 ? `1px solid ${theme.border}` : "none", cursor: "pointer", textAlign: "left",
                color: theme.textStrong, fontSize: FONT_SIZE.base, opacity: past ? 0.5 : 1,
              }}
            >
              <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", color: theme.textDim, fontSize: FONT_SIZE.sm, flexShrink: 0 }}>{shortDate(e, formatDateTime)}</span>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: RADIUS.full, background: ELECTION_CAMP_COLOR[electionCampKey(e.camp)], flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: "1 1 auto" }}>
                {name}
                {suffix}
              </span>
              {tier && <span style={{ color: theme.textDim, fontSize: FONT_SIZE.sm, flexShrink: 0 }}>{t(TIER_KEY[tier])}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("popup.politics.group.hint")}</div>
    </>
  );
}

export function ElectionEventPanel({ props }: { props: Record<string, unknown> }) {
  if (props._grp === 1 || props._grp === "1") return <ElectionGroupPanel props={props} />;
  return <ElectionEventSinglePanel props={props} />;
}

function ElectionEventSinglePanel({ props }: { props: Record<string, unknown> }) {
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
  const approx = oneOf(props.location_precision, ELECTION_APPROX_PRECISIONS);
  const isStart = str(props.point_role) === "start_point";
  // 場館級：精度簡短寫在地點後面（沿用）；代表點另列「定位」說明
  const notes = [
    precision && !approx ? t(PRECISION_KEY[precision]) : "",
    isStart && !approx ? t("popup.politics.startPoint") : "",
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
      {approx && (
        <PrecisionRow
          precision={approx}
          note={electionPrecisionNote(approx, props, i18n, "single")}
          extra={isStart ? t("popup.politics.startPoint") : ""}
        />
      )}
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

