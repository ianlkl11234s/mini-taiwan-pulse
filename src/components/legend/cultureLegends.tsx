// Legend sub-components (cultureLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { mapSeamColor } from "../../map/mapStyleScale";
import { usePaletteRamp } from "../../state/layerPalette";
import { LegendNote, LegendTitle, SwatchDot, useLegendTheme } from "./legendKit";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { JP_RELIGION_CATEGORIES } from "../../data/jpReligionTypes";
import { JP_ACCOMMODATION_CATEGORIES, JP_ACCOMMODATION_DENSITY_SCALES, JP_ACCOMMODATION_DENSITY_STOPS, JP_ACCOMMODATION_UNKNOWN_CATEGORY } from "../../data/jpTourismTypes";
import { SPORTS_CATEGORIES } from "../../data/sportsTypes";
import { CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES, ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR, PERFORMING_VENUE_COLOR, LIBRARY_SEATS_COLORS } from "../../data/cultureTypes";
import { DEITY_FAMILIES, ANCESTRAL_HALL_TYPES, RELIGION_LAYER_COLORS } from "../../data/religionTypes";
import { FUNERAL_FACILITY_TYPES, FUNERAL_OPERATOR_ENTITY_TYPES, FUNERAL_DENSITY_BUCKETS, CEMETERY_ZONING_CLASSES, CEMETERY_OSM_ODBL_NOTE, FUNERAL_LAYER_COLORS } from "../../data/funeralTypes";
import { TOUR_ATTRACTION_CATS, TOUR_HOTEL_CATS, TOUR_HERITAGE_CATS } from "../../data/tourTypes";
import { DenseHeatmapLegendRow, FireCatRows, Swatch, UrbanDotRow } from "./legendShared";

export function JpAccommodationTypesLegend({ source }: { source: "canonical" | "osm" }) {
  const t = useLegendTheme();
  const categories = source === "osm"
    ? JP_ACCOMMODATION_CATEGORIES.filter((category) => !["ryokan", "simple_lodging"].includes(category.value))
    : JP_ACCOMMODATION_CATEGORIES;
  return (
    <div>
      <LegendTitle zh={source === "osm" ? "OSM 住宿類型" : "旅宿類型"} en="宿泊施設タイプ" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {[...categories, JP_ACCOMMODATION_UNKNOWN_CATEGORY].map((category) => (
          <div key={category.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={category.color} round />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {category.label} <span style={{ color: t.textDim }}>{category.labelJa}</span>
            </span>
          </div>
        ))}
      </div>
      {source === "osm" && (
        <LegendNote style={{ lineHeight: 1.45, marginTop: 5 }}>
          社群繪製 coverage，不是完整或官方名冊。© OpenStreetMap contributors, ODbL 1.0。
        </LegendNote>
      )}
      <DenseHeatmapLegendRow layers={[source === "canonical" ? "jpAccommodationCanonical" : "jpAccommodationOsm"]} />
    </div>
  );
}

export function JpAccommodationDensityLegend({ isDark = true, scaleIdx }: { isDark?: boolean; scaleIdx: number }) {
  const densityColors = usePaletteRamp("jpAccommodationDensity", isDark, JP_ACCOMMODATION_DENSITY_STOPS.length);
  const scale = JP_ACCOMMODATION_DENSITY_SCALES[scaleIdx]
    ?? JP_ACCOMMODATION_DENSITY_SCALES[0]!;
  return (
    <div>
      <LegendTitle zh={`旅宿密度 · ${scale.shortLabel}`} />
      <FireCatRows
        square
        stroke={mapSeamColor(isDark)}
        cats={JP_ACCOMMODATION_DENSITY_STOPS.map((stop, index) => ({
          color: densityColors[index] ?? densityColors[0]!,
          label: index === 0 ? "1 間／格" : `≥ ${stop.toLocaleString("zh-TW")} 間／格`,
        }))}
      />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 5 }}>
        只計 25,459 筆可繪 canonical 旅宿；不叠加 OSM coverage，502 筆無 geometry 未入格。
      </LegendNote>
    </div>
  );
}

export function SportsVenueLegend({ visibility }: { visibility?: LayerVisibility }) {
  return (
    <div>
      <LegendTitle zh="運動場館分類" en="Category" />
      <FireCatRows cats={SPORTS_CATEGORIES} />
      {visibility?.sportsSchool && <DenseHeatmapLegendRow layers={["sportsSchool"]} />}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        大小 = 面積（area_sqm log；缺值退化固定大小）
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        隸屬 5 類：學校 / 其他公共 / 民營 / 運動公園 / 國民運動中心（各自 toggle）
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        ⚠️「不對外」場館半透明淡化
      </LegendNote>
    </div>
  );
}

// 文化設施圖例：facility_type 6 類。
export function CulturalFacilitiesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="文化設施" en="Cultural Facilities" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_FACILITY_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
      </div>
    </div>
  );
}

// 地方文化館圖例：type 5 類。
export function CulturalMuseumsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="地方文化館" en="Local Museums" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_MUSEUM_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
      </div>
    </div>
  );
}

// 藝文活動圖例：進行中 / 未開始 二色（by start_date ≤ 今日）。
export function ArtsEventsLegend() {
  return (
    <div>
      <LegendTitle zh="藝文活動" en="Arts Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={ARTS_EVENT_ONGOING_COLOR} label="進行中（已開始）" />
        <UrbanDotRow color={ARTS_EVENT_UPCOMING_COLOR} label="未開始（尚未開始）" />
      </div>
    </div>
  );
}

// 表演場館圖例：單色點 + 大小語意（∝ √活動場次數）。
export function PerformingVenuesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="表演場館" en="Performing Venues" />
      <UrbanDotRow color={PERFORMING_VENUE_COLOR} label="表演場館" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <div style={{ width: 16, height: 16, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>小 = 1 場次 · 大 = 100+ 場次</span>
      </div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        點大小 ∝ √活動場次數
      </LegendNote>
    </div>
  );
}

// 北市圖即時座位圖例：空位率漸層（紅=滿→黃→綠=空位多）+ 灰=休館中。
export function LibrarySeatsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="北市圖即時座位" en="Library Seats" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>空位率 FREE RATIO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.empty} label="滿（無空位）" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.half} label="半滿" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.full} label="空位多" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.closed} label="休館中" />
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        6 分館聚合 · 資料 10 分鐘更新
      </LegendNote>
    </div>
  );
}

// ── 🧳 觀光 Tourism 圖例 ──
// 三組配色表（分類 / 旅宿等級 / 文化資產類別）SSOT 在 data/tourTypes.ts，與
// map/overlayRegistry.ts 的 Mapbox paint expression 共用同一份，避免兩邊 hex 漂移。

// 觀光景點：分類著色（五類）↔ 熱度著色（年遊客量 log 色帶 + 灰=無統計）雙模式。
export function TourAttractionsLegend({ modeIdx }: { modeIdx: number }) {
  const t = useLegendTheme();
  const heat = modeIdx === 1;
  return (
    <div>
      <LegendTitle zh="觀光景點" en="Attractions" />
      {heat ? (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>年遊客量（log）VISITORS</div>
          <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right, #ffe082, #ffb300, #f4511e, #b71c1c)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
            <span>1 萬</span>
            <span>3,000 萬</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <UrbanDotRow color="#616161" label="無統計（非統計據點）" />
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOUR_ATTRACTION_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
          </div>
        </>
      )}
    </div>
  );
}

// 旅宿：hotel_classes 四類分色。
export function TourHotelsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="旅宿" en="Hotels & B&Bs" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類別 CLASS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HOTEL_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
      </div>
      <DenseHeatmapLegendRow layers={["tourHotels"]} />
    </div>
  );
}

// 文化資產：category 三值分色。
export function TourHeritageLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="文化資產" en="Heritage" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類別 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HERITAGE_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
      </div>
    </div>
  );
}

// 觀光活動・節慶：進行中 / 未開始 二色（by start/end 對今日）。
export function TourEventsLegend() {
  return (
    <div>
      <LegendTitle zh="觀光活動・節慶" en="Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color="#f9a825" label="進行中 Ongoing" />
        <UrbanDotRow color="#90a4ae" label="未開始 Upcoming" />
      </div>
    </div>
  );
}

// ── 🛕 Religion Legend ──
// temples 走 deity_family 9 族分色；其餘 5 層單色。宗祠另有 facility_type 3 類子圖例。
// ODbL：temples / churches / other_worship 都含 OSM 來源，圖面必須標示。

const RELIGION_SINGLE_ROWS: { key: keyof LayerVisibility; color: string; label: string }[] = [
  { key: "religionChurches", color: RELIGION_LAYER_COLORS.religionChurches, label: "教會 Churches" },
  { key: "religionAncestralHalls", color: RELIGION_LAYER_COLORS.religionAncestralHalls, label: "宗祠 Ancestral Halls" },
  { key: "religionFoundations", color: RELIGION_LAYER_COLORS.religionFoundations, label: "宗教基金會 Foundations" },
  { key: "religionOtherWorship", color: RELIGION_LAYER_COLORS.religionOtherWorship, label: "其他宗教場所 Other Worship" },
  { key: "religionTop100", color: RELIGION_LAYER_COLORS.religionTop100, label: "宗教百景 Top 100" },
];

export function ReligionLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const singles = RELIGION_SINGLE_ROWS.filter((r) => visibility[r.key]);
  // OSM 來源的三層任一開啟就要標 ODbL
  const needsOdbl = visibility.religionTemples || visibility.religionChurches || visibility.religionOtherWorship;
  return (
    <div>
      <LegendTitle zh="宗教" en="Religion" />
      {visibility.religionTemples && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>寺廟・主祀神祇</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {DEITY_FAMILIES.map((d) => (
              <div key={d.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <SwatchDot color={d.color} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{d.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            「未標示」6,855 筆幾乎都是登記制度外的民間宮壇（用「登記」切換可只看官方登記版）
          </LegendNote>
        </>
      )}
      {singles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: visibility.religionTemples ? 5 : 0 }}>
          {singles.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SwatchDot color={r.color} opacity={0.9} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
      {visibility.religionAncestralHalls && (
        <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>宗祠類型 facility_type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {ANCESTRAL_HALL_TYPES.map((it) => (
              <div key={it.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <SwatchDot color={it.color} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {needsOdbl && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          含 OSM 來源 © OpenStreetMap contributors（ODbL）
        </LegendNote>
      )}
      {visibility.religionTemples && <DenseHeatmapLegendRow layers={["religionTemples"]} />}
    </div>
  );
}

export function FuneralLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="殯葬" en="Funeral" />

      {visibility.funeralFacilities && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>殯葬設施・類型</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {FUNERAL_FACILITY_TYPES.map((f) => (
              <div key={f.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Swatch color={f.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{f.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            42% 的點是地籍／鄉鎮中心的概略座標（popup 會標示）—— 做距離分析請切「僅精確定位」
          </LegendNote>
        </>
      )}

      {visibility.funeralOperators && (
        <div style={{ marginTop: visibility.funeralFacilities ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>禮儀業者・登記別</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FUNERAL_OPERATOR_ENTITY_TYPES.map((o) => (
              <div key={o.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={o.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{o.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            預設只畫仍營業的 4,569 家（另有 1,664 家已失效——含歇業、撤銷、解散、遷他縣市）
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={FUNERAL_LAYER_COLORS.cemeteryOsm} round={false} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>墓區範圍 OSM（實際使用）</span>
        </div>
      )}

      {visibility.cemeteryZoning && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            都計墓葬用地（法定劃設）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CEMETERY_ZONING_CLASSES.map((c) => (
              <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={c.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            僅臺北 12 ＋新北 102 面 —— 其他 20 縣市空白是正常的（都計分區只做了這兩市）
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && visibility.cemeteryZoning && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          兩層語意不同：綠＝OSM 標註的實際墓區、棕＝都市計畫法定用地。刻意不合併，差異本身就是資訊。
        </LegendNote>
      )}

      {visibility.funeralOperatorDensity && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            業者密度（鄉鎮市區・登記家數）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {FUNERAL_DENSITY_BUCKETS.map((b) => (
              <div key={b.min} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={b.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{b.label}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            是業者「登記地」家數，不是服務涵蓋率 —— 業者常跨區服務
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          墓區範圍資料來自 OpenStreetMap，{CEMETERY_OSM_ODBL_NOTE}
        </LegendNote>
      )}
    </div>
  );
}

export function JpReligionLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const attributions = [
    visibility.jpReligionGsi ? "出典：国土地理院最適化ベクトルタイル" : null,
    visibility.jpReligionOsm ? "© OpenStreetMap contributors, ODbL" : null,
    visibility.jpReligionWikidata ? "Wikidata, CC0" : null,
  ].filter((value): value is string => Boolean(value));
  return (
    <div>
      <LegendTitle zh="宗教設施 宗教施設" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {JP_RELIGION_CATEGORIES.map((category) => (
          <div key={category.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={category.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{category.label}</span>
          </div>
        ))}
      </div>
      {(visibility.jpReligionGsi || visibility.jpReligionOsm || visibility.jpReligionWikidata) && <DenseHeatmapLegendRow layers={["jpReligionGsi", "jpReligionOsm", "jpReligionWikidata"]} />}
      <LegendNote style={{ marginTop: 5, lineHeight: 1.35 }}>
        日本無官方全國宗教設施圖層。任何單一圖層都不是全量，三者數字也不應相加；
        大阪府清冊實測 GSI 僅對上 62%，三源聯集仍漏 25.9%。建議一次只開一個來源。
      </LegendNote>
      {attributions.map((attribution) => (
        <LegendNote key={attribution} style={{ marginTop: 3, lineHeight: 1.35 }}>
          {attribution}
        </LegendNote>
      ))}
    </div>
  );
}
