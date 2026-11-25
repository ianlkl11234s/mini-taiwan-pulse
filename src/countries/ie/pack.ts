// ⚠️ 自動產生（move-country-pack.ts）：愛爾蘭國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { IE_PACK_MANIFEST } from "./manifest";
import { IE_PACK_PARAMS } from "./params";
import { IE_PACK_SOURCE_INFO } from "./sourceInfo";
import { IE_PACK_NOTES } from "./notes";
import { IE_PACK_SPEC_NOTES } from "./specNotes";
import { IE_PACK_PANELS } from "./panels";
import { IE_PACK_HEADER_LABELS } from "./headerLabels";
import { IE_PACK_LEGEND_SLOTS } from "./legends";
import { IE_PACK_CLICK_SLOTS } from "./clicks";
import { IE_PACK_OVERLAY_SLOTS } from "./overlays";
import { IE_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "IE",
  records: {
    layerManifest: IE_PACK_MANIFEST,
    layerParamsSpec: IE_PACK_PARAMS,
    layerSourceInfo: IE_PACK_SOURCE_INFO,
    layerNotes: IE_PACK_NOTES,
    layerSpecNotes: IE_PACK_SPEC_NOTES,
    featurePanels: IE_PACK_PANELS,
    featureHeaderLabels: IE_PACK_HEADER_LABELS,
  },
  slots: {
    legends: IE_PACK_LEGEND_SLOTS,
    gisClickLayers: IE_PACK_CLICK_SLOTS,
    overlays: IE_PACK_OVERLAY_SLOTS,
    layerHosts: IE_PACK_HOST_SLOTS,
  },
};

export default pack;
