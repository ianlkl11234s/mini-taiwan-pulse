// Legend sub-components (energyTelecomLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { FACILITY_STATUS_PAINT_COLORS, THEMED_PAINT_COLORS, FOSSIL_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { FACILITY_FUEL_COLORS, FUEL_COLORS, FUEL_FALLBACK_COLOR, RESERVE_INDICATOR_COLORS, RESERVE_INDICATOR_LABELS, CAPACITY_BREAKS, CAPACITY_RADIUS } from "../../data/energyLoader";
import { IXP_REGIONS, ANFR_OPERATORS, OSM_COMMUNICATION_TYPES, RIPE_ATLAS_NODE_TYPES, ooklaSpeedStops } from "../../data/telecomTypes";
import { POWER_OUTPUT_LEGEND_MW, powerOutputRadius } from "../../map/r6FlatEncodings";
import { DenseHeatmapLegendRow, FireCatRows } from "./legendShared";

export function NetworkStructuresLegend({ title, rows, line = false }: { title: string; rows: readonly { label: string; color: string }[]; line?: boolean }) {
  return <div><LegendTitle zh={title} /><FireCatRows cats={[...rows]} line={line} /></div>;
}

// ── OSM crowd 通訊海纜世界概覽；線位來自 OpenInfraMap z2 概化 tiles。──
const SUBMARINE_CABLE_CATS = [
  { color: "#26c6da", label: "OSM crowd route（z2 generalized）" },
];

export function SubmarineCableLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="通訊海纜" en="Submarine Cable" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SUBMARINE_CABLE_CATS.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={c.color} width={3} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        群眾標註且不完整；非工程級精確路由。© OpenStreetMap contributors · ODbL 1.0
      </LegendNote>
    </div>
  );
}

// ── OSM crowd 海纜登陸站。──
const LANDING_STATION_CATS = [
  { color: "#ffb74d", label: "OSM cable landing station" },
];

export function LandingStationLegend() {
  return (
    <div>
      <LegendTitle zh="海纜登陸站" en="Landing Station" />
      <FireCatRows cats={LANDING_STATION_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        標註不完整；空白區域不代表沒有設施。© OpenStreetMap contributors
      </LegendNote>
    </div>
  );
}

export function InternetExchangePointsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="網際網路交換中心" en="Internet Exchange" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IXP_REGIONS.map((region) => (
          <div key={region.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={region.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{region.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 5 }}>
        點越大代表參與者數越多 · PCH Active IXP
      </LegendNote>
    </div>
  );
}

export function AnfrWirelessSitesLegend() {
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh="法國 ANFR 5G 3500 無線站點" en="Wireless Sites" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {ANFR_OPERATORS.map((operator) => <div key={operator.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={operator.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{operator.label}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>8,000／33,761 概覽抽樣 · 點位非精確機房邊界</LegendNote>
  </div>;
}

export function OsmCommunicationSitesLegend() {
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh="OSM 通訊塔候選點" en="Communication Candidates" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {OSM_COMMUNICATION_TYPES.map((entry) => <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={entry.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{entry.label}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>
      全球區域抽樣 · OSM mapped candidates · 非官方／非完整 · © OpenStreetMap contributors
    </LegendNote>
  </div>;
}

export function RipeAtlasProbesLegend() {
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh="RIPE Atlas 連線量測節點" en="Connected Probes" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {RIPE_ATLAS_NODE_TYPES.map((entry) => <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={entry.color} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{entry.label}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5 }}>
      座標 80–400m 模糊化 · 志願者偏差 · 僅供研究；商業使用需另取許可 · © RIPE NCC
    </LegendNote>
  </div>;
}

export function OoklaPerformanceGridLegend({ isDark = true, paletteIdx, taiwanOnly = false }: { isDark?: boolean; paletteIdx?: number; taiwanOnly?: boolean }) {
  const t = useLegendTheme();
  const stops = ooklaSpeedStops(paletteIdx);
  return <div>
    <LegendTitle zh="Ookla 網路效能格網" en="Speedtest Performance Grid" />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {stops.map((stop) => <div key={stop.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchSquare color={stop.color} stroke={THEMED_PAINT_COLORS[taiwanOnly ? "ooklaTaiwanOutline" : "ooklaGlobalOutline"][isDark ? "dark" : "light"]} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{stop.label}</span>
      </div>)}
    </div>
    <LegendNote style={{ marginTop: 5, lineHeight: 1.35 }}>
      下載速度（kbps）· 使用者量測樣本，非 coverage map · CC BY-NC-SA 4.0<br />
      非商業使用／相同方式分享 · © Ookla · Ookla、Speedtest 及相關標誌為 Ookla, LLC 商標
    </LegendNote>
  </div>;
}

// ── Energy: fuel_type 分色 + capacity 半徑 ──

const FUEL_LEGEND_ROWS: { label: string; key: string }[] = [
  { label: "核能 Nuclear", key: "nuclear" },
  { label: "燃煤 Coal", key: "coal" },
  { label: "燃油 Oil", key: "oil" },
  { label: "天然氣 Gas", key: "natural_gas" },
  { label: "水力 Hydro", key: "hydro" },
  { label: "太陽 Solar", key: "solar" },
  { label: "風力 Wind", key: "wind" },
  { label: "地熱 Geothermal", key: "geothermal" },
  { label: "生質 Biomass/Biogas", key: "biomass" },
];

export function EnergyFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  // 同一份燃料色圖例給 legacy 電廠總圖（容量分級）與機組即時出力（R6 段 2：平面圓點大小＝出力 MW）
  const showCapacity = visibility.powerPlants;
  const showOutput = visibility.powerGenerationUnit;
  return (
    <div>
      <LegendTitle zh="發電燃料" en="Fuel" />
      {FUEL_LEGEND_ROWS.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={FUEL_COLORS[row.key] ?? FUEL_FALLBACK_COLOR} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      {showCapacity && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            Capacity (MW)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {[
              { label: `<${CAPACITY_BREAKS.small}`, r: CAPACITY_RADIUS.tiny },
              { label: `<${CAPACITY_BREAKS.medium}`, r: CAPACITY_RADIUS.small },
              { label: `<${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.medium },
              { label: `≥${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.large },
            ].map((x) => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: x.r * 2,
                    height: x.r * 2,
                    borderRadius: RADIUS.full,
                    background: FUEL_FALLBACK_COLOR,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showOutput && (
        <LegendSizeRow
          fill={FUEL_FALLBACK_COLOR}
          title="即時出力（機組圓點大小）"
          items={POWER_OUTPUT_LEGEND_MW.map((mw) => ({ r: powerOutputRadius(mw), label: `${mw.toLocaleString()} MW` }))}
        />
      )}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {showOutput && <>● 機組即時出力：面積 ∝ 出力 MW，隨時間軸更新；開「立體效果」另疊光柱（柱高 ∝ 出力／裝置容量）<br /></>}
        ● 14 台電廠有 output；OSM/IPP 等暫無
      </LegendNote>
    </div>
  );
}

// ── Energy: 高壓電網 voltage tier + line_type ──

export function PowerPolesLegend() {
  const t = useLegendTheme();
  const typeRows = [
    { label: "水泥桿（83.7%）", color: "#94a3b8" },
    { label: "水泥併桿（14.4%）", color: "#64748b" },
    { label: "木桿（1.0%）", color: "#a16207" },
    { label: "H桿（0.7%）", color: "#0ea5e9" },
    { label: "其他 8 種（0.2%）", color: "#f43f5e" },
  ];
  const heatStops = [
    { pct: "稀", color: "#38bdf8" },
    { pct: "中", color: "#22c55e" },
    { pct: "高", color: "#facc15" },
    { pct: "很高", color: "#f97316" },
    { pct: "極高", color: "#ef4444" },
  ];
  return (
    <div>
      <LegendTitle zh="全國電桿（296 萬）" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        密度（z8-12）
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
        {heatStops.map((s) => (
          <div key={s.pct} style={{ flex: 1, textAlign: "center" }}>
            <span style={{ display: "block", height: 8, background: s.color, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: t.textDim }}>{s.pct}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
        桿型（z11+）
      </div>
      {typeRows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={r.color} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 來源：台電 d077010（22 縣市，2026-06-15）<br />
        ● z8-12 看密度熱區、z13+ 看個別桿型<br />
        ● 金門 / 連江 / 澎湖無資料 → 走離島電網
      </LegendNote>
    </div>
  );
}

export function PowerGridLegend({ visibility }: { visibility?: LayerVisibility }) {
  const t = useLegendTheme();
  const voltageRows = [
    { kv: "345 kV", color: "#1AB6D9" },
    { kv: "161 kV", color: "#62D9AD" },
    { kv: "69 kV",  color: "#468BA6" },
    { kv: "未標／混合", color: "#DFE0DC" },
  ];
  return (
    <div>
      <LegendTitle zh="高壓電網" />
      {voltageRows.map((r) => (
        <div key={r.kv} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchLine color={r.color} width={3} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.kv}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        線型
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color={"#62D9AD"} width={3} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>輸電（粗）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 1.5, background: "#62D9AD", display: "inline-block", opacity: 0.55 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>配電（細）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              height: 2,
              backgroundImage: "linear-gradient(to right, #62D9AD 50%, transparent 0%)",
              backgroundSize: "6px 2px",
              backgroundRepeat: "repeat-x",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>地下電纜（虛線）</span>
        </div>
      </div>
      {visibility?.osmPowerTowers && <DenseHeatmapLegendRow layers={["osmPowerTowers"]} />}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 鐵塔需 zoom ≥ 13<br />
        ● 來源：OSM（同 openinframap），約 60% 線未標電壓
      </LegendNote>
    </div>
  );
}

// ── Energy: 變電所（超高壓）2 階（migration 235）──
export function SubstationEhvLegend() {
  const t = useLegendTheme();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#ef4444", label: "超高壓開閉所 (345 kV 切換)",    sz: 9, n: 5 },
    { color: "#ffffff", label: "超高壓變電所 E/S (345→161 kV)", sz: 8, n: 33 },
  ];
  return (
    <div>
      <LegendTitle zh="超高壓變電所" />
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 含圓形 halo 光暈強化全國級主幹節點
      </LegendNote>
    </div>
  );
}

// ── Energy: 變電所（區域）5 階（migration 235）──
export function SubstationLocalLegend() {
  const t = useLegendTheme();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#f97316", label: "一次變電所 P/S (161→69 kV)",       sz: 6.5, n: 129 },
    { color: "#14b8a6", label: "一次配電變電所 D/S (161→22.8 kV)", sz: 5.5, n: 90 },
    { color: "#facc15", label: "二次變電所 S/S (69→22.8 kV)",      sz: 5,   n: 199 },
    { color: "#3b82f6", label: "鐵路牽引變電所",                    sz: 4.5, n: 11 },
    { color: "#6b7280", label: "未分類",                            sz: 4,   n: 318 },
  ];
  return (
    <div>
      <LegendTitle zh="區域變電所" />
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 規則：name regex + voltage，台電 P/S / S/S 標示為準
      </LegendNote>
    </div>
  );
}

// ── Energy: Phase 8 SSOT facilities 6-layer ──
export function FacilityFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const fuels: { c: string; label: string }[] = [
    { c: FACILITY_FUEL_COLORS.coal!, label: "燃煤 coal" },
    { c: FACILITY_FUEL_COLORS.oil_gas!, label: "油氣 oil_gas" },
    { c: FACILITY_FUEL_COLORS.nuclear!, label: "核能 nuclear" },
    { c: FACILITY_FUEL_COLORS.hydro!, label: "水力 hydro" },
    { c: FACILITY_FUEL_COLORS.solar!, label: "光電 solar" },
    { c: FACILITY_FUEL_COLORS.wind!, label: "風力 wind" },
    { c: FACILITY_FUEL_COLORS.bioenergy!, label: "生質 bioenergy" },
    { c: FACILITY_FUEL_COLORS.geothermal!, label: "地熱 geothermal" },
    { c: FACILITY_FUEL_COLORS.waste!, label: "焚化 waste" },
  ];
  const showStatus = visibility.facPlanned || visibility.facHistorical;
  return (
    <div>
      <LegendTitle zh="電廠燃料" />
      {fuels.map((f) => (
        <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={f.c} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{f.label}</span>
        </div>
      ))}
      {showStatus && (
        <>
          <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>狀態</div>
          {visibility.facPlanned && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.construction} strokeWidth={1.5} opacity={1} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>興建中（電光黃框）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.preConstruction} strokeWidth={1.5} opacity={.55} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>規劃中（電光藍框、半透明）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.fallback} stroke={FACILITY_STATUS_PAINT_COLORS.announced} strokeWidth={1.5} opacity={.35} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>公告中（淡紫藍框）</span>
              </div>
            </>
          )}
          {visibility.facHistorical && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={FACILITY_STATUS_PAINT_COLORS.historical} stroke={FACILITY_STATUS_PAINT_COLORS.historicalStroke} strokeWidth={1} opacity={.45} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>退役/擱置（深灰、退色）</span>
            </div>
          )}
        </>
      )}
      <LegendNote style={{ marginTop: 8, lineHeight: 1.35 }}>
        ● 大小 ∝ log10(容量 MW)：0.5MW ~ 6GW 連續映射
      </LegendNote>
    </div>
  );
}

// ── Energy: 化石燃料 14 layer（Phase B） ──

const FOSSIL_FUEL_LEGEND: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "line" | "square" }[] = [
  { key: "gasStationCpc",         color: FOSSIL_PAINT_COLORS.gasStationCpc, label: "加油站 中油 (1,971)",          shape: "circle" },
  { key: "gasStationFpcc",        color: FOSSIL_PAINT_COLORS.gasStationFpcc, label: "加油站 台塑系 (348)",          shape: "circle" },
  { key: "gasStationTaisugar",    color: FOSSIL_PAINT_COLORS.gasStationTaisugar, label: "加油站 台糖 (73)",             shape: "circle" },
  { key: "gasStationOther",       color: FOSSIL_PAINT_COLORS.gasStationOther, label: "加油站 其他 (1,179)",          shape: "circle" },
  { key: "gasStationCanonical",   color: FOSSIL_PAINT_COLORS.gasStationCanonical, label: "加油站 SSOT (3,053)",         shape: "circle" },
  { key: "lpgSubpackaging",       color: FOSSIL_PAINT_COLORS.lpgSubpackaging, label: "LPG 分裝/儲存 (113)",          shape: "circle" },
  { key: "lpgRetailers",          color: FOSSIL_PAINT_COLORS.lpgRetailers, label: "LPG 加氣站/瓦斯行 (1,292)",    shape: "circle" },
  { key: "lngTerminal",           color: FOSSIL_PAINT_COLORS.lngTerminal, label: "LNG 接收站 (7)",               shape: "circle" },
  { key: "pipelineGas",           color: FOSSIL_PAINT_COLORS.pipelineGas, label: "天然氣主幹線 (11)",            shape: "line" },
  { key: "pipelineOilGas",        color: FOSSIL_PAINT_COLORS.pipelineOilGas, label: "油氣管線 OSM (10)",            shape: "line" },
  { key: "industrialRefinery",    color: FOSSIL_PAINT_COLORS.industrialRefinery, label: "煉油/化工廠（精選）",         shape: "square" },
  { key: "industrialStorageTank", color: FOSSIL_PAINT_COLORS.industrialStorageTank, label: "油氣儲槽 (72)",                shape: "square" },
  { key: "industrialPowerPlant",  color: FOSSIL_PAINT_COLORS.industrialPowerPlant, label: "火力廠 polygon (26)",          shape: "square" },
  { key: "coalTerminal",          color: FOSSIL_PAINT_COLORS.coalTerminal, label: "煤炭碼頭 (4)",                 shape: "circle" },
];

export function FossilFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const active = FOSSIL_FUEL_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <LegendTitle zh="化石燃料" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {active.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.shape === "line" ? <SwatchLine color={r.color} width={3} dash={r.key === "pipelineOilGas" ? [2, 2] : undefined} /> : r.shape === "square" ? <SwatchSquare color={r.color} /> : <SwatchDot color={r.color} />}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 雲林 POC 覆蓋分析（PMTiles × OSM edge nearest distance）──
export function CoverageLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const anyGas = visibility.gasCoverageAll || visibility.gasCoverageCpc
    || visibility.gasCoverageFpcc || visibility.gasCoverageTaisugar;
  const anyEv = visibility.evIsland;
  if (!anyGas && !anyEv) return null;

  const GAS_BANDS: { c: string; l: string }[] = [
    { c: "#16A34A",   l: "0–5 km" },
    { c: "#84CC16",   l: "5–10 km" },
    { c: "#F2D64B",   l: "10–20 km" },
    { c: "#F2A516",   l: "20–30 km" },
    { c: "#F23535",   l: "30 km+" },
  ];
  const EV_BANDS = GAS_BANDS;  // 跟加油站同色階

  return (
    <div>
      <LegendTitle zh="全台最近距離（路網）" />
      {anyGas && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>
            到最近加油站的路網距離
          </div>
          {GAS_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchLine color={s.c} width={4} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      {anyEv && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>
            到最近充電站的路網距離
          </div>
          {EV_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchLine color={s.c} width={4} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      <LegendNote style={{ marginTop: 6 }}>
        osmnx + multi-source dijkstra · 每條 OSM edge 染色 · 全台主要路網
      </LegendNote>
    </div>
  );
}

export function FacOffshoreLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="離岸風電場址（8 場）" />
      {[
        { c: "#3C92A6", label: "運轉中", dash: false },
        { c: "#7AAEC0", label: "興建中（虛線 3,2）", dash: true },
        { c: "#7AAEC0", label: "規劃中（虛線 2,2）", dash: true },
        { c: "#A8C5D0", label: "公告中（虛線 1,3）", dash: true },
      ].map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 24, height: 8,
              background: r.dash
                ? `repeating-linear-gradient(to right, ${r.c} 0 4px, transparent 4px 7px)`
                : r.c,
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 8, lineHeight: 1.35 }}>
        ● 來源：energy.power_facilities footprint（GEM polygon 配對成功 8 個）
      </LegendNote>
    </div>
  );
}

// ── Energy: OSM 風光電 POI（風機 offshore/onshore + 光電 + OSM 電廠 fuel） ──

export function RenewablePoiLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="OSM 風光電" />
      {visibility.osmWindTurbines && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>風機 (812)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#67e8f9"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>離岸 466</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#2dd4bf"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>陸域 / 未標 346</span>
          </div>
        </>
      )}
      {visibility.osmSolarFarms && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>光電廠 (734)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#fbbf24"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>POI 中心</span>
          </div>
        </>
      )}
      {visibility.osmPowerPlantsStatic && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>OSM 電廠 (513) by fuel</div>
          {[
            { k: "solar", c: "#fbbf24", l: "太陽" },
            { k: "wind", c: "#22d3ee", l: "風力" },
            { k: "hydro", c: "#3b82f6", l: "水力" },
            { k: "coal", c: "#374151", l: "煤" },
            { k: "gas", c: "#94a3b8", l: "天然氣" },
            { k: "nuclear", c: "#facc15", l: "核能" },
            { k: "waste", c: "#a3a300", l: "廢棄物" },
            { k: "other", c: "#9ca3af", l: "其他/未標" },
          ].map((x) => (
            <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
            ⚠ 與「電廠」(all_power_plants_v) 可能重疊
          </div>
        </>
      )}
    </div>
  );
}

// ── Energy: 特殊能源 5 layer 共用（offshore / island / fossil / geothermal / 北市再生） ──

export function EnergySpecialtyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="特殊" />
      {visibility.offshoreWindZones && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>離岸風電場址 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchSquare color={"#22d3ee"} opacity={0.4} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>潛力場址（fill polygon）</span>
          </div>
        </>
      )}
      {visibility.islandPowerGrid && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>離島電網 (14) by fuel</div>
          {[
            { c: "#f97316", l: "柴油" },
            { c: "#94a3b8", l: "天然氣" },
            { c: "#fbbf24", l: "太陽" },
            { c: "#22d3ee", l: "風力" },
            { c: "#3b82f6", l: "水力" },
            { c: "#a78bfa", l: "其他" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.fossilFuelInfra && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>化石燃料 (9)</div>
          {[
            { c: "#22d3ee", l: "LNG 接收站" },
            { c: "#F97316", l: "煉油廠" },
            { c: "#94a3b8", l: "燃氣電廠" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.geothermalWells && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>地熱井 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <SwatchDot color={"#ef4444"} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>井位 + 報告外連</span>
          </div>
        </>
      )}
      {visibility.renewablePermitsTaipei && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>北市再生 (438) by 類別</div>
          {[
            { c: "#fbbf24", l: "學校 164" },
            { c: "#94a3b8", l: "國有房地 149" },
            { c: "#a78bfa", l: "機關 119" },
            { c: "#ef4444", l: "焚化發電 3" },
            { c: "#a3a300", l: "沼氣發電 2" },
            { c: "#3b82f6", l: "水力發電 1" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <SwatchDot color={x.c} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Energy: 燈號 G/Y/O/R ──

export function EnergyReserveLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="備轉燈號" />
      {(["G", "Y", "O", "R"] as const).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={RESERVE_INDICATOR_COLORS[k]!} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>
            {k} · {RESERVE_INDICATOR_LABELS[k]}
          </span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 4 區用電柱（Layer 3）柱高 ∝ consumption_mw<br />
        ● 柱色 = 全國燈號（共用一個值）
      </LegendNote>
    </div>
  );
}
