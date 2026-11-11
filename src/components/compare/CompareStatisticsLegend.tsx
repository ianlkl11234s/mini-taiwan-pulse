/**
 * 比較模式的統計圖例（spec §5.32；使用者 2026-11-11 Q2 (b)「讓圖例單純一點」）：
 * - 沒比較／兩側而右側沒另選：`children`（原本的圖例）。
 * - 只畫一側：原本的圖例＋一行「只顯示在左側／右側」。
 * - 兩側、只差期別或細項、色階相同：一份圖例，期別列分「左側 …」「右側 …」兩行。
 * - 兩側、細項讓色階門檻或配色不同：「左側」「右側」兩份色階相鄰，狀態列與註記只在下面出現一次（左側那份）。
 * 由 `StatisticsDetails.tsx` 的 `StatisticsLegend` 包著用；`View` 由它傳入（避免兩檔互相 import）。
 */
import { useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { LegendNote, useLegendTheme } from "../legend/legendKit";
import { useLocale } from "../../state/localeStore";
import { COMPARE_DEFAULT_SPLIT, compareSideOf, useCompareSelector } from "../../state/compareStore";
import { compareLegendSplit, compareSplitActive, statisticsRightStoreKey } from "../../state/compareStatistics";
import { regionalStatisticsStore } from "../../state/regionalStatisticsStore";
import { isStatisticsRenderLayer, type StatisticsRenderKey } from "../../data/regionalStatisticsRecipes";
import { FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";

export interface StatisticsLegendViewProps {
  layerKey: StatisticsRenderKey;
  storeKey?: string;
  compareRightKey?: string;
  showSelection?: boolean;
  part?: "scale" | "notes";
}

function useStoreVersion(key: string) {
  return useSyncExternalStore((cb) => regionalStatisticsStore.subscribe(key, cb), () => regionalStatisticsStore.getSnapshot(key), () => regionalStatisticsStore.getSnapshot(key));
}

export function CompareStatisticsLegend({ layerKey, View, children }: { layerKey: StatisticsRenderKey; View: ComponentType<StatisticsLegendViewProps>; children: ReactNode }) {
  // 只訂開關與側別（拖把手不重繪）
  const enabled = useCompareSelector((state) => state.enabled);
  const sides = useCompareSelector((state) => state.sides);
  const compare = { enabled, sides, split: COMPARE_DEFAULT_SPLIT };
  const { t } = useLocale();
  const theme = useLegendTheme();
  const rightKey = statisticsRightStoreKey(layerKey);
  // 兩份選擇任一變動都要重算「拆不拆」
  useStoreVersion(layerKey);
  useStoreVersion(rightKey);
  if (!compare.enabled || !isStatisticsRenderLayer(layerKey)) return children;
  const side = compareSideOf(layerKey, compare);
  if (side !== "both") {
    return <div>
      {children}
      <LegendNote>{t(side === "left" ? "compare.legendOnlyLeft" : "compare.legendOnlyRight")}</LegendNote>
    </div>;
  }
  if (!compareSplitActive(layerKey, compare)) return children;
  if (!compareLegendSplit(layerKey, theme.isDark)) return <View layerKey={layerKey} compareRightKey={rightKey} />;
  const heading = { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: theme.textStrong } as const;
  return <div style={{ display: "grid", gap: 8 }}>
    <div style={{ display: "grid", gap: 2 }}><span style={heading}>{t("compare.legendLeft")}</span><View layerKey={layerKey} showSelection part="scale" /></div>
    <div style={{ display: "grid", gap: 2 }}><span style={heading}>{t("compare.legendRight")}</span><View layerKey={layerKey} storeKey={rightKey} showSelection part="scale" /></div>
    <View layerKey={layerKey} part="notes" />
  </div>;
}
