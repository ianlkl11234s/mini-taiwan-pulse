/**
 * node 端：讀本機 public/ 資產，組出某日七個網格族的 set（同瀏覽器 loadSoundFamily 的 origin＝grid 路徑）＋飛機每日包。
 * W6-4/5 綜合網格測試、Worker 計算核心測試與量測腳本共用；資產不在 → 該族 null（呼叫端自行略過）。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadAviationGridSource, loadNaturalGridSource, loadRainGridSource } from "../../../src/sound/grid/gridSources";
import { decodeRadarRainPack } from "../../../src/sound/grid/radarRainPack";
import { decodePotentialPack, type PotentialPack } from "../../../src/sound/grid/potentialPack";
import { compileRoadNetwork } from "../../../src/sound/grid/roadNetwork";
import { withRadarRain } from "../../../src/sound/soundAtlasData";
import { loadRail } from "../../../src/sound/sourceAdapters/railAdapter";
import { loadRoadTraffic } from "../../../src/sound/sourceAdapters/roadTrafficAdapter";
import type { SoundSourceSet } from "../../../src/sound/types";
import type { CompositeFamily } from "../../../src/sound/grid/compositeGrid";
import { localRailFetchers } from "./railLocalFetchers";

const GRID_DIR = "public/sound-atlas/grid";
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

export const localFetch = (async (url: string) => {
  const p = path.join("public", decodeURIComponent(String(url)));
  if (!existsSync(p)) return new Response("not found", { status: 404 });
  return new Response(readFileSync(p));
}) as typeof fetch;

export const hasRealGridAssets = (date: string): boolean =>
  ["aviation-src", "rain-gauge", "natural"].every((s) => existsSync(`${GRID_DIR}/${s}-${date}.json`))
  && existsSync(`${GRID_DIR}/aviation-${date}.class.bin`) && existsSync(`${GRID_DIR}/radar-rain-${date}.class.bin`)
  && existsSync(`${GRID_DIR}/road-network-v1.json`) && existsSync("public/sound-atlas/vd-baseline-taipei.json")
  && existsSync("public/rail/trtc/station_progress.json") && existsSync(`${GRID_DIR}/canopy-cells-v1.bin`);

export interface RealGridSets {
  sets: Record<CompositeFamily, SoundSourceSet | null>;
  aviationPack: PotentialPack | null;
}

export async function loadRealGridSets(date: string): Promise<RealGridSets> {
  const gauge = await loadRainGridSource(date, localFetch);
  const radarMeta = `${GRID_DIR}/radar-rain-${date}.meta.json`;
  const radar = existsSync(radarMeta)
    ? await decodeRadarRainPack(readJson(radarMeta), new Uint8Array(readFileSync(`${GRID_DIR}/radar-rain-${date}.class.bin`)), date)
    : null;
  const rain = gauge ? await withRadarRain(gauge, date, async () => radar) : null;
  const vdPath = `${GRID_DIR}/freeway-vd-${date}.json`;
  const road = existsSync(`${GRID_DIR}/road-network-v1.json`)
    ? (await loadRoadTraffic({ date }, {
      network: async () => compileRoadNetwork(readJson(`${GRID_DIR}/road-network-v1.json`)),
      pack: async () => (existsSync(vdPath) ? readJson(vdPath) : null),
      baseline: async () => readJson("public/sound-atlas/vd-baseline-taipei.json"),
    })) as SoundSourceSet
    : null;
  const rail = existsSync("public/rail/trtc/station_progress.json")
    ? (await loadRail({ date }, localRailFetchers(path.resolve("public/rail")))) as SoundSourceSet
    : null;
  const aviation = await loadAviationGridSource(date, Date.now() / 1000, localFetch);
  const packMeta = `${GRID_DIR}/aviation-${date}.meta.json`;
  const aviationPack = existsSync(packMeta)
    ? await decodePotentialPack(readJson(packMeta), new Uint8Array(readFileSync(`${GRID_DIR}/aviation-${date}.class.bin`)), "aviation", date)
    : null;
  return {
    sets: {
      rain,
      road_traffic: road,
      aviation,
      rail,
      wind_vegetation: await loadNaturalGridSource("wind_vegetation", date, localFetch),
      coastal_wave: await loadNaturalGridSource("coastal_wave", date, localFetch),
      river_water: await loadNaturalGridSource("river_water", date, localFetch),
    },
    aviationPack,
  };
}
