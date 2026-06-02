import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LayerVisibility } from "../types";
import { CROP_SUITABILITY_CROPS } from "../data/cropSuitabilityCrops";
import { AGRI_POI_TYPES } from "../data/agriPOITypes";
import { AGRI_COMPANY_TYPES } from "../data/agriCompanyTypes";
import { ECO_NETWORK_ZONE_TYPES } from "../data/ecoNetworkZoneTypes";
import {
  FIRE_STATION_CATS, FIRE_HYDRANT_CATS, FIRE_EVENT_CATS, FIRE_HYDRANT_COVERAGE_NOTE,
  FIRE_ISOCHRONE_BANDS, FIRE_ISOCHRONE_NOTE,
} from "../data/fireTypes";
import {
  SOIL_FERTILITY_METRICS,
  SOIL_FERTILITY_METRIC_OPTIONS,
  type SoilFertilityMetric,
} from "../data/agriSoilFertilityMetrics";

/**
 * 右下角圖例面板 — 只顯示目前開啟的圖層對應圖例
 */

// ── Earthquake depth color stops ──
const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── Road Events event_type ──
const ROAD_EVENT_TYPE_ITEMS = [
  { type: 3, color: "#ef4444", label: "事故 Accident" },
  { type: 1, color: "#eab308", label: "壅塞/事故 Congestion" },
  { type: 2, color: "#f97316", label: "施工 Construction" },
  { type: 7, color: "#a855f7", label: "活動/管制 Controlled" },
  { type: 5, color: "#dc2626", label: "災害/障礙 Disaster" },
];

// ── Disaster alert severity ──
const SEVERITY_ITEMS: { key: string; color: string; label: string }[] = [
  { key: "Extreme", color: "#dc2626", label: "極端 Extreme" },
  { key: "Severe", color: "#ea580c", label: "嚴重 Severe" },
  { key: "Moderate", color: "#eab308", label: "中度 Moderate" },
  { key: "Minor", color: "#3b82f6", label: "輕度 Minor" },
];

// ── IoT 河川 delta 紅↔藍 ──
const IOT_RIVER_DELTA_STOPS = [
  { color: "#7e22ce", label: "-1m" },
  { color: "#a855f7", label: "-30cm" },
  { color: "#d8b4fe", label: "-10cm" },
  { color: "#94a3b8", label: "0" },
  { color: "#67e8f9", label: "+10cm" },
  { color: "#06b6d4", label: "+30cm" },
  { color: "#0e7490", label: "+1m" },
];

// ── IoT 水工結構 5 類別 ──
const IOT_STRUCTURE_TYPES = [
  { color: "#a855f7", label: "累計流量 Cumulative Flow", measure: "m³" },
  { color: "#f97316", label: "閘門 Watergate", measure: "開度 % / 水位 m" },
  { color: "#dc2626", label: "堤防安全 Dam Structure", measure: "角度 / 應力" },
  { color: "#eab308", label: "河床沖刷 Erosion", measure: "深度 m" },
  { color: "#92400e", label: "揚塵 Dust", measure: "PM10 / 風速 / 溫濕度" },
];

// ── 作物適栽 4 級 kind ──（與 agricultureLayerFactory.ts CROP_KIND_COLOR_EXPR 對齊）
const CROP_KIND_ITEMS = [
  { kind: 1, color: "#1b5e20", label: "最適 Premium" },
  { kind: 2, color: "#66bb6a", label: "適栽 Suitable" },
  { kind: 3, color: "#fff59d", label: "次適 Marginal" },
  { kind: 4, color: "#ef9a9a", label: "不適 Unsuitable" },
];

interface LegendPanelProps {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
}

export function LegendPanel({ visibility, overlayParams }: LegendPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // 判斷有哪些需要圖例的圖層是開啟的
  const hasEarthquake = visibility.earthquakes;
  const hasDisasterAlert = visibility.disasterAlerts;
  const hasRoadEvents = visibility.roadEvents;
  const hasIotRiver = visibility.iotWraRiver;
  const hasIotStructure = visibility.iotWraStructure;
  const hasCropSuitability = visibility.agriCropSuitability;
  const hasAgriPOI = visibility.agriPOI;
  const hasAgriCompany = visibility.agriRetail || visibility.agriProduceWholesale || visibility.agriWholesaleMarket;
  const hasSoilFertility = visibility.agriSoilFertility;
  const hasFireEvents = visibility.fireEvents || visibility.fireLatest;
  const hasFireStations = visibility.fireStations;
  const hasFireHydrants = visibility.fireHydrants;
  const hasFireIsochrone = visibility.fireIsochrone;
  const hasEcoNetworkZones = visibility.ecoNetworkZones;
  const hasAny = hasEarthquake || hasDisasterAlert || hasRoadEvents || hasIotRiver || hasIotStructure || hasCropSuitability || hasAgriPOI || hasAgriCompany || hasSoilFertility || hasFireEvents || hasFireStations || hasFireHydrants || hasFireIsochrone || hasEcoNetworkZones;

  if (!hasAny) return null;

  return (
    <div
      style={{
        width: 200,
        background: "rgba(10, 10, 20, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.15)",
        borderRadius: 8,
        fontFamily: "monospace",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: 1,
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
        <span>LEGEND</span>
      </button>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {hasEarthquake && <EarthquakeLegend />}
          {hasDisasterAlert && <DisasterAlertLegend />}
          {hasRoadEvents && <RoadEventsLegend />}
          {hasIotRiver && <IotRiverLegend />}
          {hasIotStructure && <IotStructureLegend />}
          {hasCropSuitability && <CropSuitabilityLegend cropId={overlayParams.agriCropSuitabilityCropId ?? 0} />}
          {hasAgriPOI && <AgriPOILegend />}
          {hasAgriCompany && <AgriCompanyLegend visibility={visibility} />}
          {hasSoilFertility && <SoilFertilityLegend metricIdx={overlayParams.agriSoilFertilityMetricIdx ?? 0} />}
          {hasFireEvents && <FireEventLegend />}
          {hasFireStations && <FireStationLegend />}
          {hasFireHydrants && <FireHydrantLegend />}
          {hasFireIsochrone && <FireIsochroneLegend />}
          {hasEcoNetworkZones && <EcoNetworkZonesLegend />}
        </div>
      )}
    </div>
  );
}

// ── 消防圖例（火災 / 分隊 / 消防栓）──

function FireCatRows({ cats, square }: { cats: { color: string; label: string }[]; square?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {cats.map((c) => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: square ? 2 : "50%",
              background: c.color, opacity: 0.9, flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function FireEventLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        FIRE 火災歷史
      </div>
      <FireCatRows cats={FIRE_EVENT_CATS} />
    </div>
  );
}

function FireStationLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        消防分隊 STATIONS
      </div>
      <FireCatRows cats={FIRE_STATION_CATS} />
    </div>
  );
}

function FireHydrantLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        消防栓 HYDRANTS
      </div>
      <FireCatRows cats={FIRE_HYDRANT_CATS} square />
      <div style={{ fontSize: 8, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_HYDRANT_COVERAGE_NOTE}
      </div>
    </div>
  );
}

function FireIsochroneLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        救援等時圈 ISOCHRONE
      </div>
      <FireCatRows
        cats={FIRE_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <div style={{ fontSize: 8, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_ISOCHRONE_NOTE}
      </div>
    </div>
  );
}

function EcoNetworkZonesLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        國土綠網分區 ECO NETWORK
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ECO_NETWORK_ZONE_TYPES.map((z) => (
          <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: 1, background: z.color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Soil Fertility Legend (6 metric 可切換) ──

function SoilFertilityLegend({ metricIdx }: { metricIdx: number }) {
  const metricId = (SOIL_FERTILITY_METRIC_OPTIONS[metricIdx]?.value ?? "health") as SoilFertilityMetric;
  const meta = SOIL_FERTILITY_METRICS[metricId];
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        SOIL FERTILITY
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
        {meta.label}{meta.unit ? ` (${meta.unit})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.legendStops.map((s) => (
          <div key={`${s.color}-${s.label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2,
                background: s.color, opacity: 0.9, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agriculture POI Legend (休農場 / 田媽媽 / 特色農旅) ──

function AgriPOILegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        AGRICULTURE POI
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {AGRI_POI_TYPES.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: t.color,
                opacity: 0.9,
                border: "1px solid #fff",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
              {t.labelZh}
              <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>{t.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgriCompanyLegend({ visibility }: { visibility: LayerVisibility }) {
  const rows = AGRI_COMPANY_TYPES.filter((t) => visibility[t.key]);
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        農企業登記 AGRI BUSINESS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: t.color,
                opacity: 0.9,
                border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
              {t.labelZh}
              <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>{t.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Crop Suitability Legend (作物適栽 4 級 kind) ──

function CropSuitabilityLegend({ cropId }: { cropId: number }) {
  const crop = CROP_SUITABILITY_CROPS.find((c) => c.id === cropId);
  const cropLabel = crop ? `${crop.nameZh} (${crop.nameEn})` : `#${cropId}`;
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        CROP SUITABILITY
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
        {cropLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CROP_KIND_ITEMS.map((s) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earthquake Legend ──

function EarthquakeLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        EARTHQUAKE
      </div>

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(to right, ${EQ_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
          Magnitude
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[3, 5, 7].map((m) => {
            const r = m === 3 ? 4 : m === 5 ? 10 : 24;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 16),
                    height: Math.min(r, 16),
                    borderRadius: "50%",
                    background: "rgba(255, 59, 48, 0.4)",
                    border: "1px solid rgba(255, 59, 48, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Disaster Alert Legend ──

function RoadEventsLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        ROAD EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ROAD_EVENT_TYPE_ITEMS.map((item) => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: item.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
        ⚠ live_city 偏基隆；高雄缺 TDX 來源
      </div>
    </div>
  );
}

function DisasterAlertLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        DISASTER ALERT
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SEVERITY_ITEMS.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                opacity: 0.8,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── IoT River Legend (delta 紅↔藍) ──

function IotRiverLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        IOT 河川（補強）
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
          當日水位變化
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(to right, ${IOT_RIVER_DELTA_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>下降</span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>持平</span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>上升</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>-1m</span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>0</span>
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>+1m</span>
        </div>
      </div>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
        圈大小 = 變化幅度
      </div>
    </div>
  );
}

// ── IoT Structure Legend (5 類別 + 主要測項) ──

function IotStructureLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        IOT 水工結構
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IOT_STRUCTURE_TYPES.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: s.color,
                opacity: 0.9,
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{s.measure}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
