// ⚠️ 自動產生（move-country-pack.ts）：印尼國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { ID_PACK_MANIFEST } from "./manifest";
import { ID_PACK_PARAMS } from "./params";
import { ID_PACK_SOURCE_INFO } from "./sourceInfo";
import { ID_PACK_PANELS } from "./panels";
import { ID_PACK_HEADER_LABELS } from "./headerLabels";
import { ID_PACK_LEGEND_SLOTS } from "./legends";
import { ID_PACK_CLICK_SLOTS } from "./clicks";
import { ID_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "ID",
  records: {
    layerManifest: ID_PACK_MANIFEST,
    layerParamsSpec: ID_PACK_PARAMS,
    layerSourceInfo: ID_PACK_SOURCE_INFO,
    featurePanels: ID_PACK_PANELS,
    featureHeaderLabels: ID_PACK_HEADER_LABELS,
  },
  slots: {
    legends: ID_PACK_LEGEND_SLOTS,
    gisClickLayers: ID_PACK_CLICK_SLOTS,
    layerHosts: ID_PACK_HOST_SLOTS,
  },
};

export default pack;
