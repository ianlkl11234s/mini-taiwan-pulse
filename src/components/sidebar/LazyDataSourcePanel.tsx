import { lazy, Suspense, useEffect, type ComponentProps } from "react";
import { PanelHeader } from "./PanelHeader";
import { useLocale } from "../../state/localeStore";
import { loadingRegistry } from "../../lib/loadingRegistry";
import { BORDER, COLORS, FONT_CJK, FONT_SIZE, LIGHT } from "../../styles/designTokens";
import type { DataSourcePanel as DataSourcePanelType } from "./DataSourcePanel";

/**
 * B1 P4：資料來源總覽（含上游登記、統計來源定義與它們的文字）打開時才載入。
 * 載入期間顯示面板標題＋「載入中…」，並登記 loadingRegistry。
 */
const DataSourcePanel = lazy(() => import("./DataSourcePanel").then((module) => ({ default: module.DataSourcePanel })));
const LayerInfoSourceCard = lazy(() => import("./DataSourcePanel").then((module) => ({ default: module.LayerInfoSourceCard })));

const LOADING_ID = "ui:data-source-panel";

function ChunkLoading({ label }: { label: string }) {
  useEffect(() => {
    loadingRegistry.start(LOADING_ID, label);
    return () => loadingRegistry.end(LOADING_ID);
  }, [label]);
  return null;
}

function PanelFallback({ isDarkTheme, onClose }: { isDarkTheme: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const dim = isDarkTheme ? COLORS.textDim : LIGHT.textDim;
  return (
    <div role="status" aria-busy="true">
      <ChunkLoading label={t("rail.datasource")} />
      <PanelHeader
        title={t("rail.datasource")}
        eyebrow={t("dataSources.eyebrow")}
        onClose={onClose}
        borderColor={isDarkTheme ? BORDER.panel : LIGHT.border}
        mutedColor={dim}
        textColor={isDarkTheme ? COLORS.textStrong : LIGHT.textStrong}
      />
      <div style={{ padding: 12, color: dim, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}>{t("dataSources.loading")}</div>
    </div>
  );
}

export function LazyDataSourcePanel(props: ComponentProps<typeof DataSourcePanelType>) {
  return (
    <Suspense fallback={<PanelFallback isDarkTheme={props.isDarkTheme ?? true} onClose={props.onClose} />}>
      <DataSourcePanel {...props} />
    </Suspense>
  );
}

/** 圖層展開區「說明・來源」打開時才載入的上游資料卡（與資料來源總覽同一個 chunk）。 */
export function LazyLayerInfoSourceCard({ layerKey, isDarkTheme }: { layerKey: string; isDarkTheme: boolean }) {
  const { t } = useLocale();
  return (
    <Suspense fallback={<div role="status" style={{ color: isDarkTheme ? COLORS.textDim : LIGHT.textDim, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}><ChunkLoading label={t("rail.datasource")} />{t("dataSources.loading")}</div>}>
      <LayerInfoSourceCard layerKey={layerKey} isDarkTheme={isDarkTheme} />
    </Suspense>
  );
}
