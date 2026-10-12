// Legend sub-components (legendShared) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { rampLegendGradient } from "../../map/mapStyleScale";
import { paletteById, paletteRamp } from "../../map/palettes";
import { useHeatmapLegendPalettes } from "../../state/layerPalette";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { LegendNote, LegendRow, LegendTitle, SwatchArrow, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { FONT_SIZE } from "../../styles/designTokens";
import { FLAT_ARROW_MIN_ZOOM } from "../../map/flatMovingLayers";
import { useLocale } from "../../state/localeStore";
import { paletteName } from "../../i18n/paramText";
import { localizeLayerName } from "../../i18n/layerText";

/** R6 段 3：移動物件平面模式的箭頭說明（LG-6，與地圖同形狀）。 */
export function FlatArrowRow() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div style={{ marginTop: 4 }}>
      <LegendRow swatch={<SwatchArrow color={t.textMuted} />}>{i18n.t("legend.common.flatArrow", { zoom: FLAT_ARROW_MIN_ZOOM })}</LegendRow>
    </div>
  );
}

// ── 消防圖例（火災 / 分隊 / 消防栓）──

export function FireCatRows({ cats, square, line, stroke }: { cats: { color: string; label: string }[]; square?: boolean; line?: boolean; stroke?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {cats.map((c) => (
        <LegendRow key={c.label} swatch={line ? <SwatchLine color={c.color} /> : square ? <SwatchSquare color={c.color} stroke={stroke} /> : <SwatchDot color={c.color} />}>{c.label}</LegendRow>
      ))}
    </div>
  );
}

// 都市開放空間三層共用：一列圓點色塊 + 標籤（色票 SSOT = src/data/urbanOpenSpaceTypes.ts）
export function UrbanDotRow({ color, label, square = false }: { color: string; label: string; square?: boolean }) {
  return <LegendRow swatch={square ? <SwatchSquare color={color} /> : <SwatchDot color={color} />}>{label}</LegendRow>;
}

/**
 * LG-8：密集點拉遠改畫熱區（R5 P-4／G-2）。顏色跟地圖讀同一個解析器（R7 色盤選單＋底圖）；
 * 一個圖例管多層時，只列開著的層，各層色盤不同就各畫一條並標層名。
 */
export function DenseHeatmapLegendRow({ layers }: { layers: readonly string[] }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const entries = useHeatmapLegendPalettes(layers);
  const distinct = [...new Set(entries.map((e) => e.paletteId))];
  return (
    <div style={{ marginTop: 6 }}>
      {distinct.length === 1
        ? <SwatchGradient gradient={rampLegendGradient(paletteRamp(distinct[0]!, t.isDark)!)} labels={[i18n.t("legend.common.low"), i18n.t("legend.common.high")]} />
        : entries.map((e) => (
          <div key={e.key} style={{ marginBottom: 2 }}>
            <LegendNote>{legendLayerName(e.key, i18n)}・{paletteName(e.paletteId, paletteById(e.paletteId)?.zh ?? "", i18n)}</LegendNote>
            <SwatchGradient gradient={rampLegendGradient(paletteRamp(e.paletteId, t.isDark)!)} labels={[i18n.t("legend.common.low"), i18n.t("legend.common.high")]} />
          </div>
        ))}
      <LegendNote style={{ marginTop: 2 }}>{i18n.t("legend.common.densityZoomOut")}</LegendNote>
    </div>
  );
}

/** 圖例裡標層名用：manifest 名稱去掉英文副名 */
function legendLayerName(key: string, i18n: ReturnType<typeof useLocale>): string {
  const entry = (LAYER_MANIFEST as Record<string, { label?: string; name?: LayerName }>)[key];
  if (i18n.active !== "zh-TW" && entry?.name) return localizeLayerName(key, entry.name, i18n).primary;
  const label = entry?.label ?? key;
  return label.replace(/\s+[A-Za-z(（].*$/u, "");
}

/** 單色密集點（原本無圖例）：R5 拉遠改畫熱區後需要說明熱區色階，點本身仍單色。 */
export function DenseSingleColorLegend({ layer, label, color }: { layer: string; label: string; color: string }) {
  const t = useLegendTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><SwatchDot color={color} />{label}</div>
      <DenseHeatmapLegendRow layers={[layer]} />
    </div>
  );
}

// ── ⚰️ Funeral Legend ──
//
// 🔴 三源分開的視覺約定，圖例必須把差異講清楚：
//    B（OSM 墓區，綠）= 實際使用範圍；C（都計用地，暖棕）= 法定劃設。同時開啟時色系不同。
// 🔴 cemeteryOsm 是 ODbL → 開啟時一定要出現 © OpenStreetMap contributors。

export function Swatch({ color, round, stroke }: { color: string; round: boolean; stroke?: string }) {
  return round ? <SwatchDot color={color} /> : <SwatchSquare color={color} stroke={stroke} />;
}

// ── 全球氣候場 Legends（色階與 climateRamps.ts 共用，改色兩邊同步）──

export function ClimateGradientBar({ gradient, labels }: { gradient: string; labels: string[] }) {
  return <SwatchGradient gradient={gradient} labels={labels} />;
}

// ── 噪音／聲響六圖層 ──────────────────────────────────────────────

export function NoiseLegendTitle({ children }: { children: React.ReactNode }) {
  return <LegendTitle zh={children} />;
}

export function NoiseLegendRows({ rows, outline = false, dot = false }: {
  rows: readonly { label: string; color: string }[];
  outline?: boolean;
  dot?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {rows.map((row) => (
        <LegendRow key={row.label} swatch={dot ? <SwatchDot color={row.color} /> : <SwatchSquare color={row.color} outline={outline} />}>{row.label}</LegendRow>
      ))}
    </div>
  );
}

export function NoiseLegendNote({ children, source }: { children: React.ReactNode; source?: string }) {
  const i18n = useLocale();
  return (
    <>
      <LegendNote style={{ marginTop: 5, lineHeight: 1.45 }}>{children}</LegendNote>
      {source && <LegendNote style={{ lineHeight: 1.35 }}>{i18n.t("legend.common.sourceLicense", { source })}</LegendNote>}
    </>
  );
}
