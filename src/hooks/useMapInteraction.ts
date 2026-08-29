import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, PointLike, MapLayerMouseEvent } from "mapbox-gl";
import type { Flight, RailTrain, BusVehicle, FeatureInfo, LayerVisibility, RealEstateTooltipInfo } from "../types";
import { GIS_LAYERS } from "../map/gisClickRegistry";
import { isGfwHourlyGridDominantHitLayer } from "./useGfwHourlyGridLayer";
import { getRealEstatePointsScene } from "../map/realEstatePointsCustomLayer";
import type { FlightScene } from "../three/FlightScene";
import type { ShipScene } from "../three/ShipScene";
import type { RailScene } from "../three/RailScene";
import type { BusScene } from "../three/BusScene";
import type { ReservoirScene } from "../three/ReservoirScene";
import type { WasteScheduleScene, ScheduleDebugFrame } from "../three/WasteScheduleScene";
import type { WasteTruckScene } from "../three/WasteTruckScene";
import { compareIdFromReservoirId } from "../data/reservoirStatusLoader";
import { sampleClimateFields } from "../data/climateFieldSampler";
import { sampleRasterProbes } from "../data/rasterProbeSampler";
import { sessionTracker } from "../lib/sessionTracker";
import { canonicalGfwGridCellId, hydrateGfwGridDetail, hydrateGfwTrackDetail, needsGfwGridDetailHydration } from "../data/gfwHourlyDetailLoader";
import { beginGfwV4TrackPick } from "../data/gfwV4TrackPicking";

interface TooltipInfo {
  flight: Flight;
  x: number;
  y: number;
  altitude: number | null;
}

interface TrainTooltipInfo {
  train: RailTrain;
  x: number;
  y: number;
}

interface BusTooltipInfo {
  bus: BusVehicle;
  x: number;
  y: number;
}

export interface WasteScheduleTooltipInfo {
  frame: ScheduleDebugFrame;
  x: number;
  y: number;
}

export function useMapInteraction(
  mapRef: React.RefObject<MapboxMap | null>,
  flightSceneRef: React.RefObject<FlightScene | null>,
  flightsRef: React.RefObject<Flight[]>,
  timeRef: React.RefObject<number>,
  railSceneRef?: React.RefObject<RailScene | null>,
  busSceneRef?: React.RefObject<BusScene | null>,
  shipSceneRef?: React.RefObject<ShipScene | null>,
  layerVisibilityRef?: React.RefObject<LayerVisibility>,
  reservoirSceneRef?: React.RefObject<ReservoirScene | null>,
  wasteScheduleSceneRef?: React.RefObject<WasteScheduleScene | null>,
  touristShuttleSceneRef?: React.RefObject<BusScene | null>,
  busIntercitySceneRef?: React.RefObject<BusScene | null>,
  wasteTruckSceneRef?: React.RefObject<WasteTruckScene | null>,
) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [trainTooltipInfo, setTrainTooltipInfo] = useState<TrainTooltipInfo | null>(null);
  const [busTooltipInfo, setBusTooltipInfo] = useState<BusTooltipInfo | null>(null);
  const [wasteScheduleTooltipInfo, setWasteScheduleTooltipInfo] = useState<WasteScheduleTooltipInfo | null>(null);
  const [realEstateTooltipInfo, setRealEstateTooltipInfo] = useState<RealEstateTooltipInfo | null>(null);
  const [featureInfo, setFeatureInfo] = useState<FeatureInfo | null>(null);
  const clickBoundRef = useRef(false);
  const featureRequestRef = useRef(0);

  const bindEvents = (map: MapboxMap) => {
    if (clickBoundRef.current) return;
    clickBoundRef.current = true;

    map.on("click", (e) => {
      const featureRequest = ++featureRequestRef.current;
      const container = map.getContainer();
      const w = container.clientWidth;
      const h = container.clientHeight;

      const vis = layerVisibilityRef?.current;

      // 先嘗試拾取列車（僅在 rail 圖層開啟時）
      if (vis?.rail) {
        const railScene = railSceneRef?.current;
        if (railScene) {
          const train = railScene.pickTrain(e.point.x, e.point.y, w, h);
          if (train) {
            setTrainTooltipInfo({ train, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取垃圾車表定（debug 點選看哪條路線 / 班次）
      if (vis?.wasteSchedule) {
        const ws = wasteScheduleSceneRef?.current;
        if (ws) {
          const frame = ws.pickRoute(e.point.x, e.point.y, w, h);
          if (frame) {
            setWasteScheduleTooltipInfo({ frame, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取垃圾車實跡（W2）——「表定模擬車可點、GPS 真車不可點」的族群不一致收尾。
      // `WasteTruckScene.pickTruck` 早就寫好了（逐行同 pickRoute），從來沒有人呼叫它；
      // audit 只 grep 了 wasteTruckCustomLayer.ts 才判定「無 pick」。
      // 走 setFeatureInfo 而非 tooltip：欄位是車號／縣市／路線這種查詢型資訊，
      // 且 repo 內同為「會移動的 Three.js 物件開 FeatureInfoPanel」的前例就是上方的
      // `ship` 分支。座標用點擊位置（pickTruck 只回 row，不回插值後的經緯）。
      if (vis?.wasteTruck) {
        const truckScene = wasteTruckSceneRef?.current;
        if (truckScene) {
          const row = truckScene.pickTruck(e.point.x, e.point.y, w, h);
          if (row) {
            setFeatureInfo({
              layerType: "wasteTruck",
              properties: {
                vehicle_no: row.vehicle_no,
                city: row.city,
                route_id: row.route_id,
              },
              coords: [e.lngLat.lng, e.lngLat.lat],
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            setWasteScheduleTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取公車（僅在 busLive 圖層開啟時）
      if (vis?.busLive) {
        const busScene = busSceneRef?.current;
        if (busScene) {
          const bus = busScene.pickBus(e.point.x, e.point.y, w, h);
          if (bus) {
            setBusTooltipInfo({ bus, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取公路客運（僅在 busIntercityLive 圖層開啟時，共用 bus tooltip）
      // W2：三個 BusScene 族群（市區 / 客運 / 台灣好行）本來只有兩個接了 pick，
      // 客運是全站唯一「會動但完全點不到」的運具 —— 逐行比照上下兩個分支補齊。
      if (vis?.busIntercityLive) {
        const intercityScene = busIntercitySceneRef?.current;
        if (intercityScene) {
          const bus = intercityScene.pickBus(e.point.x, e.point.y, w, h);
          if (bus) {
            setBusTooltipInfo({ bus, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取台灣好行（僅在 touristShuttleLive 圖層開啟時，共用 bus tooltip）
      if (vis?.touristShuttleLive) {
        const shuttleScene = touristShuttleSceneRef?.current;
        if (shuttleScene) {
          const bus = shuttleScene.pickBus(e.point.x, e.point.y, w, h);
          if (bus) {
            setBusTooltipInfo({ bus, x: e.point.x, y: e.point.y });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            return;
          }
        }
      }


      // 嘗試拾取船舶（以目前船頭圓點為準）
      if (vis?.ships) {
        const shipScene = shipSceneRef?.current;
        if (shipScene) {
          const hit = shipScene.pickShip(e.point.x, e.point.y, w, h);
          if (hit) {
            setFeatureInfo({
              layerType: "ship",
              properties: {
                mmsi: hit.ship.mmsi,
                vessel_type: hit.ship.vessel_type,
                lat: hit.lat,
                lon: hit.lng,
                timestamp: hit.timestamp,
              },
              coords: [hit.lng, hit.lat],
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            setWasteScheduleTooltipInfo(null);
            return;
          }
        }
      }

      // 再嘗試拾取飛機（僅在 flights 圖層開啟時）
      if (vis?.flights) {
        const scene = flightSceneRef.current;
        if (scene) {
          const flightId = scene.pickFlight(e.point.x, e.point.y, w, h);
          if (flightId) {
            const flight = flightsRef.current.find((f) => f.fr24_id === flightId);
            if (flight) {
              let altitude: number | null = null;
              const t = timeRef.current;
              for (let i = flight.path.length - 1; i >= 0; i--) {
                if (flight.path[i]![3] <= t) { altitude = Math.round(flight.path[i]![2]); break; }
              }
              setTooltipInfo({ flight, x: e.point.x, y: e.point.y, altitude });
              setTrainTooltipInfo(null);
              return;
            }
          }
        }
      }

      // 嘗試拾取水庫 3D 水位計（僅在 waterReservoirs 圖層開啟時）
      if (vis?.waterReservoirs) {
        const reservoirScene = reservoirSceneRef?.current;
        if (reservoirScene) {
          const hit = reservoirScene.pickReservoir(e.point.x, e.point.y, w, h);
          if (hit) {
            const compareId = compareIdFromReservoirId(hit.reservoir_id);
            setFeatureInfo({
              layerType: "waterDam",
              properties: {
                kind: "reservoir",
                name: hit.name,
                compare_id: compareId,
                capacity_m3: (hit.effective_capacity_wan ?? 0) * 10000,
                is_reservoir: true,
              },
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            return;
          }
        }
      }

      // 嘗試拾取房地產交易點（三型別共用同一個 WebGL CustomLayer 與同一份 buffer）
      // W2：`App.tsx` 的 kind==="point" tooltip 分支一直都在，但 picking 在改成
      // CustomLayer 時被拿掉（舊註解「待補 GPU/空間索引 picking」）→ 死 UI。
      // 這裡用 CPU 端逐點投影補回（見 RealEstatePointsScene.pickPoint）。
      // ⚠️ 只帶 buffer 內真實存在的欄位；地址／行政區／總價／坪數不在二進位格式裡。
      if (vis?.realEstateRentalPoint || vis?.realEstateSalePoint || vis?.realEstatePresalePoint) {
        const reScene = getRealEstatePointsScene();
        if (reScene) {
          const hit = reScene.pickPoint(e.point.x, e.point.y, w, h);
          if (hit) {
            setRealEstateTooltipInfo({
              x: e.point.x,
              y: e.point.y,
              kind: "point",
              properties: {
                type: hit.type,
                price_per_sqm: hit.pricePerSqm,
                trade_ts: hit.tradeTs,
              },
            });
            setTooltipInfo(null);
            setTrainTooltipInfo(null);
            setBusTooltipInfo(null);
            setWasteScheduleTooltipInfo(null);
            return;
          }
        }
      }

      // Formal GFW v4 是 WebGL CustomLayer，不能走 queryRenderedFeatures。
      // 以目前 applied typed frame 做 5px nearest，再向 Worker 只取該點 popup metadata。
      const gfwV4Pick = vis?.gfwHourlyTracks ? beginGfwV4TrackPick(map, e.point, 5) : null;
      if (gfwV4Pick) {
        setTooltipInfo(null);
        setTrainTooltipInfo(null);
        setBusTooltipInfo(null);
        setWasteScheduleTooltipInfo(null);
        setRealEstateTooltipInfo(null);
        setFeatureInfo(null);
        void gfwV4Pick.result.then((picked) => {
          if (featureRequest !== featureRequestRef.current || !picked?.isCurrent()) return;
          const properties = picked.feature.properties ?? {};
          const coords = picked.feature.geometry.coordinates as [number, number];
          const needsDetail = typeof properties.track_id === "string" && typeof properties.vessels_json !== "string";
          setFeatureInfo({ layerType: "gfwHourlyTrack", properties: needsDetail ? { ...properties, detail_status: "loading" } : properties, coords });
          if (needsDetail) {
            void hydrateGfwTrackDetail(properties).then((hydrated) => {
              if (featureRequest !== featureRequestRef.current) return;
              setFeatureInfo({ layerType: "gfwHourlyTrack", properties: hydrated, coords });
            }).catch(() => {
              if (featureRequest !== featureRequestRef.current) return;
              setFeatureInfo({ layerType: "gfwHourlyTrack", properties: { ...properties, detail_status: "error", detail_error: "完整詳情載入失敗" }, coords });
            });
          }
          sessionTracker.log("feature_click", { layerType: "gfwHourlyTrack" });
        });
        return;
      }

      // 未命中 Three.js 物件 → 清空 tooltip，查詢 GIS 圖層
      setTooltipInfo(null);
      setTrainTooltipInfo(null);
      setBusTooltipInfo(null);
      setWasteScheduleTooltipInfo(null);
      setRealEstateTooltipInfo(null);

      {
        // 查詢 Mapbox GIS 層（接線表 = GIS_LAYERS，見 map/gisClickRegistry.ts。
        // 順序 load-bearing：下方迴圈 first-hit-wins）
        const bbox: [PointLike, PointLike] = [
          [e.point.x - 5, e.point.y - 5],
          [e.point.x + 5, e.point.y + 5],
        ];
        let found = false;
        for (const { layers: layerIds, type } of GIS_LAYERS) {
          const existingIds = layerIds.filter((id) => map.getLayer(id));
          if (existingIds.length === 0) continue;
          const queried = map.queryRenderedFeatures(bbox, { layers: existingIds });
          // GFW v4 網格：三個小時 slot 的 hit layer 都恆為 visible（翻 visibility 會 reload
          // 共用 source），所以「哪個小時能回答點擊」改在查詢後決定。必須在取 [0] 之前過濾：
          // v4 tile 沒有 observed_at，popup 一律以 dominant hour 去 hydrate，放非 dominant 的
          // feature 進來會 vessel_count 對不上而變成「驗證失敗」面板。dominant 為 null
          // （資料窗外已完全淡出）時視為沒命中，讓點擊落到下一個 GIS_LAYERS 條目。
          const features = type === "gfwHourlyGrid"
            ? queried.filter((feature) => isGfwHourlyGridDominantHitLayer(feature.layer?.id))
            : queried;
          if (features.length > 0) {
            const f = features[0]!;
            let coords: [number, number] | undefined;
            const g = f.geometry as GeoJSON.Geometry | undefined;
            if (g && g.type === "Point") {
              const c = (g as GeoJSON.Point).coordinates;
              if (typeof c[0] === "number" && typeof c[1] === "number") {
                coords = [c[0], c[1]];
              }
            }
            if (!coords) coords = [e.lngLat.lng, e.lngLat.lat];
            // roadCongestion 的 level / temperatureGrid 的 temp / earthquakeReplayTown 的 eqi
            // / funeralOperatorDensity 的 operatorCount 在 feature-state（非 baked properties）→ 併入
            const queriedProperties =
              type === "roadCongestion" ||
              type === "temperatureGrid" ||
              type === "earthquakeReplayTown" ||
              type === "funeralOperatorDensity" ||
              type === "animalShelterPressure"
                ? { ...(f.properties ?? {}), ...(f.state ?? {}) }
                : (f.properties ?? {});
            const cellId = type === "gfwHourlyGrid" ? canonicalGfwGridCellId(queriedProperties, f.id) : null;
            // PMTiles may expose the immutable key as `grid_id` or feature.id.  Normalise it
            // before both popup rendering and detail-bucket SHA selection.
            const properties = cellId ? { ...queriedProperties, cell_id: cellId } : queriedProperties;
            const needsGridDetail = type === "gfwHourlyGrid" && cellId !== null && needsGfwGridDetailHydration(properties);
            const needsTrackDetail = type === "gfwHourlyTrack" && typeof properties.track_id === "string" && typeof properties.vessels_json !== "string";
            const initialProperties = needsGridDetail || needsTrackDetail
              ? { ...properties, detail_status: "loading" }
              : properties;
            setFeatureInfo({ layerType: type, properties: initialProperties, coords });
            if (needsGridDetail || needsTrackDetail) {
              const hydrate = needsGridDetail ? hydrateGfwGridDetail : hydrateGfwTrackDetail;
              void hydrate(properties).then((hydrated) => {
                if (featureRequest !== featureRequestRef.current) return;
                setFeatureInfo({ layerType: type, properties: hydrated, coords });
              }).catch(() => {
                if (featureRequest !== featureRequestRef.current) return;
                setFeatureInfo({ layerType: type, properties: { ...properties, detail_status: "error", detail_error: "完整詳情載入失敗" }, coords });
              });
            }
            sessionTracker.log("feature_click", { layerType: type });
            found = true;
            break;
          }
        }
        // 沒命中任何向量 feature → 值編碼 raster 開啟時改讀像素物理值（W2）。
        // 排在氣候 UV 場之前：熱島／樹冠是台灣本島的層，風場／海流是全球場，
        // 同時開啟時使用者點台灣要的是前者（後者在台灣任一點都讀得到值，會整碗端走）。
        if (!found && (vis?.urbanHeat || vis?.canopyHeight)) {
          found = true; // 已接手本次點擊，下方 climateField 分支不再處理
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          void sampleRasterProbes(
            { urbanHeat: !!vis?.urbanHeat, canopyHeight: !!vis?.canopyHeight },
            lng, lat,
          ).then((probe) => {
            if (probe) {
              setFeatureInfo({
                layerType: "rasterProbe",
                properties: { urbanHeat: probe.urbanHeat, canopyHeight: probe.canopyHeight },
                coords: [lng, lat],
              });
              sessionTracker.log("feature_click", { layerType: "rasterProbe" });
            } else {
              setFeatureInfo(null);
            }
          });
        }
        // 沒命中任何向量 feature → 風場/海流開啟時改讀氣候 UV 場（nullschool 式點擊讀值）
        if (!found) {
          if (vis?.windField || vis?.oceanCurrents) {
            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;
            void sampleClimateFields(
              { wind: !!vis?.windField, currents: !!vis?.oceanCurrents },
              lng, lat,
            ).then((sample) => {
              if (sample) {
                setFeatureInfo({
                  layerType: "climateField",
                  properties: { wind: sample.wind, currents: sample.currents },
                  coords: [lng, lat],
                });
                sessionTracker.log("feature_click", { layerType: "climateField" });
              } else {
                setFeatureInfo(null);
              }
            });
          } else {
            setFeatureInfo(null);
          }
        }
      }
    });

    map.on("dblclick", (e) => {
      if (!layerVisibilityRef?.current?.flights) return;
      const scene = flightSceneRef.current;
      if (!scene) return;
      const container = map.getContainer();
      const flightId = scene.pickFlight(
        e.point.x, e.point.y,
        container.clientWidth, container.clientHeight,
      );
      if (flightId) {
        e.preventDefault();
        // 再次雙擊同一架 → 取消跟隨
        setSelectedFlightId((prev) => (prev === flightId ? null : flightId));
        setTooltipInfo(null);
        setTrainTooltipInfo(null);
        setBusTooltipInfo(null);
      }
    });

    // 使用者主動拖曳 / 滾輪縮放 / 旋轉 → 解除跟隨
    map.on("dragstart", () => setSelectedFlightId(null));
    map.on("wheel", () => setSelectedFlightId(null));
    map.on("rotatestart", () => setSelectedFlightId(null));
    map.on("pitchstart", () => setSelectedFlightId(null));
    map.on("move", () => { setTooltipInfo(null); setTrainTooltipInfo(null); setBusTooltipInfo(null); setRealEstateTooltipInfo(null); });

    // 房地產 hover tooltip（滑鼠移上即顯示，非 click）。layer 尚未建立先綁無害（mapbox 容忍）。
    const reMove = (kind: "grid" | "point") => (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      setRealEstateTooltipInfo({ x: e.point.x, y: e.point.y, kind, properties: f.properties ?? {} });
    };
    const reLeave = () => {
      map.getCanvas().style.cursor = "";
      setRealEstateTooltipInfo(null);
    };
    for (const id of ["re-grid-rental-fill", "re-grid-sale-fill", "re-grid-presale-fill"]) {
      map.on("mousemove", id, reMove("grid"));
      map.on("mouseleave", id, reLeave);
    }
    // 點 hover 暫時移除：point 已改 WebGL CustomLayer，不支援 queryRenderedFeatures（待補 GPU/空間索引 picking）
  };

  // ESC 鍵取消跟隨
  useEffect(() => {
    if (!selectedFlightId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedFlightId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedFlightId]);

  // 雙擊追蹤：相機鎖定飛機
  useEffect(() => {
    if (!selectedFlightId) return;
    const map = mapRef.current;
    if (!map) return;

    let animId: number;
    const tick = () => {
      const flight = flightsRef.current.find((f) => f.fr24_id === selectedFlightId);
      if (flight && flight.path.length > 0) {
        const t = timeRef.current;
        const path = flight.path;
        let lat: number, lng: number;
        if (t <= path[0]![3]) {
          lat = path[0]![0]; lng = path[0]![1];
        } else if (t >= path[path.length - 1]![3]) {
          lat = path[path.length - 1]![0]; lng = path[path.length - 1]![1];
        } else {
          lat = path[0]![0]; lng = path[0]![1];
          for (let i = 1; i < path.length; i++) {
            if (path[i]![3] >= t) {
              const a = path[i - 1]!;
              const b = path[i]!;
              const r = (t - a[3]) / (b[3] - a[3]);
              lat = a[0] + (b[0] - a[0]) * r;
              lng = a[1] + (b[1] - a[1]) * r;
              break;
            }
          }
        }
        map.setCenter([lng, lat]);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [selectedFlightId, mapRef, flightsRef, timeRef]);

  return {
    tooltipInfo, setTooltipInfo,
    trainTooltipInfo, setTrainTooltipInfo,
    busTooltipInfo, setBusTooltipInfo,
    wasteScheduleTooltipInfo, setWasteScheduleTooltipInfo,
    realEstateTooltipInfo, setRealEstateTooltipInfo,
    featureInfo, setFeatureInfo,
    selectedFlightId, setSelectedFlightId,
    bindEvents,
  };
}
