import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { mountainHutTypeColor, mountainHutTypeLabel } from "../../data/mountainSafetyTypes";

const HIKING_TRAIL_SOURCE_INFO: Record<string, { color: string; label: string }> = {
  A_forest: { color: "#d62728", label: "A 林業署國家步道（KML）" },
  B_osm: { color: "#1f77b4", label: "B OpenStreetMap" },
  C_np_sheipa: { color: "#2ca02c", label: "C 雪霸國家公園 SHP" },
  C_np_kinmen: { color: "#9467bd", label: "C 金門國家公園 KML" },
  D_taipei_grand: { color: "#ff7f0e", label: "D 臺北大縱走（GPX）" },
  D_newtaipei: { color: "#e377c2", label: "D 新北市觀光局（GPX）" },
};

export function HikingTrailsPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const src = String(props.source ?? "");
  const known = HIKING_TRAIL_SOURCE_INFO[src];
  const info = known ? { color: known.color, label: enumLabel("hikingTrailSource", src, known.label, i18n) } : { color: "#888", label: src || t("popup.forestry.unknownSource") };
  const name = String(props.name ?? t("popup.forestry.unnamedTrail"));
  const region = String(props.region ?? "");
  const np = String(props.in_national_park ?? "");
  const url = String(props.url ?? "");
  const dup = props.is_dup_of_A === true || props.is_dup_of_A === "true";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 14, height: 2, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: theme.textStrong, letterSpacing: 0.5 }}>{name}</div>
      </div>
      <Row field="source" value={info.label} color={info.color} />
      {region ? <Row field="managingAgency" value={region} /> : null}
      {np ? <Row label={t("popup.forestry.nationalPark")} value={np} /> : null}
      {dup ? <Row field="remarks" value={t("popup.forestry.overlapA")} /> : null}
      {url ? (
        <div style={{ marginTop: 4 }}>
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#7ec4ff", textDecoration: "underline", fontSize: FONT_SIZE.base }}>
            {t("popup.forestry.originalLink")}
          </a>
        </div>
      ) : null}
    </>
  );
}

// 樹冠巨木 popup：樹高 / 離最近可及線 / 海拔。
export function CanopyGiantsPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const fmt = (v: unknown) => (v == null ? "—" : `${v} m`);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: "#a50026", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: theme.textStrong, letterSpacing: 0.5 }}>{t("popup.forestry.canopyGiants")}</div>
      </div>
      <Row field="treeHeight" value={fmt(props.height_m)} />
      <Row label={t("popup.forestry.accessDist")} value={fmt(props.dist_access_m)} />
      <Row field="elevation" value={fmt(props.elev_m)} />
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {t("popup.forestry.canopyNote")}
      </div>
    </>
  );
}

/**
 * 山屋・高山營地 popup。
 * name 可為 null（12 筆無名工寮，上游誠實保留）→ 顯示「無名山屋」。
 * ele / capacity / name_en 多來自 OSM 抬升 → 面板底部標 ODbL。
 */
export function MountainHutPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const type = props.facility_type == null ? null : String(props.facility_type);
  const color = mountainHutTypeColor(type);
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const name = str(props.name) ?? t("popup.forestry.unnamedHut");
  const nameEn = str(props.name_en);
  // ⚠️ ele / capacity 上游是 OSM tag 原樣的**字串**（"2588"），不是 number —— 別用 typeof 判
  const ele = str(props.ele);
  const capacity = str(props.capacity);
  const manager = str(props.managed_by) ?? str(props.operator);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: theme.textStrong, letterSpacing: 0.5 }}>{name}</div>
      </div>
      <Row field="type" value={enumLabel("mountainHutType", type ?? "unclassified", mountainHutTypeLabel(type), i18n)} color={color} />
      {nameEn ? <Row field="englishName" value={nameEn} /> : null}
      {ele ? <Row field="elevation" value={`${ele} m`} /> : null}
      {capacity ? <Row field="capacity" value={t("popup.forestry.capacityPeople", { value: capacity })} /> : null}
      {manager ? <Row field="managingAgency" value={manager} /> : null}
      {props.in_yushan_official === true ? <Row field="source" value={t("popup.forestry.hutSource")} /> : null}
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {t("popup.forestry.hutNote")}
      </div>
    </>
  );
}

// ── FORESTRY panels ────────────────────────────────────────────

const FORESTRY_PROP_LABELS: Record<string, string> = {
  Name: "名稱", name: "名稱", NAME: "名稱",
  County: "縣市", county: "縣市", COUNTY: "縣市", city: "縣市",
  Town: "鄉鎮", town: "鄉鎮",
  Area: "面積", AREA: "面積", area: "面積", Area_ha: "面積 (ha)",
  Length: "長度", LENGTH: "長度", Lenth: "長度", length_m: "長度 (m)",
  Type: "類型", type: "類型", TYPE: "類型",
  species: "物種", Species: "物種",
  count: "個體數", Count: "個體數",
};

export function ForestryGenericPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  const { t } = i18n;
  const entries = Object.entries(props).slice(0, 8);
  return (
    <>
      {entries.length === 0 && (
        <div style={{ fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("popup.forestry.noProps")}</div>
      )}
      {entries.map(([k, v]) => {
        const label = FORESTRY_PROP_LABELS[k] ? enumLabel("forestryProp", k, FORESTRY_PROP_LABELS[k], i18n) : k;
        const val = v == null ? "" : typeof v === "number" ? String(v) : String(v);
        if (!val) return null;
        return <Row key={k} label={label} value={val.length > 40 ? `${val.slice(0, 40)}…` : val} />;
      })}
    </>
  );
}
