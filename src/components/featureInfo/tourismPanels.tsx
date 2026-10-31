import { placeName, placeTown } from "../../i18n/placeText";
import { useLocale } from "../../state/localeStore";
import { FONT_SIZE } from "../../styles/designTokens";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import type { LocaleSnapshot } from "../../state/localeStore";

type I18n = Pick<LocaleSnapshot, "t" | "formatNumber">;
import {
  TOUR_ATTRACTION_CATEGORY_INFO, TOUR_HERITAGE_CATEGORY_COLOR_MAP, TOUR_HOTEL_CLASS_INFO,
} from "../../data/tourTypes";

/** 台北時區今日 YYYY-MM-DD（sv-SE 本身即此格式，不 replace 斜線） */
function tourTodayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** annual_visitors_2024 為 number 才顯示：千分位 + yoy_pct 正負號% */
function visitorsRow(props: Record<string, unknown>, { t: tr, formatNumber }: I18n): string {
  const visitors = props.annual_visitors_2024;
  if (typeof visitors !== "number") return "";
  const yoy = props.yoy_pct;
  const yoyStr = typeof yoy === "number" ? tr("popup.tourism.yoy", { value: `${yoy > 0 ? "+" : ""}${yoy}` }) : "";
  return `${tr("popup.tourism.visitorCount", { count: formatNumber(visitors) })}${yoyStr}`;
}

// ── 1. 觀光景點：category 五類分色 + 中文化（色表 SSOT = data/tourTypes.ts） ──
export function AttractionsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cat = String(props.category ?? "");
  const info = TOUR_ATTRACTION_CATEGORY_INFO[cat] ?? { label: cat, color: "#e65100" };
  const desc = String(props.description ?? "");
  const descShown = desc.length > 150 ? `${desc.slice(0, 150)}…` : desc;
  return (
    <>
      <Title color={info.color}>{String(props.name ?? tr("popup.tourism.attraction"))}</Title>
      <Row field="category" value={info.label} color={info.color} />
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="openingHours" value={String(props.open_time ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row label={tr("popup.tourism.intro")} value={descShown} />
      <Row label={tr("popup.tourism.visitors2024")} value={visitorsRow(props, i18n)} />
    </>
  );
}

// ── 2. 溫泉露頭 ──
export function HotSpringsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  return (
    <>
      <Title color="#d81b60">{String(props.name ?? tr("popup.tourism.hotSpring"))}</Title>
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="region" value={placeTown(String(props.county ?? ""), String(props.district ?? ""), i18n)} />
      <Row label={tr("popup.tourism.springQuality")} value={String(props.quality ?? "")} />
      <Row field="type" value={String(props.type ?? "")} />
    </>
  );
}

// ── 3. 溫泉露頭區（面層）──
export function HotSpringZonesPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatNumber } = useLocale();
  const area = Number(props.area_m2);
  return (
    <>
      <Title color="#880e4f">{String(props.name ?? tr("popup.tourism.hotSpringZone"))}</Title>
      <Row field="number" value={props.zone_no == null ? "" : String(props.zone_no)} />
      <Row field="area" value={Number.isFinite(area) && area > 0 ? `${formatNumber(area)} m²` : ""} />
      <Row field="remarks" value={String(props.remark ?? "")} />
    </>
  );
}

// ── 4. 國家風景區（面層）：manager 全 null / category 常數 → 不顯示 ──
export function ScenicAreasPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const area = Number(props.area_km2);
  return (
    <>
      <Title color="#00695c">{String(props.name ?? tr("popup.tourism.scenicArea"))}</Title>
      <Row field="area" value={Number.isFinite(area) && area > 0 ? `${formatNumber(area)} km²` : ""} />
      <Row label={tr("popup.tourism.visitors2024")} value={visitorsRow(props, i18n)} />
    </>
  );
}

// ── 5. 文化資產：category 七類分色（色表 SSOT = data/tourTypes.ts） ──
export function HeritagePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cat = String(props.category ?? "");
  const color = TOUR_HERITAGE_CATEGORY_COLOR_MAP[cat] ?? "#6d4c41";
  return (
    <>
      <Title color={color}>{String(props.name ?? tr("popup.tourism.heritage"))}</Title>
      <Row field="category" value={cat} color={color} />
      <Row label={tr("popup.tourism.grade")} value={String(props.grade ?? "")} />
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
    </>
  );
}

// ── 7. 觀光活動・節慶：EventCancelled → 已取消；否則以 start/end 對今日判斷三態 ──
export function EventsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const start = String(props.start_time ?? "").slice(0, 10);
  const end = String(props.end_time ?? "").slice(0, 10);
  const today = tourTodayStr();
  const cancelled = String(props.event_status ?? "") === "EventCancelled";

  let statusLabel: string;
  let statusColor: string;
  if (cancelled) {
    statusLabel = tr("popup.tourism.cancelled");
    statusColor = "#9e9e9e";
  } else if (start && start <= today && (!end || end >= today)) {
    statusLabel = tr("popup.tourism.ongoing");
    statusColor = "#f9a825";
  } else if (start && start > today) {
    statusLabel = tr("popup.tourism.upcoming");
    statusColor = "#90a4ae";
  } else {
    statusLabel = tr("popup.tourism.ended");
    statusColor = "#616161";
  }

  const dateRange = start && end ? `${start} ~ ${end}` : start || end;
  const isFree = String(props.is_free ?? "");
  const freeLabel = isFree === "1" ? tr("popup.tourism.free") : isFree === "0" ? tr("popup.tourism.paid") : "";
  return (
    <>
      <Title color={statusColor}>{String(props.name ?? tr("popup.tourism.event"))}</Title>
      <Row field="status" value={statusLabel} color={statusColor} />
      <Row field="category" value={String(props.event_class ?? "")} />
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="date" value={dateRange} />
      <Row label={tr("popup.tourism.fee")} value={freeLabel} />
      <Row label={tr("popup.tourism.organizer")} value={String(props.organizer ?? "")} />
    </>
  );
}

// ── 8. 觀光工廠：website 外部連結 + geocode_precision 揭露 ──
export function FactoriesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const website = String(props.website ?? "");
  return (
    <>
      <Title color="#546e7a">{String(props.name ?? tr("popup.tourism.factory"))}</Title>
      <Row field="region" value={String(props.region ?? "")} />
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="positionAccuracy" value={String(props.geocode_precision ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            {tr("popup.tourism.officialSite")}
          </a>
        </div>
      )}
    </>
  );
}

// ── 9. 民營遊樂園：安檢誠信揭露 + coord_source=parking 註記 ──
export function AmusementParksPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const issues = props.inspection_issues_count;
  const issuesStr = issues == null || issues === "" ? "" : String(issues);
  const isParking = String(props.coord_source ?? "") === "parking";
  return (
    <>
      <Title color="#00acc1">{String(props.name ?? tr("popup.tourism.amusementPark"))}</Title>
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row field="openingHours" value={String(props.open_hours ?? "")} />
      <Row label={tr("popup.tourism.inspectionDate")} value={String(props.inspection_date ?? "")} />
      <Row label={tr("popup.tourism.latestInspection")} value={String(props.inspection_latest ?? "")} />
      <Row label={tr("popup.tourism.issuesCount")} value={issuesStr} />
      {isParking && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
          {tr("popup.tourism.parkingNote")}
        </div>
      )}
    </>
  );
}

// ── 10. 露營場 ──
export function CampingPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const website = String(props.website ?? "");
  return (
    <>
      <Title color="#7cb342">{String(props.name ?? tr("popup.tourism.camping"))}</Title>
      <Row field="county" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="region" value={placeTown(String(props.city ?? ""), String(props.district ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="status" value={String(props.status ?? "")} />
      <Row label={tr("popup.tourism.legality")} value={String(props.legal_status ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      {website && website !== "null" && (
        <div style={{ marginTop: 4, fontSize: FONT_SIZE.base }}>
          <a href={website} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>
            {tr("popup.tourism.officialSite")}
          </a>
        </div>
      )}
    </>
  );
}

// ── 11. 旅宿：hotel_classes 代碼轉中文 + 分色（色表 SSOT = data/tourTypes.ts） ──
export function HotelsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const code = String(props.hotel_classes ?? "");
  const info = TOUR_HOTEL_CLASS_INFO[code] ?? { label: code, color: "#9e9e9e" };
  const cityTown = placeName(`${String(props.city ?? "")}${String(props.town ?? "")}`, i18n);
  const stars = Number(props.hotel_stars);
  const rooms = Number(props.total_rooms);
  const low = Number(props.lowest_price);
  const ceil = Number(props.ceiling_price);
  let priceRow = "";
  if (Number.isFinite(low) && low > 0 && Number.isFinite(ceil) && ceil > 0) {
    priceRow = tr("popup.tourism.priceRange", { low: formatNumber(low), high: formatNumber(ceil) });
  } else if (Number.isFinite(low) && low > 0) {
    priceRow = tr("popup.tourism.priceFrom", { low: formatNumber(low) });
  }
  return (
    <>
      <Title color={info.color}>{String(props.hotel_name ?? tr("popup.tourism.hotel"))}</Title>
      <Row field="category" value={info.label} color={info.color} />
      <Row field="countyDistrict" value={cityTown} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={tr("popup.tourism.starRating")} value={Number.isFinite(stars) && stars > 0 ? tr("popup.tourism.starsValue", { count: stars }) : ""} />
      <Row label={tr("popup.tourism.totalRooms")} value={Number.isFinite(rooms) && rooms > 0 ? tr("popup.tourism.roomsValue", { count: formatNumber(rooms) }) : ""} />
      <Row label={tr("popup.tourism.roomPrice")} value={priceRow} />
    </>
  );
}

// ── 12. 觀光餐飲：v1 單色不分色，cuisine_class 顯示原代碼 ──
export function RestaurantsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cityTown = placeName(`${String(props.city ?? "")}${String(props.town ?? "")}`, i18n);
  return (
    <>
      <Title color="#c62828">{String(props.name ?? tr("popup.tourism.restaurant"))}</Title>
      <Row field="countyDistrict" value={cityTown} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="businessHours" value={String(props.service_time ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
      <Row label={tr("popup.tourism.cuisineCode")} value={String(props.cuisine_class ?? "")} />
    </>
  );
}
