import type { LucideIcon } from "lucide-react";
import type { LayerVisibility } from "../../types";
import { manifestIcons, type ManifestKey } from "../../data/layerManifest";

/**
 * 手寫 icon 殘量 —— **AR-22 Phase 2 完成後為空**（348/348 全部由 layerManifest 派生）。
 * `Omit<…, ManifestKey>` 退化成 `{}` 的護欄語意說明見 layerCatalog 的
 * HANDWRITTEN_LAYER_COLORS（含「spread 不觸發 excess property check」那條）。
 */
const HANDWRITTEN_LAYER_ICONS: Omit<Record<keyof LayerVisibility, LucideIcon>, ManifestKey> = {
  // （空 —— Phase 2 全數搬完）
};

/**
 * icon 全集 —— 手寫殘量 + manifest 派生。型別維持
 * `Record<keyof LayerVisibility, LucideIcon>`（tsc 護欄不弱化）。
 * AR-22 黃金快照（layerGoldenSnapshot.test.ts）經 IconRailSidebar re-export 逐 key 讀 icon 名稱比對。
 */
export const LAYER_ICONS: Record<keyof LayerVisibility, LucideIcon> = {
  ...HANDWRITTEN_LAYER_ICONS,
  ...manifestIcons(),
};

