// ⚠️ 自動產生（move-country-pack.ts）：南韓國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { KR_PACK_MANIFEST } from "./manifest";
import { KR_PACK_PARAMS } from "./params";
import { KR_PACK_SOURCE_INFO } from "./sourceInfo";
import { KR_PACK_NOTES } from "./notes";
import { KR_PACK_SPEC_NOTES } from "./specNotes";
import { KR_PACK_PANELS } from "./panels";
import { KR_PACK_HEADER_LABELS } from "./headerLabels";
import { KR_PACK_STYLE_IDS } from "./styleIds";
import { KR_PACK_LEGEND_SLOTS } from "./legends";
import { KR_PACK_CLICK_SLOTS } from "./clicks";
import { KR_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "KR",
  records: {
    layerManifest: KR_PACK_MANIFEST,
    layerParamsSpec: KR_PACK_PARAMS,
    layerSourceInfo: KR_PACK_SOURCE_INFO,
    layerNotes: KR_PACK_NOTES,
    layerSpecNotes: KR_PACK_SPEC_NOTES,
    featurePanels: KR_PACK_PANELS,
    featureHeaderLabels: KR_PACK_HEADER_LABELS,
    layerStyleIds: KR_PACK_STYLE_IDS,
  },
  slots: {
    legends: KR_PACK_LEGEND_SLOTS,
    gisClickLayers: KR_PACK_CLICK_SLOTS,
    layerHosts: KR_PACK_HOST_SLOTS,
  },
};

export default pack;
