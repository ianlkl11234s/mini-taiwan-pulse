// 環境污染 popup panels（設施 / 裁處事件 / 場址）。
// 語意紅線：EMS_S_01 列管 ≠ 污染源 → 標題與敘述皆用「污染潛勢設施」。
import { useEffect, useState } from "react";
import type { PanelProps } from "./registry";
import { Row, Badge } from "./shared";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { placeName, placeTown } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";
import type { I18nContext } from "../../i18n/layerText";
import {
  FACILITY_MEDIA, POLLUTION_MEDIUM_LABELS, POLLUTION_MEDIUM_COLORS,
  SEVERITY_BANDS, PENALTY_SEVERITY_LABELS, PENALTY_SEVERITY_COLORS,
  type PollutionMedium, type PollutionPenaltySeverity,
} from "../../data/pollutionTypes";
import { fetchToxicPermits, normalizeEmsno, type ToxicPermitInfo } from "../../data/toxicPermitsLoader";
import { useFeatureTheme } from "./featureTheme";

function sevLabel(sev: number, i18n: I18nContext): string {
  const b = SEVERITY_BANDS.find((x) => x.sev === sev);
  return b ? enumLabel("pollutionSeverity", b.sev, b.label, i18n) : `S${sev}`;
}

const PRECISION_LABELS: Record<string, string> = {
  facility_join: "設施座標（ems_no join）",
  address_exact: "地址精確定位",
  address_osm: "地址（OSM）",
  parcel: "地號補點",
  approx: "約略位置（內插）",
  unknown: "未知",
};

const REASON_LABELS: Record<string, string> = {
  money_100k: "罰鍰 >= 10 萬",
  important: "重大案件",
  continuous: "連續處罰",
  stop_order: "停工 / 停業 / 勒令 / 廢止",
  illegal_money: "不法利得",
  money_30k_100k: "罰鍰 3-10 萬",
  mobile: "移動污染",
};

export function PollutionFacilityPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const maxSev = Number(props.max_sev ?? 0);
  return (
    <div>
      <Row field="name" value={String(props.name ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="industry" value={String(props.industry_macro ?? "")} />
      <Row label={t("popup.pollution.maxSeverity")} value={sevLabel(maxSev, i18n)} color={SEVERITY_BANDS.find((b) => b.sev === maxSev)?.color} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
        {FACILITY_MEDIA.map((m: PollutionMedium) => {
          const raw = props[`sev_${m}`];
          if (raw == null) return null;
          const sev = Number(raw);
          return (
            <Badge key={m} label={`${enumLabel("pollutionMedium", m, POLLUTION_MEDIUM_LABELS[m], i18n)} S${sev}`} on={sev > 0} color={POLLUTION_MEDIUM_COLORS[m]} />
          );
        })}
      </div>
      <ToxicPermitsBlock emsno={props.emsno} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        {t("popup.pollution.facilityNote")}
      </div>
    </div>
  );
}

const TOXIC_CHEMS_SHOWN = 6;

/** 「民國年-季」→ 目前語系的資料期（中文「民國115年第2季」；英日「2026 Q2」）。 */
function toxicPeriod(period: string, i18n: LocaleSnapshot): string {
  const [rocText, season] = period.split("-");
  const roc = Number(rocText);
  if (!Number.isFinite(roc)) return period;
  const year = String(i18n.active === "zh-TW" ? roc : roc + 1911);
  // season 0＝年度釋放量申報（上游只有 emi_type「釋放量」用 0），不是第 0 季
  if (season === "0") return i18n.t("popup.pollution.toxicPeriodAnnual", { year });
  return i18n.t("popup.pollution.toxicPeriodValue", { year, season: season ?? "" });
}

/**
 * 毒化物運作區塊（G19 決定 #7）：依 emsno 查環境部 EMS_S_05 聚合 lookup，命中才顯示；
 * 不以 is_toxic／sev_toxic 推斷（語意不同）。座標仍為污染設施；統編不顯示。出典與設施來源分開列。
 */
export function ToxicPermitsBlock({ emsno }: { emsno: unknown }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const theme = useFeatureTheme();
  const key = normalizeEmsno(emsno);
  const [info, setInfo] = useState<ToxicPermitInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!key) return;
    let cancelled = false;
    fetchToxicPermits(key)
      .then((value) => { if (!cancelled) setInfo(value); })
      .catch((e) => console.warn("[ToxicPermits] lookup failed:", e));
    return () => { cancelled = true; };
  }, [key]);
  if (!info) return null;
  const zh = i18n.active === "zh-TW";
  const names = info.chems.map((c) => (zh || !c.en ? c.zh : c.en));
  const shown = names.slice(0, TOXIC_CHEMS_SHOWN).join(t("popup.common.listSeparator"));
  const chemText = names.length > TOXIC_CHEMS_SHOWN ? t("popup.pollution.toxicChemsMore", { list: shown, n: formatNumber(names.length) }) : shown;
  const acts = info.activities.map((a) => enumLabel("toxicActivity", a, a, i18n)).join(t("popup.common.listSeparator"));
  return (
    <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${theme.borderSoft}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: POLLUTION_MEDIUM_COLORS.toxic, marginBottom: 2 }}>{t("popup.pollution.toxicTitle")}</div>
      <Row label={t("popup.pollution.toxicChems")} value={chemText} />
      <Row label={t("popup.pollution.toxicActivities")} value={acts} />
      <Row label={t("popup.pollution.toxicPermits")} value={info.validPermits > 0 ? t("popup.pollution.toxicPermitCount", { n: formatNumber(info.validPermits) }) : t("popup.pollution.toxicPermitNone")} />
      {info.latestEdate && <Row label={t("popup.pollution.toxicEdate")} value={info.latestEdate} />}
      <Row label={t("popup.pollution.toxicPeriod")} value={toxicPeriod(info.period, i18n)} />
      <div style={{ marginTop: 4, fontSize: 11, color: theme.textDim, lineHeight: 1.4 }}>{t("popup.pollution.toxicSource")}</div>
    </div>
  );
}

export function PollutionPenaltyPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const medium = String(props.event_medium ?? "other") as PollutionMedium;
  const severity = String(props.severity_event ?? "normal") as PollutionPenaltySeverity;
  const money = Number(props.penalty_money ?? 0);
  const illegalMoney = Number(props.illegal_money ?? 0);
  const reason = String(props.severity_reason ?? "")
    .split(",")
    .filter(Boolean)
    .map((r) => enumLabel("pollutionReason", r, REASON_LABELS[r] ?? r, i18n))
    .join(t("popup.common.listSeparator"));
  return (
    <div>
      <Row label={t("popup.pollution.penalized")} value={String(props.fac_name ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row label={t("popup.pollution.medium")} value={enumLabel("pollutionMedium", medium, POLLUTION_MEDIUM_LABELS[medium] ?? medium, i18n)} color={POLLUTION_MEDIUM_COLORS[medium]} />
      <Row label={t("popup.pollution.tier")} value={enumLabel("pollutionPenaltySeverity", severity, PENALTY_SEVERITY_LABELS[severity] ?? severity, i18n)} color={PENALTY_SEVERITY_COLORS[severity]} />
      {reason && <Row field="severityReason" value={reason} />}
      <Row field="penaltyType" value={String(props.transgress_type ?? "")} />
      <Row field="lawViolated" value={String(props.transgress_law ?? "")} />
      <Row field="violationFact" value={String(props.violation_fact ?? "")} />
      <Row field="penaltyDate" value={String(props.penalty_date ?? "")} />
      <Row field="fine" value={money > 0 ? `NT$ ${formatNumber(money)}` : "—"} />
      {illegalMoney > 0 && <Row label={t("popup.pollution.illegalGain")} value={`NT$ ${formatNumber(illegalMoney)}`} />}
      {Number(props.is_continuous ?? 0) === 1 && (
        <div style={{ marginTop: 6 }}>
          <Badge label={t("popup.pollution.continuous")} on color="#dc2626" />
        </div>
      )}
      {Number(props.is_stop_order ?? 0) === 1 && (
        <div style={{ marginTop: 6 }}>
          <Badge label={t("popup.pollution.stopOrder")} on color="#ef4444" />
        </div>
      )}
      <Row label={t("popup.pollution.improveStatus")} value={String(props.is_improve ?? "")} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        {t("popup.pollution.geocodeMethod", { value: enumLabel("pollutionPrecision", String(props.geocode_precision ?? "unknown"), PRECISION_LABELS[String(props.geocode_precision ?? "unknown")] ?? String(props.geocode_precision ?? ""), i18n) })}
      </div>
    </div>
  );
}

export function PollutionSitePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const active = Number(props.is_active ?? 0) === 1;
  return (
    <div>
      <Row label={t("popup.pollution.siteName")} value={String(props.site_name ?? "")} />
      <Row field="county" value={placeName(String(props.county ?? ""), i18n)} />
      <Row field="district" value={placeTown(String(props.county ?? ""), String(props.township ?? ""), i18n)} />
      <Row field="type" value={String(props.site_type ?? "")} />
      <Row label={t("popup.pollution.controlType")} value={String(props.controltype ?? "")} />
      <Row label={t("popup.pollution.announceDate")} value={String(props.anno_date ?? "")} />
      <Row label={t("popup.pollution.pollutant")} value={String(props.pollutant_short ?? "")} />
      <div style={{ marginTop: 6 }}>
        <Badge label={active ? t("popup.pollution.stillControlled") : t("popup.pollution.released")} on={active} color="#dc2626" />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
        {t("popup.pollution.siteNote")}
      </div>
    </div>
  );
}
