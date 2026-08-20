import { useEffect, useState } from "react";
import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { fetchAnimalAdoptionDaily, type AnimalAdoptionDailyRow } from "../../data/animalAdoptionLoader";
import { fetchAnimalShelterOutcomeMonthly, type AnimalShelterOutcomeMonthRow } from "../../data/animalShelterOutcomesLoader";
import { fetchAnimalWelfarePointHistory, type AnimalWelfarePointHistoryRow } from "../../data/animalWelfarePointsLoader";
import { animalWelfarePointTypeMeta } from "../../data/animalWelfarePointsTypes";

const str = (v: unknown) => v == null || v === "" ? "" : String(v);
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

function Trend({ rows }: { rows: AnimalAdoptionDailyRow[] }) {
  const t = useFeatureTheme();
  if (!rows.length) return <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>尚無足夠的每日快照可畫趨勢。</div>;
  const max = Math.max(...rows.map((r) => r.listed_count), 1);
  return <div style={{ marginTop: 8 }}>
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>近 {rows.length} 次每日快照（缺值不補 0）</div>
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 42 }} aria-label="待認領養數量趨勢">
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
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{str(props.shelter_name) || "公立收容所"}</div>
    </div>
    <Row label="待認領養" value={`${num(props.listed_count).toLocaleString()} 隻`} color="#f59e0b" />
    {dog > 0 ? <Row label="犬" value={`${dog.toLocaleString()} 隻`} color="#f59e0b" /> : null}
    {cat > 0 ? <Row label="貓" value={`${cat.toLocaleString()} 隻`} color="#a855f7" /> : null}
    <Row label="縣市" value={str(props.county_name) || str(props.county_code)} />
    <Row label="資料快照" value={latest || "尚未提供"} />
    <Trend rows={daily} />
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 6 }}>數量為每日快照中的掛牌數；不代表即時在所量。</div>
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
  const points = rows.map((row) => ({ month: row.period_start?.slice(0, 7) ?? "", value: adoptedCount(row) }))
    .filter((row): row is { month: string; value: number } => row.value != null)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!points.length) return <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>官方月報未提供可辨識的認領養成果欄位。</div>;
  const max = Math.max(...points.map((point) => point.value), 1);
  return <div style={{ marginTop: 8 }}>
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>官方月報認領養成果（缺值不補 0）</div>
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 42 }} aria-label="收容所認領養月趨勢">
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
  useEffect(() => {
    if (!countyCode) return;
    fetchAnimalShelterOutcomeMonthly(countyCode).then(setOutcomes).catch(() => setOutcomes([]));
  }, [countyCode]);
  return <>
    <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{str(props.county_name) || str(props["名稱"]) || "縣市收容所"}</div>
    <Row label="資料月" value={period ? `${period}（官方月報）` : "官方月報，月份未提供"} />
    <Row label="容量使用率" value={utilization == null ? "未提供" : `${utilization.toFixed(1)}%`} color={utilization != null && utilization >= 100 ? "#dc2626" : "#f97316"} />
    <Row label="在養量" value={inShelter == null ? "未提供" : `${inShelter.toLocaleString()} 隻`} />
    <Row label="核定容量" value={capacity == null ? "未提供" : `${capacity.toLocaleString()} 隻`} />
    <OutcomeTrend rows={outcomes} />
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 8 }}>
      資料截至 {period || "官方回傳月份"}；月粒度，非即時狀態。官方總量僅採同一來源月報，不跨來源混加。
    </div>
  </>;
}

function displayTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join("、");
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).join("、");
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
  const services = displayTags(props.service_tags);
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: type.color }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{str(props.name) || "動物服務點"}</div>
    </div>
    <Row label="類型" value={type.label} color={type.color} />
    {services ? <Row label="服務" value={services} /> : null}
    {str(props.address) ? <Row label="地址" value={str(props.address)} /> : null}
    {str(props.phone) ? <Row label="電話" value={str(props.phone)} /> : null}
    {str(props.status) ? <Row label="狀態" value={str(props.status)} /> : null}
    <Row label="來源" value={sourceDatasetId || "官方／地方公開名冊"} />
    {str(props.last_seen_at) ? <Row label="最近出現" value={str(props.last_seen_at).slice(0, 10)} /> : null}
    <div style={{ color: t.textMuted, fontSize: FONT_SIZE.xs, marginTop: 8 }}>
      {history == null ? "載入此據點歷程…" : history.length ? `歷程 ${history.length.toLocaleString()} 筆（最多 400 筆）` : "尚無可顯示的據點歷程"}
    </div>
    {history?.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {history.slice(-12).map((row, index) => <span key={`${historyDate(row)}-${index}`} style={{ color: t.textDim, fontSize: FONT_SIZE.xs }}>{historyDate(row) || "未標日期"}</span>)}
    </div> : null}
    <div style={{ color: t.textDim, fontSize: FONT_SIZE.xs, marginTop: 7 }}>地方名冊覆蓋不完整；未列點不表示該地沒有服務。</div>
  </>;
}
