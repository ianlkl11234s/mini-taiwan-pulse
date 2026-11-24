// 越南國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { VnLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const VN_PACK_NOTES = {
  vnAdminBoundaries: [{ "zh-TW": "社代碼取自 Cục Thống kê 行政單位目錄（授權未明示）；Hoàng Sa／Trường Sa 幾何已移除。", en: "Commune codes are from the Cục Thống kê administrative unit list (license not stated); Hoàng Sa / Trường Sa geometry removed.", ja: "社コードは Cục Thống kê の行政単位一覧（ライセンス明示なし）。Hoàng Sa／Trường Sa の形状は除去。" }],
  vnLandslideSusceptibility: [{ "zh-TW": "Open Development Vietnam 彙編（NGO），原始機關未載明；Land slide hazard map in Vietnam（ODM GeoServer WMS，2026-11-17 渲染）", en: "Compiled by Open Development Vietnam (NGO), original agency not stated; Land slide hazard map in Vietnam (ODM GeoServer WMS, rendered 2026-11-17)", ja: "Open Development Vietnam（NGO）の編纂。元の機関は未記載。Land slide hazard map in Vietnam（ODM GeoServer WMS、2026-11-17 描画）" }],
  vnProtectedAreasOdm: [{ "zh-TW": "上游 WDPA 2016（經 ADB）", en: "Upstream WDPA 2016 (via ADB)", ja: "上流は WDPA 2016（ADB 経由）" }],
  // <codemod:append VN_PACK_NOTES>
} satisfies Partial<Record<VnLayerKey, SourceText[]>>;
