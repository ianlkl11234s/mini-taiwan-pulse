// 日本國家包：從共用檔搬來的國家專屬元件（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import { bumpHostRender, type LayerHostComponent } from "../../layers/layerHostDeps";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { useJpReligionLayers } from "./useJpReligionLayers";


/** 🌍 世界 WORLD：日本宗教設施三個彼此獨立的 raw source layer。 */
export const JpReligionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpReligionLayers");
  const gsi = useKeyOverlayParams("jpReligionGsi");
  const osm = useKeyOverlayParams("jpReligionOsm");
  const wikidata = useKeyOverlayParams("jpReligionWikidata");
  useJpReligionLayers(
    deps.mapRef,
    {
      jpReligionGsi: deps.layerVisibility.jpReligionGsi,
      jpReligionOsm: deps.layerVisibility.jpReligionOsm,
      jpReligionWikidata: deps.layerVisibility.jpReligionWikidata,
    },
    {
      jpReligionGsi: gsi.jpReligionGsiOpacity ?? 0.6,
      jpReligionOsm: osm.jpReligionOsmOpacity ?? 0.75,
      jpReligionWikidata: wikidata.jpReligionWikidataOpacity ?? 0.75,
    },
    {
      jpReligionGsi: gsi.jpReligionGsiScale ?? 1,
      jpReligionOsm: osm.jpReligionOsmScale ?? 1,
      jpReligionWikidata: wikidata.jpReligionWikidataScale ?? 1,
    },
    deps.isDarkTheme,
    { jpReligionGsi: gsi.jpReligionGsiCatMask, jpReligionOsm: osm.jpReligionOsmCatMask, jpReligionWikidata: wikidata.jpReligionWikidataCatMask },
  );
  return null;
};
