// ⚠️ 自動產生（move-country-pack.ts）：日本國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
import { JP_PACK_MANIFEST } from "./manifest";
import { JP_PACK_PARAMS } from "./params";
import { JP_PACK_SOURCE_INFO } from "./sourceInfo";
import { JP_PACK_NOTES } from "./notes";
import { JP_PACK_PANELS } from "./panels";
import { JP_PACK_HEADER_LABELS } from "./headerLabels";
import { JP_PACK_LEGEND_SLOTS } from "./legends";
import { JP_PACK_CLICK_SLOTS } from "./clicks";
import { JP_PACK_OVERLAY_SLOTS } from "./overlays";
import { JP_PACK_HOST_SLOTS } from "./hosts";

const pack: CountryPack = {
  country: "JP",
  records: {
    layerManifest: JP_PACK_MANIFEST,
    layerParamsSpec: JP_PACK_PARAMS,
    layerSourceInfo: JP_PACK_SOURCE_INFO,
    layerNotes: JP_PACK_NOTES,
    featurePanels: JP_PACK_PANELS,
    featureHeaderLabels: JP_PACK_HEADER_LABELS,
  },
  slots: {
    legends: JP_PACK_LEGEND_SLOTS,
    gisClickLayers: JP_PACK_CLICK_SLOTS,
    overlays: JP_PACK_OVERLAY_SLOTS,
    layerHosts: JP_PACK_HOST_SLOTS,
  },
};

export default pack;
