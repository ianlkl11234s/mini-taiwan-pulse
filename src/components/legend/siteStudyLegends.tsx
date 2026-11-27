// 設施研究 M（站主限定）圖例：類別名稱、顏色與筆數全部讀私人檔的 meta.legend，程式不寫任何類別值。四個圖層共用。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchSquare } from "./legendKit";
import { OwnerDataFailure } from "./agriIndustryLegends";
import { siteStudyMMetaStore } from "../../data/siteStudyMLoader";
import { SITE_STUDY_M_PARTS, type SiteStudyMeta, type SiteStudyPart } from "../../data/siteStudyMTypes";
import { ownerDataStatus } from "../../lib/ownerData";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
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
function LegendBody({ meta, part }: { meta: SiteStudyMeta | undefined; part: SiteStudyPart }) {
  const { t } = useLocale();
  const asset = SITE_STUDY_M_PARTS[part].asset;
  const get = () => ownerDataStatus.get(asset).state;
  const state = useSyncExternalStore(ownerDataStatus.subscribe, get, get);
  if (meta) return <LegendRows meta={meta} />;
  return state === "error" ? null : <LegendNote>{t("legend.siteStudy.loading")}</LegendNote>;
}

export function SiteStudyMLegend({ part = "sites" }: { part?: SiteStudyPart }) {
  const i18n = useLocale();
  const { layerKey, asset } = SITE_STUDY_M_PARTS[part];
  const all = useSyncExternalStore(siteStudyMMetaStore.subscribe, siteStudyMMetaStore.getSnapshot, siteStudyMMetaStore.getSnapshot);
  const meta = all[part];
  const loc = localizeLayerName(layerKey, LAYER_MANIFEST[layerKey].name, i18n);
  return (
    <div>
      <LegendTitle zh={loc.primary} en={loc.secondary} />
      <OwnerDataFailure asset={asset} i18n={i18n} />
      <LegendBody meta={meta} part={part} />
      {meta?.built && <LegendNote>{i18n.t("legend.siteStudy.built", { date: meta.built })}</LegendNote>}
      {meta?.note && <LegendNote>{meta.note}</LegendNote>}
    </div>
  );
}
