import { Row, SourceFooter } from "./shared";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";

type PanelProps = { props: Record<string, unknown> };

function Header({ color, name }: { color: string; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5, wordBreak: "break-word" }}>
        {name}
      </div>
    </div>
  );
}

const POLICE_SUBTYPE_ZH: Record<string, string> = {
  substation: "派出所",
  precinct: "分局",
  police_dept: "警察局",
  specialized: "專業警隊",
  headquarters: "總部",
  security: "保安",
  other: "其他",
};

const CORRECTIONAL_TYPE_ZH: Record<string, string> = {
  prison: "監獄",
  detention: "看守所",
  drug_rehab: "戒治所",
  juvenile_obs: "少年觀護所",
  correction_school: "矯正學校",
};

const COURT_TYPE_ZH: Record<string, string> = {
  supreme: "最高法院",
  high: "高等法院",
  district: "地方法院",
  admin: "行政法院",
  ipc: "智慧財產及商業法院",
  juvenile_family: "少年及家事法院",
};

const PROS_TYPE_ZH: Record<string, string> = {
  supreme: "最高檢察署",
  high: "高等檢察署",
  district: "地方檢察署",
};

const SPEED_CAM_ZH: Record<string, string> = {
  speed_camera_general: "一般測速",
  speed_camera_freeway: "國道測速",
  speed_camera_red_light: "闖紅燈",
  speed_camera_railway_crossing: "鐵路平交道",
};

// ── 警政 ──
export function PoliceStationPanel({ props }: PanelProps) {
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#1e40af" name={String(props.name ?? "警察機關")} />
      <Row label="類型" value={POLICE_SUBTYPE_ZH[sub] ?? sub} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function WomenChildWarningPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#ec4899" name={String(props.name ?? "婦幼警示點")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="分局" value={String(props.branch ?? "")} />
      <Row label="承辦" value={String(props.contact ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function SpeedCameraPanel({ props }: PanelProps) {
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#dc2626" name={SPEED_CAM_ZH[sub] ?? "測速照相"} />
      <Row label="地點" value={String(props.address ?? "")} />
      <Row label="方向" value={String(props.direction ?? "")} />
      <Row label="限速" value={props.limit_kph ? `${props.limit_kph} km/h` : ""} />
      <Row label="縣市" value={`${String(props.city ?? "")} ${String(props.region ?? "")}`.trim()} />
      <Row label="分局" value={String(props.branch ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function SpeedZoneSegmentPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#b91c1c" name="區間測速路段" />
      <Row label="位置" value={String(props.location ?? "")} />
      <Row label="限速" value={String(props.limit_kph ?? "")} />
      <Row label="取締項目" value={String(props.enforcement_item ?? "")} />
      <Row label="縣市" value={String(props.city ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 司法矯正 ──
export function CourtPanel({ props }: PanelProps) {
  const ct = String(props.court_type ?? "");
  return (
    <>
      <Header color="#7c3aed" name={String(props.name ?? "法院")} />
      <Row label="類型" value={COURT_TYPE_ZH[ct] ?? ct} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="官網" value={String(props.url ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function ProsecutorsOfficePanel({ props }: PanelProps) {
  const pt = String(props.pros_type ?? "");
  return (
    <>
      <Header color="#a855f7" name={String(props.name ?? "檢察署")} />
      <Row label="類型" value={PROS_TYPE_ZH[pt] ?? pt} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="官網" value={String(props.url ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function CorrectionalFacilityPanel({ props }: PanelProps) {
  const ft = String(props.facility_type ?? "");
  return (
    <>
      <Header color="#374151" name={String(props.name ?? "矯正機關")} />
      <Row label="類型" value={CORRECTIONAL_TYPE_ZH[ft] ?? String(props.nature_zh ?? ft)} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="官網" value={String(props.url ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
        ⓘ 全國在監人數請看右下 Monitor PrisonCard
      </div>
      <SourceFooter props={props} />
    </>
  );
}

export function CourtJurisdictionPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#7c3aed" name={`${String(props.county ?? "")} 法院管轄`} />
      <Row label="地方法院" value={String(props.district_court ?? "")} />
      <Row label="高等法院" value={String(props.high_court ?? "")} />
      <Row label="行政法院" value={String(props.admin_court ?? "")} />
      <Row label="智慧財產" value={String(props.ipc_court ?? "")} />
      <Row label="少年家事" value={String(props.juvenile_family_court ?? "")} />
      <Row label="最高法院" value={String(props.supreme_court ?? "")} />
      <Row label="法源" value={String(props.source_law ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 治安態勢 ──
export function CrimeAreaMonthlyPanel({ props }: PanelProps) {
  const byType = (() => {
    try {
      const v = props.by_type;
      if (typeof v === "string") return JSON.parse(v) as Record<string, number>;
      if (v && typeof v === "object") return v as Record<string, number>;
      return {};
    } catch { return {}; }
  })();
  const byYear = (() => {
    try {
      const v = props.by_year;
      if (typeof v === "string") return JSON.parse(v) as Record<string, number>;
      if (v && typeof v === "object") return v as Record<string, number>;
      return {};
    } catch { return {}; }
  })();
  const topTypes = Object.entries(byType)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 5);
  const years = Object.keys(byYear).map(Number).filter(Number.isFinite).sort();
  const yrLabel = years.length > 0 ? `民國 ${years[0]} ~ ${years[years.length - 1]}（${years.length} 年累計）` : "";
  return (
    <>
      <Header color="#991b1b" name={`${String(props.county ?? "")} ${String(props.town ?? "")}`} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#7f1d1d", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        {yrLabel || "11 年累計"}
      </div>
      <Row label="總事件" value={String(props.total_events ?? "0")} />
      {topTypes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 }}>主要類型 Top 5</div>
          {topTypes.map(([k, v]) => <Row key={k} label={k} value={String(v)} />)}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
        資料來源：警政署 nid 14200 鄉鎮犯罪資料表（民國 104~115）<br />
        ⚠ 顯示為累計值，非即時／近期統計
      </div>
    </>
  );
}

export function TheftTaoyuanPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#f59e0b" name={String(props.case_type ?? "竊盜事件")} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#92400e", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        2014~2024 年累計（桃園）
      </div>
      <Row label="年度" value={String(props.year ?? "")} />
      <Row label="日期" value={String(props.date ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function TrafficAccidentYearlyPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#fb7185" name="A1 死亡事故" />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#9f1239", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        2025 年度年度累計
      </div>
      <Row label="時間" value={`${String(props.date ?? "")} ${String(props.time ?? "")}`.trim()} />
      <Row label="地點" value={String(props.location ?? "")} />
      <Row label="處理單位" value={String(props.agency ?? "")} />
      <Row label="天氣" value={String(props.weather ?? "")} />
      <Row label="照明" value={String(props.light ?? "")} />
      <Row label="道路類別" value={String(props.road_type ?? "")} />
      <Row label="速限" value={props.speed_limit ? `${props.speed_limit} km/h` : ""} />
      <SourceFooter props={props} />
    </>
  );
}

export function AccidentTaipeiPanel({ props }: PanelProps) {
  const cls = String(props.case_class ?? "");
  return (
    <>
      <Header color={cls === "1" ? "#dc2626" : "#fda4af"} name={cls === "1" ? "A1 死亡事故" : "A2 受傷事故"} />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#9f1239", color: "#fff", fontSize: FONT_SIZE.xs, marginBottom: 6 }}>
        2019~ 多年累計（北市）
      </div>
      <Row label="時間" value={String(props.occurred_at ?? "")} />
      <Row label="地點" value={String(props.location ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function A1AccidentRealtimePanel({ props }: PanelProps) {
  const ageH = Number(props.age_hours ?? 0);
  const ageLabel = ageH < 1 ? `${Math.round(ageH * 60)} 分鐘前`
    : ageH < 24 ? `${ageH.toFixed(1)} 小時前 · 當天`
    : ageH < 168 ? `${(ageH / 24).toFixed(1)} 天前 · 本週`
    : `${(ageH / 24).toFixed(0)} 天前`;
  const ageColor = ageH < 24 ? "#ef4444" : ageH < 168 ? "#dc2626" : "#7f1d1d";
  return (
    <>
      <Header color={ageColor} name="A1 死亡事故" />
      <div style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: ageColor, color: "#fff", fontSize: FONT_SIZE.xs, fontWeight: 600, marginBottom: 6 }}>
        {ageLabel}
      </div>
      <Row label="發生時間" value={String(props.occurred_at ?? "")} />
      <Row label="地點" value={String(props.location ?? "")} />
      <Row label="處理單位" value={String(props.agency ?? "")} />
      <Row label="天氣" value={String(props.weather ?? "")} />
      <Row label="道路類別" value={String(props.road_type ?? "")} />
      <Row label="肇因大類" value={String(props.cause_main_major ?? "")} />
      <Row label="肇因子類" value={String(props.cause_main_sub ?? "")} />
      <Row label="死傷" value={String(props.death_injury ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
        資料來源：警政署 nid 57023（每 12h 更新）<br />
        畫面顯示過去 30 天滾動，當天/本週/30 天分桶呈現
      </div>
    </>
  );
}

// ── 廉政移民海巡 ──
export function InvestigationBureauPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#0f766e" name={String(props.name ?? "調查局")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function AntiCorruptionOfficePanel({ props }: PanelProps) {
  const level = String(props.level ?? "");
  return (
    <>
      <Header color="#14b8a6" name={String(props.name ?? "廉政")} />
      <Row label="層級" value={level === "central" ? "中央" : level === "local" ? "地方" : level} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="檢舉電話" value={String(props.phone1 ?? props.phone ?? "")} />
      <Row label="檢舉專線" value={String(props.phone2 ?? "")} />
      <Row label="信箱" value={String(props.email ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

export function ImmigrationOfficePanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#0ea5e9" name={String(props.name ?? "移民署服務站")} />
      <Row label="英文名" value={String(props.name_en ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="傳真" value={String(props.fax ?? "")} />
      <Row label="官網" value={String(props.url ?? "")} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
        資料來源：內政部移民署 opendata.immigration.gov.tw
      </div>
    </>
  );
}

export function CoastGuardStationPanel({ props }: PanelProps) {
  const sub = String(props.facility_subtype ?? "");
  return (
    <>
      <Header color="#0284c7" name={String(props.name ?? "海巡")} />
      <Row label="類型" value={sub === "patrol_station" ? "巡防隊" : sub === "ocean_pier" ? "漁港" : sub} />
      <Row label="所屬" value={String(props.area ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 警察覆蓋分析 isochrone（共用 panel） ──
function IsochronePanel({ props, title, color }: PanelProps & { title: string; color: string }) {
  const cnt = Number(props.overlap_count ?? 0);
  const tier = String(props.tier ?? "");
  const mode = String(props.mode ?? "");
  const mins = String(props.minutes ?? "");
  const lvl = cnt >= 20 ? "極多重保護" : cnt >= 12 ? "高度重疊" : cnt >= 5 ? "中度重疊" : cnt >= 2 ? "雙重保護" : "單一覆蓋";
  return (
    <>
      <Header color={color} name={title} />
      <div style={{ display: "inline-block", padding: "1px 8px", borderRadius: 4, background: color, color: "#fff", fontSize: FONT_SIZE.sm, fontWeight: 700, marginBottom: 8 }}>
        覆蓋站數 {cnt} · {lvl}
      </div>
      <Row label="層級" value={tier === "substation" ? "派出所" : tier === "precinct" ? "分局" : "縣市警局"} />
      <Row label="模式" value={mode === "walk" ? "步行" : mode === "drive" ? "開車" : mode} />
      <Row label="時間" value={`${mins} 分鐘`} />
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.5 }}>
        重疊計數法（Overlap Count）：此處同時被 {cnt} 個{tier === "substation" ? "派出所" : tier === "precinct" ? "分局" : "縣市警局"}的 {mins} 分鐘{mode === "walk" ? "步行" : "開車"}圈包含。
      </div>
    </>
  );
}
export function PoliceIsoSubstationPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} title="派出所等時圈" color="#1e40af" />;
}
export function PoliceIsoPrecinctPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} title="分局等時圈" color="#3b82f6" />;
}
export function PoliceIsoCityDeptPanel({ props }: PanelProps) {
  return <IsochronePanel props={props} title="縣市警局等時圈" color="#60a5fa" />;
}

// ── 航空：航空器空域 eAIP ──
const AIRSPACE_LAYER_COLOR: Record<string, string> = {
  FIR: "#6495ED", TMA: "#4682B4",
  CTR: "#1E90FF", CONTROL: "#1E90FF", SURFACE: "#1E90FF",
  RCR: "#DC3545", DANGER: "#FF5722",
  ULZ: "#FFC107", CIRCUIT: "#4CAF50",
};
const AIRSPACE_LAYER_ZH: Record<string, string> = {
  FIR: "飛航情報區", TMA: "終端管制區", CTR: "機場管制空域",
  CONTROL: "一般管制空域", SURFACE: "機場地面層",
  RCR: "限航區", DANGER: "危險區", ULZ: "超輕型活動區", CIRCUIT: "起降航線",
};
function fmtAlt(m: unknown, raw: unknown): string {
  if (raw && String(raw).trim()) return String(raw);
  const v = Number(m);
  if (!Number.isFinite(v)) return "";
  if (v >= 99999) return "UNL（無上限）";
  if (v <= 0) return "SFC（地表）";
  return `${v.toLocaleString()} m`;
}
export function AviationAirspacePanel({ props }: PanelProps) {
  const layer = String(props.layer ?? "");
  const color = AIRSPACE_LAYER_COLOR[layer] ?? "#94a3b8";
  const layerZh = AIRSPACE_LAYER_ZH[layer] ?? layer;
  const name = String(props.name_zh ?? props.name_en ?? props.code ?? "航空器空域");
  return (
    <>
      <Header color={color} name={name} />
      <Row label="類別" value={layer ? `${layer}（${layerZh}）` : ""} />
      <Row label="代碼" value={String(props.code ?? "")} />
      <Row label="底高度 floor" value={fmtAlt(props.floor_m, props.floor_raw)} />
      <Row label="頂高度 ceiling" value={fmtAlt(props.ceiling_m, props.ceiling_raw)} />
      <Row label="airspace class" value={String(props.airspace_class ?? "")} />
      <Row label="備註" value={String(props.remarks ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 航空：無人機禁航區 ──
const DRONE_COLOR: Record<string, string> = {
  "紅區": "#DC3545",
  "黃區": "#FFC107",
};
export function DroneZonesPanel({ props }: PanelProps) {
  const zoneColor = String(props["空域顏色"] ?? "未分類");
  const headerColor = DRONE_COLOR[zoneColor] ?? "#6C757D";
  return (
    <>
      <Header color={headerColor} name={String(props["空域名稱"] ?? "禁航區")} />
      <Row label="空域顏色" value={zoneColor} />
      <Row label="空域類別" value={String(props["空域類別"] ?? "")} />
      <Row label="主管機關" value={String(props["主管機關名稱"] ?? "")} />
      <Row label="罰則" value={String(props["罰則"] ?? "")} />
      <Row label="聯絡方式" value={String(props["聯絡方式"] ?? "")} />
      <Row label="說明" value={String(props["空域說明"] ?? "")} />
      <Row label="縣市" value={String(props.countyname ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 民防 ──
export function CivilDefenseShelterPanel({ props }: PanelProps) {
  return (
    <>
      <Header color="#64748b" name={String(props.name ?? "防空避難所")} />
      <Row label="類型" value={String(props.subtype ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="容量" value={props.capacity ? `${props.capacity} 人` : ""} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}
