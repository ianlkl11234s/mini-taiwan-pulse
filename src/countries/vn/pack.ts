// ⚠️ 自動產生（move-country-pack.ts）：越南國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { VN_PACK_MANIFEST } from "./manifest";
import { VN_PACK_PARAMS } from "./params";
import { VN_PACK_SOURCE_INFO } from "./sourceInfo";
import { VN_PACK_NOTES } from "./notes";
import { VN_PACK_SPEC_NOTES } from "./specNotes";
import { VN_PACK_PANELS } from "./panels";
import { VN_PACK_HEADER_LABELS } from "./headerLabels";
import { VN_PACK_LEGEND_SLOTS } from "./legends";
import { VN_PACK_CLICK_SLOTS } from "./clicks";
import { VN_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "VN",
  records: {
    layerManifest: VN_PACK_MANIFEST,
    layerParamsSpec: VN_PACK_PARAMS,
    layerSourceInfo: VN_PACK_SOURCE_INFO,
    layerNotes: VN_PACK_NOTES,
    layerSpecNotes: VN_PACK_SPEC_NOTES,
    featurePanels: VN_PACK_PANELS,
    featureHeaderLabels: VN_PACK_HEADER_LABELS,
  },
  slots: {
    legends: VN_PACK_LEGEND_SLOTS,
    gisClickLayers: VN_PACK_CLICK_SLOTS,
    layerHosts: VN_PACK_HOST_SLOTS,
  },
};

export default pack;
