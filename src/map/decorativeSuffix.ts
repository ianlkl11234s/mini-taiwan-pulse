/**
 * 裝飾子圖層 suffix 關鍵字（圖例合成 LG-14、對比契約 contrastContractExtract、暗底對比 darkContrast 共用）。
 * 獨立成零相依模組：overlayRegistry 匯出前就要用（darkContrast），不能經過會 import registry 的 legendLayerOpacity。
 */
export const DECORATIVE_SUFFIX_WORDS = ["glow", "halo", "ripple", "pulse", "hit", "range", "hover", "selected", "highlight", "label", "text", "outline", "stroke", "casing", "seam", "hatch", "missing"] as const;
export const isDecorativeSuffix = (suffix: string | undefined) => DECORATIVE_SUFFIX_WORDS.some((word) => (suffix ?? "").toLowerCase().includes(word));
