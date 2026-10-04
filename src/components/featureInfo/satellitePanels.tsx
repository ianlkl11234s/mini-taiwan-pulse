import { Row, SourceFooter } from "./shared";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { getSatelliteTleFetchedAt } from "../../data/satelliteLoader";
import { SATELLITE_SOURCE_URLS } from "../../data/satelliteDataState";
import { SATELLITE_COLORS, SATELLITE_LABELS, type SatelliteCategory } from "../../data/satelliteTypes";

// 地圖上的衛星 feature 只帶 cat／norad／name／altKm，沒有來源欄位；
// 來源是整個圖層共通的產品知識（loader 讀 satellite_classified view：
// gis-platform 每 2h 從 Space-Track 同步 TLE，分類依 UCS 衛星資料庫），故由 panel 補上並自掛 SourceFooter
// （layerType「satellites」已列入 FeatureInfoPanel 的 FOOTER_SELF_MANAGED_LAYER_TYPES）。
const SATELLITE_SOURCE = {
  source_org: "Space-Track（TLE）· UCS 衛星資料庫（分類）",
  source_url: SATELLITE_SOURCE_URLS.spaceTrack,
} as const;

export function SatellitePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const cat = String(props.cat ?? "") as SatelliteCategory;
  const name = String(props.name ?? "");
  const norad = String(props.norad ?? "");
  const altKm = Number(props.altKm);
  const color = SATELLITE_COLORS[cat] ?? "#888";
  const catLabel = SATELLITE_LABELS[cat] ?? cat;
  return (
    <div>
      <div style={{ fontWeight: 700, color, fontSize: FONT_SIZE.lg }}>{name || "Satellite"}</div>
      <Row label="類別" value={catLabel} color={color} />
      <Row label="NORAD" value={norad} />
      <Row label="高度" value={Number.isFinite(altKm) ? `${altKm.toLocaleString()} km` : ""} />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>
        足跡：內圈 50 km 掃描寬度／外圈 1,500 km 仰角 ≥10° 可見範圍
      </div>
      <SourceFooter
        props={{
          ...SATELLITE_SOURCE,
          fetched_at: (() => {
            const ms = getSatelliteTleFetchedAt();
            return ms == null ? "" : `${new Date(ms + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ")}（台灣時間）`;
          })(),
        }}
      />
    </div>
  );
}
