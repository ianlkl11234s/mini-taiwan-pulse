/**
 * R6 段 3（2026-10-06）：小量移動物件（台鐵／高鐵列車、垃圾車 GPS）加「立體效果」toggle（預設開），
 * 關閉時改畫 Mapbox 平面點、拉近換方向箭頭；插值抽成不依賴 three 的純函式，立體與平面共用。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getParamsSpec, paramControlCategory, type LayerParamSpec } from "../layerParamsSpec";
import { anyThreeLayerVisible, railThreeVisible, type ThreeStereoToggles } from "../../hooks/useThreeJsLayers";
import { bearingDeg, directedBearing, interpolateOnLineString, interpolateWithBearingOnLineString } from "../../engines/railUtils";
import {
  VIEW_LAG_SECONDS, computeWasteTruckFrames, interpolateWasteMatchedTrail, interpolateWasteTrail,
  wasteTruckBearing, wasteTruckFrameAt, wasteTruckRecentPath, wasteVisualTimeSec,
} from "../wasteTruckFrames";
import type { WasteTrailPoint, WasteTrailRow } from "../wasteLoader";
import {
  FLAT_ARROW_MIN_ZOOM, FLAT_MOVING_IDS, buildArrowSdf, flatMovingArrowLayout, flatMovingArrowPaint,
  flatMovingCirclePaint, flatMovingPickLayers,
} from "../../map/flatMovingLayers";
import {
  FLAT_MOVING_THROTTLE_MS, RecentTrackHistory, railFlatFeatures, resolveFlatMovingActive, wasteFlatFeatures,
} from "../../map/flatMovingController";
import { LAYER_MANIFEST } from "../layerManifest";
import { describeLayerControls } from "../../research/layerControls";
import { effectiveRailTrackMode } from "../../map/railTracks";
import { layerParamsStore } from "../../state/layerParamsStore";
import { visibleControlSpecs } from "../../state/layerParamsControls";
import type { LayerVisibility, RailTrain } from "../../types";

const findSpec = (key: string, name: string): LayerParamSpec | undefined =>
  getParamsSpec(key)?.find((s) => s.name === name);

/** 完整的 LayerVisibility：只有指定 key 為 true，其餘一律 false */
const visOf = (on: Partial<Record<keyof LayerVisibility, boolean>>) =>
  new Proxy(on, { get: (t, k) => (t as Record<string | symbol, boolean>)[k] ?? false }) as unknown as LayerVisibility;

// ── 1. toggle 規格 ─────────────────────────────────────────

describe("R6 段 3：立體效果 toggle（預設開）", () => {
  it.each([["rail", "railTrain3D"], ["wasteTruck", "wasteTruck3D"]])("%s.%s：label 立體效果、default true、out null、歸顏色組", (key, name) => {
    const spec = findSpec(key, name);
    expect(spec).toMatchObject({ kind: "toggle", label: "立體效果", default: true, out: null });
    expect(paramControlCategory(spec!)).toBe("color");
    expect((getParamsSpec(key) ?? []).filter((s) => s.kind === "toggle" && s.label === "立體效果")).toHaveLength(1);
  });

  it("列車立體效果只在「列車」顯示時出現；軌道 select 預設 3D、3D 選項依列車立體效果停用", () => {
    expect(findSpec("rail", "railTrain3D")?.showWhen).toEqual({ param: "railTrainVisible", equals: true });
    expect(findSpec("rail", "railTrackMode")).toMatchObject({
      kind: "select", default: "3d",
      disableRule: { option: "3d", param: "railTrain3D", enabledWhenIn: ["true"] },
    });
  });

  it("音符滑桿與 wasteSchedule 共用值；只有 wasteTruck 掛 showWhen（立體效果開才顯示）", () => {
    for (const name of ["wasteNoteSize", "wasteNoteZOffset"]) {
      const truck = findSpec("wasteTruck", name)!;
      const sched = findSpec("wasteSchedule", name)!;
      expect(truck.showWhen).toEqual({ param: "wasteTruck3D", equals: true });
      expect(sched.showWhen).toBeUndefined();
      const { showWhen: _s, ...truckRest } = truck;
      expect(truckRest).toEqual(sched);
      expect(truck.sharedGroup).toBe(name);
    }
    // 光點大小平面模式仍有作用（平面點大小），不收起
    expect(findSpec("wasteTruck", "wasteOrbScale")?.showWhen).toBeUndefined();
  });

  it("Agent 讀圖層控制看得到立體效果 toggle（layerControls 由規格自動帶出）", () => {
    for (const key of ["rail", "wasteTruck"]) {
      const c = describeLayerControls(key, new Set()).controls.find((x) => x.label === "立體效果");
      expect(c, key).toMatchObject({ kind: "toggle", value: true, hidden: false });
    }
  });

  it("manifest params 與圖例同步（wasteTruck 補圖例）", () => {
    expect(LAYER_MANIFEST.rail.params).toEqual({ count: 6, kinds: ["toggle", "toggle", "select", "slider", "slider", "slider"] });
    expect(LAYER_MANIFEST.wasteTruck.params).toEqual({ count: 5, kinds: ["slider", "slider", "slider", "slider", "toggle"] });
    expect(LAYER_MANIFEST.wasteTruck.legend).toBe("wasteTruck");
  });
});

// ── 1b. 2026-10-09 決議：列車平面時軌道自動 2D ／ 平面垃圾車收起音符滑桿 ──

describe("R6 段 3 決議：effectiveRailTrackMode", () => {
  it("立體開 → 照使用者設定；立體關 → 一律 2D", () => {
    expect(effectiveRailTrackMode(true, "3d")).toBe("3d");
    expect(effectiveRailTrackMode(true, "2d")).toBe("2d");
    expect(effectiveRailTrackMode(false, "3d")).toBe("2d");
    expect(effectiveRailTrackMode(false, "2d")).toBe("2d");
  });
});

describe("R6 段 3 決議：面板與 Agent 控制一致", () => {
  beforeEach(() => layerParamsStore.reset());

  const trackCtl = () => describeLayerControls("rail", new Set()).controls.find((c) => c.controlId === "railTrackMode")!;

  it("列車平面：軌道 3D 選項停用並附原因，存值不被改寫；立體開回原設定", () => {
    expect(trackCtl().options.find((o) => o.value === "3d")).toEqual({ label: "3D", value: "3d", disabled: false });
    layerParamsStore.setParam("rail", "railTrain3D", false);
    expect(trackCtl().options.find((o) => o.value === "3d")).toEqual({ label: "3D（列車平面時用 2D）", value: "3d", disabled: true });
    expect(trackCtl().options.find((o) => o.value === "2d")?.disabled).toBe(false);
    expect(layerParamsStore.getParam("rail", "railTrackMode")).toBe("3d");
    layerParamsStore.setParam("rail", "railTrain3D", true);
    expect(trackCtl().options.find((o) => o.value === "3d")?.disabled).toBe(false);
    expect(layerParamsStore.getParam("rail", "railTrackMode")).toBe("3d");
  });

  it("垃圾車平面：音符兩支滑桿收起（面板與 Agent 都看到 hidden）；立體開恢復", () => {
    const names = () => visibleControlSpecs("wasteTruck").map((s) => s.name);
    expect(names()).toEqual(expect.arrayContaining(["wasteNoteSize", "wasteNoteZOffset"]));
    layerParamsStore.setParam("wasteTruck", "wasteTruck3D", false);
    expect(names()).not.toContain("wasteNoteSize");
    expect(names()).not.toContain("wasteNoteZOffset");
    expect(names()).toContain("wasteOrbScale");
    const ctls = describeLayerControls("wasteTruck", new Set()).controls;
    expect(ctls.find((c) => c.controlId === "wasteNoteSize")).toMatchObject({ hidden: true, showWhen: { param: "wasteTruck3D", equals: true } });
    layerParamsStore.setParam("wasteTruck", "wasteTruck3D", true);
    expect(names()).toContain("wasteNoteSize");
  });

  it("wasteSchedule 不受影響：音符滑桿常駐，值仍與 wasteTruck 同步（含垃圾車平面時）", () => {
    layerParamsStore.setParam("wasteTruck", "wasteTruck3D", false);
    const names = visibleControlSpecs("wasteSchedule").map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["wasteNoteSize", "wasteNoteZOffset"]));
    layerParamsStore.setParam("wasteSchedule", "wasteNoteSize", 1.2);
    expect(layerParamsStore.getParam("wasteTruck", "wasteNoteSize")).toBe(1.2);
    expect(describeLayerControls("wasteSchedule", new Set()).controls.find((c) => c.controlId === "wasteNoteSize"))
      .toMatchObject({ hidden: false, value: 1.2 });
  });
});

// ── 2. Three 圖層可見判斷 ───────────────────────────────────

const OFF: ThreeStereoToggles = {
  fireStations3D: false, beamVisible: false, thsrPillarVisible: false, traPillarVisible: false,
  metroPillarVisible: false, airportPillarVisible: false, portPillarVisible: false,
  tempExtruded: false, wfMonitoring3D: false,
  railTrainVisible: true, railTrain3D: false, railTrack3D: false, wasteTruck3D: false,
  wfIncinerator3D: false, wfLandfill3D: false, wfLandfillCoastal3D: false, wfTransfer3D: false, wfMedical3D: false,
};

describe("R6 段 3：立體關時 Three 不因列車／垃圾車而載入或重畫", () => {
  it("rail：軌道 2D＋列車立體關 → false；任一需要 Three 的設定 → true", () => {
    expect(anyThreeLayerVisible(visOf({ rail: true }), OFF)).toBe(false);
    expect(anyThreeLayerVisible(visOf({ rail: true }), { ...OFF, railTrain3D: true })).toBe(true);
    // railTrack3D 是有效值：列車立體開＋軌道 3D 時才為 true
    expect(anyThreeLayerVisible(visOf({ rail: true }), { ...OFF, railTrain3D: true, railTrack3D: true })).toBe(true);
    // 2026-10-09 決議：列車平面時即使存值是 3D，有效軌道為 2D → 不觸發 Three
    const flatWith3dSaved = { ...OFF, railTrack3D: effectiveRailTrackMode(false, "3d") === "3d" };
    expect(anyThreeLayerVisible(visOf({ rail: true }), flatWith3dSaved)).toBe(false);
    // 列車隱藏時立體效果不算數
    expect(anyThreeLayerVisible(visOf({ rail: true }), { ...OFF, railTrainVisible: false, railTrain3D: true })).toBe(false);
    expect(railThreeVisible(false, { railTrainVisible: true, railTrain3D: true, railTrack3D: true })).toBe(false);
  });

  it("wasteTruck：立體關 → false；開 → true", () => {
    expect(anyThreeLayerVisible(visOf({ wasteTruck: true }), OFF)).toBe(false);
    expect(anyThreeLayerVisible(visOf({ wasteTruck: true }), { ...OFF, wasteTruck3D: true })).toBe(true);
  });

  it("平面層只在立體關時啟用", () => {
    const t = { railTrainVisible: true, railTrain3D: false, wasteTruck3D: false };
    expect(resolveFlatMovingActive(visOf({ rail: true, wasteTruck: true }), t)).toEqual({ rail: true, wasteTruck: true });
    expect(resolveFlatMovingActive(visOf({ rail: true, wasteTruck: true }), { ...t, railTrain3D: true, wasteTruck3D: true }))
      .toEqual({ rail: false, wasteTruck: false });
    expect(resolveFlatMovingActive(visOf({ rail: true }), { ...t, railTrainVisible: false }).rail).toBe(false);
    expect(resolveFlatMovingActive(visOf({}), t)).toEqual({ rail: false, wasteTruck: false });
  });
});

// ── 3. 方位角與線上插值 ─────────────────────────────────────

describe("R6 段 3：方位角", () => {
  it("正北 0、正東 90、正南 180、正西 270，重合 null", () => {
    expect(bearingDeg([121, 24], [121, 24.01])).toBeCloseTo(0, 6);
    expect(bearingDeg([121, 24], [121.01, 24])).toBeCloseTo(90, 6);
    expect(bearingDeg([121, 24], [121, 23.99])).toBeCloseTo(180, 6);
    expect(bearingDeg([121, 24], [120.99, 24])).toBeCloseTo(270, 6);
    expect(bearingDeg([121, 24], [121, 24])).toBeNull();
  });

  it("經度差乘 cos 緯度（緯度 60° 時等經緯差的方向約 26.6°，不是 45°）", () => {
    expect(bearingDeg([0, 60], [0.01, 60.01])).toBeCloseTo(26.57, 1);
  });

  it("directedBearing：反向行駛轉 180°", () => {
    expect(directedBearing(10, false)).toBe(10);
    expect(directedBearing(10, true)).toBe(190);
    expect(directedBearing(270, true)).toBe(90);
    expect(directedBearing(null, true)).toBeNull();
  });
});

describe("R6 段 3：interpolateWithBearingOnLineString（列車引擎用）", () => {
  // 先往東、再往北的 L 形
  const coords: [number, number][] = [[121, 24], [121.01, 24], [121.01, 24.01]];

  it.each([-0.1, 0, 0.2, 0.5, 0.75, 1, 1.2])("progress %s 的位置與 interpolateOnLineString 完全相同", (p) => {
    expect(interpolateWithBearingOnLineString(coords, p).position).toEqual(interpolateOnLineString(coords, p));
  });

  it("跨段：前半段方位朝東、後半段朝北；端點沿首／末段", () => {
    expect(interpolateWithBearingOnLineString(coords, 0.25).bearing).toBeCloseTo(90, 4);
    expect(interpolateWithBearingOnLineString(coords, 0.75).bearing).toBeCloseTo(0, 4);
    expect(interpolateWithBearingOnLineString(coords, 0).bearing).toBeCloseTo(90, 4);
    expect(interpolateWithBearingOnLineString(coords, 1).bearing).toBeCloseTo(0, 4);
  });

  it("少於兩點沒有方向", () => {
    expect(interpolateWithBearingOnLineString([[121, 24]], 0.5)).toEqual({ position: [121, 24], bearing: null });
  });
});

// ── 4. 垃圾車插值純函式 ─────────────────────────────────────

const pt = (t: number, lng: number, lat: number, tripId = 1, status: WasteTrailPoint["status"] = "collecting"): WasteTrailPoint =>
  ({ t, lng, lat, status, tripId });
const row = (trail: WasteTrailPoint[], vehicle_no = "KEM-0001"): WasteTrailRow =>
  ({ vehicle_no, city: "高雄市", route_id: null, trail });

describe("R6 段 3：垃圾車 GPS 插值（時間邊界）", () => {
  // 每 120 秒一點、往東 0.002°（約 200m，> 120m → 線性插值）
  const trail = [pt(1000, 120.300, 22.6), pt(1120, 120.302, 22.6), pt(1240, 120.304, 22.6)];

  it("開始前：停在第一點、alpha 0.4", () => {
    expect(interpolateWasteTrail(trail, 900)).toMatchObject({ lng: 120.300, lat: 22.6, alpha: 0.4, visible: true });
  });

  it("段內線性插值；剛好在取樣點上回該點", () => {
    expect(interpolateWasteTrail(trail, 1060).lng).toBeCloseTo(120.301, 9);
    expect(interpolateWasteTrail(trail, 1180).lng).toBeCloseTo(120.303, 9);
    expect(interpolateWasteTrail(trail, 1120).lng).toBeCloseTo(120.302, 9);
  });

  it("結束後：5 分鐘內實心、5–20 分鐘半透明、超過 20 分鐘不顯示", () => {
    expect(interpolateWasteTrail(trail, 1240 + 60)).toMatchObject({ lng: 120.304, alpha: 1, visible: true });
    expect(interpolateWasteTrail(trail, 1240 + 600)).toMatchObject({ alpha: 0.45, visible: true });
    expect(interpolateWasteTrail(trail, 1240 + 1300).visible).toBe(false);
  });

  it("跨 trip：前半在舊點淡出、後半在新點淡入（不畫中間）", () => {
    const tb = [pt(0, 120.30, 22.6, 1), pt(100, 120.40, 22.6, 2)];
    expect(interpolateWasteTrail(tb, 25)).toMatchObject({ lng: 120.30, alpha: 0.5 });
    expect(interpolateWasteTrail(tb, 75)).toMatchObject({ lng: 120.40, alpha: 0.5 });
  });

  it("matched：沿路網 polyline 依 progress 插值；段外 45 秒淡出", () => {
    const matched = {
      polyline: [[120.30, 22.6], [120.31, 22.6]] as [number, number][],
      timeline: [{ t: 0, progress: 0, status: "collecting" as const, tripId: 1 }, { t: 100, progress: 1, status: "collecting" as const, tripId: 1 }],
      confidence: null,
    };
    expect(interpolateWasteMatchedTrail(matched, 50).lng).toBeCloseTo(120.305, 9);
    expect(interpolateWasteMatchedTrail(matched, 100 + 30).alpha).toBeCloseTo(1 - 30 / 45, 6);
    expect(interpolateWasteMatchedTrail(matched, 100 + 60).visible).toBe(false);
  });

  it("live 視覺時間落後 5 分鐘；回放時間照用", () => {
    const nowMs = 2_000_000_000_000;
    expect(wasteVisualTimeSec(nowMs / 1000 - 10, nowMs)).toBe(nowMs / 1000 - VIEW_LAG_SECONDS);
    expect(wasteVisualTimeSec(nowMs / 1000 - 3600, nowMs)).toBe(nowMs / 1000 - 3600);
    expect(wasteVisualTimeSec(undefined, nowMs)).toBe(nowMs / 1000 - VIEW_LAG_SECONDS);
  });

  it("computeWasteTruckFrames：跳過無資料與不可見的車、依順序截斷到 maxCount", () => {
    const rows = [row([], "empty"), row(trail, "a"), row([pt(-1000, 120, 22)], "stale"), row(trail, "b"), row(trail, "c")];
    const out = computeWasteTruckFrames(rows, 1060, { maxCount: 2 });
    expect(out.map((p) => p.row.vehicle_no)).toEqual(["a", "b"]);
    expect(out[0]!.bearing).toBeNull(); // 沒要求就不算方向
  });

  it("方位角：往東開 → 90°；停著不動 → null", () => {
    const r = row(trail);
    const f = wasteTruckFrameAt(r, 1060)!;
    expect(wasteTruckBearing(r, 1060, f)).toBeCloseTo(90, 3);
    const parked = row([pt(0, 120.3, 22.6), pt(120, 120.3, 22.6), pt(240, 120.3, 22.6)]);
    expect(wasteTruckBearing(parked, 100, wasteTruckFrameAt(parked, 100)!)).toBeNull();
    expect(computeWasteTruckFrames([r], 1060, { withBearing: true })[0]!.bearing).toBeCloseTo(90, 3);
  });

  it("點選軌跡：往前 10 分鐘取樣，跨 trip 瞬移處斷開", () => {
    const lines = wasteTruckRecentPath(row(trail), 1240, 240, 60);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.length).toBe(5);
    const tb = row([pt(0, 120.30, 22.6, 1), pt(60, 120.301, 22.6, 1), pt(120, 120.40, 22.6, 2), pt(180, 120.401, 22.6, 2)]);
    expect(wasteTruckRecentPath(tb, 180, 180, 15).length).toBe(2);
  });
});

// ── 5. 平面畫法（paint／icon／zoom）─────────────────────────

describe("R6 段 3：平面 paint 與箭頭", () => {
  it("圓點：M 4.5／S 3 固定半徑乘大小倍率、P-2 底圖色描邊", () => {
    const dark = flatMovingCirclePaint(true, 1, 1);
    expect(dark["circle-radius"]).toEqual(["match", ["get", "tier"], "S", 3, 4.5]);
    expect(flatMovingCirclePaint(true, 2, 1)["circle-radius"]).toEqual(["match", ["get", "tier"], "S", 6, 9]);
    expect(dark["circle-stroke-color"]).toBe("#0a0a14");
    expect(flatMovingCirclePaint(false, 1, 1)["circle-stroke-color"]).toBe("#ffffff");
    expect(dark["circle-stroke-width"]).toBe(1);
    expect(dark["circle-color"]).toEqual(["get", "color"]);
  });

  it("z ≥ 12 有方向的物件圓點透明（改畫箭頭），沒方向的維持圓點", () => {
    expect(FLAT_ARROW_MIN_ZOOM).toBe(12);
    const op = flatMovingCirclePaint(true, 1, 1)["circle-opacity"];
    expect(op).toEqual(["step", ["zoom"], ["*", ["get", "alpha"], 0.85], 12, ["case", ["has", "bearing"], 0, ["*", ["get", "alpha"], 0.85]]]);
    expect(flatMovingCirclePaint(true, 1, 0.5)["circle-opacity"]).toEqual(
      ["step", ["zoom"], ["*", ["get", "alpha"], 0.425], 12, ["case", ["has", "bearing"], 0, ["*", ["get", "alpha"], 0.425]]],
    );
  });

  it("箭頭：P-5 L 階 13px、依 bearing 旋轉、貼地、不避讓；色＝物件色、描邊同底圖色", () => {
    const layout = flatMovingArrowLayout(1);
    expect(layout["icon-size"]).toBeCloseTo(13 / 16, 9);
    expect(flatMovingArrowLayout(2)["icon-size"]).toBeCloseTo(26 / 16, 9);
    expect(layout).toMatchObject({
      "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
      "icon-allow-overlap": true, "icon-ignore-placement": true,
    });
    expect(flatMovingArrowPaint(false, 1)).toMatchObject({ "icon-color": ["get", "color"], "icon-halo-color": "#ffffff", "icon-halo-width": 1 });
  });

  it("SDF 箭頭：中心在形狀內（alpha > 邊緣 191）、角落在外（0）、尖端朝上", () => {
    const size = 48;
    const sdf = buildArrowSdf(size, 32);
    const alphaAt = (x: number, y: number) => sdf[(y * size + x) * 4 + 3]!;
    expect(alphaAt(24, 20)).toBeGreaterThan(191);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(24, 9)).toBeGreaterThan(alphaAt(24, 39)); // 上方尖端在形狀內、下方凹口在外
  });

  it("點選圖層＝圓點＋箭頭；兩層 id 不重複", () => {
    expect(flatMovingPickLayers("rail")).toEqual([FLAT_MOVING_IDS.rail.circle, FLAT_MOVING_IDS.rail.arrow]);
    const all = [...Object.values(FLAT_MOVING_IDS.rail), ...Object.values(FLAT_MOVING_IDS.wasteTruck)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("節流約 25fps", () => {
    expect(FLAT_MOVING_THROTTLE_MS).toBeGreaterThanOrEqual(33);
    expect(FLAT_MOVING_THROTTLE_MS).toBeLessThanOrEqual(50);
  });
});

// ── 6. GeoJSON 組裝與點選軌跡歷史 ─────────────────────────────

describe("R6 段 3：平面 GeoJSON", () => {
  const train = (id: string, position: [number, number], bearing?: number | null): RailTrain =>
    ({ trainId: id, trackId: "t", systemId: "tra", position, color: "#ff0000", status: "running", bearing });

  it("列車：色＝train.color、M 階；無方向不帶 bearing；[0,0] 略過", () => {
    const fc = railFlatFeatures([train("1", [121, 24], 45), train("2", [121.1, 24], null), train("3", [0, 0], 10)]);
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.properties).toEqual({ key: "tra-1", color: "#ff0000", tier: "M", alpha: 1, bearing: 45 });
    expect("bearing" in fc.features[1]!.properties).toBe(false);
  });

  it("垃圾車：停車／離線 S 階，alpha 沿用插值結果", () => {
    const r = row([pt(0, 120.3, 22.6)]);
    const fc = wasteFlatFeatures([
      { row: r, frame: { lat: 22.6, lng: 120.3, status: "parked", alpha: 0.45, visible: true }, bearing: null },
      { row: r, frame: { lat: 22.6, lng: 120.3, status: "collecting", alpha: 1, visible: true }, bearing: 90 },
    ]);
    expect(fc.features[0]!.properties).toMatchObject({ tier: "S", alpha: 0.45, color: "#fbbf24" });
    expect("bearing" in fc.features[0]!.properties).toBe(false);
    expect(fc.features[1]!.properties).toMatchObject({ tier: "M", bearing: 90 });
  });

  it("RecentTrackHistory：0.5 秒取樣、超過視窗丟棄、時間跳轉清空、下線的車移除", () => {
    const h = new RecentTrackHistory(10, 30);
    h.record([{ key: "a", position: [1, 1] }], 100);
    h.record([{ key: "a", position: [2, 2] }], 100.2); // < 0.5 秒不記
    h.record([{ key: "a", position: [3, 3] }], 105);
    expect(h.path("a")).toEqual([[1, 1], [3, 3]]);
    h.record([{ key: "a", position: [4, 4] }], 112);
    expect(h.path("a")).toEqual([[3, 3], [4, 4]]);
    h.record([{ key: "b", position: [5, 5] }], 113);
    expect(h.path("a")).toEqual([]);
    h.record([{ key: "b", position: [6, 6] }], 200); // 跳轉 > 30 秒
    expect(h.path("b")).toEqual([[6, 6]]);
  });
});
