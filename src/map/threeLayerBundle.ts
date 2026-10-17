/**
 * 主站 Three.js custom layer 的 dynamic-import 入口（C1 首屏瘦身）。
 *
 * useThreeJsLayers 只經由 `import("../map/threeLayerBundle")` 取用這些 factory，
 * three.js 與各 Scene 因此切成獨立 chunk：第一次有 3D 圖層可見（或開任一圖層後的背景預載）才下載。
 * 所有呼叫端請共用 useThreeJsLayers 的 loadThreeLayerBundle()，不要另寫 import specifier。
 */
export { createFlightLayer, createShipLayer, createRailLayer } from "./customLayer";
export { createBusLayer } from "./busCustomLayer";
export { createWasteTruckLayer } from "./wasteTruckCustomLayer";
export { createWasteScheduleLayer } from "./wasteScheduleCustomLayer";
export { createWasteFacilityLayer } from "./wasteFacilityCustomLayer";
export { createLighthouseLayer } from "./lighthouseCustomLayer";
export { createCombinedStationPillarLayer } from "./stationPillarCustomLayer";
export { createTemperatureWaveLayer } from "./temperatureWaveCustomLayer";
export { createFireStationLayer } from "./fireStationCustomLayer";
