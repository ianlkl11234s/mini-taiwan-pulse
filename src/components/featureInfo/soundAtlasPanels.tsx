/**
 * City Sound Atlas 來源 popup（layerType "soundSource"，十家族共用）：
 * 類別、名稱、距離、相對潛勢（非 dB）、證據、空間／時間精度、來源時間與資料出處。
 * 無法判斷時寫白話原因，不寫 0。
 */
import { useLocale } from "../../state/localeStore";
import { SOUND_FAMILY_COLORS } from "../../sound/soundAtlasColors";
import { SOUND_FAMILIES_ALL } from "../../sound/engines/receiverQuery";
import type { ContributionEvidence, SoundSourceFamily } from "../../sound/types";
import {
  EVIDENCE_KEYS, FAMILY_KEYS, STATUS_KEYS, STRUCTURE_KEYS,
  formatDistanceM, formatPotential, originKey, formatTaipeiTime, providerKey, rainClassKey, reasonKey, spatialPrecisionKey, temporalPrecisionKey,
  ROAD_EVIDENCE_KEYS, roadClassKey, roadLevelKey, roadProviderOf,
} from "../sound/soundAtlasText";
import { SOUND_POTENTIAL_GRID_COLORS, SOUND_RAIN_GRID_COLORS, SOUND_ROAD_GRID_COLORS } from "../../sound/soundAtlasColors";
import type { PotentialGridFamily } from "../../sound/grid/potentialGridState";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_SIZE } from "../../styles/designTokens";

const FAMILIES = new Set<SoundSourceFamily>(SOUND_FAMILIES_ALL);
const STRUCTURES = new Set(Object.keys(STRUCTURE_KEYS));
const EVIDENCE = new Set<ContributionEvidence>(["observed", "scheduled", "modeled", "inferred", "estimated"]);
const FAMILY_PROVIDER: Record<SoundSourceFamily, string> = {
  aviation: "flight_trails", rain: "cwa_rain_gauge", thunder: "", waste_collection: "waste_schedule_static",
  rail: "rail_", road_traffic: "freeway_sections", roadwork: "tdx_road_event_city",
  wind_vegetation: "cwa_weather_obs", coastal_wave: "cwa_marine_obs", river_water: "wra_river_water_level",
};
const NATURAL = new Set<SoundSourceFamily>(["wind_vegetation", "coastal_wave", "river_water"]);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function SoundSourcePanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const family = FAMILIES.has(props.family as SoundSourceFamily) ? (props.family as SoundSourceFamily) : null;
  const active = props.status === "active";
  const evidence = EVIDENCE.has(props.evidence as ContributionEvidence) ? (props.evidence as ContributionEvidence) : null;
  const altitude = num(props.altitudeM);
  const delay = num(props.delayS);
  const structure = STRUCTURES.has(str(props.railStructure)) ? (str(props.railStructure) as keyof typeof STRUCTURE_KEYS) : null;
  return <div>
    <Title color={family ? SOUND_FAMILY_COLORS[family] : theme.textDefault}>
      {`${family ? t(FAMILY_KEYS[family]) : "—"}${str(props.label) && family !== "thunder" ? ` · ${str(props.label)}` : ""}`}
    </Title>
    <Row label={t("soundAtlas.row.potential")} value={active ? formatPotential(num(props.potential)) : t(STATUS_KEYS.unknown)} mono={active} />
    {!active && <Row label={t("soundAtlas.row.reason")} value={t(reasonKey(str(props.unknownReason)))} />}
    <Row label={t("soundAtlas.row.distance")} value={formatDistanceM(num(props.distanceM))} mono />
    {family === "aviation" && <Row label={t("soundAtlas.row.altitude")} value={altitude == null ? "—" : `${Math.round(altitude)} m`} mono />}
    {family === "rail" && structure && <Row label={t("soundAtlas.row.railStructure")} value={t(STRUCTURE_KEYS[structure])} />}
    {delay != null && <Row label={t("soundAtlas.row.delay")} value={`${delay.toFixed(1)} s`} mono />}
    {evidence && <Row label={t("soundAtlas.row.evidence")} value={t(EVIDENCE_KEYS[evidence])} />}
    <Row label={t("soundAtlas.row.spatial")} value={t(spatialPrecisionKey(str(props.spatialPrecision)))} />
    <Row label={t("soundAtlas.row.temporal")} value={t(temporalPrecisionKey(str(props.temporalPrecision)))} />
    <Row label={t("soundAtlas.row.updated")} value={str(props.sourceTime) ? formatTaipeiTime(str(props.sourceTime), true) : "—"} mono />
    {family === "road_traffic" && (
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>
        {props.proxyKind === "typical_weekday_volume"
          ? t("soundAtlas.row.typicalNote", { days: str(props.flowDays) || "—" })
          : props.proxyKind === "observed_volume" ? t("soundAtlas.row.freewayObservedNote") : t("soundAtlas.row.roadProxyNote")}
      </div>
    )}
    {family && NATURAL.has(family) && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.row.naturalNote")}</div>}
    {family === "roadwork" && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.row.permitNote")}</div>}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.disclaimer")}</div>
    <SourceFooter props={{ source: `${t(providerKey(family === "thunder" ? str(props.label) : family === "road_traffic" ? roadProviderOf(props.proxyKind) : FAMILY_PROVIDER[family ?? "aviation"]))}${family === "rain" && str(props.temporalPrecision).startsWith("radar") ? ` ＋ ${t(providerKey("cwa_radar_grid"))}` : ""} · ${t(originKey(props.origin))}` }} />
  </div>;
}

/**
 * W6-1 雨勢網格格子 popup（layerType "soundRainCell"；useMapInteraction 以網格索引查格）。
 * 數值由 rainEstimateAt 對格心即時算（和網格、接收點查詢同一套規則）：分級、依據（雷達／雨量站／同級）、
 * 雷達幀時刻、最近雨量站與其每小時資料時刻。無法判斷寫白話原因，不寫 0。
 */
export function SoundRainCellPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const k = num(props.rainClass);
  const known = k != null && k >= 0 && k <= 4;
  const source = str(props.source);
  const radarNone = props.radarPack !== "ok";
  const radarClass = num(props.radarClass);
  const radarSlot = num(props.radarSlotStart);
  const gaugeClass = num(props.gaugeClass);
  const gaugeAt = num(props.gaugeObservedAt);
  const gaugeMm = num(props.gaugeMm);
  const bin = num(props.binStart);
  const sourceKey = source === "radar" ? "soundAtlas.rainCell.source.radar"
    : source === "gauge" ? (radarNone ? "soundAtlas.rainCell.source.gaugeOnly" : "soundAtlas.rainCell.source.gauge")
    : source === "both" ? "soundAtlas.rainCell.source.both" : null;
  const station = str(props.stationName);
  const gaugeText = gaugeClass == null
    ? t("soundAtlas.rainCell.gaugeNone")
    : `${station || "—"}・${formatDistanceM(num(props.stationDistanceM))}・${t(rainClassKey(gaugeClass))}${gaugeMm != null ? `（${gaugeMm} mm/h）` : ""}${gaugeAt != null ? `・${t("soundAtlas.rainCell.gaugeWindow", { from: formatTaipeiTime(gaugeAt - 3600), to: formatTaipeiTime(gaugeAt) })}` : ""}`;
  const radarText = radarNone ? t("soundAtlas.rainCell.radarNone") : `${t(rainClassKey(radarClass))}${radarSlot != null ? `・${formatTaipeiTime(radarSlot)}` : ""}`;
  return <div>
    <Title color={known ? SOUND_RAIN_GRID_COLORS[k as 0 | 1 | 2 | 3 | 4] : theme.textDefault}>{t("soundAtlas.rainCell.title")}</Title>
    <Row label={t("soundAtlas.rainCell.class")} value={t(rainClassKey(k))} />
    {!known && <Row label={t("soundAtlas.row.reason")} value={t(reasonKey(str(props.unknownReason)))} />}
    {sourceKey && <Row label={t("soundAtlas.rainCell.source")} value={t(sourceKey)} />}
    <Row label={t("soundAtlas.rainCell.radar")} value={radarText} />
    <Row label={t("soundAtlas.rainCell.gauge")} value={gaugeText} />
    <Row label={t("soundAtlas.rainCell.bin")} value={bin != null ? `${formatTaipeiTime(bin, true)}–${formatTaipeiTime(bin + 600)}` : "—"} mono />
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.rainCell.note")}</div>
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.disclaimer")}</div>
    <SourceFooter props={{ source: `${t(providerKey("cwa_radar_grid"))} ＋ ${t(providerKey("cwa_rain_gauge"))} · ${t(originKey(props.origin))}` }} />
  </div>;
}

/**
 * W6-2 道路車流網格格子 popup（layerType "soundRoadCell"；useMapInteraction 以網格索引查格）。
 * 分級、證據等級、主要來源（國道 VD／臺北 VD／道路等級）、流量與資料時刻；無法判斷寫白話原因。
 */
export function SoundRoadCellPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const level = num(props.level);
  const status = str(props.status);
  const ev = str(props.evidence) as keyof typeof ROAD_EVIDENCE_KEYS;
  const evKnown = ev in ROAD_EVIDENCE_KEYS;
  const known = status === "active" || status === "inactive";
  const veh = num(props.vehPerHour);
  const sampleT = num(props.sampleT);
  const bin = num(props.binStart);
  const cls = roadClassKey(str(props.roadClass));
  const roadName = str(props.roadName);
  const vd = str(props.vdId);
  const roadText = !evKnown ? "—"
    : ev === "inferred" ? `${roadName || "—"}${cls ? `（${t(cls)}）` : ""}`
    : `${roadName ? `${roadName}${str(props.roadDir) ? ` ${str(props.roadDir)}` : ""} · ` : ""}VD ${vd || "—"}`;
  const color = known && level != null ? SOUND_ROAD_GRID_COLORS[evKnown ? ev : "observed"][level as 0 | 1 | 2 | 3 | 4] : theme.textDefault;
  return <div>
    <Title color={color}>{t("soundAtlas.roadCell.title")}</Title>
    <Row label={t("soundAtlas.roadCell.level")} value={known ? t(roadLevelKey(level)) : t(roadLevelKey(null))} />
    {!known && <Row label={t("soundAtlas.row.reason")} value={t(reasonKey(str(props.unknownReason)))} />}
    {known && <Row label={t("soundAtlas.roadCell.evidence")} value={evKnown ? t(ROAD_EVIDENCE_KEYS[ev]) : t("soundAtlas.road.evidence.none")} />}
    {evKnown && <Row label={t("soundAtlas.roadCell.road")} value={roadText} />}
    {evKnown && <Row label={t("soundAtlas.row.distance")} value={formatDistanceM(num(props.distanceM))} mono />}
    {evKnown && veh != null && <Row label={t("soundAtlas.roadCell.flow")} value={`${Math.round(veh).toLocaleString()} ${t("soundAtlas.roadCell.vehPerHour")}`} mono />}
    {evKnown && sampleT != null && ev !== "inferred" && <Row label={t("soundAtlas.roadCell.dataTime")} value={formatTaipeiTime(sampleT, true)} mono />}
    <Row label={t("soundAtlas.roadCell.bin")} value={bin != null ? `${formatTaipeiTime(bin, true)}–${formatTaipeiTime(bin + 600)}` : "—"} mono />
    {evKnown && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t(ev === "observed" ? "soundAtlas.roadCell.flowNote.observed" : ev === "estimated" ? "soundAtlas.roadCell.flowNote.estimated" : "soundAtlas.roadCell.flowNote.inferred")}</div>}
    {props.otherUnknown === true && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.roadCell.otherUnknown")}</div>}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.roadCell.note")}</div>
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.disclaimer")}</div>
    <SourceFooter props={{ source: `${t(providerKey(evKnown ? roadProviderOf(ev === "observed" ? "observed_volume" : ev === "estimated" ? "typical_weekday_volume" : "road_type_no_volume") : "osm_road_class"))} · ${t(originKey(props.origin))}` }} />
  </div>;
}

const POTENTIAL_FAMILIES = new Set<PotentialGridFamily>(["aviation", "rail", "wind_vegetation", "coastal_wave", "river_water"]);
const LEVEL_KEYS = ["soundAtlas.level.0", "soundAtlas.level.1", "soundAtlas.level.2", "soundAtlas.level.3", "soundAtlas.level.4"] as const;

/**
 * W6-3 連續潛勢網格格子 popup（layerType "soundPotentialCell"，飛機／鐵道／風／浪／河川共用；useMapInteraction 以網格索引查格）。
 * 數值由 queryFamilyInterval 對格心即時算（和網格、接收點查詢同一套規則）：分級、精確潛勢、主要來源與距離、來源時刻。
 * 無法判斷寫白話原因，不寫 0。
 */
export function SoundPotentialCellPanel({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const family = POTENTIAL_FAMILIES.has(props.family as PotentialGridFamily) ? (props.family as PotentialGridFamily) : null;
  const level = num(props.level);
  const known = level != null && level >= 0 && level <= 4;
  const potential = num(props.potential);
  const gate = num(props.gate) ?? 0;
  const bin = num(props.binStart);
  const active = num(props.activeCount) ?? 0;
  const unknown = num(props.unknownCount) ?? 0;
  const label = str(props.topLabel);
  const topTime = str(props.topSourceTime);
  const belowGate = known && level === 0 && potential != null && potential > 0;
  const color = family && known ? SOUND_POTENTIAL_GRID_COLORS[family][level as 0 | 1 | 2 | 3 | 4] : theme.textDefault;
  const familyName = family ? t(FAMILY_KEYS[family]) : "—";
  const provider = family === "rail" ? "rail_" : FAMILY_PROVIDER[family ?? "aviation"];
  return <div>
    <Title color={color}>{t("soundAtlas.potentialCell.title", { family: familyName })}</Title>
    <Row label={t("soundAtlas.potentialCell.level")} value={known ? (belowGate ? t("soundAtlas.potentialCell.belowGate", { gate: formatPotential(gate) }) : t(LEVEL_KEYS[level as 0 | 1 | 2 | 3 | 4])) : t("soundAtlas.level.unknown")} />
    {!known && <Row label={t("soundAtlas.row.reason")} value={t(reasonKey(str(props.unknownReason)))} />}
    {known && <Row label={t("soundAtlas.potentialCell.potential")} value={formatPotential(potential)} mono />}
    {family === "aviation" && <Row label={t("soundAtlas.potentialCell.gate")} value={formatPotential(gate)} mono />}
    {(active > 0 || unknown > 0) && <Row label={t("soundAtlas.potentialCell.count")} value={t("soundAtlas.potentialCell.countValue", { active, unknown })} />}
    {label && <Row label={t("soundAtlas.potentialCell.top")} value={`${label}・${formatDistanceM(num(props.topDistanceM))}`} />}
    {str(props.topUnknownReason) && <Row label={t("soundAtlas.row.reason")} value={t(reasonKey(str(props.topUnknownReason)))} />}
    {topTime && <Row label={t("soundAtlas.row.updated")} value={formatTaipeiTime(topTime, true)} mono />}
    <Row label={t("soundAtlas.potentialCell.bin")} value={bin != null ? `${formatTaipeiTime(bin, true)}–${formatTaipeiTime(bin + 600)}` : "—"} mono />
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.potentialCell.note")}</div>
    {family === "aviation" && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.potentialCell.aviationNote")}</div>}
    {family === "rail" && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.potentialCell.railNote")}</div>}
    {family && NATURAL.has(family) && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.row.naturalNote")}</div>}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.disclaimer")}</div>
    <SourceFooter props={{ source: `${t(providerKey(provider))}${family === "rail" ? " ＋ OpenStreetMap（ODbL）" : ""} · ${t(originKey(props.origin))}` }} />
  </div>;
}
