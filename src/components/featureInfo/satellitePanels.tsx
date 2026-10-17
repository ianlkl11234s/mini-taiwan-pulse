import { Row, SourceFooter, Title } from "./shared";
import { FONT_SIZE, FONT_DATA, RADIUS } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { getSatelliteTleFetchedAt } from "../../data/satelliteLoader";
import { SATELLITE_SOURCE_URLS } from "../../data/satelliteDataState";
import { satelliteConsoleStore } from "../../state/satelliteConsoleStore";
import { SATELLITE_COLORS, SATELLITE_LABELS, type SatelliteCategory } from "../../data/satelliteTypes";

// 地圖上的衛星 feature 只帶 cat／norad／name／altKm，沒有來源欄位；
// 來源是整個圖層共通的產品知識（loader 讀 satellite_classified view：
// gis-platform 每 2h 從 Space-Track 同步 TLE，分類依 UCS 衛星資料庫），故由 panel 補上並自掛 SourceFooter
// （layerType「satellites」已列入 FeatureInfoPanel 的 FOOTER_SELF_MANAGED_LAYER_TYPES）。
const SATELLITE_SOURCE_URL = SATELLITE_SOURCE_URLS.spaceTrack;

export function SatellitePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const cat = String(props.cat ?? "") as SatelliteCategory;
  const name = String(props.name ?? "");
  const norad = String(props.norad ?? "");
  const altKm = Number(props.altKm);
  const color = SATELLITE_COLORS[cat] ?? "#888";
  // 類別名稱表（SATELLITE_LABELS）圖例也在用，不動它；只在 popup 端去掉國旗 emoji
  const catLabel = enumLabel("satelliteCategory", cat, (SATELLITE_LABELS[cat] ?? cat).replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, ""), i18n);
  const noradNum = Number(norad);
  const mono = { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" } as const;
  return (
    <div>
      <Title color={color}>{name || tr("popup.satellite.fallback")}</Title>
      <Row field="category" value={catLabel} color={color} />
      <Row field="number" value={norad} mono title={tr("popup.satellite.noradTitle")} />
      <Row label={tr("popup.satellite.altitude")} value={Number.isFinite(altKm) ? `${formatNumber(altKm)} km` : ""} mono />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>
        {tr("popup.satellite.footprint1")}<span style={mono}>50</span>{tr("popup.satellite.footprint2")}<span style={mono}>1,500</span>{tr("popup.satellite.footprint3")}<span style={mono}>≥10°</span>{tr("popup.satellite.footprint4")}
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
            {tr("popup.satellite.encyclopedia")}
          </button>
        </div>
      )}
      <SourceFooter
        props={{
          source_org: tr("popup.satellite.sourceOrg"),
          source_url: SATELLITE_SOURCE_URL,
          fetched_at: (() => {
            const ms = getSatelliteTleFetchedAt();
            return ms == null ? "" : tr("popup.satellite.fetchedAt", { time: new Date(ms + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ") });
          })(),
        }}
      />
    </div>
  );
}
