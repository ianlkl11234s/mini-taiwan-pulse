import { useEffect, useState } from "react";
import { CctvStreamView } from "../CctvStreamView";
import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { fetchAirportHourlyPax } from "../../data/airportPaxLoader";

/** 海纜 cable_type 對應色 */
const CABLE_TYPE_COLORS: Record<string, string> = {
  "國際幹線": "#2196F3",
  "海峽專線": "#F44336",
  "離島連接": "#4CAF50",
  "中國境內": "#FF9800",
  "規劃中": "#9E9E9E",
};

/** 登陸站 station_type 對應色 */
const STATION_TYPE_COLORS: Record<string, string> = {
  "國際樞紐": "#2196F3",
  "區域節點": "#26c6da",
};

/** 超商品牌對應色 */
const BRAND_COLORS: Record<string, string> = {
  "7-ELEVEN": "#00843D",
  "全家": "#00843D",
  "FamilyMart": "#00843D",
  "萊爾富": "#E31937",
  "Hi-Life": "#E31937",
  "OK": "#FF8C00",
  "OKmart": "#FF8C00",
};

/** 機關便民據點 type → 中文 label + 色 */
const GOV_OFFICE_TYPE: Record<string, { color: string; label: string }> = {
  district_office: { color: "#8d6e63", label: "公所" },
  household_registration: { color: "#7986cb", label: "戶政事務所" },
  land_office: { color: "#9ccc65", label: "地政事務所" },
};

/** 公廁清潔評鑑等級 → 色（缺值 fallback 灰）*/
const TOILET_GRADE_COLOR: Record<string, string> = {
  特優級: "#7e57c2",
  優等級: "#ab47bc",
  普通級: "#ffb300",
  不合格: "#e53935",
};

/** 港口分類對應色 */
const PORT_CLASS_COLORS: Record<string, string> = {
  "國際商港": "#42a5f5",
  "國內商港": "#64b5f6",
  "第一類漁港": "#26c6da",
  "第二類漁港": "#4dd0e1",
  "工業專用港": "#ffa726",
  "軍港": "#78909c",
};

/** CCTV source 對應色 / 標籤 */
const CCTV_SOURCE: Record<string, { color: string; label: string }> = {
  freeway: { color: "#ff9800", label: "國道" },
  highway: { color: "#ffd54f", label: "省道快速道路" },
  city:    { color: "#26c6da", label: "市區道路" },
};

export function SubmarineCablePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const cableType = String(props.cable_type ?? "");
  const accentColor = CABLE_TYPE_COLORS[cableType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Cable")}
        </div>
      </div>
      <Row label="類型" value={cableType} color={accentColor} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="啟用年" value={String(props.rfs_year ?? "")} />
      <Row label="長度" value={String(props.length ?? "")} />
      <Row label="擁有者" value={String(props.owners ?? "")} />
      <Row label="供應商" value={String(props.suppliers ?? "")} />
      <Row label="台灣端" value={String(props.tw_landings ?? "")} />
      <Row label="中國端" value={String(props.cn_landings ?? "")} />
    </>
  );
}

export function LandingStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const stationType = String(props.station_type ?? "");
  const accentColor = STATION_TYPE_COLORS[stationType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="國家" value={String(props.country ?? "")} />
      <Row label="樞紐等級" value={stationType} color={accentColor} />
      <Row label="電纜數" value={String(props.cable_count ?? "")} />
      <Row label="電纜清單" value={String(props.cable_names_str ?? "")} />
    </>
  );
}

export function ConvenienceStorePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const brand = String(props.brand ?? "");
  const accentColor = BRAND_COLORS[brand] ?? "#26c6da";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Store")}
        </div>
      </div>
      <Row label="品牌" value={brand} color={accentColor} />
      <Row label="地址" value={String(props.addr ?? props.address ?? "")} />
    </>
  );
}

export function PostOfficePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#d32f2f";
  const flag = (v: unknown) => (v === true || v === "true" || v === 1 ? "✓" : "✗");
  const city = String(props.city ?? "");
  const district = String(props.district ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Post Office")}
        </div>
      </div>
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="縣市區" value={[city, district].filter(Boolean).join(" ")} />
      <Row label="平日營業" value={flag(props.weekday_service)} color={accentColor} />
      <Row label="平日延時" value={flag(props.weekday_extended_service)} />
      <Row label="週六營業" value={flag(props.saturday_service)} />
      <Row label="週日營業" value={flag(props.sunday_service)} />
    </>
  );
}

export function IPostBoxPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#ef6c00";
  const lockerCount = props.locker_count != null ? String(props.locker_count) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown iPost Box")}
        </div>
      </div>
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="相對位置" value={String(props.relative_location ?? "")} />
      <Row label="營業時間" value={String(props.business_hours ?? "")} color={accentColor} />
      <Row label="格數" value={lockerCount ? `${lockerCount} 格` : ""} />
      <Row label="櫃型" value={String(props.cabinet_type ?? "")} />
    </>
  );
}

export function CommunityCenterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#26a69a";
  const county = String(props.county ?? "");
  const town = String(props.town ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Community Center")}
        </div>
      </div>
      <Row label="行政區" value={[county, town].filter(Boolean).join(" ")} color={accentColor} />
      <Row label="地址" value={String(props.address ?? "")} />
    </>
  );
}

export function GovServiceOfficePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const type = String(props.type ?? "");
  const info = GOV_OFFICE_TYPE[type] ?? { color: "#8d6e63", label: type };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Office")}
        </div>
      </div>
      <Row label="類型" value={info.label} color={info.color} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="轄區" value={String(props.jurisdiction ?? "")} />
    </>
  );
}

export function PublicLibraryPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#5c6bc0";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Library")}
        </div>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} color={accentColor} />
      <Row label="類型" value={String(props.type ?? "")} />
    </>
  );
}

export function WelfareCenterPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#ec407a";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Welfare Center")}
        </div>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} color={accentColor} />
      <Row label="服務區" value={String(props.service_area ?? "")} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        資料時點 2023-04
      </div>
    </>
  );
}

export function RetailMarketPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#66bb6a";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Market")}
        </div>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} color={accentColor} />
      <Row label="營業時間" value={String(props.business_hours ?? "")} />
    </>
  );
}

export function PublicToiletPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const grade = String(props.grade ?? "");
  const gradeColor = TOILET_GRADE_COLOR[grade] ?? "#9e9e9e";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: gradeColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Toilet")}
        </div>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="等級" value={grade} color={gradeColor} />
      <Row label="類別" value={String(props.type2 ?? "")} />
    </>
  );
}

export function LighthousePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ffd700", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Unknown Lighthouse")}
        </div>
      </div>
      <Row label="緯度" value={String(props.Lat ?? "")} />
      <Row label="經度" value={String(props.Lon ?? "")} />
    </>
  );
}

export function PortPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const portClass = String(props.port_class ?? "");
  const accentColor = PORT_CLASS_COLORS[portClass] ?? "#88bbff";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Port")}
        </div>
      </div>
      <Row label="分類" value={portClass} color={accentColor} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="資料源" value={String(props.source ?? "")} />
    </>
  );
}

export function AirportPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const iata = String(props.iata ?? "");
  const [series, setSeries] = useState<{ inSeries: SparklinePoint[]; outSeries: SparklinePoint[] }>({ inSeries: [], outSeries: [] });
  const [loadingTs, setLoadingTs] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!iata) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchAirportHourlyPax(iata, 24)
      .then((rows) => {
        if (cancelled) return;
        const inSeries = rows.map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: Number(r.pax_in) || 0 }));
        const outSeries = rows.map((r) => ({ t: Date.parse(r.hour_bucket) / 1000, v: Number(r.pax_out) || 0 }));
        setSeries({ inSeries, outSeries });
        setHasData(rows.length > 0);
      })
      .catch((e) => console.warn("[AirportPanel] hourly pax fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [iata]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#daa520", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Airport")}
        </div>
      </div>
      <Row label="英文" value={String(props.name_en ?? "")} />
      <Row label="ICAO" value={String(props.icao ?? "")} />
      <Row label="IATA" value={iata} />

      {iata && (
        <>
          <div style={{ marginTop: 10, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
            24h 入境人次（每小時）
          </div>
          {loadingTs ? (
            <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
              載入中…
            </div>
          ) : !hasData ? (
            <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim, padding: "8px 4px", textAlign: "center" }}>
              無資料（border_airport_snapshot collector 未涵蓋此機場）
            </div>
          ) : (
            <>
              <TimeseriesSparkline data={series.inSeries} unit="人" lineColor="#10b981" height={80} />
              <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
                24h 出境人次
              </div>
              <TimeseriesSparkline data={series.outSeries} unit="人" lineColor="#fb7185" height={80} />
            </>
          )}
        </>
      )}
    </>
  );
}

export function CctvPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const source = String(props.source ?? "");
  const info = CCTV_SOURCE[source] ?? { color: "#26c6da", label: source };
  const streamUrl = String(props.VideoStreamURL ?? "");
  const imageUrlRaw = props.VideoImageURL != null ? String(props.VideoImageURL) : "";
  const imageUrl = imageUrlRaw && imageUrlRaw !== "null" && imageUrlRaw !== "undefined" ? imageUrlRaw : "";
  // 換選別支時用 CCTVID 當 key 強制 remount，確保串流狀態機與 MJPEG 連線重置
  const cctvKey = String(props.CCTVID ?? streamUrl);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.RoadName ?? props.CCTVID ?? "CCTV")}
        </div>
      </div>
      <Row label="來源" value={info.label} color={info.color} />
      <Row label="方向" value={String(props.RoadDirection ?? "")} />
      <Row label="ID" value={String(props.CCTVID ?? "")} />
      {streamUrl ? (
        <CctvStreamView
          key={cctvKey}
          streamUrl={streamUrl}
          imageUrl={imageUrl}
          source={source}
          accentColor={info.color}
        />
      ) : (
        <div style={{ marginTop: 8, fontSize: FONT_SIZE.base, color: t.textMuted }}>
          此攝影機未提供串流網址
        </div>
      )}
    </>
  );
}

export function EtcGantryPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#f06292";
  const start = String(props.StartInterchange ?? "");
  const end = String(props.EndInterchange ?? "");
  const segment = start && end ? `${start} → ${end}` : (start || end);
  const fareSmall = String(props.FareSmall ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.GantryID ?? "ETC Gantry")}
        </div>
      </div>
      <Row label="國道" value={String(props.Freeway ?? "")} color={accentColor} />
      <Row label="方向" value={String(props.Direction ?? "")} />
      <Row label="區間" value={segment} />
      <Row label="里程" value={props.TollMile ? `${String(props.TollMile)} km` : ""} />
      <Row label="小型車費率" value={fareSmall ? `${fareSmall} 元/km` : ""} color={accentColor} />
    </>
  );
}

export function ServiceAreaPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#4db6ac";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Service Area")}
        </div>
      </div>
      <Row label="國道" value={String(props.Freeway ?? "")} color={accentColor} />
      <Row label="位置" value={String(props.Location ?? "")} />
      <Row label="方向" value={String(props.Direction ?? "")} />
      <Row label="經營者" value={String(props.Operator ?? "")} />
      <Row label="地址" value={String(props.Address ?? "")} />
      <Row label="主題" value={String(props.Theme ?? "")} />
    </>
  );
}

export function ServiceAreaPolygonPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#4db6ac";
  const areaHa = typeof props.area_ha === "number"
    ? props.area_ha.toFixed(2)
    : String(props.area_ha ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Service Area")}
        </div>
      </div>
      <Row label="經營者" value={String(props.Operator ?? "")} color={accentColor} />
      <Row label="主題" value={String(props.Theme ?? "")} />
      <Row label="國道" value={String(props.Freeway ?? "")} />
      <Row label="面積" value={areaHa ? `${areaHa} 公頃` : ""} />
    </>
  );
}

export function TaxiStandPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const accentColor = "#f9a825";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.Name ?? "Taxi Stand")}
        </div>
      </div>
      <Row label="行政區" value={String(props.District ?? "")} color={accentColor} />
      <Row label="位置" value={String(props.StreetName ?? "")} />
      <Row label="格位" value={props.Slots ? `${String(props.Slots)} 格` : ""} />
      <Row label="時段" value={String(props.Schedule ?? "")} />
      <Row label="城市" value={String(props.city ?? "")} />
    </>
  );
}
