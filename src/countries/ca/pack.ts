// ⚠️ 自動產生（move-country-pack.ts）：加拿大國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { CA_PACK_MANIFEST } from "./manifest";
import { CA_PACK_PARAMS } from "./params";
import { CA_PACK_SOURCE_INFO } from "./sourceInfo";
import { CA_PACK_NOTES } from "./notes";
import { CA_PACK_SPEC_NOTES } from "./specNotes";
import { CA_PACK_PANELS } from "./panels";
import { CA_PACK_HEADER_LABELS } from "./headerLabels";
import { CA_PACK_LEGEND_SLOTS } from "./legends";
import { CA_PACK_CLICK_SLOTS } from "./clicks";
import { CA_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "CA",
  records: {
    layerManifest: CA_PACK_MANIFEST,
    layerParamsSpec: CA_PACK_PARAMS,
    layerSourceInfo: CA_PACK_SOURCE_INFO,
    layerNotes: CA_PACK_NOTES,
    layerSpecNotes: CA_PACK_SPEC_NOTES,
    featurePanels: CA_PACK_PANELS,
    featureHeaderLabels: CA_PACK_HEADER_LABELS,
  },
  slots: {
    legends: CA_PACK_LEGEND_SLOTS,
    gisClickLayers: CA_PACK_CLICK_SLOTS,
    layerHosts: CA_PACK_HOST_SLOTS,
  },
};

export default pack;
