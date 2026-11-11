/**
 * City Sound Atlas 來源 popup（layerType "soundSource"，七家族共用）：
 * 類別、名稱、距離、相對潛勢（非 dB）、證據、空間／時間精度、來源時間與資料出處。
 * 無法判斷時寫白話原因，不寫 0。
 */
import { useLocale } from "../../state/localeStore";
import { SOUND_FAMILY_COLORS } from "../../sound/soundAtlasColors";
import type { ContributionEvidence, SoundSourceFamily } from "../../sound/types";
import {
  EVIDENCE_KEYS, FAMILY_KEYS, STATUS_KEYS, STRUCTURE_KEYS,
  formatDistanceM, formatPotential, formatTaipeiTime, providerKey, reasonKey, spatialPrecisionKey, temporalPrecisionKey,
} from "../sound/soundAtlasText";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { FONT_SIZE } from "../../styles/designTokens";

const FAMILIES = new Set<SoundSourceFamily>(["aviation", "rain", "thunder", "waste_collection", "rail", "road_traffic", "roadwork"]);
const STRUCTURES = new Set(Object.keys(STRUCTURE_KEYS));
const EVIDENCE = new Set<ContributionEvidence>(["observed", "scheduled", "modeled", "inferred"]);
const FAMILY_PROVIDER: Record<SoundSourceFamily, string> = {
  aviation: "flight_trails", rain: "cwa_rain_gauge", thunder: "", waste_collection: "waste_schedule_static",
  rail: "rail_", road_traffic: "freeway_sections", roadwork: "tdx_road_event_city",
};
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
    {family === "road_traffic" && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.row.roadProxyNote")}</div>}
    {family === "roadwork" && <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.row.permitNote")}</div>}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: theme.textDim }}>{t("soundAtlas.disclaimer")}</div>
    <SourceFooter props={{ source: `${t(providerKey(family === "thunder" ? str(props.label) : FAMILY_PROVIDER[family ?? "aviation"]))} · ${t(props.origin === "scene" ? "soundAtlas.origin.scene" : "soundAtlas.origin.live")}` }} />
  </div>;
}
