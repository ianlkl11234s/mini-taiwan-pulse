/**
 * 垃圾處理設施 Custom Layer — 一個 layer 包 5 個 sub-scene。
 *
 * 5 個 sub-scene 對應 5 個 sub-toggle：
 *   - WasteIncineratorScene (wfIncinerator)
 *   - WasteLandfillScene    (wfLandfill)
 *   - WasteTransferScene    (wfTransfer)
 *   - WasteMedicalScene     (wfMedical)
 *   - WasteMonitoringWellScene (wfMonitoring)
 *
 * 每個 sub-scene 由 LayerSidebar 控制 visibility / size / opacity / altitude。
 * pick 統一走 customLayer 的 click handler，輪詢 5 個 scene 取最近命中。
 */

import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { WasteFacilityRow } from "../data/wasteLoader";
import type { FeatureInfo } from "../types";
import {
  WasteIncineratorScene,
  WasteLandfillScene,
  WasteTransferScene,
  WasteMedicalScene,
  WasteMonitoringWellScene,
} from "../three/WasteFacilityScenes";

export type WasteFacility3DKey = "wfIncinerator" | "wfLandfill" | "wfTransfer" | "wfMedical" | "wfMonitoring";

/** facility_type → which scene */
const TYPE_TO_KEY: Record<string, WasteFacility3DKey> = {
  incinerator: "wfIncinerator",
  landfill: "wfLandfill",
  transfer_station: "wfTransfer",
  medical_waste: "wfMedical",
  monitoring_well: "wfMonitoring",
};

export interface WasteFacility3DScenes {
  wfIncinerator: WasteIncineratorScene;
  wfLandfill: WasteLandfillScene;
  wfTransfer: WasteTransferScene;
  wfMedical: WasteMedicalScene;
  wfMonitoring: WasteMonitoringWellScene;
}

export interface WasteFacilityLayerParams {
  size: number;       // 0.5 ~ 3
  opacity: number;    // 0.2 ~ 1
  altitude: number;   // 0 ~ 500 (m)
  /** 焚化爐專屬：底圈大小（拉遠也可見的地面標示） */
  ringSize?: number;
}

export interface WasteFacilityLayerOptions {
  id?: string;
  /** 抓最新 facility 資料（依 facility_type 分群） */
  getFacilityByType: () => Map<string, WasteFacilityRow[]>;
  getVisibility: () => Record<WasteFacility3DKey, boolean>;
  getParams: () => Record<WasteFacility3DKey, WasteFacilityLayerParams>;
  onSceneReady?: (scenes: WasteFacility3DScenes) => void;
}

const ALL_KEYS: WasteFacility3DKey[] = [
  "wfIncinerator", "wfLandfill", "wfTransfer", "wfMedical", "wfMonitoring",
];

export function createWasteFacilityLayer(opts: WasteFacilityLayerOptions): CustomLayerInterface & {
  pickFacility: (sx: number, sy: number, vw: number, vh: number) => { key: WasteFacility3DKey; row: WasteFacilityRow } | null;
  scenes: WasteFacility3DScenes;
} {
  const scenes: WasteFacility3DScenes = {
    wfIncinerator: new WasteIncineratorScene(),
    wfLandfill: new WasteLandfillScene(),
    wfTransfer: new WasteTransferScene(),
    wfMedical: new WasteMedicalScene(),
    wfMonitoring: new WasteMonitoringWellScene(800),
  };
  let map: MapboxMap | null = null;
  let lastDataKey = "";
  let lastParamsKey = "";

  return {
    id: opts.id ?? "waste-facility-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,
    scenes,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      for (const k of ALL_KEYS) scenes[k].init(gl);
      opts.onSceneReady?.(scenes);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      const byType = opts.getFacilityByType();
      const vis = opts.getVisibility();
      const params = opts.getParams();

      // 偵測 data 變更：rows 總和當作 fingerprint
      const dataKey = `${byType.get("incinerator")?.length ?? 0}|${byType.get("landfill")?.length ?? 0}|${byType.get("transfer_station")?.length ?? 0}|${byType.get("medical_waste")?.length ?? 0}|${byType.get("monitoring_well")?.length ?? 0}`;
      if (dataKey !== lastDataKey) {
        lastDataKey = dataKey;
        for (const [type, key] of Object.entries(TYPE_TO_KEY)) {
          const rows = byType.get(type) ?? [];
          scenes[key].setRows(rows);
        }
      }

      // 偵測 params 變更
      const paramsKey = ALL_KEYS.map((k) => {
        const p = params[k];
        const ring = k === "wfIncinerator" ? `:${p?.ringSize ?? 1}` : "";
        return `${vis[k] ? 1 : 0}:${p?.size ?? 1}:${p?.opacity ?? 1}:${p?.altitude ?? 0}${ring}`;
      }).join("|");
      if (paramsKey !== lastParamsKey) {
        lastParamsKey = paramsKey;
        for (const k of ALL_KEYS) {
          const p = params[k];
          scenes[k].setVisible(vis[k]);
          if (p) {
            scenes[k].setSize(p.size);
            scenes[k].setOpacity(p.opacity);
            scenes[k].setAltitude(p.altitude);
            if (k === "wfIncinerator" && p.ringSize !== undefined) {
              scenes.wfIncinerator.setGroundRingScale(p.ringSize);
            }
          }
        }
      }

      // 任一 sub-scene visible 才需要重繪
      let anyVisible = false;
      for (const k of ALL_KEYS) {
        if (vis[k]) {
          anyVisible = true;
          scenes[k].render(matrix);
        }
      }
      if (anyVisible) map?.triggerRepaint();
    },

    pickFacility(sx, sy, vw, vh) {
      let best: { key: WasteFacility3DKey; row: WasteFacilityRow; dist: number } | null = null;
      for (const k of ALL_KEYS) {
        const row = scenes[k].pick(sx, sy, vw, vh);
        if (row) {
          // 用 threshold 內最近的（pick 內部已過濾）
          if (!best) best = { key: k, row, dist: 0 };
        }
      }
      return best ? { key: best.key, row: best.row } : null;
    },

    onRemove() {
      for (const k of ALL_KEYS) scenes[k].dispose();
    },
  };
}

/** 給外部 click handler 用：把 facility_type 對應的 sub-key 回查 */
export function facilityTypeToSubKey(type: string): WasteFacility3DKey | null {
  return TYPE_TO_KEY[type] ?? null;
}

/** 把 picked row 轉成 FeatureInfo (popup 用) */
export function facilityRowToFeatureInfo(row: WasteFacilityRow): FeatureInfo {
  return {
    layerType: "wasteFacility",
    properties: {
      kind: "facility",
      id: row.id,
      facility_name: row.facility_name,
      facility_type: row.facility_type,
      city: row.city,
      operator: row.operator,
      address: row.address,
      capacity_tpd: row.capacity_tpd,
      status: row.status,
      start_year: row.start_year,
      source_url: row.source_url,
    },
  };
}
