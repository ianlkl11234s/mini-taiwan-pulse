// ⚠️ 自動產生（move-country-pack.ts）：菲律賓國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { PH_PACK_MANIFEST } from "./manifest";
import { PH_PACK_PARAMS } from "./params";
import { PH_PACK_SOURCE_INFO } from "./sourceInfo";
import { PH_PACK_NOTES } from "./notes";
import { PH_PACK_SPEC_NOTES } from "./specNotes";
import { PH_PACK_PANELS } from "./panels";
import { PH_PACK_HEADER_LABELS } from "./headerLabels";
import { PH_PACK_LEGEND_SLOTS } from "./legends";
import { PH_PACK_CLICK_SLOTS } from "./clicks";
import { PH_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "PH",
  records: {
    layerManifest: PH_PACK_MANIFEST,
    layerParamsSpec: PH_PACK_PARAMS,
    layerSourceInfo: PH_PACK_SOURCE_INFO,
    layerNotes: PH_PACK_NOTES,
    layerSpecNotes: PH_PACK_SPEC_NOTES,
    featurePanels: PH_PACK_PANELS,
    featureHeaderLabels: PH_PACK_HEADER_LABELS,
  },
  slots: {
    legends: PH_PACK_LEGEND_SLOTS,
    gisClickLayers: PH_PACK_CLICK_SLOTS,
    layerHosts: PH_PACK_HOST_SLOTS,
  },
};

export default pack;
