import { useEffect, useState } from "react";
import { loadPropertyValueAdmin, type PropertyValueAdmin } from "../../data/propertyValueAdminLoader";
import { PROPERTY_VALUE_ADMIN_LEVELS, resolvePropertyValueAdminLevel } from "../../data/propertyValueAdminTypes";
import { useLayerParams } from "../../state/layerParamsStore";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";

export function PropertyValueStatisticsDetails() {
  const { t } = useLocale();
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
      <div>{t("paramsPanel.pv.coverage", { label: t(level === "township" ? "paramsPanel.pv.levelTownship" : "paramsPanel.pv.levelCounty"), done: count ?? "…", expected: config.expectedCount })}</div>
      {level === "township" && <div>{t("paramsPanel.pv.townshipNote")}</div>}
      <div>{t("paramsPanel.pv.excluded")}</div>
      {data && <div>{t("paramsPanel.pv.version", { version: data.meta.value_version, date: data.meta.generated_at.slice(0, 10) })}</div>}
      <div>{t("paramsPanel.pv.disclaimer")}</div>
    </div>
  );
}
