/**
 * 比較模式在圖層展開區的控制項（spec §5.11「比較」類，排在最前；DESIGN §4）。
 *
 * 由規格產生，不手寫 JSX：
 * - 「顯示在」：左／右／兩側（3 個選項 → `ParamControlList` 自動畫成分段控制）。不支援的圖層三個選項都停用，
 *   下方說明「比較模式暫不支援，只顯示在左側」（使用者 2026-11-11 Q1 (a)）。
 * - 統計層兩側時：右側的期別／細項（`compareStatistics.rightStatisticsSpecs` 派生的連動選單）。
 *
 * 只給面板用：不進 `buildParamControls`／`LAYER_PARAMS_SPEC`，Agent（`research/layerControls.ts`）看不到也不能設，
 * 行為與單地圖相同（作用在左側）。
 */
import { isStatisticsRenderLayer } from "../data/regionalStatisticsRecipes";
import type { LocaleSnapshot } from "./localeStore";
import { compareSideOf, isCompareSupported, type CompareSide, type CompareState } from "./compareStore";
import { rightStatisticsSpecs, setCompareSide, leftStatisticsSpecs } from "./compareStatistics";
import { linkedSelectSnapshot, setLinkedSelect, canRetryLinkedSelect, retryLinkedSelects } from "./linkedSelect";
import { paramText } from "../i18n/paramText";
import type { LinkedSelectConfig, ParamControl, SelectConfig } from "./layerParamsControls";
import type { LayerParamSpec } from "../data/layerParamsSpec";

type I18n = Pick<LocaleSnapshot, "active" | "lookup" | "t">;

const SIDES: readonly CompareSide[] = ["left", "right", "both"];
const SIDE_TEXT = { left: "compare.sideLeft", right: "compare.sideRight", both: "compare.sideBoth" } as const;

export function buildCompareControls(key: string, snapshot: CompareState, i18n: I18n): ParamControl[] {
  if (!snapshot.enabled) return [];
  const supported = isCompareSupported(key);
  const side = compareSideOf(key, snapshot);
  const sideControl: SelectConfig = {
    type: "select",
    label: i18n.t("compare.sideLabel"),
    value: side,
    options: SIDES.map((value) => ({ label: i18n.t(SIDE_TEXT[value]), value, ...(supported ? {} : { disabled: true }) })),
    onChange: (next) => setCompareSide(key, next as CompareSide),
    ...(supported ? {} : { note: i18n.t("compare.unsupported") }),
  };
  const controls: ParamControl[] = [sideControl];
  if (!supported || side !== "both" || !isStatisticsRenderLayer(key)) return controls;
  const specs = rightStatisticsSpecs(key);
  let carrier = true;
  for (const spec of specs) {
    const snap = linkedSelectSnapshot(key, spec);
    // 與左側同一條可見規則：選項 ≥2 才顯示；第一列在載入中／錯誤時保底顯示（承載狀態字）
    if (snap.options.length <= 1 && !(spec.primary && snap.status !== "ready")) continue;
    const statusText = !carrier ? undefined
      : snap.status === "loading" ? i18n.t("paramsPanel.loading")
        : snap.status === "error" ? (snap.error ? i18n.t("paramsPanel.loadFailedWith", { error: snap.error }) : i18n.t("paramsPanel.loadFailed"))
          : undefined;
    const control: LinkedSelectConfig = {
      type: "linkedSelect",
      label: i18n.t("compare.rightPrefix", { label: paramText(spec.label, i18n, { layerKey: key, name: spec.name }) }),
      value: snap.value,
      options: snap.options.map(({ localize, ...option }) => ({ ...option, label: localize?.(i18n as never) ?? option.label })),
      status: snap.status,
      ...(statusText ? { statusText } : {}),
      onChange: (next) => setLinkedSelect(key, spec, next),
      ...(carrier && snap.status === "error" && canRetryLinkedSelect(spec.provider) ? { onRetry: () => retryLinkedSelects(key, spec.provider) } : {}),
    };
    carrier = false;
    controls.push(control);
  }
  return controls;
}

/**
 * 把比較控制項併進原本的展開區列表：「顯示在」排最前；統計層兩側時，左側原本的期別／細項列標籤加「左側」前綴
 * （面板層改名，不改規格中文：Agent 與黃金快照照舊），右側的期別／細項緊接在左側最後一列之後。
 * `visible` 是 `visibleControlSpecs(key)`，與 `controls` 逐位對應。
 */
export function withCompareControls(key: string, snapshot: CompareState, controls: readonly ParamControl[], visible: readonly LayerParamSpec[], i18n: I18n): ParamControl[] {
  const [side, ...right] = buildCompareControls(key, snapshot, i18n);
  if (!side) return [...controls];
  if (!right.length) return [side, ...controls];
  const names = new Set(leftStatisticsSpecs(key).map((spec) => spec.name));
  let last = -1;
  const left = controls.map((control, index) => {
    const spec = visible[index];
    if (!spec || !names.has(spec.name) || !("label" in control)) return control;
    last = index;
    return { ...control, label: i18n.t("compare.leftPrefix", { label: control.label }) };
  });
  return [side, ...left.slice(0, last + 1), ...right, ...left.slice(last + 1)];
}
