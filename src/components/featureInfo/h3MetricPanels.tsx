/**
 * H3 指標格 popup（W2，no-popup-audit 工作包 7）—— 六個圖層共用一個 body。
 *
 * 這六層（popCount / h3Population / indicators / socioeconomic / spatialEconomy /
 * youbikeFullness）由三個 factory 現算 H3 polygon 後手動 addSource/addLayer，
 * `properties` 統一只有 `{ color, value, height }`（youbike 多一個 `capacity`）：
 *   - `value` = **當前選定指標的原始值**（factory 逐層取值處已逐行覆核，見下方各 resolver）
 *   - `height` 是 0~1 正規化+gamma 後的高度，**不可顯示**
 *
 * ── 為什麼 panel 要讀 store ──────────────────────────────────────────
 * properties 不帶指標名稱，光看 `value` 無從得知是「戶數」還是「扶老比」。
 * 指標選擇在 `layerParamsStore`，故於點擊當下讀一次。
 *
 * ⚠️ 用非 hook 的 `layerParamsStore.getParam()` 包在 `useMemo(…, [props])` 裡，
 *    **不要**用 `useLayerParams` 反應式訂閱 —— popup 開著時使用者切指標，
 *    value 是點擊當下凍結的舊值、label 卻會跟著變，等於顯示錯資料。
 *    （凍結快照的前例：`TemperatureGridPanel` 的 `useMemo(() => …, [props])`）
 *
 * ── 中文標籤 / 單位的出處 ────────────────────────────────────────────
 * `layerParamsSpec` 的 select options 只有極簡英文（"Med" / "IQR" / "Sal%"），
 * 中文名與單位散在兩處既有 SSOT，本檔逐字對齊、不另立第二套說法：
 *   - 中文名：`src/components/InfoModal.tsx` 的三段說明（indicators / socio / spatial）
 *   - 單位：`src/data/h3Loader.ts` 各 CellData 介面的欄位註解
 *     （im 萬元 · hp 萬元 · hu 萬元/坪 · ad per 1000 people · vs/vl/lm 0~1）
 * 查無 key 時 fallback 到 spec 的英文 label（`getParamsSpec` +
 * `resolveSelectOptions`）—— 上游哪天新增指標，最壞情況是退化成 sidebar 同款字，
 * 絕不會印出錯的中文。
 */
import { useMemo } from "react";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { layerParamsStore } from "../../state/layerParamsStore";
import { getParamsSpec, resolveSelectOptions } from "../../data/layerParamsSpec";

type Fmt = "int" | "num2" | "pct" | "raw";

interface Gloss {
  label: string;
  unit?: string;
  fmt: Fmt;
}

/** 指標 gloss：key = layerParamsSpec 用的 metric value 字串 */
const GLOSS: Record<string, Record<string, Gloss>> = {
  // h3LayerFactory:68 `metric === "day" ? d.d : d.n`；欄位註解 d=day / n=night population
  h3Population: {
    day: { label: "日間人口", unit: "人", fmt: "int" },
    night: { label: "夜間人口", unit: "人", fmt: "int" },
  },
  // demographicsLayerFactory:229 固定傳 "p"（不是日/夜人口——audit 此處記載有誤）
  popCount: {
    p: { label: "總人口", unit: "人", fmt: "int" },
  },
  // DemographicH3CellData 欄位註解 + InfoModal 的 indicators 說明段
  indicators: {
    hh: { label: "戶數", unit: "戶", fmt: "int" },
    m: { label: "男性人口", unit: "人", fmt: "int" },
    f: { label: "女性人口", unit: "人", fmt: "int" },
    sr: { label: "性別比", fmt: "num2" },
    pph: { label: "每戶人口", unit: "人", fmt: "num2" },
    dr: { label: "扶養比", fmt: "num2" },
    cd: { label: "扶幼比", fmt: "num2" },
    ed: { label: "扶老比", fmt: "num2" },
    ai: { label: "老化指數", fmt: "num2" },
  },
  // SocioeconomicH3CellData 欄位註解 + InfoModal 的 socio 說明段
  socioeconomic: {
    im: { label: "所得中位數", unit: "萬元", fmt: "num2" },
    iq: { label: "所得四分位距比", fmt: "num2" },
    sr: { label: "薪資佔比", fmt: "num2" },
    vs: { label: "人口活力分數", fmt: "num2" },
    vl: { label: "脆弱度指數", fmt: "num2" },
  },
  // SpatialEconomyH3CellData 欄位註解 + InfoModal 的 spatial 說明段
  spatialEconomy: {
    hp: { label: "房價中位數", unit: "萬元", fmt: "num2" },
    hu: { label: "每坪單價", unit: "萬元/坪", fmt: "num2" },
    hpr: { label: "房價所得比", fmt: "num2" },
    ad: { label: "便利設施密度", unit: "處/千人", fmt: "num2" },
    lm: { label: "土地混合度", fmt: "num2" },
  },
};

/** 各層當前 metric 的取得方式（逐層對齊 gridHosts 的 paramStr 呼叫） */
function currentMetric(layerKey: string): string {
  switch (layerKey) {
    // gridHosts:80
    case "h3Population": return String(layerParamsStore.getParam("h3Population", "h3Metric") ?? "day");
    // gridHosts:99 —— 本層無 metric 參數，factory 寫死 "p"
    case "popCount": return "p";
    // gridHosts:128（indCategory 只決定下拉選項集合，值本身看 indMetric）
    case "indicators": return String(layerParamsStore.getParam("indicators", "indMetric") ?? "hh");
    // gridHosts:155
    case "socioeconomic": return String(layerParamsStore.getParam("socioeconomic", "socioMetric") ?? "im");
    // gridHosts:179
    case "spatialEconomy": return String(layerParamsStore.getParam("spatialEconomy", "spatialMetric") ?? "hp");
    default: return "";
  }
}

/** fallback：GLOSS 查無此 metric 時，退回 spec 的英文 label（永不顯示錯的中文） */
function specLabel(layerKey: string, metricParam: string, metric: string): string {
  const spec = getParamsSpec(layerKey);
  const target = spec?.find((s) => s.name === metricParam);
  if (!target || target.kind !== "select") return metric;
  const opts = resolveSelectOptions(target, layerParamsStore.getParams(layerKey));
  return opts.find((o) => String(o.value) === metric)?.label ?? metric;
}

function formatValue(v: number, g: Gloss | undefined): string {
  if (!Number.isFinite(v)) return "—";
  const fmt = g?.fmt ?? "raw";
  const base =
    fmt === "int" ? Math.round(v).toLocaleString()
    : fmt === "pct" ? `${(v * 100).toFixed(1)}%`
    : fmt === "num2" ? v.toFixed(2)
    : String(v);
  return g?.unit ? `${base} ${g.unit}` : base;
}

function H3CellBody({
  props, layerKey, metricParam, title, accent,
}: {
  props: Record<string, unknown>;
  layerKey: string;
  metricParam: string;
  title: string;
  accent: string;
}) {
  const t = useFeatureTheme();
  // ⚠️ deps 只有 props：指標在點擊當下凍結，跟著 value 一起定格
  const shown = useMemo(() => {
    const metric = currentMetric(layerKey);
    const gloss = GLOSS[layerKey]?.[metric];
    const label = gloss?.label ?? specLabel(layerKey, metricParam, metric);
    return { label, value: formatValue(Number(props.value), gloss) };
  }, [props, layerKey, metricParam]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accent, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {title}
        </div>
      </div>
      <Row label={shown.label} value={shown.value} color={accent} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        H3 六邊形網格單元 · 數值為該格聚合值
      </div>
    </>
  );
}

export function PopCountCellPanel({ props }: { props: Record<string, unknown> }) {
  return <H3CellBody props={props} layerKey="popCount" metricParam="" title="人口數網格" accent="#ff7043" />;
}

export function H3PopulationCellPanel({ props }: { props: Record<string, unknown> }) {
  return <H3CellBody props={props} layerKey="h3Population" metricParam="h3Metric" title="日夜人口網格" accent="#42a5f5" />;
}

export function IndicatorsCellPanel({ props }: { props: Record<string, unknown> }) {
  return <H3CellBody props={props} layerKey="indicators" metricParam="indMetric" title="人口指標網格" accent="#ab47bc" />;
}

export function SocioeconomicCellPanel({ props }: { props: Record<string, unknown> }) {
  return <H3CellBody props={props} layerKey="socioeconomic" metricParam="socioMetric" title="社經指標網格" accent="#26a69a" />;
}

export function SpatialEconomyCellPanel({ props }: { props: Record<string, unknown> }) {
  return <H3CellBody props={props} layerKey="spatialEconomy" metricParam="spatialMetric" title="空間經濟網格" accent="#ec407a" />;
}

/**
 * YouBike 有車率格：本層無 metric 參數（`value` 恆為 `cell.fr` 有車率 0~1，
 * `ybHeightMode` 只改高度不改值），且是本群唯一多帶一欄 `capacity`（= `cell.sc`
 * 該格平均總車柱數）的一層 → 不走 GLOSS，直接寫死兩列。
 */
export function YoubikeFullnessCellPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const fr = Number(props.value);
  const capacity = Number(props.capacity);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#ffca28", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          YouBike 有車率
        </div>
      </div>
      {Number.isFinite(fr) && <Row label="有車率" value={`${(fr * 100).toFixed(1)}%`} color="#ffca28" />}
      {Number.isFinite(capacity) && <Row label="平均車柱數" value={`${capacity.toFixed(1)} 柱`} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        H3 六邊形網格單元 · 該格所有站點平均
      </div>
    </>
  );
}
