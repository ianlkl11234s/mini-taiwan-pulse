import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getLayerNotes, layerKeysForPopup, resolveSourceText } from "../../../data/layerSourceInfo";
import type { MessageKey } from "../../../i18n/keys";

const DIR = join(__dirname, "../../../i18n/locales/zh-TW");
const ZH: Record<string, string> = {};
for (const file of readdirSync(DIR)) if (file.endsWith(".json")) Object.assign(ZH, JSON.parse(readFileSync(join(DIR, file), "utf8")));

/** popup layerType 對應圖層在「說明・來源」顯示的固定說明（中文），供測試確認從 popup 搬過去的備註還在。 */
export function layerNotesZh(popupLayerType: string): string {
  const lookup = (key: MessageKey, vars?: Record<string, string | number>) => {
    const raw = ZH[key];
    if (raw == null) return null;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (vars && name in vars ? String(vars[name]) : m));
  };
  return layerKeysForPopup(popupLayerType)
    .flatMap((key) => getLayerNotes(key).map((note) => resolveSourceText(note, { active: "zh-TW", lookup })))
    .join("\n");
}
