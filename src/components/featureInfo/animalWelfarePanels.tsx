import { useEffect, useState } from "react";
import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { fetchAnimalAdoptionDaily, type AnimalAdoptionDailyRow } from "../../data/animalAdoptionLoader";
import { fetchAnimalShelterOutcomeMonthly, type AnimalShelterOutcomeMonthRow } from "../../data/animalShelterOutcomesLoader";
import { fetchAnimalWelfarePointHistory, type AnimalWelfarePointHistoryRow } from "../../data/animalWelfarePointsLoader";
import { animalWelfarePointTypeMeta } from "../../data/animalWelfarePointsTypes";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName } from "../../i18n/placeText";

const str = (v: unknown) => v == null || v === "" ? "" : String(v);
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

function Trend({ rows }: { rows: AnimalAdoptionDailyRow[] }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  if (!rows.length) return <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>{tr("popup.animalWelfare.noSnapshots")}</div>;
  const max = Math.max(...rows.map((r) => r.listed_count), 1);
  return <div style={{ marginTop: 8 }}>
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>{tr("popup.animalWelfare.snapshotCount", { count: rows.length })}</div>
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 42 }} aria-label={tr("popup.animalWelfare.adoptionTrendAria")}>
      {rows.map((r) => <div key={r.snapshot_date} title={`${r.snapshot_date}: ${r.listed_count}`} style={{ flex: 1, minWidth: 2, height: `${Math.max(4, r.listed_count / max * 100)}%`, background: "#f59e0b", borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0` }} />)}
    </div>
  </div>;
}

export function AnimalAdoptionPanel({ props }: { props: Record<string, unknown> }) {
  const [daily, setDaily] = useState<AnimalAdoptionDailyRow[]>([]);
  const shelterId = str(props.canonical_shelter_id);
  const latest = str(props.latest_snapshot_date);
  useEffect(() => {
    if (!shelterId || !latest) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(latest);
    if (!match) return;
    const year = Number(match[1]!);
    const month = Number(match[2]!);
    const day = Number(match[3]!);
    const start = new Date(Date.UTC(year, month - 1, day - 29));
    fetchAnimalAdoptionDaily(start.toISOString().slice(0, 10), latest, undefined, shelterId)
      .then(setDaily).catch(() => setDaily([]));
  }, [shelterId, latest]);
  const dog = num(props.dog_count);
  const cat = num(props.cat_count);
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{str(props.shelter_name) || tr("popup.animalWelfare.publicShelter")}</div>
    </div>
    <Row label={tr("popup.animalWelfare.listed")} value={tr("popup.animalWelfare.animals", { count: num(props.listed_count), value: formatNumber(num(props.listed_count)) })} color="#f59e0b" />
    {dog > 0 ? <Row label={tr("popup.animalWelfare.dog")} value={tr("popup.animalWelfare.animals", { count: dog, value: formatNumber(dog) })} color="#f59e0b" /> : null}
    {cat > 0 ? <Row label={tr("popup.animalWelfare.cat")} value={tr("popup.animalWelfare.animals", { count: cat, value: formatNumber(cat) })} color="#a855f7" /> : null}
    <Row field="county" value={str(props.county_name) ? placeName(str(props.county_name), i18n) : str(props.county_code)} />
    <Row label={tr("popup.animalWelfare.snapshot")} value={latest || tr("popup.animalWelfare.notYetProvided")} />
    <Trend rows={daily} />
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 6 }}>{tr("popup.animalWelfare.snapshotNote")}</div>
  </>;
}

const nullable = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function reportMonth(props: Record<string, unknown>) {
  const year = nullable(props.report_year);
  const month = nullable(props.report_month);
  if (year != null && month != null) return `${year}-${String(month).padStart(2, "0")}`;
  const period = str(props.period_start);
  return /^\d{4}-\d{2}/.test(period) ? period.slice(0, 7) : "";
}

function adoptedCount(row: AnimalShelterOutcomeMonthRow): number | null {
  const m = row.official_metrics;
  for (const key of ["adopt_count", "adopt_total", "adopted_count", "adoption_count", "adoptions", "adopted"]) {
    const value = nullable(m[key]);
    if (value != null) return value;
  }
  return null;
}

function OutcomeTrend({ rows }: { rows: AnimalShelterOutcomeMonthRow[] }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const points = rows.map((row) => ({ month: row.period_start?.slice(0, 7) ?? "", value: adoptedCount(row) }))
    .filter((row): row is { month: string; value: number } => row.value != null)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!points.length) return <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>{tr("popup.animalWelfare.noOutcomeField")}</div>;
  const max = Math.max(...points.map((point) => point.value), 1);
  return <div style={{ marginTop: 8 }}>
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>{tr("popup.animalWelfare.outcomeTitle")}</div>
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 42 }} aria-label={tr("popup.animalWelfare.outcomeTrendAria")}>
      {points.map((point) => <div key={point.month} title={`${point.month}: ${point.value}`} style={{ flex: 1, minWidth: 2, height: `${Math.max(4, point.value / max * 100)}%`, background: "#f97316", borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0` }} />)}
    </div>
  </div>;
}

export function AnimalShelterPressurePanel({ props }: { props: Record<string, unknown> }) {
  const [outcomes, setOutcomes] = useState<AnimalShelterOutcomeMonthRow[]>([]);
  const countyCode = str(props.county_code);
  const period = reportMonth(props);
  const utilization = nullable(props.capacity_utilization);
  const inShelter = nullable(props.in_shelter_count);
  const capacity = nullable(props.capacity);
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  useEffect(() => {
    if (!countyCode) return;
    fetchAnimalShelterOutcomeMonthly(countyCode).then(setOutcomes).catch(() => setOutcomes([]));
  }, [countyCode]);
  return <>
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{(str(props.county_name) ? placeName(str(props.county_name), i18n) : "") || str(props["名稱"]) || tr("popup.animalWelfare.countyShelter")}</div>
    <Row label={tr("popup.animalWelfare.dataMonth")} value={period ? tr("popup.animalWelfare.officialMonthly", { period }) : tr("popup.animalWelfare.monthMissing")} />
    <Row label={tr("popup.animalWelfare.utilization")} value={utilization == null ? tr("popup.common.notProvided") : `${utilization.toFixed(1)}%`} color={utilization != null && utilization >= 100 ? "#dc2626" : "#f97316"} />
    <Row label={tr("popup.animalWelfare.inShelter")} value={inShelter == null ? tr("popup.common.notProvided") : tr("popup.animalWelfare.animals", { count: inShelter, value: formatNumber(inShelter) })} />
    <Row label={tr("popup.animalWelfare.approvedCapacity")} value={capacity == null ? tr("popup.common.notProvided") : tr("popup.animalWelfare.animals", { count: capacity, value: formatNumber(capacity) })} />
    <OutcomeTrend rows={outcomes} />
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>
      {tr("popup.animalWelfare.asOfNote", { period: period || tr("popup.animalWelfare.officialMonthFallback") })}
    </div>
  </>;
}

function displayTags(value: unknown, sep: string) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(sep);
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).join(sep);
    } catch { /* Mapbox scalar property, use as-is. */ }
    return value;
  }
  return "";
}

function historyDate(row: AnimalWelfarePointHistoryRow) {
  for (const key of ["snapshot_date", "observed_date", "effective_date", "collected_at", "last_seen_at"]) {
    const value = str(row[key]);
    if (value) return value.slice(0, 10);
  }
  return "";
}

/** This component only exists after a map click, so its history request is never an initial 7k-point N+1. */
export function AnimalWelfarePointsPanel({ props }: { props: Record<string, unknown> }) {
  const sourceDatasetId = str(props.source_dataset_id);
  const sourceRecordKey = str(props.source_record_key);
  const [history, setHistory] = useState<AnimalWelfarePointHistoryRow[] | null>(null);
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const type = animalWelfarePointTypeMeta(props.point_type);
  useEffect(() => {
    if (!sourceDatasetId || !sourceRecordKey) return;
    let cancelled = false;
    setHistory(null);
    fetchAnimalWelfarePointHistory(sourceDatasetId, sourceRecordKey)
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [sourceDatasetId, sourceRecordKey]);
  const services = displayTags(props.service_tags, tr("popup.common.listSeparator"));
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: type.color }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{str(props.name) || tr("popup.animalWelfare.serviceSite")}</div>
    </div>
    <Row field="type" value={enumLabel("animalWelfarePointType", type.value, type.label, i18n)} color={type.color} />
    {services ? <Row label={tr("popup.animalWelfare.service")} value={services} /> : null}
    {str(props.address) ? <Row field="address" value={str(props.address)} /> : null}
    {str(props.phone) ? <Row field="phone" value={str(props.phone)} /> : null}
    {str(props.status) ? <Row field="status" value={str(props.status)} /> : null}
    <Row field="source" value={sourceDatasetId || tr("popup.animalWelfare.sourceFallback")} />
    {str(props.last_seen_at) ? <Row label={tr("popup.animalWelfare.lastSeen")} value={str(props.last_seen_at).slice(0, 10)} /> : null}
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginTop: 8 }}>
      {history == null ? tr("popup.animalWelfare.historyLoading") : history.length ? tr("popup.animalWelfare.historyCount", { count: history.length, value: formatNumber(history.length) }) : tr("popup.animalWelfare.historyNone")}
    </div>
    {history?.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {history.slice(-12).map((row, index) => <span key={`${historyDate(row)}-${index}`} style={{ color: t.textDim, fontSize: FONT_SIZE.xs }}>{historyDate(row) || tr("popup.animalWelfare.noDate")}</span>)}
    </div> : null}
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 7 }}>{tr("popup.animalWelfare.coverageNote")}</div>
  </>;
}
