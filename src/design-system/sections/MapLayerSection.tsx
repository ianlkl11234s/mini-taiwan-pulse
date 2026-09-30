/**
 * §10 地圖圖層樣式（docs/design-system/map-layers.md §3）。
 * 所有尺寸／透明度／顏色從 src/map/mapStyleScale.ts、pointSpec.ts、pointTiers.ts 匯入，以 1:1 px 畫在 SVG／canvas 上；
 * 另附 4× 放大版方便看細節。底色是地圖替身色，不是 Mapbox 底圖。
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { COLORS, FONT_SIZE, LIGHT } from "../../styles/designTokens";
import {
  BOUNDARY_GRAY, FILL_OPACITY, FILL_OUTLINE, GRADED_SEAM, HEATMAP, LABEL, LINE_DASH, LINE_OPACITY, LINE_WIDTH, MAP_LOCAL_IDEOGRAPH_FONT, MAP_SEAM,
  MISSING_HATCH, POINT_ICON_PX, POINT_OPACITY, POINT_RADIUS, POINT_STROKE, hatchImageData, type HatchKind,
} from "../../map/mapStyleScale";
import { DECORATION_SUFFIX_RE, LIVE_DECORATION_CAP, LIVE_DECORATION_LAYERS } from "../../map/pointSpec";
import { HOOK_POINT_TIERS, POINT_TIERS } from "../../map/pointTiers";
import { FILL_TIERS, LINE_TIERS } from "../../map/lineFillTiers";
import { Kv, Pair, Section, Spec, Sub, Tag, mockMapBg, objRows, SPEC_MAP, type SectionDef } from "../kit";

const theme = (isDark: boolean) => (isDark ? "dark" : "light") as "dark" | "light";
/** 示意用的資料色（不是任何圖層的真色） */
const SAMPLE = { point: "#4fc3f7", line: "#4fc3f7", fill: "#3b82f6", fire: "#f4511e" } as const;
/** 文件值：viz-library M3 泡泡 rMin／rMax（程式未匯出常數） */
const BUBBLE_DOC = { rMin: 4, rMax: 28 } as const;
/** 文件值：資料編碼描邊（useTyphoonTracksLayer／useFireEventsLayer 內部常數，未匯出） */
const TYPHOON_DOC = { forecast: "#38bdf8", observed: "#a855f7", forecastStrokeWidth: 1.5 } as const;
const CASUALTY_DOC = { dark: "#ffffff", light: "#111827" } as const;

const textColor = (isDark: boolean) => (isDark ? COLORS.textMuted : LIGHT.textMuted);

/** 1× 與 4× 兩份同一組幾何 */
function Zoomed({ w, h, isDark, children, zoom = 4 }: { w: number; h: number; isDark: boolean; children: ReactNode; zoom?: number }) {
  return (
    <div className="ds-row" style={{ alignItems: "flex-end" }}>
      <figure style={{ margin: 0 }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: mockMapBg(isDark), display: "block", borderRadius: 4 }}>{children}</svg>
        <figcaption style={{ fontSize: FONT_SIZE.xs, color: textColor(isDark) }}>1:1</figcaption>
      </figure>
      <figure style={{ margin: 0, maxWidth: "100%", overflowX: "auto" }}>
        <svg width={w * zoom} height={h * zoom} viewBox={`0 0 ${w} ${h}`} style={{ background: mockMapBg(isDark), display: "block", borderRadius: 4 }} shapeRendering="geometricPrecision">{children}</svg>
        <figcaption style={{ fontSize: FONT_SIZE.xs, color: textColor(isDark) }}>{zoom}× 放大</figcaption>
      </figure>
    </div>
  );
}

/** Mapbox circle：填色在半徑內，描邊畫在半徑外側（circle-stroke 不吃進半徑）。 */
function MapCircle({ cx, cy, r, fill, fillOpacity = POINT_OPACITY.base, stroke, strokeWidth = POINT_STROKE.width, strokeOpacity }: {
  cx: number; cy: number; r: number; fill: string; fillOpacity?: number; stroke: string; strokeWidth?: number; strokeOpacity: number;
}) {
  return <>
    <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={fillOpacity} />
    <circle cx={cx} cy={cy} r={r + strokeWidth / 2} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />
  </>;
}

function PointTiersDemo({ isDark }: { isDark: boolean }) {
  const t = theme(isDark);
  const tiers = Object.entries(POINT_RADIUS) as [keyof typeof POINT_RADIUS, number][];
  const values = [10, 100, 1000];
  const maxV = Math.max(...values);
  const bubbleR = (v: number) => BUBBLE_DOC.rMin + (BUBBLE_DOC.rMax - BUBBLE_DOC.rMin) * Math.sqrt(v / maxV);
  return <>
    <Sub title="點三階 S／M／L＋icon" kind="real">
      <Zoomed w={150} h={40} isDark={isDark}>
        {tiers.map(([k, r], i) => (
          <MapCircle key={k} cx={20 + i * 30} cy={20} r={r} fill={SAMPLE.point} stroke={MAP_SEAM[t]} strokeOpacity={POINT_STROKE.opacity[t]} />
        ))}
        {(Object.entries(POINT_ICON_PX) as [string, number][]).map(([k, s], i) => (
          <rect key={k} x={110 + i * 20 - s / 2} y={20 - s / 2} width={s} height={s} fill={SAMPLE.point} fillOpacity={POINT_OPACITY.base} transform={`rotate(45 ${110 + i * 20} 20)`} />
        ))}
      </Zoomed>
      <Kv rows={[
        ...objRows("POINT_RADIUS", POINT_RADIUS).map(([k, v]) => [k, `${String(v)}px（直徑 ${Number(v) * 2}）`] as [string, string]),
        ...objRows("POINT_ICON_PX", POINT_ICON_PX),
        [`描邊色 MAP_SEAM.${t}`, MAP_SEAM[t]],
        ["描邊寬 POINT_STROKE.width", `${POINT_STROKE.width}px（畫在半徑外側）`],
        [`描邊透明度 POINT_STROKE.opacity.${t}`, POINT_STROKE.opacity[t]],
        ...objRows("POINT_OPACITY", POINT_OPACITY),
      ]} />
    </Sub>
    <Sub title="B 階（泡泡，依資料）" kind="real">
      <Zoomed w={160} h={64} isDark={isDark} zoom={2}>
        {values.map((v, i) => {
          const r = bubbleR(v);
          return <MapCircle key={v} cx={[16, 50, 118][i]!} cy={32} r={r} fill={SAMPLE.point} fillOpacity={0.7} stroke={MAP_SEAM[t]} strokeOpacity={POINT_STROKE.opacity[t]} />;
        })}
      </Zoomed>
      <p className="ds-note" style={{ color: textColor(isDark) }}>面積 ∝ 值，rMin <span className="ds-mono">{BUBBLE_DOC.rMin}</span>／rMax <span className="ds-mono">{BUBBLE_DOC.rMax}</span> <Tag kind="doc" />；描邊與三階相同（withPointSpec 對 B 只統一描邊）。</p>
    </Sub>
    <Sub title="資料編碼描邊（不套底圖色細縫）" kind="doc">
      <Zoomed w={150} h={40} isDark={isDark}>
        <MapCircle cx={20} cy={20} r={POINT_RADIUS.M} fill={TYPHOON_DOC.observed} stroke={MAP_SEAM[t]} strokeOpacity={POINT_STROKE.opacity[t]} />
        <MapCircle cx={50} cy={20} r={POINT_RADIUS.M} fill="transparent" fillOpacity={0} stroke={TYPHOON_DOC.forecast} strokeWidth={TYPHOON_DOC.forecastStrokeWidth} strokeOpacity={POINT_STROKE.opacity[t]} />
        <MapCircle cx={95} cy={20} r={POINT_RADIUS.M} fill={SAMPLE.fire} stroke={MAP_SEAM[t]} strokeOpacity={POINT_STROKE.opacity[t]} />
        <MapCircle cx={125} cy={20} r={POINT_RADIUS.M} fill={SAMPLE.fire} stroke={CASUALTY_DOC[t]} strokeOpacity={POINT_STROKE.opacity[t]} />
      </Zoomed>
      <Kv rows={[
        ["颱風 實際（左 1）", `實心 ${TYPHOON_DOC.observed}＋底圖色細縫`],
        ["颱風 預測（左 2）", `空心環 ${TYPHOON_DOC.forecast}，寬 ${TYPHOON_DOC.forecastStrokeWidth}`],
        ["火災 一般（右 2）", "底圖色細縫"],
        [`火災 有傷亡（右 1）${t}`, CASUALTY_DOC[t]],
      ]} />
      <p className="ds-note" style={{ color: textColor(isDark) }}>常數在 <code>useTyphoonTracksLayer.ts</code>／<code>useFireEventsLayer.ts</code> 內部、未匯出（且 hook 會引入 mapbox），本頁印文件值；半徑 POINT_RADIUS.M 為真值。</p>
    </Sub>
    <Sub title="即時裝飾上限（光暈）" kind="real">
      <Zoomed w={70} h={40} isDark={isDark}>
        <defs>
          <radialGradient id={`live-halo-${t}`}>
            <stop offset={1 - LIVE_DECORATION_CAP.minBlur} stopColor={SAMPLE.point} stopOpacity={LIVE_DECORATION_CAP.opacity} />
            <stop offset={1} stopColor={SAMPLE.point} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={35} cy={20} r={POINT_RADIUS.M * LIVE_DECORATION_CAP.radiusFactor} fill={`url(#live-halo-${t})`} />
        <MapCircle cx={35} cy={20} r={POINT_RADIUS.M} fill={SAMPLE.point} stroke={MAP_SEAM[t]} strokeOpacity={POINT_STROKE.opacity[t]} />
      </Zoomed>
      <Kv rows={[
        ...objRows("LIVE_DECORATION_CAP", LIVE_DECORATION_CAP),
        ["LIVE_DECORATION_LAYERS", [...LIVE_DECORATION_LAYERS].join("、")],
        ["裝飾子圖層判斷 DECORATION_SUFFIX_RE", DECORATION_SUFFIX_RE.source],
      ]} />
      <p className="ds-note" style={{ color: textColor(isDark) }}>光暈用 M 階 × radiusFactor、opacity 上限、circle-blur 下限畫出（blur 以漸層近似）。不在清單內的圖層，光暈透明度歸零。</p>
    </Sub>
  </>;
}

function LinesDemo({ isDark }: { isDark: boolean }) {
  const t = theme(isDark);
  const tiers = Object.entries(LINE_WIDTH) as [string, readonly [number, number]][];
  const y0 = 12;
  return <>
    <Sub title="線寬三階（z10／z14）＋虛線＋透明度" kind="real">
      <Zoomed w={220} h={y0 + tiers.length * 16 + 3 * 16 + 4 * 14} isDark={isDark} zoom={2}>
        {tiers.map(([k, [z10, z14]], i) => (
          <g key={k}>
            <line x1={8} x2={100} y1={y0 + i * 16} y2={y0 + i * 16} stroke={SAMPLE.line} strokeOpacity={LINE_OPACITY.standard} strokeWidth={z10} strokeLinecap="round" />
            <line x1={120} x2={212} y1={y0 + i * 16} y2={y0 + i * 16} stroke={SAMPLE.line} strokeOpacity={LINE_OPACITY.standard} strokeWidth={z14} strokeLinecap="round" />
          </g>
        ))}
        {(Object.entries(LINE_DASH) as [string, readonly number[]][]).map(([k, dash], i) => {
          const w = LINE_WIDTH.standard[1];
          return <line key={k} x1={8} x2={212} y1={y0 + (tiers.length + i) * 16} y2={y0 + (tiers.length + i) * 16} stroke={SAMPLE.line} strokeOpacity={LINE_OPACITY.standard} strokeWidth={w} strokeDasharray={dash.map((d) => d * w).join(" ")} />;
        })}
        {(["emphasis", "standard", "thin"] as const).map((k, i) => (
          <line key={k} x1={8} x2={212} y1={y0 + (tiers.length + 2 + i) * 16} y2={y0 + (tiers.length + 2 + i) * 16} stroke={BOUNDARY_GRAY[t]} strokeWidth={LINE_WIDTH[k][1]} />
        ))}
        {(Object.entries(LINE_OPACITY) as [string, number][]).map(([k, op], i) => (
          <line key={k} x1={8} x2={212} y1={y0 + (tiers.length + 5) * 16 + i * 14} y2={y0 + (tiers.length + 5) * 16 + i * 14} stroke={SAMPLE.line} strokeOpacity={op} strokeWidth={LINE_WIDTH.standard[1]} />
        ))}
      </Zoomed>
      <p className="ds-note" style={{ color: textColor(isDark) }}>由上而下：三階（左 z10、右 z14）→ 虛線 general／boundary（×z14 標準寬）→ 行政界灰（縣市 強調／鄉鎮 標準／村里 細，z14）→ 透明度 standard／reference／grid／min。</p>
      <Kv rows={[
        ...objRows("LINE_WIDTH", LINE_WIDTH),
        ...objRows("LINE_DASH", LINE_DASH),
        ...objRows("LINE_OPACITY", LINE_OPACITY),
        [`BOUNDARY_GRAY.${t}`, BOUNDARY_GRAY[t]],
      ]} />
    </Sub>
  </>;
}

/** hatchImageData → 8×8 canvas（給 createPattern 與 SVG pattern 共用） */
function hatchTile(kind: HatchKind, isDark: boolean): HTMLCanvasElement {
  const img = hatchImageData(kind, isDark);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

function HatchCanvas({ kind, isDark, zoom }: { kind: HatchKind; isDark: boolean; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = 64;
  const H = 40;
  useEffect(() => {
    const c = ref.current;
    // willReadFrequently：走軟體 canvas，避免 GPU canvas 在大張截圖時 context lost 被清空
    const ctx = c?.getContext("2d", { willReadFrequently: true });
    if (!c || !ctx) return;
    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = mockMapBg(isDark);
      ctx.fillRect(0, 0, W * zoom, H * zoom);
      const tile = hatchTile(kind, isDark);
      const scaled = document.createElement("canvas");
      scaled.width = tile.width * zoom;
      scaled.height = tile.height * zoom;
      const sctx = scaled.getContext("2d");
      if (!sctx) return;
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(tile, 0, 0, scaled.width, scaled.height);
      const pattern = ctx.createPattern(scaled, "repeat");
      if (!pattern) return;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W * zoom, H * zoom);
    };
    draw();
    c.addEventListener("contextrestored", draw);
    return () => c.removeEventListener("contextrestored", draw);
  }, [kind, isDark, zoom]);
  return <canvas ref={ref} width={W * zoom} height={H * zoom} style={{ display: "block", borderRadius: 4 }} />;
}

const STEP = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26"] as const;

function FillsDemo({ isDark }: { isDark: boolean }) {
  const t = theme(isDark);
  const hatchUrl = useMemo(() => hatchTile("missing", isDark).toDataURL(), [isDark]);
  const cells: { x: number; y: number; color: string | null }[] = [
    { x: 0, y: 0, color: STEP[0] }, { x: 1, y: 0, color: STEP[1] }, { x: 2, y: 0, color: null },
    { x: 0, y: 1, color: STEP[2] }, { x: 1, y: 1, color: null }, { x: 2, y: 1, color: STEP[3] },
  ];
  const cw = 44;
  const ch = 30;
  return <>
    <Sub title="面透明度四階" kind="real">
      <Zoomed w={4 * 52 + 8} h={48} isDark={isDark} zoom={2}>
        {(Object.entries(FILL_OPACITY) as [string, number][]).map(([k, op], i) => (
          <g key={k}>
            <rect x={8 + i * 52} y={6} width={44} height={30} fill={SAMPLE.fill} fillOpacity={op}><title>{k}</title></rect>
            <text x={30 + i * 52} y={45} fontSize={7} textAnchor="middle" fill={textColor(isDark)}>{op}</text>
          </g>
        ))}
      </Zoomed>
      <Kv rows={[...objRows("FILL_OPACITY", FILL_OPACITY), ...objRows("FILL_OUTLINE", FILL_OUTLINE)]} />
    </Sub>
    <Sub title="統計分級面細縫（有值 vs 無值）" kind="real">
      <Zoomed w={3 * cw + 16} h={2 * ch + 16} isDark={isDark} zoom={3}>
        <defs>
          <pattern id={`hatch-missing-${t}`} width={MISSING_HATCH.size} height={MISSING_HATCH.size} patternUnits="userSpaceOnUse">
            <image href={hatchUrl} width={MISSING_HATCH.size} height={MISSING_HATCH.size} style={{ imageRendering: "pixelated" }} />
          </pattern>
        </defs>
        {cells.map((c) => {
          const x = 8 + c.x * cw;
          const y = 8 + c.y * ch;
          return c.color ? (
            <g key={`${c.x}-${c.y}`}>
              <rect x={x} y={y} width={cw} height={ch} fill={c.color} fillOpacity={FILL_OPACITY.graded} />
              <rect x={x} y={y} width={cw} height={ch} fill="none" stroke={MAP_SEAM[t]} strokeWidth={GRADED_SEAM.width} strokeOpacity={GRADED_SEAM.opacity[t]} />
            </g>
          ) : (
            <g key={`${c.x}-${c.y}`}>
              <rect x={x} y={y} width={cw} height={ch} fill={`url(#hatch-missing-${t})`} />
              <rect x={x} y={y} width={cw} height={ch} fill="none" stroke={BOUNDARY_GRAY[t]} strokeWidth={GRADED_SEAM.width} strokeOpacity={GRADED_SEAM.noValueOpacity} />
            </g>
          );
        })}
      </Zoomed>
      <Kv rows={[
        ["有值：線色", `MAP_SEAM.${t} = ${MAP_SEAM[t]}`],
        ["有值：線寬／透明度", `${GRADED_SEAM.width}px ／ ${GRADED_SEAM.opacity[t]}`],
        ["無值：線色", `BOUNDARY_GRAY.${t} = ${BOUNDARY_GRAY[t]}`],
        ["無值：透明度 noValueOpacity", GRADED_SEAM.noValueOpacity],
        ["面透明度 FILL_OPACITY.graded", FILL_OPACITY.graded],
      ]} />
    </Sub>
    <Sub title="缺值／遮蔽斜線（hatchImageData → canvas）" kind="real">
      <div className="ds-row">
        {(["missing", "suppressed"] as const).map((kind) => (
          <figure key={kind} style={{ margin: 0 }}>
            <div className="ds-row" style={{ alignItems: "flex-end", gap: 8 }}>
              <HatchCanvas kind={kind} isDark={isDark} zoom={1} />
              <HatchCanvas kind={kind} isDark={isDark} zoom={3} />
            </div>
            <figcaption style={{ fontSize: FONT_SIZE.xs, color: textColor(isDark) }}>{kind === "missing" ? "缺值 missing：單向 45°" : "遮蔽 suppressed：交叉"}（1:1／3×）</figcaption>
          </figure>
        ))}
      </div>
      <Kv rows={[["MISSING_HATCH.size", `${MISSING_HATCH.size}px`], [`MISSING_HATCH.rgb.${t}`, MISSING_HATCH.rgb[t]], ["MISSING_HATCH.alpha", MISSING_HATCH.alpha]]} />
    </Sub>
  </>;
}

function HeatLabelDemo({ isDark }: { isDark: boolean }) {
  const t = theme(isDark);
  const [poiZ10, poiZ14] = LABEL.poi;
  const [badgeZ10, badgeZ14] = LABEL.badge;
  const fill = isDark ? COLORS.textDefault : LIGHT.textDefault;
  const text = (x: number, y: number, size: number, s: string, bold = false) => (
    <text x={x} y={y} fontSize={size} fontWeight={bold ? 700 : 500} fontFamily={MAP_LOCAL_IDEOGRAPH_FONT} fill={fill}
      stroke={LABEL.halo[t]} strokeWidth={LABEL.haloWidth * 2} strokeLinejoin="round" paintOrder="stroke">{s}</text>
  );
  return <>
    <Sub title="熱區（HEATMAP）" kind="real">
      <Zoomed w={90} h={48} isDark={isDark} zoom={2}>
        {HEATMAP.radius.map((r, i) => (
          <g key={r}>
            <circle cx={24 + i * 42} cy={24} r={r} fill="none" stroke={SAMPLE.point} strokeDasharray="2 2" />
            <text x={24 + i * 42} y={27} fontSize={7} textAnchor="middle" fill={textColor(isDark)}>{r}</text>
          </g>
        ))}
      </Zoomed>
      <Kv rows={[...objRows("HEATMAP", HEATMAP), ["radius 意義", "[z10, z14] heatmap-radius px"]]} />
    </Sub>
    <Sub title="文字標籤（LABEL）" kind="real">
      <Zoomed w={220} h={56} isDark={isDark} zoom={2}>
        {text(6, 18, poiZ10, `臺北車站 z10 ${poiZ10}px`)}
        {text(6, 36, poiZ14, `臺北車站 z14 ${poiZ14}px`)}
        {text(150, 18, badgeZ10, "128", true)}
        {text(150, 40, badgeZ14, "128", true)}
      </Zoomed>
      <Kv rows={[...objRows("LABEL", LABEL), ["MAP_LOCAL_IDEOGRAPH_FONT", MAP_LOCAL_IDEOGRAPH_FONT]]} />
      <p className="ds-note" style={{ color: textColor(isDark) }}>字色為示意（規格只定 halo）；halo 以 SVG 描邊 2× haloWidth、paint-order stroke 近似 Mapbox text-halo。</p>
    </Sub>
  </>;
}

function LineFillTierTable() {
  const count = (vals: string[]) => Object.entries(vals.reduce<Record<string, number>>((a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }), {}));
  const rows: [string, string][] = [
    ["FILL_TIERS（面）", count(Object.values(FILL_TIERS) as string[]).map(([k, n]) => `${k} ${n}`).join("、")],
    ["LINE_TIERS 寬（線）", count(Object.values(LINE_TIERS).map((t) => t.width)).map(([k, n]) => `${k} ${n}`).join("、")],
    ["LINE_TIERS 透明度（線）", count(Object.values(LINE_TIERS).map((t) => t.opacity)).map(([k, n]) => `${k} ${n}`).join("、")],
  ];
  return <Kv rows={rows} />;
}

function TierTable() {
  const groups = [
    { name: "POINT_TIERS（OVERLAY_REGISTRY，withPointSpec 套用）", obj: POINT_TIERS as Record<string, string> },
    { name: "HOOK_POINT_TIERS（hook 各自引用 pointRadius）", obj: HOOK_POINT_TIERS as Record<string, string> },
  ];
  const tiers = ["S", "M", "L", "B"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <table className="ds-kv" style={{ maxWidth: 640 }}>
        <thead><tr><th>表</th>{tiers.map((t) => <th key={t}>{t}</th>)}<th>合計</th></tr></thead>
        <tbody>
          {groups.map((g) => {
            const vals = Object.values(g.obj);
            return (
              <tr key={g.name}>
                <td>{g.name}</td>
                {tiers.map((t) => <td key={t} className="ds-mono">{vals.filter((v) => v === t).length}</td>)}
                <td className="ds-mono">{vals.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {groups.map((g) => (
        <details key={g.name} className="ds-details">
          <summary>{g.name} 圖層 key 清單</summary>
          {tiers.map((t) => {
            const keys = Object.entries(g.obj).filter(([, v]) => v === t).map(([k]) => k).sort();
            if (keys.length === 0) return null;
            return (
              <div key={t} style={{ margin: "4px 0 8px" }}>
                <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textStrong }}>{t} 階（<span className="ds-mono">{keys.length}</span>）</div>
                <div className="ds-keys ds-mono">{keys.map((k) => <span key={k}>{k}</span>)}</div>
              </div>
            );
          })}
        </details>
      ))}
    </div>
  );
}

export const MAP_SECTION: SectionDef = { id: "map-layers", no: "10", title: "地圖圖層樣式" };
export function MapLayerSection() {
  return (
    <Section def={MAP_SECTION}>
      <Spec doc={SPEC_MAP} section="§3.1–§3.5" impl={["src/map/mapStyleScale.ts", "src/map/pointSpec.ts", "src/map/pointTiers.ts"]} />
      <p className="ds-note">以 1:1 px 畫出（另附放大版），數值全部從上列檔案匯入。每個框的底色是 <b>地圖底圖替身色</b>（暗 <span className="ds-mono">{mockMapBg(true)}</span>／淡 <span className="ds-mono">{mockMapBg(false)}</span>），不是 Mapbox 真底圖；資料色也只是示意色。</p>
      <Sub title="點（§3.1 P-1–P-6）" />
      <Pair render={(isDark) => <PointTiersDemo isDark={isDark} />} />
      <Sub title="線（§3.2 L-1–L-5）" />
      <Pair render={(isDark) => <LinesDemo isDark={isDark} />} />
      <Sub title="面（§3.3 F-1–F-3）" />
      <Pair render={(isDark) => <FillsDemo isDark={isDark} />} />
      <Sub title="熱區與文字（§3.4 G-2、§3.5 T-1–T-3）" />
      <Pair render={(isDark) => <HeatLabelDemo isDark={isDark} />} />
      <Sub title="點分階表（pointTiers.ts）" kind="real">
        <TierTable />
      </Sub>
      <Sub title="線面分階表（lineFillTiers.ts，withLineFillSpec 套用）" kind="real">
        <LineFillTierTable />
      </Sub>
    </Section>
  );
}
