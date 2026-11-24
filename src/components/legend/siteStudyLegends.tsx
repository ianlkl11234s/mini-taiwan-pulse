// 設施研究 M（站主限定）圖例：類別名稱、顏色與筆數全部讀私人檔的 meta.legend，程式不寫任何類別值。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchSquare } from "./legendKit";
import { OwnerDataFailure } from "./agriIndustryLegends";
import { SITE_STUDY_M_ASSETS, siteStudyMMetaStore } from "../../data/siteStudyMLoader";
import type { OwnerDataAssetName } from "../../data/ownerDataAssets";
import { ownerDataStatus } from "../../lib/ownerData";
import type { SiteStudyMeta } from "../../data/siteStudyMTypes";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { paramBool, useLayerParams } from "../../layers/layerParamsAccess";
import { useLocale } from "../../state/localeStore";

function LegendRows({ meta }: { meta: SiteStudyMeta }) {
  const { formatNumber } = useLocale();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {meta.legend.map((row) => (
        <LegendRow key={row.key} swatch={<SwatchSquare color={row.color} />}>
          {row.count === null ? row.label : `${row.label} · ${formatNumber(row.count)}`}
        </LegendRow>
      ))}
    </div>
  );
}

/** 圖例列；還沒有資料時顯示載入中（讀取失敗時由 OwnerDataFailure 顯示原因，不再疊一行載入中） */
function LegendBody({ meta, asset }: { meta: SiteStudyMeta | undefined; asset: OwnerDataAssetName }) {
  const { t } = useLocale();
  const get = () => ownerDataStatus.get(asset).state;
  const state = useSyncExternalStore(ownerDataStatus.subscribe, get, get);
  if (meta) return <LegendRows meta={meta} />;
  return state === "error" ? null : <LegendNote>{t("legend.siteStudy.loading")}</LegendNote>;
}

export function SiteStudyMLegend() {
  const i18n = useLocale();
  const meta = useSyncExternalStore(siteStudyMMetaStore.subscribe, siteStudyMMetaStore.getSnapshot, siteStudyMMetaStore.getSnapshot);
  const showOverlays = paramBool(useLayerParams("siteStudyM"), "siteStudyM", "siteStudyMOverlays");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <LegendTitle zh={localizeLayerName("siteStudyM", LAYER_MANIFEST.siteStudyM.name, i18n).primary} en="Site Study M" />
        <OwnerDataFailure asset={SITE_STUDY_M_ASSETS.sites} i18n={i18n} />
        <LegendBody meta={meta.sites} asset={SITE_STUDY_M_ASSETS.sites} />
        {meta.sites?.built && <LegendNote>{i18n.t("legend.siteStudy.built", { date: meta.sites.built })}</LegendNote>}
        {meta.sites?.note && <LegendNote>{meta.sites.note}</LegendNote>}
      </div>
      {showOverlays && (
        <div>
          <LegendTitle zh={i18n.t("legend.siteStudy.overlaysTitle")} />
          <OwnerDataFailure asset={SITE_STUDY_M_ASSETS.overlays} i18n={i18n} />
          <LegendBody meta={meta.overlays} asset={SITE_STUDY_M_ASSETS.overlays} />
        </div>
      )}
    </div>
  );
}
