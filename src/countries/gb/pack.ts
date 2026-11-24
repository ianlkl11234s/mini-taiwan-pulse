// ⚠️ 自動產生（move-country-pack.ts）：英國國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { GB_PACK_MANIFEST } from "./manifest";
import { GB_PACK_PARAMS } from "./params";
import { GB_PACK_SOURCE_INFO } from "./sourceInfo";
import { GB_PACK_NOTES } from "./notes";
import { GB_PACK_PANELS } from "./panels";
import { GB_PACK_HEADER_LABELS } from "./headerLabels";
import { GB_PACK_LEGEND_SLOTS } from "./legends";
import { GB_PACK_CLICK_SLOTS } from "./clicks";
import { GB_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "GB",
  records: {
    layerManifest: GB_PACK_MANIFEST,
    layerParamsSpec: GB_PACK_PARAMS,
    layerSourceInfo: GB_PACK_SOURCE_INFO,
    layerNotes: GB_PACK_NOTES,
    featurePanels: GB_PACK_PANELS,
    featureHeaderLabels: GB_PACK_HEADER_LABELS,
  },
  slots: {
    legends: GB_PACK_LEGEND_SLOTS,
    gisClickLayers: GB_PACK_CLICK_SLOTS,
    layerHosts: GB_PACK_HOST_SLOTS,
  },
};

export default pack;
