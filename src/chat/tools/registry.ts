// 匯集全部 chat tools 給 agent 的 streamText 使用。

import type { MapBridge } from "../types";
import { mapTools } from "./mapTools";
import { catalogTools } from "./catalogTools";
import { dataTools } from "./dataTools";

export function buildTools(bridge: MapBridge) {
  return {
    ...catalogTools(bridge),
    ...mapTools(bridge),
    ...dataTools(bridge),
  };
}
