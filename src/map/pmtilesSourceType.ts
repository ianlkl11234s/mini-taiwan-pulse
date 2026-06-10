// PMTiles SourceType 共用註冊。
//
// 原本 agriculture / fire / medical 三個 factory 各養一份 registerSourceTypeOnce
// + module flag，且 fire/medical 依賴「MapView 先 ensure agriculture」的呼叫順序
// 才不會重複註冊。統一收斂到這裡：誰先呼叫誰註冊，其餘 no-op。
import mapboxgl from "mapbox-gl";
// mapbox-pmtiles 的 package.json "main" 直接指 src/*.ts，會牽動 TS 編譯
// 套件原始檔；改 import dist/ 的 ESM build 並局部宣告型別繞過。
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";
import { PMTILES_SOURCE_TYPE } from "./pmtilesConstants";

let registered = false;

export function registerPmtilesSourceTypeOnce(): void {
  if (registered) return;
  registered = true;
  const actualType = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;
  if (actualType !== PMTILES_SOURCE_TYPE) {
    // 套件升版改了常數 → 立刻在 console 暴露，避免 silent 失效
    console.error(
      `[pmtiles] SOURCE_TYPE 不一致：mapbox-pmtiles="${actualType}" vs constants="${PMTILES_SOURCE_TYPE}"`,
    );
  }
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (type: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(actualType, PmTilesSource);
  } catch {
    // 已註冊過（mapbox 重複註冊會 throw），忽略
  }
}
