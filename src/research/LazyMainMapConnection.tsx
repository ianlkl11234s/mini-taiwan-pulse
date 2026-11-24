import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { loadingRegistry } from "../lib/loadingRegistry";
import { agentAllowedAtStart } from "./agentAllowed";
import type { MainMapConnection as MainMapConnectionType } from "./MainMapConnection";

/**
 * B1 P4：整套 research（MainMapConnection 與它的連線、分析、查詢處理）不在開站時載入。
 * 只在需要配對時才 import：使用者打開 Agent 面板，或這個分頁先前已開放連線（重整沿用／?agent=1／本機測試身分）。
 * 載入期間登記 loadingRegistry，與其他非同步載入一致。
 */
const MainMapConnection = lazy(() => import("./MainMapConnection").then((module) => ({ default: module.MainMapConnection })));

const LOADING_ID = "research:main-map-connection";

function ChunkLoading() {
  useEffect(() => {
    loadingRegistry.start(LOADING_ID, "載入 Agent 連線");
    return () => loadingRegistry.end(LOADING_ID);
  }, []);
  return null;
}

export function LazyMainMapConnection(props: ComponentProps<typeof MainMapConnectionType>) {
  const [wanted, setWanted] = useState(agentAllowedAtStart);
  const open = Boolean(props.open);
  useEffect(() => { if (open) setWanted(true); }, [open]);
  if (!wanted) return null;
  return (
    <Suspense fallback={<ChunkLoading />}>
      <MainMapConnection {...props} />
    </Suspense>
  );
}
