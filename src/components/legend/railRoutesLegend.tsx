// 軌道路線（railRoutes）圖例：每個系統列出實際出現的線色（與 geojson `color` 同源，見 railRoutesTypes）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, useLegendTheme } from "./legendKit";
import { RAIL_METRO_LINES, RAIL_ROUTES_SYSTEMS } from "../../data/railRoutesTypes";
import { TRANSFER_STATION, transferRingColor } from "../../map/mapStyleScale";

export function RailRoutesLegend() {
  return (
    <div>
      <LegendTitle zh="軌道路線" en="Rail Routes" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RAIL_ROUTES_SYSTEMS.map((s) => (
          <LegendRow
            key={s.value}
            swatch={
              <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
                {s.colors.slice(0, 4).map((c) => <SwatchLine key={c} color={c} />)}
              </span>
            }
          >
            {s.label}
          </LegendRow>
        ))}
      </div>
      <LegendNote>捷運各線沿用官方線色；僅路線幾何，列車位置見「鐵道」圖層。信義線東延段線形 © OpenStreetMap contributors (ODbL)</LegendNote>
    </div>
  );
}

/** 捷運站圖例：站點依所屬路線線色（與 railRoutes 線色同源），轉乘站白底深描邊。 */
export function MetroStationsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="捷運站" en="Metro Stations" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {RAIL_METRO_LINES.map((l) => (
          <LegendRow key={`${l.system}-${l.lineId}`} swatch={<SwatchDot color={l.color} opacity={1} />}>{l.name}</LegendRow>
        ))}
      </div>
      <div style={{ marginTop: 4 }}>
        <LegendRow swatch={<SwatchDot color={TRANSFER_STATION.fill} opacity={1} stroke={transferRingColor(t.isDark)} strokeWidth={TRANSFER_STATION.ringWidth} />}>轉乘站</LegendRow>
      </div>
      <LegendNote>站點顏色為所屬路線線色；同名且相距 500 m 內的站視為轉乘站</LegendNote>
    </div>
  );
}
