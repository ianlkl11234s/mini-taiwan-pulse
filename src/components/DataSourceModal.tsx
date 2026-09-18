/**
 * DataSourceModal — 顯示單一 layer 的資料來源浮窗
 *
 * Step 4 UI for the SSOT bridge. Reads from Supabase RPC via useDataCatalogForLayer.
 * Graceful fallback to UPSTREAM_REGISTRY (Step 1 static bridge) when RPC unavailable.
 */
import { useEffect, useMemo, useState } from "react";
import { X, ExternalLink, Database, Clock, Building2, FileText, GitBranch } from "lucide-react";
import { useDataCatalogForLayer } from "../hooks/useDataCatalog";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets } from "../data/upstreamRegistry";
import { LAYER_COLORS } from "./sidebar/layerCatalog";
import type { LayerVisibility } from "../types";
import { getStatisticsDataSourceDefinition, statisticsSourceLevelLabel, statisticsIndicatorLabel } from "../data/statisticsDataSources";
import { LAYER_MANIFEST } from "../data/layerManifest";
import { isStatisticsRenderLayer, statisticsReleaseFallback, statisticsRenderRecipe } from "../data/regionalStatisticsRecipes";
import { loadRegionalStatisticsValues, type StatisticsSource } from "../data/regionalStatisticsLoader";

interface Props {
  layerKey: keyof LayerVisibility | null;
  onClose: () => void;
}

const LIFECYCLE_LABEL: Record<string, string> = {
  realtime: "即時（分鐘級）",
  daily: "每日",
  weekly: "每週",
  monthly: "每月",
  quarterly: "每季",
  yearly: "每年",
  static: "一次性 / 靜態",
  semi_annual: "每半年",
  planned: "規劃中",
  deprecated: "已停用",
};

export function DataSourceModal({ layerKey, onClose }: Props) {
  const { data: entries, loading, error } = useDataCatalogForLayer(layerKey);
  const ref = layerKey ? UPSTREAM_REGISTRY[layerKey] : null;
  const statisticsSource = layerKey ? getStatisticsDataSourceDefinition(layerKey) : undefined;
  const [artifactSource, setArtifactSource] = useState<StatisticsSource | null>(null);
  const [artifactRelease, setArtifactRelease] = useState<{ period_start: string; period_end: string } | null>(null);
  const [artifactSourceError, setArtifactSourceError] = useState<string | null>(null);
  const [artifactSourceLoading, setArtifactSourceLoading] = useState(false);
  const layerLabel = layerKey && LAYER_MANIFEST[layerKey].section !== null
    ? LAYER_MANIFEST[layerKey].label
    : layerKey;

  const upstreamDatasetIds = useMemo(() => {
    if (!layerKey) return [];
    return resolveUpstreamDatasets(layerKey);
  }, [layerKey]);

  useEffect(() => {
    if (!layerKey || !isStatisticsRenderLayer(layerKey)) {
      setArtifactSource(null);
      setArtifactRelease(null);
      setArtifactSourceError(null);
      return;
    }
    const recipe = statisticsRenderRecipe(layerKey);
    const releaseFallback = statisticsReleaseFallback(layerKey);
    const controller = new AbortController();
    setArtifactSource(null);
    setArtifactRelease(null);
    setArtifactSourceError(null);
    setArtifactSourceLoading(true);
    // Provenance only needs the verified release receipt; do not acquire or
    // cache administrative boundary geometry for this modal.
    loadRegionalStatisticsValues({
      layerKey,
      datasetId: recipe.dataset_id,
      indicatorId: recipe.indicator_id,
      level: recipe.level,
      releaseId: "releaseId" in recipe ? recipe.releaseId : undefined,
      dimensions: recipe.dimensions,
      label: recipe.label,
      allowReleaseFallback: Boolean(releaseFallback),
      releaseFallback,
    }, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setArtifactSource(result.sources); setArtifactRelease(result.values.release); } })
      .catch(error => { if (!controller.signal.aborted) setArtifactSourceError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!controller.signal.aborted) setArtifactSourceLoading(false); });
    return () => controller.abort();
  }, [layerKey]);

  if (!layerKey || !ref) return null;

  const color = LAYER_COLORS[layerKey] ?? "#666";
  const status = ref.status;

  return (
    <div
      className="ds-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111827", color: "#E5E7EB", borderRadius: 12,
          padding: 24, maxWidth: 560, width: "90vw", maxHeight: "85vh",
          overflow: "auto", border: `2px solid ${color}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: "50%" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>資料來源 — {layerLabel}</h2>
              <code style={{ color: "#6B7280", fontSize: 11 }}>{layerKey}</code>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer" }}
            aria-label="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} />

        {/* Loading */}
        {loading && <div style={{ marginTop: 16, color: "#9CA3AF" }}>載入中…</div>}
        {error && (
          <div style={{ marginTop: 12, padding: 8, background: "#7f1d1d33", borderRadius: 6, fontSize: 12 }}>
            ⚠ Supabase RPC 未就緒（{error}）— 顯示 Step 1 static bridge 內容。
          </div>
        )}

        {statisticsSource && (
          <StatisticsSourceCard source={statisticsSource} registryStatus={status} />
        )}

        {statisticsSource && <ArtifactSourceCard level={statisticsSource.level} source={artifactSource} release={artifactRelease} loading={artifactSourceLoading} error={artifactSourceError} derived={statisticsSource.kind === "derived"} />}

        {/* pulse_only lineage */}
        {status === "pulse_only" && (ref.derivedFromLayers || ref.derivedFromDatasets) && (
          <div style={{ marginTop: 16, padding: 12, background: "#1F2937", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#A78BFA", fontSize: 13 }}>
              <GitBranch size={14} /> 派生分析
            </div>
            <div style={{ fontSize: 13, color: "#D1D5DB", marginBottom: 6 }}>
              <strong>類型：</strong> {ref.derivationType ?? "custom"}
            </div>
            {ref.processing && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 1.5 }}>
                {ref.processing}
              </div>
            )}
            {ref.derivedFromLayers && (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                派生自 layers: <code style={{ color: "#A78BFA" }}>{ref.derivedFromLayers.join(", ")}</code>
              </div>
            )}
            {upstreamDatasetIds.length > 0 && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                最終上游 datasets: <code style={{ color: "#60A5FA" }}>{upstreamDatasetIds.join(", ")}</code>
              </div>
            )}
          </div>
        )}

        {/* Catalog entries */}
        {entries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              {entries.length} 個上游資料集
            </div>
            {entries.map((e) => <EntryCard key={e.datasetId} entry={e} />)}
          </div>
        )}

        {/* Fallback: no entries from RPC, show static registry info */}
        {entries.length === 0 && status === "verified" && !loading && (
          <div style={{ marginTop: 16 }}>
            {ref.datasets.map((d) => (
              <div key={d.datasetId} style={{ padding: 12, background: "#1F2937", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#60A5FA" }}>
                  <Database size={12} style={{ display: "inline", marginRight: 6 }} />
                  {d.datasetId}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                  Confidence: {d.confidence} · 詳細資訊需 Supabase migration 269 apply
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "catalog_missing" && (
          <div style={{ marginTop: 16, padding: 12, background: "#78350f33", borderRadius: 8, fontSize: 13 }}>
            此 layer 尚無對應 catalog 條目。詳見 <code>docs/audit/data_sources_pending_catalog.md</code>。
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "verified" | "pulse_only" | "catalog_missing" }) {
  const cfg = {
    verified: { color: "#10B981", label: "已橋接" },
    pulse_only: { color: "#A78BFA", label: "派生分析" },
    catalog_missing: { color: "#F59E0B", label: "待補 catalog" },
  }[status];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", background: cfg.color + "22",
      color: cfg.color, borderRadius: 4, fontSize: 11, fontWeight: 500,
    }}>{cfg.label}</span>
  );
}

function StatisticsSourceCard({ source, registryStatus }: { source: NonNullable<ReturnType<typeof getStatisticsDataSourceDefinition>>; registryStatus: string }) {
  const kindLabel = source.kind === "derived" ? "派生統計" : source.kind === "presentation" ? "固定學制統計入口" : "原始統計";
  return (
    <div style={{ marginTop: 16, padding: 12, background: "#1F2937", borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: "#60A5FA", marginBottom: 6 }}>{kindLabel} · {source.label}</div>
      {registryStatus === "verified" && <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>登錄狀態：已橋接至本站資料集；不表示 catalog 已逐筆驗證原始來源。</div>}
      <div style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.5 }}>{source.metricLabel}</div>
      <div style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1.5 }}>datasetId：<code>{source.datasetIds.join(", ")}</code></div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>期別：{source.period} · 單位：{source.unit} · 層級：{statisticsSourceLevelLabel(source.level)}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{source.contract}</div>
      {source.disclosure && <div style={{ marginTop: 6, fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{source.disclosure}</div>}
      {source.provider && <div style={{ marginTop: 6, fontSize: 12, color: "#9CA3AF" }}>提供機關：{source.provider}</div>}
      {source.license && <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>授權：{source.license}</div>}
      {source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, color: "#60A5FA", fontSize: 12, wordBreak: "break-all" }}>{source.sourceUrl}</a>}
    </div>
  );
}

function comparisonInputUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

function ArtifactSourceCard({ source, release, loading, error, derived, level }: { level: string; source: StatisticsSource | null; release: { period_start: string; period_end: string } | null; loading: boolean; error: string | null; derived: boolean }) {
  const derivation = source?.derivation as Record<string, unknown> | undefined;
  const inputs = Array.isArray(derivation?.input_sources) ? derivation.input_sources.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value))) : [];
  return (
    <div style={{ marginTop: 16, padding: 12, background: "#1F2937", borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: "#A78BFA", marginBottom: 6 }}>{derived ? "派生原始來源" : "已發布來源紀錄"}</div>
      {loading && <div style={{ color: "#9CA3AF", fontSize: 12 }}>讀取已發布的來源紀錄…</div>}
      {error && <div style={{ color: "#F59E0B", fontSize: 12 }}>來源紀錄未載入：{error}</div>}
      {release && <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>此筆來源紀錄期間：{release.period_start} 至 {release.period_end}</div>}
      {derivation && <>
        {typeof derivation.formula === "string" && <div style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1.5 }}>公式：{derivation.formula.replace(/\bnumerator\b/g, "分子").replace(/\bdenominator\b/g, "分母")}</div>}
        {(typeof derivation.numerator_indicator === "string" || typeof derivation.denominator_indicator === "string") && <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>分子：{statisticsIndicatorLabel(derivation.numerator_indicator, level)} · 分母：{statisticsIndicatorLabel(derivation.denominator_indicator, level)}</div>}
        {inputs.map((input, index) => {
          const url = comparisonInputUrl(input.source_landing_url);
          return <div key={`${String(input.dataset_id ?? input.source_dataset_id ?? index)}-${index}`} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #374151", fontSize: 12, color: "#D1D5DB" }}>
            <div>{String(input.publisher ?? "未標示提供機關")} · {String(input.dataset_id ?? input.source_dataset_id ?? "未標示 dataset")}</div>
            <div style={{ color: "#9CA3AF", marginTop: 3 }}>期別：{typeof input.period_start === "string" && typeof input.period_end === "string" ? `${input.period_start} 至 ${input.period_end}` : String(input.period ?? input.period_label ?? "未標示")} · 授權：{String(input.license ?? "未標示")}</div>
            {url && <a href={url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4, color: "#60A5FA", wordBreak: "break-all" }}>{url}</a>}
          </div>;
        })}
      </>}
      {source && !derivation && <SourceRecord source={source} />}
    </div>
  );
}

function SourceRecord({ source }: { source: StatisticsSource }) {
  const url = comparisonInputUrl(source.source_landing_url ?? source.source_url);
  const publisher = typeof source.publisher === "string" ? source.publisher : undefined;
  const license = typeof source.license === "string" ? source.license : undefined;
  if (!publisher && !license && !url) return null;
  return <div style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1.5 }}>
    {publisher && <div>提供機關：{publisher}</div>}
    {license && <div style={{ color: "#9CA3AF" }}>授權：{license}</div>}
    {url && <a href={url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4, color: "#60A5FA", wordBreak: "break-all" }}>{url}</a>}
  </div>;
}

function EntryCard({ entry }: { entry: import("../data/dataCatalogLoader").DataCatalogEntry }) {
  return (
    <div style={{ padding: 12, background: "#1F2937", borderRadius: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#F3F4F6", marginBottom: 4 }}>
        <Database size={12} style={{ display: "inline", marginRight: 6, color: "#60A5FA" }} />
        {entry.title ?? entry.datasetId}
      </div>
      {entry.summary && (
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 1.5 }}>{entry.summary}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
        {entry.providerAgency && (
          <>
            <span style={{ color: "#6B7280" }}><Building2 size={11} style={{ display: "inline" }} /> 機關</span>
            <span style={{ color: "#D1D5DB" }}>{entry.providerAgency}</span>
          </>
        )}
        {entry.lifecycle && (
          <>
            <span style={{ color: "#6B7280" }}><Clock size={11} style={{ display: "inline" }} /> 頻率</span>
            <span style={{ color: "#D1D5DB" }}>{LIFECYCLE_LABEL[entry.lifecycle] ?? entry.lifecycle}
              {entry.updateFrequency && ` · ${entry.updateFrequency}`}
            </span>
          </>
        )}
        {entry.license && (
          <>
            <span style={{ color: "#6B7280" }}>授權</span>
            <span style={{ color: "#D1D5DB" }}>{entry.license}</span>
          </>
        )}
        {entry.lastUpdated && (
          <>
            <span style={{ color: "#6B7280" }}>更新</span>
            <span style={{ color: "#D1D5DB" }}>{entry.lastUpdated}</span>
          </>
        )}
        {entry.sourceUrl && (
          <>
            <span style={{ color: "#6B7280" }}><ExternalLink size={11} style={{ display: "inline" }} /> API</span>
            <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#60A5FA", wordBreak: "break-all" }}>
              {entry.sourceUrl}
            </a>
          </>
        )}
        {entry.catalogMdPath && (
          <>
            <span style={{ color: "#6B7280" }}><FileText size={11} style={{ display: "inline" }} /> 文件</span>
            <span style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace" }}>{entry.catalogMdPath}</span>
          </>
        )}
      </div>
    </div>
  );
}
