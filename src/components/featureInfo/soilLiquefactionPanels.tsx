import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { BOUNDARY_GRAY } from "../../map/mapStyleScale";
import {
  LIQUEFACTION_SITE_COLOR, LIQUEFACTION_SITE_PRECISION_LABEL, LIQUEFACTION_SITE_STATUS_LABEL,
  SOIL_LIQUEFACTION_OFFICIAL_MAP_URL, SOIL_LIQUEFACTION_RIGHTS_TEXT, SOIL_LIQUEFACTION_SOURCE_ORG,
  SOIL_POTENTIAL_CLASSES, SOIL_POTENTIAL_NOT_INVESTIGATED, WEAK_SOIL_COLORS, WEAK_SOIL_DEPTH_LABEL,
  WEAK_SOIL_LAYER_SPEC, WEAK_SOIL_MATERIAL_LABEL, WEAK_SOIL_SPT_THRESHOLD, weakSoilField,
  type WeakSoilLayerKey, type WeakSoilMaterial,
} from "../../data/soilLiquefactionTypes";

/**
 * 土壤液化 owner-only popup（spec §5.2）。tile 沒有來源欄位 → panel 端補來源常數並自掛 SourceFooter
 * （FeatureInfoPanel `FOOTER_SELF_MANAGED_LAYER_TYPES`）。不印 release_id／source_feature_id（§6.3）。
 */
const str = (value: unknown): string => (value == null || value === "" ? "" : String(value));
const footerProps = (props: Record<string, unknown>) => ({
  ...props,
  source_org: SOIL_LIQUEFACTION_SOURCE_ORG,
  source_url: SOIL_LIQUEFACTION_OFFICIAL_MAP_URL,
  license: SOIL_LIQUEFACTION_RIGHTS_TEXT,
});
const SITE_CAVEAT = "個別基地僅供初步評估，不構成工程安全判定；請以官方圖台與現地鑽探為準。";

export function SoilLiquefactionPotentialPanel({ props }: { props: Record<string, unknown> }) {
  const raw = str(props.potential_class);
  const known = SOIL_POTENTIAL_CLASSES.find((item) => item.value === raw);
  const notInvestigated = raw === SOIL_POTENTIAL_NOT_INVESTIGATED;
  const label = known?.label ?? (notInvestigated ? "未調查" : "類別缺值");
  return <>
    <Title color={known?.color ?? BOUNDARY_GRAY.dark}>{`土壤液化潛勢：${label}`}</Title>
    <Row label="潛勢類別" value={label} />
    {known && <Row label="類別意義" value="官方整合鑽孔、地下水位、設計地震與歷史資料的綜合類別，不是量測值；不可回推 PL 或地下水位。" />}
    {notInvestigated && <Row label="未調查" value="官方未調查區（含山區、臺地、海埔新生地、河岸及零星小平地），不等於低潛勢。" />}
    {!known && !notInvestigated && <Row label="資料限制" value="來源未提供潛勢類別；不等於低潛勢。" />}
    <Row label="評估年份" value={str(props.source_year)} mono />
    <Row label="使用限制" value={SITE_CAVEAT} />
    <SourceFooter props={footerProps(props)} />
  </>;
}

function thicknessText(value: unknown): string {
  if (value == null || value === "") return "—（缺值）";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—（缺值）";
  return number === 0 ? "0 m（此深度段無弱層）" : `${number.toLocaleString("zh-TW")} m`;
}

function makeWeakSoilPanel(key: WeakSoilLayerKey): FC<{ props: Record<string, unknown> }> {
  const { material, depth } = WEAK_SOIL_LAYER_SPEC[key];
  const depthLabel = WEAK_SOIL_DEPTH_LABEL[depth];
  const order: WeakSoilMaterial[] = material === "sand" ? ["sand", "clay"] : ["clay", "sand"];
  const Panel = ({ props }: { props: Record<string, unknown> }) => <>
    <Title color={WEAK_SOIL_COLORS[material][3]}>{`地表下 ${depthLabel} 弱層厚度`}</Title>
    {order.map((item) => (
      <Row key={item} label={`${WEAK_SOIL_MATERIAL_LABEL[item]}（${WEAK_SOIL_SPT_THRESHOLD[item]}）`} value={thicknessText(props[weakSoilField(item, depth)])} />
    ))}
    <Row label="門檻" value="軟弱黏土為黏性土 SPT-N≤4；疏鬆砂土為砂質土 SPT-N≤10。" />
    <Row label="深度用途" value="0–5／5–10／10–20 m 分別對應不同開挖參考深度；厚度是該深度段內弱層合計，不是全深度。" />
    <Row label="使用限制" value={`網格僅供初步評估，不構成工程安全判定。${SITE_CAVEAT}`} />
    <SourceFooter props={footerProps(props)} />
  </>;
  Panel.displayName = `WeakSoilPanel(${key})`;
  return Panel;
}

export const WEAK_SOIL_PANELS = {
  weakSoilClay0To5: makeWeakSoilPanel("weakSoilClay0To5"),
  weakSoilSand0To5: makeWeakSoilPanel("weakSoilSand0To5"),
  weakSoilClay5To10: makeWeakSoilPanel("weakSoilClay5To10"),
  weakSoilSand5To10: makeWeakSoilPanel("weakSoilSand5To10"),
  weakSoilClay10To20: makeWeakSoilPanel("weakSoilClay10To20"),
  weakSoilSand10To20: makeWeakSoilPanel("weakSoilSand10To20"),
} as const satisfies Record<WeakSoilLayerKey, FC<{ props: Record<string, unknown> }>>;

export function LiquefactionMonitoringSitePanel({ props }: { props: Record<string, unknown> }) {
  const status = str(props.status);
  const precision = str(props.precision);
  return <>
    <Title color={LIQUEFACTION_SITE_COLOR}>{str(props.name) || "土壤液化監測站"}</Title>
    <Row label="運作狀態" value={LIQUEFACTION_SITE_STATUS_LABEL[status] ?? status} />
    <Row label="位置精度" value={LIQUEFACTION_SITE_PRECISION_LABEL[precision] ?? precision} />
    <Row label="資料限制" value="只有站點位置與名稱，不是即時觀測值；監測數據請回官方頁面查詢。" />
    <SourceFooter props={footerProps(props)} />
  </>;
}
