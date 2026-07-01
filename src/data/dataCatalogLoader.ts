/**
 * dataCatalogLoader — 讀 metadata.data_catalog（Step 2 建的 Supabase 表）
 *
 * 走 Step 2 建立的 RPC：
 *  - public.get_data_catalog_for_layer(layer_key)   → 該 layer 對應的 upstream datasets
 *  - public.get_data_catalog_by_theme(theme)        → 該主題所有 datasets
 *
 * SSOT chain：
 *  layerCatalog.ts  (pulse layer_key)
 *   → upstreamRegistry.ts (Step 1 橋接：layer_key → dataset_id)
 *   → RPC get_data_catalog_for_layer (Step 2)
 *   → metadata.data_catalog (Step 3 sync from catalog markdown)
 *
 * 若 RPC 不存在（migration 未 apply）會 gracefully 返回空陣列 + console warn。
 */
import { supabase } from "../lib/supabase";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets } from "./upstreamRegistry";
import type { LayerVisibility } from "../types";

export interface DataCatalogEntry {
  datasetId: string;
  title: string | null;
  summary: string | null;
  providerAgency: string | null;
  sourceUrl: string | null;
  sourceDatasetId: string | null;
  license: string | null;
  lifecycle: string | null;
  updateFrequency: string | null;
  lastUpdated: string | null;
  catalogMdPath: string | null;
}

export interface DataCatalogSummary {
  datasetId: string;
  theme: string;
  subtopic: string | null;
  title: string | null;
  providerAgency: string | null;
  lifecycle: string | null;
  usedByPulseLayers: string[];
}

function mapEntry(row: Record<string, unknown>): DataCatalogEntry {
  return {
    datasetId: String(row.dataset_id ?? ""),
    title: (row.title as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    providerAgency: (row.provider_agency as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceDatasetId: (row.source_dataset_id as string | null) ?? null,
    license: (row.license as string | null) ?? null,
    lifecycle: (row.lifecycle as string | null) ?? null,
    updateFrequency: (row.update_frequency as string | null) ?? null,
    lastUpdated: (row.last_updated as string | null) ?? null,
    catalogMdPath: (row.catalog_md_path as string | null) ?? null,
  };
}

/**
 * Fetch catalog entries for a given pulse layer_key.
 *
 * For verified layers: returns rows from Supabase RPC.
 * For pulse_only layers: transitively resolves derivedFromLayers → dataset_ids,
 *   then fetches each dataset (multiple RPC calls). This handles compound analyses.
 * For catalog_missing: returns empty array.
 */
export async function fetchDataCatalogForLayer(
  layerKey: keyof LayerVisibility
): Promise<DataCatalogEntry[]> {
  const ref = UPSTREAM_REGISTRY[layerKey];
  if (!ref) return [];

  // For pulse_only: transitively resolve to upstream datasets, then batch fetch by dataset_id
  if (ref.status === "pulse_only") {
    const datasetIds = resolveUpstreamDatasets(layerKey);
    if (datasetIds.length === 0) return [];
    // Batch: pick any pulse_layer that uses each dataset — cheaper to use direct dataset lookup
    // For MVP just do one RPC per dataset (dataset count is small: usually 1-4)
    const results = await Promise.all(
      datasetIds.map((did) => fetchDataCatalogByDatasetId(did))
    );
    return results.filter((r): r is DataCatalogEntry => r !== null);
  }

  if (ref.status !== "verified") return [];

  const { data, error } = await supabase.rpc("get_data_catalog_for_layer", {
    p_layer_key: layerKey,
  });
  if (error) {
    console.warn("[dataCatalog] RPC get_data_catalog_for_layer failed:", error.message);
    return [];
  }
  return Array.isArray(data) ? data.map(mapEntry) : [];
}

/**
 * Fetch a single catalog entry by dataset_id. Used for pulse_only lineage resolution.
 * Reuses get_data_catalog_by_theme with client-side filter to avoid needing a new RPC.
 */
async function fetchDataCatalogByDatasetId(datasetId: string): Promise<DataCatalogEntry | null> {
  const { data, error } = await supabase
    .from("data_catalog")
    .select("dataset_id, title, summary, provider_agency, source_url, source_dataset_id, license, lifecycle, update_frequency, last_updated, catalog_md_path")
    .eq("dataset_id", datasetId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return mapEntry(data as Record<string, unknown>);
}

/**
 * Fetch catalog summaries by theme (or all if theme=null). Used for the
 * "資料來源總覽" browser icon.
 */
export async function fetchDataCatalogByTheme(theme?: string): Promise<DataCatalogSummary[]> {
  const { data, error } = await supabase.rpc("get_data_catalog_by_theme", {
    p_theme: theme ?? null,
  });
  if (error) {
    console.warn("[dataCatalog] RPC get_data_catalog_by_theme failed:", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    datasetId: String(row.dataset_id ?? ""),
    theme: String(row.theme ?? ""),
    subtopic: (row.subtopic as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    providerAgency: (row.provider_agency as string | null) ?? null,
    lifecycle: (row.lifecycle as string | null) ?? null,
    usedByPulseLayers: Array.isArray(row.used_by_pulse_layers)
      ? (row.used_by_pulse_layers as string[])
      : [],
  }));
}
