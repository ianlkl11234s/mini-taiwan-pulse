import { useEffect, useMemo, useState } from "react";
import { Layers, MapPin, TrainFront, type LucideIcon } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { searchLayers, type LayerSearchResult } from "../../lib/layerSearch";
import { searchPlaces, type PlaceSearchHit, type PlaceSearchIndex } from "../../lib/placeSearch";
import { loadPlaceSearchIndex } from "../../data/placeSearchIndexLoader";
import { localizeSectionTitle } from "../../i18n/layerText";
import { useRailTheme } from "./railTheme";

const LIMIT = 8;
const KIND_KEY = { county: "placeSearch.kind.county", town: "placeSearch.kind.town", village: "placeSearch.kind.village" } as const;

type IndexState = { status: "loading" } | { status: "ready"; index: PlaceSearchIndex } | { status: "error" };

/** 第一次掛載（＝第一次展開 Locations 搜尋）才下載索引；失敗顯示錯誤，不顯示成「沒有符合」。 */
export function usePlaceSearchIndex(): IndexState {
  const { t } = useLocale();
  const [state, setState] = useState<IndexState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadPlaceSearchIndex(t("placeSearch.loadingLabel")).then(
      (index) => { if (alive) setState({ status: "ready", index }); },
      () => { if (alive) setState({ status: "error" }); },
    );
    return () => { alive = false; };
  }, [t]);
  return state;
}

interface UnifiedSearchResultsProps {
  query: string;
  indexState: IndexState;
  lockedKeys?: ReadonlySet<string>;
  onPickPlace: (place: PlaceSearchHit) => void;
  onPickLayer: (layer: LayerSearchResult) => void;
}

/** Locations 面板：有輸入時顯示「地點」（本地索引）與「圖層」兩區，地點在前，各最多 8 筆。 */
export function UnifiedSearchResults({ query, indexState, lockedKeys, onPickPlace, onPickLayer }: UnifiedSearchResultsProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const places = useMemo(
    () => (indexState.status === "ready" ? searchPlaces(indexState.index, query, LIMIT) : []),
    [indexState, query],
  );
  const layers = useMemo(
    () => searchLayers(query, { limit: LIMIT, ...(lockedKeys ? { lockedKeys } : {}) }),
    [query, lockedKeys],
  );
  return (
    <div data-testid="unified-search-results">
      <SectionTitle icon={MapPin} title={t("placeSearch.places")} count={indexState.status === "ready" ? places.length : null} />
      {indexState.status === "loading" && <EmptyLine text={t("placeSearch.loading")} />}
      {indexState.status === "error" && <EmptyLine text={t("placeSearch.loadFailed")} role="alert" />}
      {indexState.status === "ready" && places.length === 0 && <EmptyLine text={t("placeSearch.noPlaces")} />}
      {places.map((place) => (
        <ResultRow
          key={`${place.kind}:${place.parent}:${place.label}`}
          icon={place.kind === "station" ? TrainFront : MapPin}
          name={place.label}
          subtitle={place.kind === "station" ? place.parent : [place.parent, t(KIND_KEY[place.kind])].filter(Boolean).join(" · ")}
          onClick={() => onPickPlace(place)}
        />
      ))}
      <SectionTitle icon={Layers} title={t("placeSearch.layers")} count={layers.length} />
      {layers.length === 0 && <EmptyLine text={t("placeSearch.noLayers")} />}
      {layers.map((layer) => (
        <ResultRow
          key={layer.key}
          icon={Layers}
          name={i18n.active === "zh-TW" ? layer.label : i18n.lookup(`layer.${layer.key}`) ?? layer.label}
          subtitle={[layer.theme, layer.group].filter((v): v is string => !!v).map((v) => localizeSectionTitle(v, i18n)).join(" · ")}
          onClick={() => onPickLayer(layer)}
        />
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: number | null }) {
  const { DIM } = useRailTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px 2px" }}>
      <Icon size={12} color={DIM} aria-hidden="true" />
      <span style={{ fontSize: FONT_SIZE.sm, fontWeight: 700, letterSpacing: 1.5, color: DIM, fontFamily: FONT_CJK }}>{title}</span>
      {count != null && <span style={{ fontSize: FONT_SIZE.xs, color: DIM, fontFamily: FONT_DATA, marginLeft: 4 }}>{count}</span>}
    </div>
  );
}

function EmptyLine({ text, role }: { text: string; role?: "alert" }) {
  const { DIM } = useRailTheme();
  return <div role={role} style={{ padding: "4px 12px 6px 28px", fontSize: FONT_SIZE.sm, color: DIM, fontFamily: FONT_CJK }}>{text}</div>;
}

function ResultRow({ icon: Icon, name, subtitle, onClick }: { icon: LucideIcon; name: string; subtitle: string; onClick: () => void }) {
  const { DIM, INACTIVE_TEXT, ROW_HOVER } = useRailTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 12px",
        border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ROW_HOVER; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={14} color={DIM} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: FONT_SIZE.md, fontWeight: 600, color: INACTIVE_TEXT, fontFamily: FONT_CJK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {subtitle && <span style={{ display: "block", fontSize: FONT_SIZE.sm, color: DIM, fontFamily: FONT_CJK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</span>}
      </span>
    </button>
  );
}
