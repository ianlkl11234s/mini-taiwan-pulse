// 南韓第 3–5 波 18 層的共用 popup（規格見 data/krDataLayers.ts）。來源與授權由 panel 自掛 SourceFooter。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { KR_DATA_SPECS, KR_UNMEASURED, KR_UNNAMED, pickL3, type KrField, type KrLayerSpec } from "../../data/krDataLayers";
import type { KrDataKey } from "../../data/krDataKeys";

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const PEAK_DIR = { up: { zh: "上行", en: "up", ja: "上り" }, down: { zh: "下行", en: "down", ja: "下り" }, inner: { zh: "內環", en: "inner loop", ja: "内回り" }, outer: { zh: "外環", en: "outer loop", ja: "外回り" } } as const;

/** 標題色：分類層取該筆分類色（與地圖一致），否則用圖層主色。 */
function catColor(spec: KrLayerSpec, props: Record<string, unknown>): string {
  if (spec.key === "krSeoulSubwayCongestion") {
    const v = Number(props.peak_wkd);
    const cats = spec.cats!;
    return !Number.isFinite(v) ? spec.color : v < 34 ? cats[0]!.color : v < 80 ? cats[1]!.color : v < 130 ? cats[2]!.color : cats[3]!.color;
  }
  if (!spec.cats || !spec.catProp) return spec.color;
  const v = text(props[spec.catProp]);
  return spec.cats.find((c) => c.values.includes(v))?.color ?? spec.otherColor ?? spec.color;
}

function formatField(f: KrField, props: Record<string, unknown>, locale: string, fmt: (n: number, digits?: number) => string): string {
  const raw = props[f.prop];
  if (f.kind === "peak") {
    const v = Number(raw);
    if (raw == null || !Number.isFinite(v)) return "";
    const dir = text(props[`${f.prop}_dir`]) as keyof typeof PEAK_DIR;
    return `${fmt(v, 0)}% · ${text(props[`${f.prop}_slot`])} · ${PEAK_DIR[dir] ? pickL3(PEAK_DIR[dir], locale) : dir}`;
  }
  if (f.kind === "measure") {
    const v = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(v)) return pickL3(KR_UNMEASURED, locale);
    return `${fmt(v, f.digits ?? 2)}${f.unit ? ` ${f.unit}` : ""}`;
  }
  if (f.kind === "num") {
    const v = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(v)) return "";
    return `${fmt(v, f.digits ?? 0)}${f.unit ? ` ${f.unit}` : ""}`;
  }
  const s = text(raw);
  if (!s) return "";
  if (f.map?.[s]) return pickL3(f.map[s]!, locale);
  return s;
}

function makePanel(spec: KrLayerSpec): FC<{ props: Record<string, unknown> }> {
  return function KrDataPanel({ props }) {
    const i18n = useLocale();
    const locale = i18n.locale;
    const fmt = (n: number, digits = 0) => i18n.formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: digits });
    const title = spec.title.props.map((p) => text(props[p])).find(Boolean) || pickL3(spec.title.fallback ?? KR_UNNAMED, locale);
    const measuredNone = spec.key === "krWaterQualityStations" && props.measured === false;
    return <>
      <Title color={catColor(spec, props)}>{title}</Title>
      {spec.fields.map((f) => {
        const value = measuredNone && f.kind === "measure" ? pickL3(KR_UNMEASURED, locale) : formatField(f, props, locale, fmt);
        return <Row key={f.prop} label={pickL3(f.label, locale)} value={value} mono={f.kind === "code"} />;
      })}
      {spec.popupNotes.map((n, i) => <Row key={i} label={locale === "en" ? "Note" : locale === "ja" ? "備考" : "備註"} value={pickL3(n, locale)} />)}
      <SourceFooter props={{ source_org: spec.sourceOrg, source_url: spec.sourceUrl, license: spec.license, fetched_at: spec.fetchedAt }} />
    </>;
  };
}

export const KR_DATA_PANELS = Object.fromEntries(KR_DATA_SPECS.map((s) => [s.key, makePanel(s)])) as Record<KrDataKey, FC<{ props: Record<string, unknown> }>>;
