/** 圖層名 key 該放哪個英日文檔（分檔腳本與 localeParity 共用，確保口徑一致）。 */
import { hasCountryPack } from "../../countries/packs";
import { layerIndexRow } from "../../data/layerIndex";
import { countryLayerFile } from "../localeFiles";

/** `layer.<key>` → `layers.<cc>`（有國家包的國家）或 `layers`（台灣、WORLD、SIM、沒有國家包的國家）。 */
export function layerFileForKey(messageKey: string): string {
  const country = layerIndexRow(messageKey.replace(/^layer\./, ""))?.country;
  return country && hasCountryPack(country) ? countryLayerFile(country) : "layers";
}
