// 南韓 KRH-1 popup：生態自然圖（C117）、生活垃圾排出規則（C086，星期格子 spec §5.46）。來源由 panel 自掛 SourceFooter。
import { useEffect, useState } from "react";
import { PopupDetails, PopupScroll, Row, SourceFooter, Title } from "./shared";
import { WeekdayGrid } from "./WeekdayGrid";
import { useFeatureTheme } from "./featureTheme";
import { FONT_DATA, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../styles/designTokens";
import { pickL3, type L3 } from "../../data/krDataLayers";
import { useLocale } from "../../state/localeStore";
import { krEcoIndexNow, krWasteRulesNow, loadKrWasteRules } from "../../data/krEcoWasteLoader";
import {
  KR_ECO_COLOR, KR_ECO_EVAL_FIELDS, KR_ECO_LICENSE, KR_ECO_SOURCE_ORG, KR_ECO_SOURCE_URL, KR_ECO_TEXT, KR_KRH1_FETCHED_AT,
  KR_WASTE_ATTRIBUTION, KR_WASTE_COLOR, KR_WASTE_ITEMS, KR_WASTE_LICENSE, KR_WASTE_PLACE_TYPES, KR_WASTE_SOURCE_URL, KR_WASTE_TEXT,
  KR_WEEKDAY_LONG, KR_WEEKDAY_SHORT, KR_WEEKDAYS, krEcoGrade, krWasteDaysState,
  type KrWasteGroup, type KrWasteRulesFile, type KrWasteSgg, type KrWeekday,
} from "../../data/krEcoWasteTypes";

const text = (value: unknown) => (value == null ? "" : String(value).trim());
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

// ─────────────────────────── C117 生態自然圖 ───────────────────────────

/** props 由點擊流程補上 `_eco_source`（命中的分片 source id，`kr-eco-nature-<code>`），用來查該 시·도 檔的고시번호。 */
export function KrEcologyNaturalnessPanel({ props }: { props: Record<string, unknown> }) {
  const { locale } = useLocale();
  const L = (x: L3) => pickL3(x, locale);
  const grade = krEcoGrade(props.eczmGr);
  const code = text(props._eco_source).replace(/^kr-eco-nature-/, "");
  const file = krEcoIndexNow()?.find((f) => f.code === code);
  const age = text(props.frphAgclNm);
  const notice = file?.notice_no ? `기후에너지환경부 고시 제${file.notice_no}호${file.notice_date ? `（${file.notice_date}）` : ""}` : "";
  return <>
    <Title color={grade?.color ?? KR_ECO_COLOR}>{grade ? L(grade.label) : L(KR_ECO_TEXT.title)}</Title>
    <Row label={L(KR_ECO_TEXT.grade)} value={grade ? L(grade.label) : text(props.eczmGr)} />
    <Row label={L(KR_ECO_TEXT.plant)} value={text(props.plntClnNm)} />
    {KR_ECO_EVAL_FIELDS.map((f) => {
      const v = text(props[f.prop]);
      return <Row key={f.prop} label={L(f.label)} value={v ? `${v}${L(KR_ECO_TEXT.gradeSuffix)}` : ""} />;
    })}
    <Row label={L(KR_ECO_TEXT.wetland)} value={text(props.precSmldNm)} />
    <Row label={L(KR_ECO_TEXT.landform)} value={text(props.tpgrphNm)} />
    <Row label={L(KR_ECO_TEXT.forestAge)} value={age === "N/A" ? "" : age} />
    <Row label={L(KR_ECO_TEXT.region)} value={file?.sido_ecobank ?? ""} />
    <Row label={L(KR_ECO_TEXT.notice)} value={notice} />
    <SourceFooter props={{ source_org: `${KR_ECO_SOURCE_ORG} · ${L(KR_ECO_TEXT.popupUnmodified)}`, source_url: KR_ECO_SOURCE_URL, license: KR_ECO_LICENSE, fetched_at: KR_KRH1_FETCHED_AT }} />
  </>;
}

// ─────────────────────────── C086 垃圾排出規則 ───────────────────────────

function useWasteRules(): KrWasteRulesFile | null {
  const [rules, setRules] = useState<KrWasteRulesFile | null>(krWasteRulesNow());
  useEffect(() => {
    if (rules) return;
    let alive = true;
    loadKrWasteRules().then((d) => { if (alive) setRules(d); }).catch(() => undefined);
    return () => { alive = false; };
  }, [rules]);
  return rules;
}

const MAX_ZONES = 3;
const MAX_SITES = 20;

function GroupBlock({ g, color, showDays }: { g: KrWasteGroup; color: string; showDays: boolean }) {
  const t = useFeatureTheme();
  const { locale } = useLocale();
  const L = (x: L3) => pickL3(x, locale);
  const d = krWasteDaysState(g);
  const time = g.start && g.end ? `${g.start}–${g.end}` : "";
  const zones = g.zones ?? [];
  const sites = (g.sites ?? []).filter(([, place]) => text(place));
  return <div className="fi-row" style={{ padding: "4px 0", fontSize: FONT_SIZE.base, lineHeight: 1.35 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {showDays && d.days.length > 0
        ? <WeekdayGrid order={KR_WEEKDAYS} on={d.days} color={color}
          short={(x) => L(KR_WEEKDAY_SHORT[x as KrWeekday])} long={(x) => L(KR_WEEKDAY_LONG[x as KrWeekday])} />
        : null}
      {showDays && d.missing ? <span style={{ color: t.textMuted }}>{L(KR_WASTE_TEXT.daysMissing)}</span> : null}
      {showDays && d.other ? <span style={{ color: t.textMuted }}>{d.days.length > 0 ? "＋" : ""}{L(KR_WASTE_TEXT.daysOther)}</span> : null}
      {time
        ? <span style={{ color: t.textStrong, fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{time}</span>
        : <span style={{ color: t.textMuted }}>{L(KR_WASTE_TEXT.timeMissing)}</span>}
    </div>
    {zones.length > 0 ? <div style={{ fontSize: FONT_SIZE.sm, color: t.textMuted, marginTop: 2 }}>
      {L(KR_WASTE_TEXT.zones)}：{zones.slice(0, MAX_ZONES).join("；")}{zones.length > MAX_ZONES ? `　${fill(L(KR_WASTE_TEXT.moreZones), { n: zones.length - MAX_ZONES })}` : ""}
    </div> : null}
    {(g.methods ?? []).length > 0 ? <div style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, marginTop: 2 }}>
      {L(KR_WASTE_TEXT.methods)}：{(g.methods ?? []).join("／")}
    </div> : null}
    {sites.length > 0 ? <PopupDetails summary={fill(L(KR_WASTE_TEXT.sites), { n: sites.length })}>
      <ul style={{ margin: 0, paddingLeft: 14, fontSize: FONT_SIZE.sm, color: t.textDefault }}>
        {sites.slice(0, MAX_SITES).map(([zone, place], i) => <li key={i}>{zone ? `${zone}：` : ""}{place}</li>)}
      </ul>
      {sites.length > MAX_SITES ? <div style={{ fontSize: FONT_SIZE.sm, color: t.textDim }}>{fill(L(KR_WASTE_TEXT.moreSites), { n: sites.length - MAX_SITES })}</div> : null}
    </PopupDetails> : null}
  </div>;
}

function ItemSection({ rule, item }: { rule: KrWasteSgg; item: (typeof KR_WASTE_ITEMS)[number] }) {
  const t = useFeatureTheme();
  const { locale } = useLocale();
  const L = (x: L3) => pickL3(x, locale);
  const groups = rule.items?.[item.id] ?? [];
  return <div style={{ marginTop: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: t.textStrong }}>
      <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: item.color, flexShrink: 0 }} />
      {L(item.label)}
      <span style={{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.regular, color: t.textMuted }}>{groups.length > 0 ? fill(L(KR_WASTE_TEXT.groups), { n: groups.length }) : ""}</span>
    </div>
    {groups.length === 0
      ? <div style={{ fontSize: FONT_SIZE.sm, color: t.textMuted, padding: "3px 0" }}>{L(KR_WASTE_TEXT.noItem)}</div>
      : groups.map((g, i) => <GroupBlock key={i} g={g} color={item.color} showDays={item.id !== "bulky"} />)}
  </div>;
}

/** props＝kr_admin_boundaries sgg 層（sgg_code、sgg_name、sido_name）；規則依 sgg_code 從 JSON 查。 */
export function KrWasteDisposalRulesPanel({ props }: { props: Record<string, unknown> }) {
  const { locale } = useLocale();
  const L = (x: L3) => pickL3(x, locale);
  const rules = useWasteRules();
  const code = text(props.sgg_code);
  const name = [text(props.sido_name), text(props.sgg_name)].filter(Boolean).join(" ");
  const footer = <SourceFooter props={{ source_org: KR_WASTE_ATTRIBUTION, source_url: KR_WASTE_SOURCE_URL, license: KR_WASTE_LICENSE, fetched_at: KR_KRH1_FETCHED_AT }} />;
  if (!rules) return <>
    <Title color={KR_WASTE_COLOR}>{name || L(KR_WASTE_TEXT.title)}</Title>
    <Row label={L(KR_WASTE_TEXT.title)} value={L(KR_WASTE_TEXT.rulesLoading)} />
    {footer}
  </>;
  const rule = rules.sgg[code];
  if (!rule) return <>
    <Title color={KR_WASTE_COLOR}>{name || L(KR_WASTE_TEXT.title)}</Title>
    <Row label={L(KR_WASTE_TEXT.title)} value={L(KR_WASTE_TEXT.uncoveredPopup)} />
    {footer}
  </>;
  const places = Object.entries(rule.place_types ?? {}).map(([k, n]) => `${KR_WASTE_PLACE_TYPES[k] ? L(KR_WASTE_PLACE_TYPES[k]!) : k} ${n}`).join("、");
  const dates = rule.data_date ? (rule.data_date[0] === rule.data_date[1] ? rule.data_date[0] : `${rule.data_date[0]}～${rule.data_date[1]}`) : "";
  return <>
    <Title color={KR_WASTE_COLOR}>{name || rule.sgg_name}</Title>
    {rule.scope === "city" ? <Row label={L(KR_WASTE_TEXT.title)} value={fill(L(KR_WASTE_TEXT.cityScope), { city: rule.applies_from ?? "" })} /> : null}
    <Row label={L(KR_WASTE_TEXT.placeType)} value={places} />
    <Row label={L(KR_WASTE_TEXT.dept)} value={(rule.dept ?? []).join("、")} />
    <Row label={L(KR_WASTE_TEXT.noCollection)} value={(rule.no_collection ?? []).join("；")} />
    <Row label={L(KR_WASTE_TEXT.dataDate)} value={dates} mono />
    <PopupScroll>
      {KR_WASTE_ITEMS.map((item) => <ItemSection key={item.id} rule={rule} item={item} />)}
    </PopupScroll>
    {footer}
  </>;
}
