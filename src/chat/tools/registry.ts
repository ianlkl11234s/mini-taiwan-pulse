// 匯集全部 chat tools 給 agent 的 streamText 使用。

import type { MapBridge } from "../types";
import { mapTools } from "./mapTools";
import { catalogTools } from "./catalogTools";
import { dataTools } from "./dataTools";
import { loadAllPacks } from "../../countries/packs";

export function buildTools(bridge: MapBridge) {
  // AI 對話的工具（找圖層、開圖層、調參數）要看得到全部國家的圖層（B1 P5a）：開始對話就載入全部國家包
  void loadAllPacks().catch(() => undefined);
  return {
    ...catalogTools(bridge),
    ...mapTools(bridge),
    ...dataTools(bridge),
  };
}
