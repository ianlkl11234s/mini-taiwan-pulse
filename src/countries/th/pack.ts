// ⚠️ 自動產生（move-country-pack.ts）：泰國國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { TH_PACK_MANIFEST } from "./manifest";
import { TH_PACK_PARAMS } from "./params";
import { TH_PACK_SOURCE_INFO } from "./sourceInfo";
import { TH_PACK_NOTES } from "./notes";
import { TH_PACK_PANELS } from "./panels";
import { TH_PACK_HEADER_LABELS } from "./headerLabels";
import { TH_PACK_LEGEND_SLOTS } from "./legends";
import { TH_PACK_CLICK_SLOTS } from "./clicks";
import { TH_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "TH",
  records: {
    layerManifest: TH_PACK_MANIFEST,
    layerParamsSpec: TH_PACK_PARAMS,
    layerSourceInfo: TH_PACK_SOURCE_INFO,
    layerNotes: TH_PACK_NOTES,
    featurePanels: TH_PACK_PANELS,
    featureHeaderLabels: TH_PACK_HEADER_LABELS,
  },
  slots: {
    legends: TH_PACK_LEGEND_SLOTS,
    gisClickLayers: TH_PACK_CLICK_SLOTS,
    layerHosts: TH_PACK_HOST_SLOTS,
  },
};

export default pack;
