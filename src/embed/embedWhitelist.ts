/**
 * `/embed` 可用圖層白名單（EM-06）
 *
 * **自動派生，不手動維護** —— 新增圖層時不必回來改這裡，規則本身保證安全：
 *
 * 1. `dynamicData !== true` → 只收純靜態檔（GeoJSON / PMTiles）。動態圖層走 Supabase RPC，
 *    嵌在別人文章裡等於把 DB egress 交給別人的流量決定（見 embeddable-map.md §6-2）。
 * 2. 排除 `GATED_LAYERS` → owner-only 私人圖層不得經由嵌入洩漏。
 *
 * 要開放某個動態圖層時，是「逐案評估 egress 後加例外」，不是放寬這裡的規則。
 */
import { OVERLAY_REGISTRY } from "../map/overlayRegistry";
import { GATED_LAYERS } from "../components/sidebar/layerCatalog";
import { EMBED_CDN_LAYERS } from "./dynamicCdnLayers";
import { SNAPSHOT_KEYS } from "./snapshotLayers";
import { REPLAY_KEYS } from "./replayLayers";
import type { OverlayConfig, LayerVisibility } from "../types";

/**
 * 例外（EM-14）：標成 `dynamicData` 但資料其實不會動、且已有 CDN 快照的圖層。
 * 這些走 `/static-rpc/*.json`，同樣不碰 Supabase。**gated 仍然一律排除**。
 */
function hasCdnSnapshot(id: keyof LayerVisibility): boolean {
  return id in EMBED_CDN_LAYERS;
}

export const EMBED_ALLOWED_CONFIGS: OverlayConfig[] = OVERLAY_REGISTRY.filter(
  (o) => (!o.dynamicData || hasCdnSnapshot(o.id)) && !GATED_LAYERS.has(o.id),
);

export const EMBED_ALLOWED: ReadonlySet<string> = new Set([
  ...EMBED_ALLOWED_CONFIGS.map((o) => o.id),
  // EM-15：歷史快照圖層不在 overlayRegistry（主站是專屬 hook 畫的），
  // 由 embed 自行 addSource/addLayer。**需帶 `date=` 才有資料**，否則靜默略過。
  ...SNAPSHOT_KEYS,
  // EM-16：回放圖層（Three.js CustomLayer + 回放時鐘）。同樣**需帶 `date=`**，
  // 資料來自 gzip 快照，一樣不碰 Supabase —— 派生方式比照 SNAPSHOT_KEYS。
  ...REPLAY_KEYS,
]);

/** 全 false 的 LayerVisibility，再把指定的 key 打開。 */
export function buildEmbedVisibility(keys: readonly (keyof LayerVisibility)[] = []): LayerVisibility {
  const out = {} as LayerVisibility;
  for (const config of OVERLAY_REGISTRY) out[config.id] = false;
  for (const k of SNAPSHOT_KEYS) out[k] = false;
  for (const k of REPLAY_KEYS) out[k] = false;
  for (const k of keys) {
    if (EMBED_ALLOWED.has(k)) out[k] = true;
  }
  return out;
}

/** 只保留白名單內、且被要求開啟的 config —— 餵給 addAllOverlays，避免註冊用不到的 source。 */
export function configsFor(keys: readonly (keyof LayerVisibility)[]): OverlayConfig[] {
  const want = new Set(keys);
  return EMBED_ALLOWED_CONFIGS.filter((o) => want.has(o.id));
}
