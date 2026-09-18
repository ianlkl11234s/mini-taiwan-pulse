import { useEffect, useState } from "react";
import { loadPropertyValueAdmin, type PropertyValueAdmin } from "../../data/propertyValueAdminLoader";
import { PROPERTY_VALUE_ADMIN_LEVELS, resolvePropertyValueAdminLevel } from "../../data/propertyValueAdminTypes";
import { useLayerParams } from "../../state/layerParamsStore";
import { FONT_SIZE } from "../../styles/designTokens";

export function PropertyValueStatisticsDetails() {
  const params = useLayerParams("propertyValueAdmin");
  const level = resolvePropertyValueAdminLevel(params.propertyValueAdminLevel === "township" ? 1 : 0);
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  const [data, setData] = useState<PropertyValueAdmin | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPropertyValueAdmin().then((value) => { if (!cancelled) setData(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const count = data?.[level].length;
  return (
    <div style={{ fontSize: FONT_SIZE.xs, lineHeight: 1.55, color: "rgba(180,200,220,0.82)" }}>
      <div>{config.label}覆蓋：{count ?? "…"} / {config.expectedCount}。缺值以灰色顯示，不當作 0。</div>
      {level === "township" && <div>鄉鎮市區界自 z6 開始顯示；縣市層可在全國尺度閱讀。</div>}
      <div>目前來源未提供金門、連江、澎湖；嘉義市與其兩區已納入。</div>
      {data && <div>估值版本：{data.meta.value_version}。產製：{data.meta.generated_at.slice(0, 10)}。</div>}
      <div>這是市場交易建物的模型估值總量，不是公告地價、稅基或逐筆鑑價。</div>
    </div>
  );
}
