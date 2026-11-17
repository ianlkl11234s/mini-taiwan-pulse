import { useSyncExternalStore } from "react";
import { Row, SourceFooter, Title, formatTaiwanMinute, formatTaiwanShort } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { fire119SnapshotStore, type Fire119Case } from "../../data/liveIncidentsLoader";
import {
  FIRE119_CATEGORY_COLOR,
  FIRE119_CATEGORY_LABEL,
  FIRE119_DISTRICT_COLORS,
  FIRE119_HOSPITAL_COLOR,
  FIRE119_RETURNED_COLOR,
  FIRE119_STATUS_LABEL,
  PBS_CATEGORY_COLOR,
  PBS_CATEGORY_LABEL,
  PBS_CLEARED_COLOR,
  PBS_STATUS_LABEL,
  asFire119Category,
  asFire119Precision,
  asFire119Status,
  asPbsCategory,
  asPbsStatus,
} from "../../data/liveIncidentsTypes";

/** 清單最多列幾件（其餘寫「另有 N 件」） */
const LIST_MAX = 12;

function msIso(v: unknown): string | null {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? new Date(n).toISOString() : null;
}

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || !v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

/** 位置精度第一行（站主決策 7：「位置精度：路名（約 X km）」；只到行政區；站方模糊化位置） */
function PrecisionRow({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const snap = useSyncExternalStore(fire119SnapshotStore.subscribe, fire119SnapshotStore.getSnapshot, fire119SnapshotStore.getSnapshot);
  const precision = asFire119Precision(props.geom_precision);
  const roadKey = typeof props.road_key === "string" ? props.road_key : null;
  const road = roadKey ? snap?.roads.get(roadKey) ?? null : null;
  let value: string;
  if (precision === "road") {
    const name = road?.name ?? null;
    if (!name) value = t("popup.liveIncidents.precisionRoadNoName");
    else if (road?.lengthM != null) value = t("popup.liveIncidents.precisionRoad", { road: name, km: (road.lengthM / 1000).toFixed(1) });
    else value = t("popup.liveIncidents.precisionRoadUnknown", { road: name });
  } else if (precision === "fuzzy") value = t("popup.liveIncidents.precisionFuzzy");
  else if (precision === "exact") value = t("popup.liveIncidents.precisionExact");
  else if (precision === "district") value = t("popup.liveIncidents.precisionDistrict");
  else value = t("popup.liveIncidents.precisionHospital");
  return <Row label={t("popup.liveIncidents.precision")} value={value} />;
}

/** 原始類別字串：新北帶「AmbulanceBack||即時救護」這類內部前綴，只留最後一段 */
function rawLabel(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const last = v.split("||").pop()?.trim() ?? "";
  return last || null;
}

function categoryText(cat: unknown, i18n: ReturnType<typeof useLocale>): string {
  const c = asFire119Category(cat);
  return enumLabel("fire119Category", c, FIRE119_CATEGORY_LABEL[c], i18n);
}
function statusText(status: unknown, raw: unknown, i18n: ReturnType<typeof useLocale>): string {
  const s = asFire119Status(status);
  const label = enumLabel("fire119Status", s, FIRE119_STATUS_LABEL[s], i18n);
  return typeof raw === "string" && raw && raw !== label ? `${label}（${raw}）` : label;
}

/** 單一案件（點） */
function CaseDetail({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const th = useFeatureTheme();
  const cat = asFire119Category(props.category);
  const status = asFire119Status(props.status);
  const color = status === "returned" ? FIRE119_RETURNED_COLOR : FIRE119_CATEGORY_COLOR[cat];
  const units = parseJson<string[]>(props.units, []);
  const history = parseJson<[string, string][]>(props.status_history, []);
  const title = rawLabel(props.category_raw) ?? categoryText(cat, i18n);
  return (
    <>
      <Title color={color}>{title}</Title>
      <PrecisionRow props={props} />
      <Row label={t("popup.liveIncidents.received")} value={formatTaiwanMinute(msIso(props.received_ms))} mono />
      <Row label={t("popup.liveIncidents.category")} value={categoryText(cat, i18n)} />
      <Row label={t("popup.liveIncidents.status")} value={statusText(status, props.status_raw, i18n)} />
      <Row label={t("popup.liveIncidents.location")} value={typeof props.location_text === "string" ? props.location_text : ""} />
      <Row label={t("popup.liveIncidents.units")} value={units.join("、")} />
      <Row label={t("popup.liveIncidents.hospital")} value={typeof props.hospital === "string" ? props.hospital : ""} />
      {history.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: FONT_SIZE.sm, color: th.textMuted }}>{t("popup.liveIncidents.history")}</div>
          {history.map(([ts, s], i) => (
            <div key={`${ts}-${i}`} style={{ fontSize: FONT_SIZE.sm, color: th.textStrong, display: "flex", gap: 8 }}>
              <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", color: th.textMuted }}>{formatTaiwanShort(ts)}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** 多件清單（鄉鎮面量、醫院徽章） */
function CaseList({ cases, withLocation }: { cases: Fire119Case[]; withLocation: boolean }) {
  const i18n = useLocale();
  const { t } = i18n;
  const th = useFeatureTheme();
  if (cases.length === 0) return <div style={{ fontSize: FONT_SIZE.sm, color: th.textMuted }}>{t("popup.liveIncidents.noCases")}</div>;
  const sorted = [...cases].sort((a, b) => (b.receivedMs ?? b.updatedMs ?? 0) - (a.receivedMs ?? a.updatedMs ?? 0));
  return (
    <div style={{ marginTop: 4 }}>
      {sorted.slice(0, LIST_MAX).map((c) => (
        <div key={c.key} style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: FONT_SIZE.sm, padding: "2px 0", color: th.textStrong }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: c.status === "returned" ? FIRE119_RETURNED_COLOR : FIRE119_CATEGORY_COLOR[c.category] }} />
          <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", color: th.textMuted, flexShrink: 0 }}>
            {formatTaiwanShort(msIso(c.receivedMs ?? c.updatedMs))}
          </span>
          <span>
            {rawLabel(c.categoryRaw) ?? categoryText(c.category, i18n)}・{statusText(c.status, null, i18n)}
            {withLocation && c.locationText ? `・${c.locationText}` : ""}
          </span>
        </div>
      ))}
      {sorted.length > LIST_MAX && (
        <div style={{ fontSize: FONT_SIZE.sm, color: th.textMuted }}>{t("popup.liveIncidents.listMore", { count: sorted.length - LIST_MAX })}</div>
      )}
    </div>
  );
}

/** 即時 119：點（單件）、鄉鎮面量／件數徽章（該鄉鎮案件）、醫院徽章（送醫中案件） */
function Fire119LiveBody({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const snap = useSyncExternalStore(fire119SnapshotStore.subscribe, fire119SnapshotStore.getSnapshot, fire119SnapshotStore.getSnapshot);
  if (props._kind === "hospital") {
    const h = snap?.hospitals.get(String(props._key ?? "")) ?? null;
    const name = typeof props.hospital === "string" && props.hospital ? props.hospital : t("popup.liveIncidents.hospital");
    return (
      <>
        <Title color={FIRE119_HOSPITAL_COLOR}>{name}</Title>
        <Row label={t("popup.liveIncidents.precision")} value={t("popup.liveIncidents.precisionHospital")} />
        <Row label={t("popup.liveIncidents.status")} value={`${statusText("transporting", null, i18n)}・${t("popup.liveIncidents.caseCount", { count: h?.cases.length ?? 0 })}`} />
        <CaseList cases={h?.cases ?? []} withLocation={false} />
      </>
    );
  }
  const townCode = props._kind === "district" ? String(props._key ?? "") : typeof props.TOWNCODE === "string" ? props.TOWNCODE : null;
  if (townCode) {
    const cases = snap?.districts.get(townCode) ?? [];
    const name = typeof props.town_name === "string" ? props.town_name
      : `${typeof props.COUNTYNAME === "string" ? props.COUNTYNAME : ""}${typeof props.TOWNNAME === "string" ? props.TOWNNAME : ""}`;
    return (
      <>
        <Title color={FIRE119_DISTRICT_COLORS[2]}>{name || townCode}</Title>
        <Row label={t("popup.liveIncidents.precision")} value={t("popup.liveIncidents.precisionDistrict")} />
        <Row label={t("popup.liveIncidents.cases")} value={t("popup.liveIncidents.caseCount", { count: cases.length })} />
        <CaseList cases={cases} withLocation />
      </>
    );
  }
  return <CaseDetail props={props} />;
}

/** 即時 119：面板自掛來源列（RPC feature 沒有來源欄；FeatureInfoPanel FOOTER_SELF_MANAGED_LAYER_TYPES） */
export function Fire119LivePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <>
      <Fire119LiveBody props={props} />
      <SourceFooter props={{ source_org: t("popup.liveIncidents.sourceFire") }} />
    </>
  );
}

/** 警廣即時路況 */
export function PbsRoadEventsLivePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const cat = asPbsCategory(props.category);
  const status = asPbsStatus(props.status);
  const color = status === "cleared" ? PBS_CLEARED_COLOR : PBS_CATEGORY_COLOR[cat];
  const roadtype = typeof props.roadtype === "string" ? props.roadtype : "";
  return (
    <>
      <Title color={color}>{roadtype || enumLabel("pbsCategory", cat, PBS_CATEGORY_LABEL[cat], i18n)}</Title>
      <Row label={t("popup.liveIncidents.precision")} value={t("popup.liveIncidents.pbsPrecision")} />
      <Row label={t("popup.liveIncidents.happened")} value={formatTaiwanMinute(msIso(props.happened_ms))} mono />
      <Row label={t("popup.liveIncidents.status")} value={enumLabel("pbsStatus", status, PBS_STATUS_LABEL[status], i18n)} />
      <Row label={t("popup.liveIncidents.area")} value={typeof props.area === "string" ? props.area : ""} />
      <Row label={t("popup.liveIncidents.direction")} value={typeof props.direction === "string" ? props.direction : ""} />
      <Row label={t("popup.liveIncidents.description")} value={typeof props.comment === "string" ? props.comment : ""} />
      <SourceFooter props={{ source_org: t("popup.liveIncidents.sourcePbs"), source_url: "https://data.gov.tw/dataset/15221" }} />
    </>
  );
}
