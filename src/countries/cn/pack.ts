// ⚠️ 自動產生（move-country-pack.ts）：中國國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { CN_PACK_MANIFEST } from "./manifest";
import { CN_PACK_PARAMS } from "./params";
import { CN_PACK_SOURCE_INFO } from "./sourceInfo";
import { CN_PACK_NOTES } from "./notes";
import { CN_PACK_SPEC_NOTES } from "./specNotes";
import { CN_PACK_PANELS } from "./panels";
import { CN_PACK_HEADER_LABELS } from "./headerLabels";
import { CN_PACK_LEGEND_SLOTS } from "./legends";
import { CN_PACK_CLICK_SLOTS } from "./clicks";
import { CN_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "CN",
  records: {
    layerManifest: CN_PACK_MANIFEST,
    layerParamsSpec: CN_PACK_PARAMS,
    layerSourceInfo: CN_PACK_SOURCE_INFO,
    layerNotes: CN_PACK_NOTES,
    layerSpecNotes: CN_PACK_SPEC_NOTES,
    featurePanels: CN_PACK_PANELS,
    featureHeaderLabels: CN_PACK_HEADER_LABELS,
  },
  slots: {
    legends: CN_PACK_LEGEND_SLOTS,
    gisClickLayers: CN_PACK_CLICK_SLOTS,
    layerHosts: CN_PACK_HOST_SLOTS,
  },
};

export default pack;
