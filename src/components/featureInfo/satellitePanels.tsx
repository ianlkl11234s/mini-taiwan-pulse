import { Row, SourceFooter, Title } from "./shared";
import { FONT_SIZE, FONT_DATA, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { getSatelliteTleFetchedAt } from "../../data/satelliteLoader";
import { SATELLITE_SOURCE_URLS } from "../../data/satelliteDataState";
import { satelliteConsoleStore } from "../../state/satelliteConsoleStore";
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
  // 類別名稱表（SATELLITE_LABELS）圖例也在用，不動它；只在 popup 端去掉國旗 emoji
  const catLabel = (SATELLITE_LABELS[cat] ?? cat).replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, "");
  const noradNum = Number(norad);
  const mono = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" } as const;
  return (
    <div>
      <Title color={color}>{name || "衛星"}</Title>
      <Row label="類別" value={catLabel} color={color} />
      <Row label="編號" value={norad} mono title="NORAD 編號" />
      <Row label="高度" value={Number.isFinite(altKm) ? `${altKm.toLocaleString()} km` : ""} mono />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>
        足跡：內圈 <span style={mono}>50</span> km 掃描寬度、外圈 <span style={mono}>1,500</span> km 可見範圍（仰角 <span style={mono}>≥10°</span>）
      </div>
      {Number.isInteger(noradNum) && noradNum > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => satelliteConsoleStore.selectNorad(noradNum)}
            style={{
              height: 24, padding: "0 8px", borderRadius: RADIUS.md, cursor: "pointer",
              border: `1px solid ${t.border}`, background: t.bgSubtle, color: t.textDefault, fontSize: FONT_SIZE.sm,
            }}
          >
            查看衛星百科
          </button>
        </div>
      )}
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
