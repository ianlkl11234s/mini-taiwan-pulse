import { useSyncExternalStore } from "react";
import { getJpMedicalRuntime, retryJpMedicalCatalog, subscribeJpMedicalRuntime } from "../data/jpMedicalLoader";
import { useKeyOverlayParams } from "../layers/layerParamsAccess";
import { JP_MEDICAL_CATEGORIES } from "../data/jpMedicalTypes";

const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "未提供";
const date = (value: unknown) => typeof value === "string" ? value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") : "未提供";

export function JpMedicalStatus({ kind }: { kind: "facilities" | "care" | "areas" }) {
  const runtime = useSyncExternalStore(subscribeJpMedicalRuntime, getJpMedicalRuntime, getJpMedicalRuntime);
  const params = useKeyOverlayParams("jpMedicalFacilities");
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
  </div>;
  const names = ["jpMedicalHospital", "jpMedicalClinic", "jpMedicalDental", "jpMedicalMidwife", "jpMedicalPharmacy"];
  const selected = JP_MEDICAL_CATEGORIES.filter((_, index) => params[names[index]!] === 1);
  const sum = (field: string) => {
    const values = selected.map(item => (totals?.[item.value] as Record<string, unknown> | undefined)?.[field]);
    return values.every(value => typeof value === "number" && Number.isFinite(value)) ? values.reduce<number>((a, b) => a + (b as number), 0) : undefined;
  };
  return <div>
    來源日期 {date(dataset?.source_date)}<br />
    {selected.length ? <>目前選取 {selected.map(item => item.label).join("、")}<br />
      全國來源列 {number(sum("source_record_count"))}；可繪製 {number(sum("mapped_point_count"))}；缺座標 {number(sum("excluded_no_coordinate_count"))}</>
      : <strong>未選取分類；請開啟至少一類。</strong>}
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
