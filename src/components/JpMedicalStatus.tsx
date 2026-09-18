import { useSyncExternalStore } from "react";
import { getJpMedicalRuntime, retryJpMedicalCatalog, setJpMedicalDisplayMode, subscribeJpMedicalRuntime } from "../data/jpMedicalLoader";
import { JP_MEDICAL_CATEGORIES } from "../data/jpMedicalTypes";

const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "未提供";
const date = (value: unknown) => typeof value === "string" ? value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : "未提供";
function displayModeControl(mode: "adaptive" | "points") {
  return <div style={{ marginTop: 5 }}>
    <button disabled={mode === "adaptive"} onClick={() => setJpMedicalDisplayMode("adaptive")}>聚合格網（預設）</button>{" "}
    <button disabled={mode === "points"} onClick={() => setJpMedicalDisplayMode("points")}>完整點位</button>
    <div>{mode === "points" ? "完整點位模式：所有縮放都讀原始點位。" : "自適應模式：zoom < 8 顯示可見分類加總的 z6 格網中心計數；zoom ≥ 8 才讀完整點位。"}</div>
  </div>;
}

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
    {displayModeControl(runtime.displayMode ?? "adaptive")}
  </div>;
  const selected = JP_MEDICAL_CATEGORIES.find(item => item.key === layerKey);
  const categoryTotals = selected ? totals?.[selected.value] as Record<string, unknown> | undefined : undefined;
  return <div>
    來源日期 {date(dataset?.source_date)}<br />
    {selected ? <>{selected.label}<br />
      全國來源列 {number(categoryTotals?.source_record_count)}；可繪製 {number(categoryTotals?.mapped_point_count)}；缺座標 {number(categoryTotals?.excluded_no_coordinate_count)}</>
      : <strong>分類統計未提供。</strong>}
    {displayModeControl(runtime.displayMode ?? "adaptive")}
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
