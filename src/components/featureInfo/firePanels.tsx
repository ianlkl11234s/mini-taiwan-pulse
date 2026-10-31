import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { fireStationColor, fireHydrantColor, fireIsochroneColor, fireIsochroneLabel } from "../../data/fireTypes";
import { Row, SourceFooter } from "./shared";
import { FIRE_HYDRANT_SOURCES } from "../../data/safetyG36Types";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";

export function FireEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const deaths = Number(props.deaths ?? 0);
  const injuries = Number(props.injuries ?? 0);
  const casualty = deaths > 0 || injuries > 0;
  const accentColor = casualty ? "#ff1744" : "#ff7043";
  const ts = Number(props.occurred_ts ?? 0);
  let timeStr = "";
  if (ts > 0) {
    const d = new Date(ts * 1000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    timeStr = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  }
  const loc = [props.county ? placeName(String(props.county), i18n) : "", props.township ? placeTown(String(props.county ?? ""), String(props.township), i18n) : ""].filter(Boolean).join(" ");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {loc || tr("popup.fire.eventFallback")}
        </div>
      </div>
      <Row label={tr("popup.fire.cause")} value={String(props.cause ?? "")} color={accentColor} />
      <Row field="deaths" value={String(deaths)} color={deaths > 0 ? "#ff1744" : undefined} />
      <Row label={tr("popup.fire.injuries")} value={String(injuries)} color={injuries > 0 ? "#ffb300" : undefined} />
      <Row field="occurredAt" value={timeStr} />
    </>
  );
}

export function FireStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cat = String(props.cat ?? "其他");
  const accentColor = fireStationColor(cat);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? tr("popup.fire.stationFallback"))}
        </div>
      </div>
      <Row field="type" value={enumLabel("fireStationType", String(props.type ?? cat), String(props.type ?? cat), i18n)} color={accentColor} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="district" value={placeTown(String(props.county ?? ""), String(props.district ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row field="phone" value={String(props.phone ?? "")} />
    </>
  );
}

export function FireHydrantPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cat = String(props.cat ?? "其他");
  const accentColor = fireHydrantColor(cat);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {tr("popup.fire.hydrant")}
        </div>
      </div>
      <Row label={tr("popup.fire.hydrantType")} value={enumLabel("fireHydrantType", String(props.type ?? cat), String(props.type ?? cat), i18n)} color={accentColor} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="district" value={placeTown(String(props.county ?? ""), String(props.district ?? ""), i18n)} />
      <Row field="number" value={String(props.twc_id ?? (props.src === "twc" ? "" : props.id ?? ""))} />
      {props.type_code != null && <Row label={tr("popup.fire.hydrantTypeCode")} value={String(props.type_code)} mono />}
      {/* G36：tile 不帶來源欄，依 src 補三家來源（FOOTER_SELF_MANAGED_LAYER_TYPES 已登記 fireHydrant） */}
      <HydrantSource src={props.src} />
    </>
  );
}

function HydrantSource({ src }: { src: unknown }) {
  const source = FIRE_HYDRANT_SOURCES[src as keyof typeof FIRE_HYDRANT_SOURCES];
  if (!source) return null;
  return <SourceFooter props={{ source_org: source.org, source_url: source.url, license: source.license, fetched_at: source.fetched }} />;
}

export function FireIsochronePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const minutes = Number(props.minutes ?? 0);
  const accentColor = fireIsochroneColor(minutes);
  const cumulative = props.cumulative_sqkm != null ? `${props.cumulative_sqkm} km²` : "";
  const ring = props.ring_sqkm != null ? `${props.ring_sqkm} km²` : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {[5, 10, 15].includes(minutes) ? enumLabel("fireIsochrone", minutes, fireIsochroneLabel(minutes), i18n) : tr("popup.fire.minutesLabel", { minutes })}
        </div>
      </div>
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row label={tr("popup.fire.reachTime")} value={tr("popup.fire.withinMinutes", { minutes })} color={accentColor} />
      <Row label={tr("popup.fire.cumulativeArea")} value={cumulative} />
      <Row label={tr("popup.fire.ringArea")} value={ring} />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 6, lineHeight: 1.4 }}>
        {tr("popup.fire.isochroneNote")}
      </div>
    </>
  );
}
