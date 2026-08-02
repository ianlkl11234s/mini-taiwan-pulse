import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

// 本檔 Title 為極簡本地版（同 culturePanels / sportsPanels 慣例）：shared.tsx 未 export Title。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

/** 台北時區今日 YYYY-MM-DD（sv-SE 本身即此格式，不 replace 斜線） */
function tourTodayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** annual_visitors_2024 為 number 才顯示：千分位 + yoy_pct 正負號% */
function visitorsRow(props: Record<string, unknown>): string {
  const visitors = props.annual_visitors_2024;
  if (typeof visitors !== "number") return "";
  const yoy = props.yoy_pct;
  const yoyStr = typeof yoy === "number" ? `（年增 ${yoy > 0 ? "+" : ""}${yoy}%）` : "";
  return `${visitors.toLocaleString()} 人次${yoyStr}`;
}

// ── 1. 觀光景點：category 五類分色 + 中文化 ──
const ATTRACTION_CATEGORY: Record<string, { label: string; color: string }> = {
  Nature: { label: "自然", color: "#2e7d32" },
  Culture: { label: "文化", color: "#6d4c41" },
  Leisure_Arts: { label: "休閒藝術", color: "#ab47bc" },
  Urban_Comm: { label: "都會社區", color: "#0288d1" },
  Other: { label: "其他", color: "#9e9e9e" },
};

export function AttractionsPanel({ props }: { props: Record<string, unknown> }) {
  const cat = String(props.category ?? "");
  const info = ATTRACTION_CATEGORY[cat] ?? { label: cat, color: "#e65100" };
  const desc = String(props.description ?? "");
  const descShown = desc.length > 150 ? `${desc.slice(0, 150)}…` : desc;
  return (
    <>
      <Title color={info.color}>{String(props.name ?? "觀光景點")}</Title>
      <Row label="類別" value={info.label} color={info.color} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="開放時間" value={String(props.open_time ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="簡介" value={descShown} />
      <Row label="2024 遊客" value={visitorsRow(props)} />
    </>
  );
}

// ── 2. 溫泉露頭 ──
export function HotSpringsPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color="#d81b60">{String(props.name ?? "溫泉露頭")}</Title>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="區域" value={String(props.district ?? "")} />
      <Row label="泉質" value={String(props.quality ?? "")} />
      <Row label="類型" value={String(props.type ?? "")} />
    </>
  );
}

// ── 3. 溫泉露頭區（面層）──
export function HotSpringZonesPanel({ props }: { props: Record<string, unknown> }) {
  const area = Number(props.area_m2);
  return (
    <>
      <Title color="#880e4f">{String(props.name ?? "溫泉露頭區")}</Title>
      <Row label="編號" value={props.zone_no == null ? "" : String(props.zone_no)} />
      <Row label="面積" value={Number.isFinite(area) && area > 0 ? `${area.toLocaleString()} m²` : ""} />
      <Row label="備註" value={String(props.remark ?? "")} />
    </>
  );
}

// ── 4. 國家風景區（面層）：manager 全 null / category 常數 → 不顯示 ──
export function ScenicAreasPanel({ props }: { props: Record<string, unknown> }) {
  const area = Number(props.area_km2);
  return (
    <>
      <Title color="#00695c">{String(props.name ?? "國家風景區")}</Title>
      <Row label="面積" value={Number.isFinite(area) && area > 0 ? `${area.toLocaleString()} km²` : ""} />
      <Row label="2024 遊客" value={visitorsRow(props)} />
    </>
  );
}

// ── 5. 文化資產：category 三值分色 ──
const HERITAGE_CATEGORY_COLOR: Record<string, string> = {
  古蹟: "#5d4037",
  歷史建築: "#8d6e63",
  文化景觀: "#a1887f",
};

export function HeritagePanel({ props }: { props: Record<string, unknown> }) {
  const cat = String(props.category ?? "");
  const color = HERITAGE_CATEGORY_COLOR[cat] ?? "#6d4c41";
  return (
    <>
      <Title color={color}>{String(props.name ?? "文化資產")}</Title>
      <Row label="類別" value={cat} color={color} />
      <Row label="級別" value={String(props.grade ?? "")} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
    </>
  );
}

// ── 7. 觀光活動・節慶：EventCancelled → 已取消；否則以 start/end 對今日判斷三態 ──
export function EventsPanel({ props }: { props: Record<string, unknown> }) {
  const start = String(props.start_time ?? "").slice(0, 10);
  const end = String(props.end_time ?? "").slice(0, 10);
  const today = tourTodayStr();
  const cancelled = String(props.event_status ?? "") === "EventCancelled";

  let statusLabel: string;
  let statusColor: string;
  if (cancelled) {
    statusLabel = "已取消";
    statusColor = "#9e9e9e";
  } else if (start && start <= today && (!end || end >= today)) {
    statusLabel = "進行中";
    statusColor = "#f9a825";
  } else if (start && start > today) {
    statusLabel = "未開始";
    statusColor = "#90a4ae";
  } else {
    statusLabel = "已結束";
    statusColor = "#616161";
  }

  const dateRange = start && end ? `${start} ~ ${end}` : start || end;
  const isFree = String(props.is_free ?? "");
  const freeLabel = isFree === "1" ? "免費" : isFree === "0" ? "收費" : "";
  return (
    <>
      <Title color={statusColor}>{String(props.name ?? "觀光活動")}</Title>
      <Row label="狀態" value={statusLabel} color={statusColor} />
      <Row label="類別" value={String(props.event_class ?? "")} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="日期" value={dateRange} />
      <Row label="費用" value={freeLabel} />
      <Row label="主辦" value={String(props.organizer ?? "")} />
    </>
  );
}

// ── 8. 觀光工廠：website 外部連結 + geocode_precision 揭露 ──
export function FactoriesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const website = String(props.website ?? "");
  return (
    <>
      <Title color="#546e7a">{String(props.name ?? "觀光工廠")}</Title>
      <Row label="區域" value={String(props.region ?? "")} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="定位精度" value={String(props.geocode_precision ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            官方網站 ↗
          </a>
        </div>
      )}
    </>
  );
}

// ── 9. 民營遊樂園：安檢誠信揭露 + coord_source=parking 註記 ──
export function AmusementParksPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const issues = props.inspection_issues_count;
  const issuesStr = issues == null || issues === "" ? "" : String(issues);
  const isParking = String(props.coord_source ?? "") === "parking";
  return (
    <>
      <Title color="#00acc1">{String(props.name ?? "民營遊樂園")}</Title>
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="開放時間" value={String(props.open_hours ?? "")} />
      <Row label="檢查日期" value={String(props.inspection_date ?? "")} />
      <Row label="最新檢查" value={String(props.inspection_latest ?? "")} />
      <Row label="缺失項數" value={issuesStr} />
      {isParking && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
          點位為停車場（誤差 &lt; 500m）
        </div>
      )}
    </>
  );
}

// ── 10. 露營場 ──
export function CampingPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const website = String(props.website ?? "");
  return (
    <>
      <Title color="#7cb342">{String(props.name ?? "露營場")}</Title>
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="區域" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="合法性" value={String(props.legal_status ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            官方網站 ↗
          </a>
        </div>
      )}
    </>
  );
}

// ── 11. 旅宿：hotel_classes 代碼轉中文 + 分色 ──
const HOTEL_CLASS: Record<string, { label: string; color: string }> = {
  "1": { label: "國際觀光旅館", color: "#d32f2f" },
  "2": { label: "一般觀光旅館", color: "#f57c00" },
  "3": { label: "旅館", color: "#1976d2" },
  "4": { label: "民宿", color: "#43a047" },
};

export function HotelsPanel({ props }: { props: Record<string, unknown> }) {
  const code = String(props.hotel_classes ?? "");
  const info = HOTEL_CLASS[code] ?? { label: code, color: "#9e9e9e" };
  const cityTown = `${String(props.city ?? "")}${String(props.town ?? "")}`;
  const stars = Number(props.hotel_stars);
  const rooms = Number(props.total_rooms);
  const low = Number(props.lowest_price);
  const ceil = Number(props.ceiling_price);
  let priceRow = "";
  if (Number.isFinite(low) && low > 0 && Number.isFinite(ceil) && ceil > 0) {
    priceRow = `${low.toLocaleString()} ~ ${ceil.toLocaleString()} 元`;
  } else if (Number.isFinite(low) && low > 0) {
    priceRow = `${low.toLocaleString()} 元起`;
  }
  return (
    <>
      <Title color={info.color}>{String(props.hotel_name ?? "旅宿")}</Title>
      <Row label="類別" value={info.label} color={info.color} />
      <Row label="縣市區" value={cityTown} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="星級" value={Number.isFinite(stars) && stars > 0 ? `${stars} 星` : ""} />
      <Row label="總房數" value={Number.isFinite(rooms) && rooms > 0 ? `${rooms.toLocaleString()} 間` : ""} />
      <Row label="房價" value={priceRow} />
    </>
  );
}

// ── 12. 觀光餐飲：v1 單色不分色，cuisine_class 顯示原代碼 ──
export function RestaurantsPanel({ props }: { props: Record<string, unknown> }) {
  const cityTown = `${String(props.city ?? "")}${String(props.town ?? "")}`;
  return (
    <>
      <Title color="#c62828">{String(props.name ?? "觀光餐飲")}</Title>
      <Row label="縣市區" value={cityTown} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="營業時間" value={String(props.service_time ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="類別代碼" value={String(props.cuisine_class ?? "")} />
    </>
  );
}
