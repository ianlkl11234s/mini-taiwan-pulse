import { FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName, placeTown } from "../../i18n/placeText";
import {
  DISASTER_RESOURCE_HOLDER_OPTIONS, FIRING_AGENCY_OPTIONS, NUCLEAR_EPZ_KIND_OPTIONS, TRAFFIC_ACCIDENT_CAUSE_OPTIONS,
  TRAFFIC_ACCIDENT_CLASS_OPTIONS, TRAFFIC_ACCIDENT_PERIOD, TRAFFIC_ACCIDENT_SOURCE, TSUNAMI_SIREN_COLOR,
  g36ColorOf, g36LabelOf,
} from "../../data/safetyG36Types";

/**
 * G36（2026-10-31）popup：2025 A1／A2 交通事故、救災資源據點、海嘯警報臺、核電廠集結點與收容處所、射擊公告區。
 * GeoJSON 四層的來源 footer 由 FeatureInfoPanel 統一掛（檔內帶 source_org／source_url／license／fetched_at）；
 * 交通事故是 PMTiles、tile 不帶來源欄 → 本檔自掛 SourceFooter（FOOTER_SELF_MANAGED_LAYER_TYPES 已登記）。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function TrafficAccidents2025Panel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const cat = str(props.cat);
  const color = g36ColorOf(TRAFFIC_ACCIDENT_CLASS_OPTIONS, cat);
  const dead = num(props.dead);
  const inj = num(props.inj);
  return <>
    <Title color={color}>{tr("popup.policeJustice.accidentTitle")}</Title>
    <Row field="category" value={enumLabel("trafficAccidentClass", cat, g36LabelOf(TRAFFIC_ACCIDENT_CLASS_OPTIONS, cat), i18n)} color={color} />
    <Row field="occurredAt" value={`${str(props.date)} ${str(props.time)}`.trim()} mono />
    <Row label={tr("popup.policeJustice.casualties")} value={dead == null || inj == null ? "" : tr("popup.policeJustice.deathsInjuries", { dead, inj })} />
    <Row label={tr("popup.policeJustice.mainCause")} value={enumLabel("trafficAccidentCause", str(props.cause), g36LabelOf(TRAFFIC_ACCIDENT_CAUSE_OPTIONS, props.cause), i18n)} />
    <Row label={tr("popup.policeJustice.subCause")} value={str(props.cause_sub)} />
    <Row label={tr("popup.policeJustice.vehicles")} value={str(props.veh)} />
    <Row label={tr("popup.policeJustice.handlingUnit")} value={str(props.unit)} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.4 }}>
      {tr("popup.policeJustice.accidentNote", { period: TRAFFIC_ACCIDENT_PERIOD })}
    </div>
    <SourceFooter props={TRAFFIC_ACCIDENT_SOURCE} />
  </>;
}

export function DisasterResourceSitesPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const holder = str(props.holder);
  const color = g36ColorOf(DISASTER_RESOURCE_HOLDER_OPTIONS, holder);
  const total = num(props.n_items);
  const positive = num(props.n_positive);
  return <>
    <Title color={color}>{str(props.name) || tr("popup.fire.resourceTitle")}</Title>
    <Row label={tr("popup.fire.resourceHolder")} value={enumLabel("disasterResourceHolder", holder, g36LabelOf(DISASTER_RESOURCE_HOLDER_OPTIONS, holder), i18n)} color={color} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="district" value={placeTown(str(props.county), str(props.town), i18n)} />
    <Row field="address" value={str(props.address)} />
    <Row label={tr("popup.fire.resourceCounts")} value={total == null || positive == null ? "" : tr("popup.fire.resourceCountsValue", { positive, total })} />
    <Row label={tr("popup.fire.resourceItems")} value={str(props.items) || tr("popup.fire.resourceNone")} />
    <Row field="updated" value={str(props.updated)} mono />
  </>;
}

export function TsunamiSirensPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  return <>
    <Title color={TSUNAMI_SIREN_COLOR}>{str(props.name) || tr("popup.policeJustice.tsunamiTitle")}</Title>
    <Row label={tr("popup.policeJustice.managingUnit")} value={str(props.unit)} />
    <Row field="address" value={str(props.address)} />
    <Row label={tr("popup.policeJustice.voiceBroadcast")} value={enumLabel("tsunamiSirenVoice", str(props.voice), str(props.voice), i18n)} />
    <Row label={tr("popup.policeJustice.operation")} value={enumLabel("tsunamiSirenMode", str(props.mode), str(props.mode), i18n)} />
  </>;
}

export function NuclearEpzEvacuationPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const kind = str(props.kind);
  const color = g36ColorOf(NUCLEAR_EPZ_KIND_OPTIONS, kind);
  const isShelter = kind === "shelter";
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="category" value={enumLabel("nuclearEpzKind", kind, g36LabelOf(NUCLEAR_EPZ_KIND_OPTIONS, kind), i18n)} color={color} />
    {!isShelter && <Row field="countyDistrict" value={`${str(props.district)}${str(props.village)}`} />}
    {!isShelter && <Row label={tr("popup.policeJustice.nuclearPlant")} value={str(props.plant)} />}
    {isShelter && <Row label={tr("popup.policeJustice.nuclearVillages")} value={str(props.villages)} />}
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.4 }}>{tr("popup.policeJustice.nuclearNote")}</div>
  </>;
}

export function FiringNoticeAreasPanel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const agency = str(props.agency);
  const color = g36ColorOf(FIRING_AGENCY_OPTIONS, agency);
  const period = [str(props.start), str(props.end)].filter(Boolean).join(" ～ ");
  return <>
    <Title color={color}>{str(props.title) || tr("popup.policeJustice.firingTitle")}</Title>
    <Row field="category" value={enumLabel("firingAgency", agency, g36LabelOf(FIRING_AGENCY_OPTIONS, agency), i18n)} color={color} />
    <Row label={tr("popup.policeJustice.issuingUnit")} value={str(props.unit)} />
    <Row label={tr("popup.policeJustice.noticePeriod")} value={period} mono />
    <Row label={tr("popup.policeJustice.dailyWindow")} value={str(props.daily_window)} mono />
    <Row label={tr("popup.policeJustice.firingHeight")} value={str(props.height)} />
    <Row field="website" value={str(props.notice_url)} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.warn, marginTop: 6, lineHeight: 1.4 }}>{tr("popup.policeJustice.firingNote")}</div>
  </>;
}
