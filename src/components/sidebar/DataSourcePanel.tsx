/**
 * DataSourcePanel — 左側 rail「資料來源」面板（D1：列內展開）
 *
 * 取代舊 DataSourceBrowser（右下浮動 ⓘ → 右側抽屜）+ DataSourceModal（置中彈窗）。
 * 資料載入邏輯（dataCatalogLoader / useDataCatalogForLayer / UPSTREAM_REGISTRY /
 * searchLayers / statisticsDataSources / lockedKeys 鎖頭）全部保留，只換外殼與互動：
 * 面板嵌在 IconRailSidebar 的浮動面板區，點列在列下方展開上游資料卡（同時只展開一筆）。
 *
 * 規格依據：docs/features/ui-consistency-audit-20260927/ui-controls-sheet.html §4 D1。
 */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, Lock } from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { LayerNameLine, ListRow } from "./LayerRow";
import { SubGroupLabel } from "./ThemeBanner";
import { LAYER_ICONS } from "./layerIcons";
import { railPalette, RailThemeContext } from "./railTheme";
import { THEMES, LAYER_COLORS, layerDisplayName, themeName } from "./layerCatalog";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets, type UpstreamStatus } from "../../data/upstreamRegistry";
import { useDataCatalogForLayer } from "../../hooks/useDataCatalog";
import { searchLayers } from "../../lib/layerSearch";
import { getStatisticsDataSourceDefinition, isDataSourceBrowserVisible, statisticsIndicatorLabel, statisticsSourceLevelLabel } from "../../data/statisticsDataSources";
import { isStatisticsRenderLayer, statisticsReleaseFallback, statisticsRenderRecipe } from "../../data/regionalStatisticsRecipes";
import { loadRegionalStatisticsValues, type StatisticsSource } from "../../data/regionalStatisticsLoader";
import { COLORS, BORDER, CONTROL, LIGHT, FONT_CJK, FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { LayerVisibility } from "../../types";

function comparisonInputUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

// ── Palette（暗／淡；token 取自 designTokens.ts，與 ui-controls-sheet.html §4 .t-dark／.t-light 同值）──

interface DsPalette {
  text: string; textDefault: string; muted: string; dim: string;
  border: string; borderMid: string;
  controlBg: string; controlBgHover: string; controlBorder: string;
  accent: string; accentFaint: string;
  statusLive: string; statusWarn: string; statusDerived: string;
  link: string;
}

const DARK_DS: DsPalette = {
  text: COLORS.textStrong, textDefault: COLORS.textDefault, muted: COLORS.textMuted, dim: COLORS.textDim,
  border: BORDER.panel, borderMid: BORDER.mid,
  controlBg: CONTROL.bg, controlBgHover: CONTROL.bgHover, controlBorder: CONTROL.border,
  accent: COLORS.accent, accentFaint: COLORS.accentFaint,
  statusLive: COLORS.statusLive, statusWarn: COLORS.statusWarn, statusDerived: COLORS.statusDerived,
  link: COLORS.link,
};

const LIGHT_DS: DsPalette = {
  text: LIGHT.textStrong, textDefault: LIGHT.textDefault, muted: LIGHT.textMuted, dim: LIGHT.textDim,
  border: LIGHT.border, borderMid: LIGHT.borderMid,
  controlBg: LIGHT.controlBg, controlBgHover: LIGHT.controlBgHover, controlBorder: LIGHT.controlBorder,
  accent: LIGHT.accent, accentFaint: LIGHT.accentFaint,
  statusLive: LIGHT.statusLive, statusWarn: LIGHT.statusWarn, statusDerived: COLORS.statusDerived,
  link: LIGHT.link,
};

type StatusFilter = "all" | UpstreamStatus;

const STATUS_ICON: Record<UpstreamStatus, string> = { verified: "✓", pulse_only: "⚙", catalog_missing: "?" };
const STATUS_TITLE: Record<UpstreamStatus, string> = { verified: "已接上", pulse_only: "派生", catalog_missing: "待補" };
const LIFECYCLE_LABEL: Record<string, string> = {
  realtime: "即時（分鐘級）", daily: "每日", weekly: "每週", monthly: "每月",
  quarterly: "每季", yearly: "每年", static: "一次性 / 靜態", semi_annual: "每半年",
  planned: "規劃中", deprecated: "已停用",
};

const CONFIDENCE_LABEL: Record<string, string> = { HIGH: "高", MED: "中", LOW: "低" };

function statusOf(key: string): UpstreamStatus {
  return UPSTREAM_REGISTRY[key as keyof LayerVisibility]?.status ?? "catalog_missing";
}

type Fact = { k: string; v: ReactNode; mono?: boolean };
/** 過濾掉不成立的事實列，統一 facts 陣列型別（否則各分支的字面量型別互不相容）。 */
function facts(...items: (Fact | null)[]): Fact[] {
  return items.filter((f): f is Fact => f !== null);
}

function statusColor(p: DsPalette, status: UpstreamStatus): string {
  return status === "verified" ? p.statusLive : status === "pulse_only" ? p.statusDerived : p.statusWarn;
}

// ── Fact row（B 版：標籤 10px muted 寬 44、值 strong）──

function FactRow({ p, k, children, mono }: { p: DsPalette; k: string; children: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: 10.5, lineHeight: 1.3, borderBottom: `1px solid ${p.border}` }}>
      <span style={{ width: 44, flexShrink: 0, fontSize: FONT_SIZE.sm, color: p.muted, fontFamily: FONT_CJK }}>{k}</span>
      <span style={{ color: p.text, wordBreak: "break-all", fontFamily: mono ? FONT_DATA : FONT_CJK, fontSize: mono ? FONT_SIZE.sm : FONT_SIZE.base }}>{children}</span>
    </div>
  );
}

function c2Style(p: DsPalette, primary: boolean, disabled?: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 9px",
    borderRadius: RADIUS.md, border: `1px solid ${primary ? p.accent : p.controlBorder}`,
    background: primary ? p.accentFaint : p.controlBg,
    color: primary ? p.accent : p.text,
    fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: primary ? 600 : 500,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? CONTROL.disabledOpacity : 1,
    whiteSpace: "nowrap",
  };
}

// ── 上游資料卡（列內展開）──

interface SourceBlock { title: string | null; desc?: string | null; facts: { k: string; v: ReactNode; mono?: boolean }[]; docPath?: string | null }

/** 資料來源暗／淡色票；圖層展開區的「說明・來源」也用這一份。 */
export const dataSourcePalette = (isDarkTheme: boolean): DsPalette => (isDarkTheme ? DARK_DS : LIGHT_DS);

/**
 * 上游資料卡。資料來源面板列內展開，也嵌在圖層展開區最後一行「說明・來源」裡
 * （layer-panel-unify P1；那裡圖層已開著，`hideActivate` 藏掉「開啟圖層」鈕）。
 */
export function DataSourceCard({
  p, layerKey, locked, onActivateLayer, hideActivate = false,
}: { p: DsPalette; layerKey: keyof LayerVisibility; locked: boolean; onActivateLayer?: (key: keyof LayerVisibility) => void; hideActivate?: boolean }) {
  const { data: entries, loading, error } = useDataCatalogForLayer(layerKey);
  const ref = UPSTREAM_REGISTRY[layerKey];
  const status: UpstreamStatus = ref?.status ?? "catalog_missing";
  const statisticsSource = getStatisticsDataSourceDefinition(layerKey);
  const upstreamIds = useMemo(() => resolveUpstreamDatasets(layerKey), [layerKey]);

  // 統計圖層的「已發布來源紀錄」（release 期間＋derivation 公式／上游 input_sources）。
  // 與舊 DataSourceModal 的 ArtifactSourceCard 同一條資料路徑，只換外殼。
  const [artifactSource, setArtifactSource] = useState<StatisticsSource | null>(null);
  const [artifactRelease, setArtifactRelease] = useState<{ period_start: string; period_end: string } | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStatisticsRenderLayer(layerKey)) {
      setArtifactSource(null); setArtifactRelease(null); setArtifactError(null);
      return;
    }
    const recipe = statisticsRenderRecipe(layerKey);
    const releaseFallback = statisticsReleaseFallback(layerKey);
    const controller = new AbortController();
    setArtifactSource(null); setArtifactRelease(null); setArtifactError(null); setArtifactLoading(true);
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
      .then((result) => { if (!controller.signal.aborted) { setArtifactSource(result.sources); setArtifactRelease(result.values.release); } })
      .catch((e) => { if (!controller.signal.aborted) setArtifactError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!controller.signal.aborted) setArtifactLoading(false); });
    return () => controller.abort();
  }, [layerKey]);

  const statisticsBlock: SourceBlock | null = useMemo(() => {
    if (!statisticsSource) return null;
    const kindLabel = statisticsSource.kind === "derived" ? "派生統計" : statisticsSource.kind === "presentation" ? "固定學制統計入口" : "原始統計";
    const derivation = artifactSource?.derivation as Record<string, unknown> | undefined;
    const inputs = Array.isArray(derivation?.input_sources)
      ? derivation.input_sources.filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v)))
      : [];
    // 原始統計（無 derivation）的已發布來源紀錄：機關／授權／來源頁，沿用舊 DataSourceModal 的 SourceRecord。
    const recordUrl = artifactSource && !derivation ? comparisonInputUrl(artifactSource.source_landing_url ?? artifactSource.source_url) : undefined;
    const recordPublisher = artifactSource && !derivation && typeof artifactSource.publisher === "string" ? artifactSource.publisher : null;
    const recordLicense = artifactSource && !derivation && typeof artifactSource.license === "string" ? artifactSource.license : null;
    return {
      title: `${kindLabel} · ${statisticsSource.label}`,
      desc: [statisticsSource.metricLabel, statisticsSource.contract, statisticsSource.disclosure].filter(Boolean).join(" — "),
      facts: facts(
        statisticsSource.provider ? { k: "機關", v: statisticsSource.provider } : null,
        { k: "頻率", v: statisticsSource.period },
        statisticsSource.license ? { k: "授權", v: statisticsSource.license } : null,
        { k: "單位", v: `${statisticsSource.unit} · ${statisticsSourceLevelLabel(statisticsSource.level)}` },
        statisticsSource.datasetIds.length ? { k: "資料集", v: statisticsSource.datasetIds.join(", "), mono: true } : null,
        statisticsSource.sourceUrl ? { k: "API", v: <a href={statisticsSource.sourceUrl} target="_blank" rel="noreferrer" style={{ color: p.link, wordBreak: "break-all" }}>{statisticsSource.sourceUrl}</a> } : null,
        artifactLoading ? { k: "來源", v: "讀取已發布的來源紀錄…" } : null,
        artifactError ? { k: "來源", v: `未載入：${artifactError}` } : null,
        artifactRelease ? { k: "期間", v: `${artifactRelease.period_start} 至 ${artifactRelease.period_end}`, mono: true } : null,
        derivation && typeof derivation.formula === "string" ? { k: "公式", v: derivation.formula.replace(/\bnumerator\b/g, "分子").replace(/\bdenominator\b/g, "分母") } : null,
        derivation && (typeof derivation.numerator_indicator === "string" || typeof derivation.denominator_indicator === "string")
          ? { k: "分子分母", v: `分子：${statisticsIndicatorLabel(derivation.numerator_indicator, statisticsSource.level)} · 分母：${statisticsIndicatorLabel(derivation.denominator_indicator, statisticsSource.level)}` }
          : null,
        recordPublisher ? { k: "發布機關", v: recordPublisher } : null,
        recordLicense ? { k: "發布授權", v: recordLicense } : null,
        recordUrl ? { k: "發布來源", v: <a href={recordUrl} target="_blank" rel="noreferrer" style={{ color: p.link, wordBreak: "break-all" }}>{recordUrl}</a> } : null,
        inputs.length ? {
          k: "上游", v: (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {inputs.map((input, idx) => {
                const url = comparisonInputUrl(input.source_landing_url);
                return (
                  <div key={`${String(input.dataset_id ?? input.source_dataset_id ?? idx)}-${idx}`} style={{ paddingTop: idx ? 4 : 0, borderTop: idx ? `1px solid ${p.border}` : undefined }}>
                    <div>{String(input.publisher ?? "未標示提供機關")} · {String(input.dataset_id ?? input.source_dataset_id ?? "未標示 dataset")}</div>
                    <div style={{ color: p.muted, marginTop: 2 }}>
                      期別：{typeof input.period_start === "string" && typeof input.period_end === "string" ? `${input.period_start} 至 ${input.period_end}` : String(input.period ?? input.period_label ?? "未標示")} · 授權：{String(input.license ?? "未標示")}
                    </div>
                    {url && <a href={url} target="_blank" rel="noreferrer" style={{ color: p.link, wordBreak: "break-all" }}>{url}</a>}
                  </div>
                );
              })}
            </div>
          ),
        } : null,
      ),
      docPath: null,
    };
  }, [statisticsSource, artifactSource, artifactRelease, artifactLoading, artifactError, p]);

  const baseBlocks: SourceBlock[] = useMemo(() => {
    const lineageBlock: SourceBlock = {
      title: "派生分析",
      desc: ref?.processing ?? null,
      facts: facts(
        { k: "類型", v: ref?.derivationType ?? "custom" },
        ref?.derivedFromLayers?.length ? { k: "派生自", v: ref.derivedFromLayers.join("、") } : null,
        upstreamIds.length ? { k: "上游", v: upstreamIds.join("、") } : null,
      ),
      docPath: null,
    };
    if (entries.length > 0) {
      const entryBlocks: SourceBlock[] = entries.map((e) => ({
        title: e.title ?? "上游資料集",
        desc: e.summary,
        facts: facts(
          e.title ? null : { k: "資料集", v: e.datasetId, mono: true },
          e.providerAgency ? { k: "機關", v: e.providerAgency } : null,
          e.lifecycle ? { k: "頻率", v: `${LIFECYCLE_LABEL[e.lifecycle] ?? e.lifecycle}${e.updateFrequency ? ` · ${e.updateFrequency}` : ""}` } : null,
          e.license ? { k: "授權", v: e.license } : null,
          e.lastUpdated ? { k: "更新", v: e.lastUpdated, mono: true } : null,
          e.sourceUrl ? { k: "API", v: <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ color: p.link, wordBreak: "break-all" }}>{e.sourceUrl}</a> } : null,
        ),
        docPath: e.catalogMdPath,
      }));
      // 派生圖層即使 catalog 有條目，也要保留派生脈絡（舊 modal 兩者並列）。
      return status === "pulse_only" && (ref?.derivedFromLayers || ref?.derivedFromDatasets) ? [lineageBlock, ...entryBlocks] : entryBlocks;
    }
    if (status === "verified") {
      // 卡片標題不印資料集代號（spec §6.3）；代號改放「資料集」事實列，與統計來源卡同一寫法。
      return ref.datasets.map((d) => ({ title: "已比對的上游資料集", desc: `比對信心：${CONFIDENCE_LABEL[d.confidence] ?? d.confidence}`, facts: facts({ k: "資料集", v: d.datasetId, mono: true }), docPath: null }));
    }
    if (status === "pulse_only") return [lineageBlock];
    if (statisticsSource) return [];
    return [{ title: null, desc: "此圖層尚無對應 catalog 條目。", facts: facts(), docPath: null }];
  }, [entries, status, ref, upstreamIds, statisticsSource, p]);

  const blocks: SourceBlock[] = statisticsBlock ? [statisticsBlock, ...baseBlocks] : baseBlocks;

  // 統計來源描述的是同一批上游資料集，不另加 1；只有沒有其他上游紀錄時才以其 datasetIds 計數。
  const upstreamCount = (entries.length > 0 ? entries.length
    : status === "verified" ? ref.datasets.length
    : status === "pulse_only" ? Math.max(upstreamIds.length, 1)
    : 0) || (statisticsSource?.datasetIds.length ?? 0);
  const docPath = blocks.find((b) => b.docPath)?.docPath ?? null;

  return (
    <div style={{ margin: "2px 4px 6px 14px", padding: "6px 0 6px 10px", borderLeft: `1px solid ${p.borderMid}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: FONT_SIZE.base, fontFamily: FONT_CJK }}>
        <span style={{ fontWeight: 700, color: statusColor(p, status) }}>{STATUS_ICON[status]} {STATUS_TITLE[status]}</span>
        {upstreamCount > 0 && <span style={{ color: p.dim, fontSize: FONT_SIZE.sm }}>· {upstreamCount} 個上游資料集</span>}
      </div>
      {loading && <div style={{ color: p.dim, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}>載入中…</div>}
      {error && <div style={{ color: p.statusWarn, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK }}>⚠ 來源紀錄未載入（{error}）— 顯示 static bridge 內容。</div>}
      {blocks.map((block, i) => (
        <div key={`${block.title ?? "x"}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {block.title && <div style={{ fontSize: FONT_SIZE.md, fontWeight: 700, color: p.text, fontFamily: FONT_CJK }}>{block.title}</div>}
          {block.desc && <div style={{ fontSize: 10.5, color: p.muted, lineHeight: 1.5, fontFamily: FONT_CJK }}>{block.desc}</div>}
          {block.facts.map((f) => <FactRow key={f.k} p={p} k={f.k} mono={f.mono}>{f.v}</FactRow>)}
        </div>
      ))}
      {(!hideActivate || docPath) && <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        {!hideActivate && <button
          type="button"
          disabled={locked}
          onClick={() => { if (!locked) onActivateLayer?.(layerKey); }}
          title={locked ? "此圖層需要授權" : "開啟圖層"}
          style={c2Style(p, true, locked)}
        >
          {locked && <Lock size={11} />}開啟圖層
        </button>}
        {docPath && (
          <button
            type="button"
            disabled
            title={docPath}
            style={{ ...c2Style(p, false, true), fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, height: "auto", minHeight: 22, whiteSpace: "normal", wordBreak: "break-all", textAlign: "left", flex: 1, minWidth: 0 }}
          >
            {docPath}
          </button>
        )}
      </div>}
    </div>
  );
}

// ── 主題 / 群組標題 ──

function ThemeHeader({ p, title }: { p: DsPalette; title: string }) {
  const { zh, sub } = themeName(title);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px 0", fontSize: FONT_SIZE.base, fontWeight: 600, color: p.text, fontFamily: FONT_CJK }}>
      <span>{zh}</span>
      {sub && <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: p.dim, letterSpacing: 0.8 }}>{sub}</span>}
    </div>
  );
}

// ── 圖層列（layer-panel-unify P8：共用 ListRow；沒有開關，狀態圖示放在開關那一格）──

function Row({
  p, layerKeyLabel, layerKey, locked, expanded, onToggle,
}: { p: DsPalette; layerKeyLabel: string; layerKey: keyof LayerVisibility; locked: boolean; expanded: boolean; onToggle: () => void }) {
  const color = LAYER_COLORS[layerKey] ?? p.dim;
  const status = statusOf(layerKey);
  const Icon = LAYER_ICONS[layerKey];
  return (
    <ListRow
      ariaLabel={layerKeyLabel}
      label={<LayerNameLine name={layerDisplayName(layerKey, layerKeyLabel)} />}
      icon={Icon ? <Icon size={14} color={color} style={{ flexShrink: 0 }} /> : null}
      expandable
      expanded={expanded}
      onClick={onToggle}
      trailing={<>
        {locked && <Lock size={11} color={p.dim} style={{ flexShrink: 0, marginRight: 4 }} aria-label="受限" />}
        <span title={STATUS_TITLE[status]} aria-label={STATUS_TITLE[status]} style={{ width: 16, paddingRight: 12, textAlign: "center", fontSize: FONT_SIZE.sm, fontWeight: 700, color: statusColor(p, status) }}>{STATUS_ICON[status]}</span>
      </>}
    />
  );
}

// ── 主面板 ──

interface DataSourcePanelProps {
  isDarkTheme?: boolean;
  onClose: () => void;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  onActivateLayer?: (key: keyof LayerVisibility) => void;
}

export function DataSourcePanel({ isDarkTheme = true, onClose, lockedKeys, onActivateLayer }: DataSourcePanelProps) {
  const p = isDarkTheme ? DARK_DS : LIGHT_DS;
  const rail = railPalette(isDarkTheme);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedKey, setExpandedKey] = useState<keyof LayerVisibility | null>(null);

  const toggleExpand = (key: keyof LayerVisibility) => setExpandedKey((cur) => (cur === key ? null : key));

  const totals = useMemo(() => {
    let v = 0, po = 0, cm = 0;
    for (const key of Object.keys(UPSTREAM_REGISTRY)) {
      if (!isDataSourceBrowserVisible(key)) continue;
      const s = statusOf(key);
      if (s === "verified") v++; else if (s === "pulse_only") po++; else cm++;
    }
    return { all: v + po + cm, verified: v, pulse_only: po, catalog_missing: cm } as Record<StatusFilter, number>;
  }, []);

  const q = search.trim().toLowerCase();
  const matchesFilter = (key: string) => statusFilter === "all" || statusOf(key) === statusFilter;

  const themedLayers = useMemo(() => {
    const out: { theme: string; groups: { title: string; layers: { key: keyof LayerVisibility; label: string }[] }[] }[] = [];
    for (const theme of THEMES) {
      const groups: { title: string; layers: { key: keyof LayerVisibility; label: string }[] }[] = [];
      for (const g of theme.groups) {
        const layers = g.layers
          .filter((l) => isDataSourceBrowserVisible(l.key))
          .filter((l) => matchesFilter(l.key))
          .filter((l) => !q || l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q))
          .map((l) => ({ key: l.key, label: l.label }));
        if (layers.length > 0) groups.push({ title: g.title, layers });
      }
      if (groups.length > 0) out.push({ theme: theme.title, groups });
    }
    return out;
  }, [q, statusFilter]);

  const searchResults = useMemo(
    () => (q ? searchLayers(search, { lockedKeys }).filter((r) => isDataSourceBrowserVisible(r.key) && matchesFilter(r.key)) : []),
    [q, search, lockedKeys, statusFilter],
  );
  const visibleSearchResults = searchResults.slice(0, 50);

  const segments: { id: StatusFilter; label: string; title: string }[] = [
    { id: "all", label: "全部", title: "全部圖層" },
    { id: "verified", label: STATUS_ICON.verified, title: "已接上" },
    { id: "pulse_only", label: STATUS_ICON.pulse_only, title: "派生" },
    { id: "catalog_missing", label: STATUS_ICON.catalog_missing, title: "待補" },
  ];

  return (
    <RailThemeContext.Provider value={rail}>
      <PanelHeader title="資料來源" eyebrow="資料" onClose={onClose} borderColor={p.border} mutedColor={p.dim} textColor={p.text} />

      {/* 搜尋框：高 26、--control-* */}
      <div style={{ padding: "8px 12px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 8px", borderRadius: RADIUS.md, border: `1px solid ${p.controlBorder}`, background: p.controlBg }}>
          <Search size={12} color={p.dim} style={{ flexShrink: 0 }} />
          <input
            type="text"
            aria-label="搜尋圖層名稱"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋圖層名稱"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: p.text, fontSize: FONT_SIZE.base, fontFamily: FONT_CJK }}
          />
        </div>
      </div>

      {/* 可點篩選分段 */}
      <div style={{ padding: "0 12px 6px" }}>
        <div style={{ display: "flex", height: 24, borderRadius: RADIUS.md, border: `1px solid ${p.controlBorder}`, background: p.controlBg, padding: 2, gap: 2 }}>
          {segments.map((seg) => {
            const on = statusFilter === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => setStatusFilter(seg.id)}
                title={seg.title}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  border: "none", borderRadius: RADIUS.sm, cursor: "pointer",
                  background: on ? p.accentFaint : "transparent",
                  color: on ? p.accent : (seg.id === "all" ? p.muted : statusColor(p, seg.id as UpstreamStatus)),
                  fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: on ? 600 : 500,
                }}
              >
                <span>{seg.label}</span>
                <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, opacity: 0.85 }}>{totals[seg.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="layer-sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>
        {q ? (
          searchResults.length === 0 ? (
            <div style={{ padding: 12, color: p.dim, fontSize: FONT_SIZE.base, fontFamily: FONT_CJK }}>找不到相符圖層</div>
          ) : (
            <>
              <div aria-live="polite" style={{ padding: "4px 12px", color: p.dim, fontSize: FONT_SIZE.xs, fontFamily: FONT_CJK }}>
                找到 {searchResults.length} 筆{searchResults.length > visibleSearchResults.length ? `，顯示前 ${visibleSearchResults.length} 筆` : ""}
              </div>
              {visibleSearchResults.map((r) => (
                <Fragment key={r.key}>
                  <Row p={p} layerKeyLabel={r.label} layerKey={r.key} locked={!!lockedKeys?.has(r.key)} expanded={expandedKey === r.key} onToggle={() => toggleExpand(r.key)} />
                  {expandedKey === r.key && <DataSourceCard p={p} layerKey={r.key} locked={!!lockedKeys?.has(r.key)} onActivateLayer={onActivateLayer} />}
                </Fragment>
              ))}
            </>
          )
        ) : (
          themedLayers.map((t) => (
            <div key={t.theme}>
              <ThemeHeader p={p} title={t.theme} />
              {t.groups.map((g) => (
                <div key={g.title}>
                  <SubGroupLabel>{g.title}</SubGroupLabel>
                  {g.layers.map((l) => (
                    <Fragment key={l.key}>
                      <Row p={p} layerKeyLabel={l.label} layerKey={l.key} locked={!!lockedKeys?.has(l.key)} expanded={expandedKey === l.key} onToggle={() => toggleExpand(l.key)} />
                      {expandedKey === l.key && <DataSourceCard p={p} layerKey={l.key} locked={!!lockedKeys?.has(l.key)} onActivateLayer={onActivateLayer} />}
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </RailThemeContext.Provider>
  );
}
