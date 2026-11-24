/**
 * 比較模式的統計圖例（spec §5.32；使用者 2026-11-11 Q2 (b)「讓圖例單純一點」、2026-11-12 選定合成一份）：
 * - 沒比較／兩側而右側沒另選：`children`（原本的圖例）。
 * - 只畫一側：原本的圖例＋一行「只顯示在左側／右側」。
 * - 兩側且右側另選了期別或細項：**合成一份**——指標名一次；「左：期別・細項」「右：期別・細項」各一行；
 *   色階門檻與配色相同只畫一組色票，不同就「左側」「右側」兩排並列；狀態列、出典與註記只出現一次，預設收合成「說明 ›」。
 * 由 `StatisticsDetails.tsx` 的 `StatisticsLegend` 包著用；`View` 由它傳入（避免兩檔互相 import）。
 */
import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { LegendNote, useLegendTheme } from "../legend/legendKit";
import { useLocale } from "../../state/localeStore";
import { compareSideOf, useCompareSideState } from "../../state/compareStore";
import { compareLegendSplit, compareSplitActive, statisticsRightStoreKey } from "../../state/compareStatistics";
import { regionalStatisticsStore } from "../../state/regionalStatisticsStore";
import { isStatisticsRenderLayer, type StatisticsRenderKey } from "../../data/regionalStatisticsRecipes";
import { FONT_CJK, FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";

export type StatisticsLegendPart = "title" | "period" | "rows" | "notes" | "status";

export interface StatisticsLegendViewProps {
  layerKey: StatisticsRenderKey;
  storeKey?: string;
  part?: StatisticsLegendPart;
}

function useStoreVersion(key: string) {
  return useSyncExternalStore((cb) => regionalStatisticsStore.subscribe(key, cb), () => regionalStatisticsStore.getSnapshot(key), () => regionalStatisticsStore.getSnapshot(key));
}

export function CompareStatisticsLegend({ layerKey, View, children }: { layerKey: StatisticsRenderKey; View: ComponentType<StatisticsLegendViewProps>; children: ReactNode }) {
  // 只訂開關與側別（拖把手不重繪）
  const compare = useCompareSideState();
  const { t } = useLocale();
  const theme = useLegendTheme();
  const rightKey = statisticsRightStoreKey(layerKey);
  // 兩份選擇任一變動都要重算「色票要不要分兩排」
  useStoreVersion(layerKey);
  useStoreVersion(rightKey);
  // 兩國並排：圖例整段依國家分左右（LegendPanel），這裡不另標側別
  if (!compare.enabled || compare.mode === "countries" || !isStatisticsRenderLayer(layerKey)) return children;
  const side = compareSideOf(layerKey, compare);
  if (side !== "both") {
    return <div>
      {children}
      <LegendNote>{t(side === "left" ? "compare.legendOnlyLeft" : "compare.legendOnlyRight")}</LegendNote>
    </div>;
  }
  if (!compareSplitActive(layerKey, compare)) return children;
  return <MergedCompareLegend layerKey={layerKey} rightKey={rightKey} View={View} splitRows={compareLegendSplit(layerKey, theme.isDark)} />;
}

/** 合成圖例本體（拆出來方便測試：`splitRows` 由外面依兩側色階算好傳入） */
export function MergedCompareLegend({ layerKey, rightKey, View, splitRows }: { layerKey: StatisticsRenderKey; rightKey: string; View: ComponentType<StatisticsLegendViewProps>; splitRows: boolean }) {
  const { t } = useLocale();
  const theme = useLegendTheme();
  const [notesOpen, setNotesOpen] = useState(false);
  const heading = { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: theme.textStrong, flex: "none" } as const;
  const sideLine = (label: string, key: string) => (
    <div style={{ display: "flex", gap: 4, fontSize: FONT_SIZE.sm, color: theme.textDefault }}>
      <span style={heading}>{label}</span>
      <View layerKey={layerKey} storeKey={key} part="period" />
    </div>
  );
  const column = (label: string, key: string) => (
    <div style={{ display: "grid", gap: 2, alignContent: "start", minWidth: 0 }}>
      <span style={heading}>{label}</span>
      <View layerKey={layerKey} storeKey={key} part="rows" />
    </div>
  );
  return <div style={{ display: "grid", gap: 6 }}>
    <View layerKey={layerKey} part="title" />
    {sideLine(t("compare.legendLeftLabel"), layerKey)}
    {sideLine(t("compare.legendRightLabel"), rightKey)}
    {/* 兩側共用色階時只畫左側 rows：右側的載入中／失敗狀態另外顯示（分兩排時各排 rows 已含自己的狀態） */}
    {!splitRows && <View layerKey={layerKey} storeKey={rightKey} part="status" />}
    {splitRows
      ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{column(t("compare.legendLeft"), layerKey)}{column(t("compare.legendRight"), rightKey)}</div>
      : <View layerKey={layerKey} part="rows" />}
    <div>
      <button
        type="button"
        aria-expanded={notesOpen}
        onClick={() => setNotesOpen((open) => !open)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 0", border: 0, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}
      >
        {t("compare.legendNotes")}
        <ChevronRight size={10} aria-hidden="true" style={{ transform: notesOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {notesOpen && <div style={{ display: "grid", gap: 4 }}>
        {/* 左右各自的出典／涵蓋註記（期別不同時健康度與來源可能不同） */}
        <span style={heading}>{t("compare.legendLeftLabel")}</span>
        <View layerKey={layerKey} part="notes" />
        <span style={heading}>{t("compare.legendRightLabel")}</span>
        <View layerKey={layerKey} storeKey={rightKey} part="notes" />
      </div>}
    </div>
  </div>;
}
