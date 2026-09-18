import { useSyncExternalStore } from "react";
import { getJpMedicalRuntime, retryJpMedicalCatalog, subscribeJpMedicalRuntime } from "../data/jpMedicalLoader";
import { JP_MEDICAL_CATEGORIES } from "../data/jpMedicalTypes";

const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "未提供";
const date = (value: unknown) => typeof value === "string" ? value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : "未提供";
const adaptiveNote = <div style={{ marginTop: 5 }}>zoom &lt; 8 顯示目前開啟分類的 10 km 密度網格；zoom ≥ 8 自動切換完整點位。</div>;

export function JpMedicalStatus({ kind, layerKey }: { kind: "facilities" | "care" | "areas"; layerKey?: string }) {
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime, getJpMedicalRuntime);
  if (runtime.status === "idle" || runtime.status === "loading") return <span>資料目錄載入中…</span>;
  if (runtime.status === "error") return <div role="alert">資料載入失敗：{runtime.error ?? "未知錯誤"}<br /><button onClick={retryJpMedicalCatalog}>重試醫療資料</button></div>;
  const dataset = runtime.catalog?.datasets?.[kind === "facilities" ? "navii" : kind === "care" ? "h17" : "a38"];
  const totals = dataset?.national_totals;
  if (kind === "areas") return <div>2020 歷史版 · STALE<br />国土数値情報 A38；非現行醫療圈更新。</div>;
  if (kind === "care") return <div>
    來源日期 {date(dataset?.source_date)}<br />
    全國來源列 {number(totals?.source_record_count)}；可繪製服務登記 {number(totals?.mapped_service_registration_count)}<br />
    非空間 {number(totals?.excluded_no_coordinate_count)}；重複隔離 {number(totals?.duplicate_quarantine_count)}<br />
    35 類來源服務；不是唯一機構數。
    {adaptiveNote}
  </div>;
  const selected = JP_MEDICAL_CATEGORIES.find(item => item.key === layerKey);
  const categoryTotals = selected ? totals?.[selected.value] as Record<string, unknown> | undefined : undefined;
  return <div>
    來源日期 {date(dataset?.source_date)}<br />
    {selected ? <>{selected.label}<br />
      全國來源列 {number(categoryTotals?.source_record_count)}；可繪製 {number(categoryTotals?.mapped_point_count)}；缺座標 {number(categoryTotals?.excluded_no_coordinate_count)}</>
      : <strong>分類統計未提供。</strong>}
    {adaptiveNote}
  </div>;
}


export function JpMedicalAlert() {
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime, getJpMedicalRuntime);
  if (runtime.status !== "error") return null;
  return <div role="alert" style={{ position: "absolute", top: 100, right: 16, zIndex: 50, maxWidth: "min(340px, 85vw)", padding: 12, background: "#451a1a", color: "#fff", borderRadius: 8 }}>
    日本醫療資料載入失敗：{runtime.error}<br />
    <button onClick={retryJpMedicalCatalog}>重試醫療資料</button>
  </div>;
}
