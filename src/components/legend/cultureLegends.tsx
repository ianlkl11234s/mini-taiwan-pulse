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
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { MessageKey } from "../../i18n/keys";

export function JpAccommodationTypesLegend({ source }: { source: "canonical" | "osm" }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const categories = source === "osm"
    ? JP_ACCOMMODATION_CATEGORIES.filter((category) => !["ryokan", "simple_lodging"].includes(category.value))
    : JP_ACCOMMODATION_CATEGORIES;
  return (
    <div>
      <LegendTitle zh={source === "osm" ? i18n.t("legend.culture.accTypesTitleOsm") : i18n.t("legend.culture.accTypesTitle")} en="宿泊施設タイプ" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
        {[...categories, JP_ACCOMMODATION_UNKNOWN_CATEGORY].map((category) => (
          <div key={category.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Swatch color={category.color} round />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {enumLabel("jpAccommodationType", category.value, category.label, i18n)}{i18n.active !== "ja" && <>{" "}<span style={{ color: t.textDim }}>{category.labelJa}</span></>}
            </span>
          </div>
        ))}
      </div>
      {source === "osm" && (
        <LegendNote style={{ lineHeight: 1.45, marginTop: 5 }}>
          {i18n.t("legend.culture.accOsmNote")}
        </LegendNote>
      )}
      <DenseHeatmapLegendRow layers={[source === "canonical" ? "jpAccommodationCanonical" : "jpAccommodationOsm"]} />
    </div>
  );
}

export function JpAccommodationDensityLegend({ isDark = true, scaleIdx }: { isDark?: boolean; scaleIdx: number }) {
  const i18n = useLocale();
  const densityColors = usePaletteRamp("jpAccommodationDensity", isDark, JP_ACCOMMODATION_DENSITY_STOPS.length);
  const scale = JP_ACCOMMODATION_DENSITY_SCALES[scaleIdx]
    ?? JP_ACCOMMODATION_DENSITY_SCALES[0]!;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.accDensityTitle", { scale: scale.shortLabel })} />
      <FireCatRows
        square
        stroke={mapSeamColor(isDark)}
        cats={JP_ACCOMMODATION_DENSITY_STOPS.map((stop, index) => ({
          color: densityColors[index] ?? densityColors[0]!,
          label: index === 0 ? i18n.t("legend.culture.accPerCellOne") : i18n.t("legend.culture.accPerCellMin", { n: i18n.formatNumber(stop) }),
        }))}
      />
      <LegendNote style={{ lineHeight: 1.45, marginTop: 5 }}>
        {i18n.t("legend.culture.accDensityNote")}
      </LegendNote>
    </div>
  );
}

export function SportsVenueLegend({ visibility }: { visibility?: LayerVisibility }) {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.sportsTitle")} en="Category" />
      <FireCatRows cats={SPORTS_CATEGORIES.map((c) => ({ ...c, label: enumLabel("sportsCategory", c.key, c.label, i18n) }))} />
      {visibility?.sportsSchool && <DenseHeatmapLegendRow layers={["sportsSchool"]} />}
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.culture.sportsNoteSize")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.culture.sportsNoteLayers")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.culture.sportsNoteClosed")}
      </LegendNote>
    </div>
  );
}

// 文化設施圖例：facility_type 6 類。
export function CulturalFacilitiesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.culFacTitle")} en="Cultural Facilities" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.subType")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_FACILITY_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={enumLabel("legendCulture", c.name, c.name, i18n)} />)}
      </div>
    </div>
  );
}

// 地方文化館圖例：type 5 類。
export function CulturalMuseumsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.culMuseumTitle")} en="Local Museums" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.subType")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_MUSEUM_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={enumLabel("legendCulture", c.name, c.name, i18n)} />)}
      </div>
    </div>
  );
}

// 藝文活動圖例：進行中 / 未開始 二色（by start_date ≤ 今日）。
export function ArtsEventsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.artsTitle")} en="Arts Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={ARTS_EVENT_ONGOING_COLOR} label={i18n.t("legend.culture.artsOngoing")} />
        <UrbanDotRow color={ARTS_EVENT_UPCOMING_COLOR} label={i18n.t("legend.culture.artsUpcoming")} />
      </div>
    </div>
  );
}

// 表演場館圖例：單色點 + 大小語意（∝ √活動場次數）。
export function PerformingVenuesLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.venuesTitle")} en="Performing Venues" />
      <UrbanDotRow color={PERFORMING_VENUE_COLOR} label={i18n.t("legend.culture.venuesTitle")} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <div style={{ width: 16, height: 16, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.culture.venuesSize")}</span>
      </div>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.culture.venuesNote")}
      </LegendNote>
    </div>
  );
}

// 北市圖即時座位圖例：空位率漸層（紅=滿→黃→綠=空位多）+ 灰=休館中。
export function LibrarySeatsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.libTitle")} en="Library Seats" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.libHead")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.empty} label={i18n.t("legend.culture.libFull")} />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.half} label={i18n.t("legend.culture.libHalf")} />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.full} label={i18n.t("legend.culture.libMany")} />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.closed} label={i18n.t("legend.culture.libClosed")} />
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.culture.libNote")}
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
  const i18n = useLocale();
  const heat = modeIdx === 1;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.tourAttrTitle")} en="Attractions" />
      {heat ? (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.tourVisitorsHead")}</div>
          <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right, #ffe082, #ffb300, #f4511e, #b71c1c)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
            <span>{i18n.t("legend.culture.tourVisitorsMin")}</span>
            <span>{i18n.t("legend.culture.tourVisitorsMax")}</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <UrbanDotRow color="#616161" label={i18n.t("legend.culture.tourNoStats")} />
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.subCategory")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOUR_ATTRACTION_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={enumLabel("legendCulture", c.label, c.label, i18n)} />)}
          </div>
        </>
      )}
    </div>
  );
}

// 旅宿：hotel_classes 四類分色。
export function TourHotelsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.tourHotelsTitle")} en="Hotels & B&Bs" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.subClass")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HOTEL_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={enumLabel("legendCulture", c.label, c.label, i18n)} />)}
      </div>
      <DenseHeatmapLegendRow layers={["tourHotels"]} />
    </div>
  );
}

// 文化資產：category 三值分色。
export function TourHeritageLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.tourHeritageTitle")} en="Heritage" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.subKind")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HERITAGE_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={enumLabel("legendCulture", c.label, c.label, i18n)} />)}
      </div>
    </div>
  );
}

// 觀光活動・節慶：進行中 / 未開始 二色（by start/end 對今日）。
export function TourEventsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.tourEventsTitle")} en="Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color="#f9a825" label={i18n.t("legend.culture.tourOngoing")} />
        <UrbanDotRow color="#90a4ae" label={i18n.t("legend.culture.tourUpcoming")} />
      </div>
    </div>
  );
}

// ── 🛕 Religion Legend ──
// temples 走 deity_family 9 族分色；其餘 5 層單色。宗祠另有 facility_type 3 類子圖例。
// ODbL：temples / churches / other_worship 都含 OSM 來源，圖面必須標示。

const RELIGION_SINGLE_ROWS: { key: keyof LayerVisibility; color: string; labelKey: MessageKey }[] = [
  { key: "religionChurches", color: RELIGION_LAYER_COLORS.religionChurches, labelKey: "legend.culture.religionChurches" },
  { key: "religionAncestralHalls", color: RELIGION_LAYER_COLORS.religionAncestralHalls, labelKey: "legend.culture.religionAncestralHalls" },
  { key: "religionFoundations", color: RELIGION_LAYER_COLORS.religionFoundations, labelKey: "legend.culture.religionFoundations" },
  { key: "religionOtherWorship", color: RELIGION_LAYER_COLORS.religionOtherWorship, labelKey: "legend.culture.religionOtherWorship" },
  { key: "religionTop100", color: RELIGION_LAYER_COLORS.religionTop100, labelKey: "legend.culture.religionTop100" },
];

export function ReligionLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const singles = RELIGION_SINGLE_ROWS.filter((r) => visibility[r.key]);
  // OSM 來源的三層任一開啟就要標 ODbL
  const needsOdbl = visibility.religionTemples || visibility.religionChurches || visibility.religionOtherWorship;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.religionTitle")} en="Religion" />
      {visibility.religionTemples && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.religionDeityHead")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {DEITY_FAMILIES.map((d) => (
              <div key={d.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <SwatchDot color={d.color} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{enumLabel("religionDeityFamily", d.value, d.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.culture.religionUnmarkedNote")}
          </LegendNote>
        </>
      )}
      {singles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: visibility.religionTemples ? 5 : 0 }}>
          {singles.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SwatchDot color={r.color} opacity={0.9} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(r.labelKey)}</span>
            </div>
          ))}
        </div>
      )}
      {visibility.religionAncestralHalls && (
        <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>{i18n.t("legend.culture.religionAncestralHead")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {ANCESTRAL_HALL_TYPES.map((it) => (
              <div key={it.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <SwatchDot color={it.color} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("religionAncestralType", it.value, it.label, i18n)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {needsOdbl && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          {i18n.t("legend.culture.religionOdbl")}
        </LegendNote>
      )}
      {visibility.religionTemples && <DenseHeatmapLegendRow layers={["religionTemples"]} />}
    </div>
  );
}

export function FuneralLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.funeralTitle")} en="Funeral" />

      {visibility.funeralFacilities && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.funeralFacHead")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 8, rowGap: 2 }}>
            {FUNERAL_FACILITY_TYPES.map((f) => (
              <div key={f.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Swatch color={f.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, whiteSpace: "nowrap" }}>{enumLabel("funeralFacilityType", f.value, f.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.culture.funeralApproxNote")}
          </LegendNote>
        </>
      )}

      {visibility.funeralOperators && (
        <div style={{ marginTop: visibility.funeralFacilities ? 5 : 0 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{i18n.t("legend.culture.funeralOpHead")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FUNERAL_OPERATOR_ENTITY_TYPES.map((o) => (
              <div key={o.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={o.color} round />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("funeralOperatorEntity", o.value, o.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.culture.funeralOpNote")}
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && (
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <Swatch color={FUNERAL_LAYER_COLORS.cemeteryOsm} round={false} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.culture.funeralCemOsm")}</span>
        </div>
      )}

      {visibility.cemeteryZoning && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.culture.funeralZoningHead")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CEMETERY_ZONING_CLASSES.map((c) => (
              <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={c.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("funeralZoningClass", c.value, c.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.culture.funeralZoningNote")}
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && visibility.cemeteryZoning && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          {i18n.t("legend.culture.funeralBothNote")}
        </LegendNote>
      )}

      {visibility.funeralOperatorDensity && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
            {i18n.t("legend.culture.funeralDensityHead")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {FUNERAL_DENSITY_BUCKETS.map((b) => (
              <div key={b.min} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Swatch color={b.color} round={false} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("legendCulture", b.label, b.label, i18n)}</span>
              </div>
            ))}
          </div>
          <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
            {i18n.t("legend.culture.funeralDensityNote")}
          </LegendNote>
        </div>
      )}

      {visibility.cemeteryOsm && (
        <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
          {i18n.t("legend.culture.funeralOsmNote", { note: CEMETERY_OSM_ODBL_NOTE })}
        </LegendNote>
      )}
    </div>
  );
}

export function JpReligionLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const attributions = [
    visibility.jpReligionGsi ? i18n.t("legend.culture.jpReligionGsi") : null,
    visibility.jpReligionOsm ? "© OpenStreetMap contributors, ODbL" : null,
    visibility.jpReligionWikidata ? "Wikidata, CC0" : null,
  ].filter((value): value is string => Boolean(value));
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.culture.jpReligionTitle")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {JP_RELIGION_CATEGORIES.map((category) => (
          <div key={category.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={category.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("religionJp", category.value, category.label, i18n)}</span>
          </div>
        ))}
      </div>
      {(visibility.jpReligionGsi || visibility.jpReligionOsm || visibility.jpReligionWikidata) && <DenseHeatmapLegendRow layers={["jpReligionGsi", "jpReligionOsm", "jpReligionWikidata"]} />}
      <LegendNote style={{ marginTop: 5, lineHeight: 1.35 }}>
        {i18n.t("legend.culture.jpReligionNote")}
      </LegendNote>
      {attributions.map((attribution) => (
        <LegendNote key={attribution} style={{ marginTop: 3, lineHeight: 1.35 }}>
          {attribution}
        </LegendNote>
      ))}
    </div>
  );
}
