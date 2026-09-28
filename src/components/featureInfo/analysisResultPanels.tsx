// Agent 分析結果的停靠面板（取代原本 MainMapConnection 手刻 DOM 的 mapboxgl.Popup）。
//
// properties 由 MainMapConnection 在點擊當下組好（researchResultPanelProperties）：
// 每筆重疊紀錄的標題、分類色、事實列都已解析成人類可讀字串 —— 資料集欄不帶內部識別碼。
// 本檔只負責渲染與「本位置多筆紀錄」的切換。
import { useState } from "react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { AnalysisResultPanelProperties, AnalysisResultPanelRecord, AnalysisResultPanelTrend } from "../../research/researchResultPopup";
import { TrendLine } from "../../research/charts/TrendLine";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const FALLBACK_DOT = "#64aaff";

/** 以數字開頭的值（含單位、時間戳）走 Row 的 mono（等寬 + tabular-nums）。 */
const NUMERIC_VALUE = /^[-+−]?\d/;

function isTrend(value: unknown): value is AnalysisResultPanelTrend {
  if (!value || typeof value !== "object") return false;
  const trend = value as Partial<AnalysisResultPanelTrend>;
  return Array.isArray(trend.points) && typeof trend.caption === "string" && (trend.markerIndex === null || typeof trend.markerIndex === "number");
}

function isRecord(value: unknown): value is AnalysisResultPanelRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AnalysisResultPanelRecord>;
  if (typeof record.title !== "string" || !Array.isArray(record.facts)) return false;
  return record.trend === undefined || isTrend(record.trend);
}

/** highlightPoint 也可能以 layerType "analysisResult" 送進任意 properties —— 只接受合格形狀。 */
function readPanelProperties(props: Record<string, unknown>): AnalysisResultPanelProperties {
  const records = Array.isArray(props.records) ? props.records.filter(isRecord) : [];
  const total = typeof props.total === "number" && Number.isFinite(props.total) ? props.total : records.length;
  const omitted = typeof props.omitted === "number" && Number.isFinite(props.omitted) ? props.omitted : 0;
  return { records, total, omitted };
}

export function AnalysisResultPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { records, total, omitted } = readPanelProperties(props);
  // FeatureInfoPanel 不以 feature 當 key：換一組重疊紀錄就把選擇器歸零，
  // 但同一組紀錄在 App 重繪（properties 物件換手）時保留使用者的選擇。
  const signature = `${total}\u0000${records.map((item) => item.title).join("\u0000")}`;
  const [selected, setSelected] = useState({ signature, index: 0 });
  const index = selected.signature === signature ? selected.index : 0;
  const setIndex = (next: number) => setSelected({ signature, index: next });
  const record = records[index] ?? records[0];

  return (
    <div style={{ fontFamily: FONT_CJK }}>
      {records.length > 1 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>
          <span style={{ flex: "1 1 auto" }}>本位置 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{total}</span> 筆紀錄</span>
          <select
            aria-label="選擇重疊分析紀錄"
            value={String(index)}
            onChange={(event) => setIndex(Number(event.target.value))}
            style={{ minWidth: 0, maxWidth: 160, border: `1px solid ${t.border}`, borderRadius: RADIUS.sm, background: t.bgSubtle, color: t.textStrong, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base }}
          >
            {records.map((item, i) => <option key={i} value={String(i)}>{`${i + 1}. ${item.title}`}</option>)}
          </select>
        </label>
      )}
      {record ? (
        <>
          <Title color={record.color ?? FALLBACK_DOT}>{record.title}</Title>
          {record.facts.map((fact, i) => <Row key={i} label={fact.label} value={fact.value} mono={NUMERIC_VALUE.test(fact.value)} />)}
          {record.trend && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>{record.trend.caption}</div>
              <TrendLine
                points={record.trend.points.map((point, i) => ({ id: String(i), label: point.label, value: point.value }))}
                compact
                {...(record.trend.markerIndex !== null ? { markerIndex: record.trend.markerIndex } : {})}
              />
            </div>
          )}
        </>
      ) : (
        <Row label="紀錄" value="本次分析命中的空間紀錄" />
      )}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${t.border}`, fontSize: FONT_SIZE.xs, lineHeight: 1.55, color: t.textDim }}>
        暫時分析結果 · 非完整來源圖層{omitted ? ` · 另有 ${omitted} 筆重疊紀錄未列出` : ""}
      </div>
    </div>
  );
}
