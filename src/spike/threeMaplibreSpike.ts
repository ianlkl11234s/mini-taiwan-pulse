/**
 * 技術 Spike：驗證 Three.js CustomLayer 能否在 MapLibre GL 上運作
 *
 * 對照組 = 主站 src/map/customLayer.ts (createRailLayer) + src/three/RailScene.ts
 * 差異點全部寫在 README 級註解裡，供後續移植 src/embed/ 時參考。
 *
 * ⚠️ 這是 spike 檔，不接主站任何模組，不被任何檔案 import。
 *
 * ── 實測結論（maplibre-gl 5.24.0 / three 0.172 / Chromium SwiftShader）──
 * PASS。Three.js InstancedMesh 在 MapLibre CustomLayer 上與 map.project() 逐像素對齊
 * （z7/z10、pitch 45/60、bearing 20/30 皆 dx=dy=0.00px），無任何 WebGL/matrix 錯誤。
 *
 * mapbox → maplibre 四個差異：
 * 1. render 第二參數：mapbox = number[16]；maplibre = 物件 CustomRenderMethodInput
 *    keys = farZ / nearZ / fov / modelViewProjectionMatrix / projectionMatrix
 *           / shaderData / defaultProjectionData
 * 2. 要用的矩陣 = options.defaultProjectionData.mainMatrix（Float64Array(16)）。
 *    ❌ options.modelViewProjectionMatrix 是另一個座標系，實測會把物件投到畫面外約 -54000px。
 * 3. onAdd 的 gl 型別是 WebGLRenderingContext | WebGL2RenderingContext（實際拿到 WebGL2），
 *    mapbox 型別只宣告 WebGLRenderingContext。gl.canvas === map.getCanvas() 兩邊都成立。
 * 4. renderingMode 在 maplibre 是 optional 且預設 "2d"，要顯式寫 "3d"。
 *
 * 不變的部分：autoClear=false / resetState() 前後夾 / blend state 手動存還 /
 * triggerRepaint() 驅動動畫 / MercatorCoordinate API 名稱與數值（實測 bit-identical）。
 */
import maplibregl, { type CustomLayerInterface, type CustomRenderMethodInput } from "maplibre-gl";
import mapboxgl from "mapbox-gl";
import * as THREE from "three";
import "maplibre-gl/dist/maplibre-gl.css";

// ── 測試線段：台北 → 高雄 ──
const TAIPEI: [number, number] = [121.52, 25.05];
const KAOHSIUNG: [number, number] = [120.30, 22.62];
const SPHERE_COUNT = 20;
let sphereRadiusM = 12000; // 12km，z7 下約 10px 半徑，肉眼可見（window.__spikeSetRadius 可調）
let altitudeM = 0; // 高度（公尺），驗證 mercator z 軸是否 conformal（window.__spikeSetAlt 可調）

// ─────────────────────────────────────────────────────────────
// 座標轉換：等價替換 src/utils/coordinates.ts 的 mapbox 版本
// mapboxgl.MercatorCoordinate → maplibregl.MercatorCoordinate
// 兩者 API 完全同名（fromLngLat / meterInMercatorCoordinateUnits）
// ─────────────────────────────────────────────────────────────
function toMercatorMaplibre(lng: number, lat: number, altMeters: number) {
  const mc = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], altMeters);
  return { x: mc.x, y: mc.y, z: mc.z };
}

function metersPerUnitMaplibre(lat: number): number {
  return maplibregl.MercatorCoordinate.fromLngLat([0, lat], 0).meterInMercatorCoordinateUnits();
}

// ── 雙引擎數值對照（純數學，不需要 mapbox token）──
function logEngineParity() {
  const mb = mapboxgl.MercatorCoordinate.fromLngLat(TAIPEI, 1000);
  const ml = maplibregl.MercatorCoordinate.fromLngLat(TAIPEI, 1000);
  const parity = {
    mapbox: { x: mb.x, y: mb.y, z: mb.z, mpu: mb.meterInMercatorCoordinateUnits() },
    maplibre: { x: ml.x, y: ml.y, z: ml.z, mpu: ml.meterInMercatorCoordinateUnits() },
    dx: Math.abs(mb.x - ml.x),
    dy: Math.abs(mb.y - ml.y),
    dz: Math.abs(mb.z - ml.z),
    dmpu: Math.abs(mb.meterInMercatorCoordinateUnits() - ml.meterInMercatorCoordinateUnits()),
  };
  console.log("[SPIKE] MercatorCoordinate parity mapbox vs maplibre:", JSON.stringify(parity));
  (window as unknown as Record<string, unknown>).__spikeParity = parity;
  return parity;
}

// ─────────────────────────────────────────────────────────────
// Three.js Scene（比照 RailScene：Camera + 覆寫 projectionMatrix）
// ─────────────────────────────────────────────────────────────
class SpikeScene {
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  renderer!: THREE.WebGLRenderer;
  mesh!: THREE.InstancedMesh;
  private dummy = new THREE.Matrix4();
  private lastMatrix = new THREE.Matrix4();
  /** 每顆球目前的 lng/lat，給驗證用 */
  positions: Array<{ lng: number; lat: number }> = [];

  init(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    // 與 RailScene.init 完全相同的掛法：借用 map 既有 canvas + gl context
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, SPHERE_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.count = SPHERE_COUNT;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(SPHERE_COUNT * 3),
      3,
    );
    const color = new THREE.Color();
    for (let i = 0; i < SPHERE_COUNT; i++) {
      color.setHSL(0.08 + (i / SPHERE_COUNT) * 0.5, 1.0, 0.6);
      this.mesh.instanceColor.setXYZ(i, color.r, color.g, color.b);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);
  }

  /** phase ∈ [0,1)：整串球沿線位移 */
  update(phase: number) {
    this.positions = [];
    for (let i = 0; i < SPHERE_COUNT; i++) {
      const t = (i / SPHERE_COUNT + phase) % 1;
      const lng = TAIPEI[0] + (KAOHSIUNG[0] - TAIPEI[0]) * t;
      const lat = TAIPEI[1] + (KAOHSIUNG[1] - TAIPEI[1]) * t;
      this.positions.push({ lng, lat });

      const p = toMercatorMaplibre(lng, lat, altitudeM);
      const s = metersPerUnitMaplibre(lat) * sphereRadiusM;
      this.dummy.makeScale(s, s, s);
      this.dummy.setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(i, this.dummy);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  render(matrix: ArrayLike<number>) {
    // 比照 RailScene.render：存還 blend state，避免污染 map 自己的 GL state
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  /** 用當前 MVP 矩陣把 instance i 投影到螢幕座標（驗證用，比照 RailScene.pickTrain）*/
  projectInstance(i: number, viewW: number, viewH: number): { x: number; y: number } | null {
    const m = new THREE.Matrix4();
    this.mesh.getMatrixAt(i, m);
    const els = m.elements;
    const v = new THREE.Vector4(els[12] ?? 0, els[13] ?? 0, els[14] ?? 0, 1.0);
    v.applyMatrix4(this.lastMatrix);
    if (v.w <= 0) return null;
    return {
      x: ((v.x / v.w) * 0.5 + 0.5) * viewW,
      y: ((-v.y / v.w) * 0.5 + 0.5) * viewH,
    };
  }

  dispose() {
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material)?.dispose();
    this.renderer?.dispose();
  }
}

// ─────────────────────────────────────────────────────────────
// MapLibre CustomLayerInterface
// ⚠️ 與 mapbox 最大差異：render 第二參數是 **物件** 不是 number[]
// ─────────────────────────────────────────────────────────────
type MatrixChoice = "mvp" | "main" | "projectionOnly";

function createSpikeLayer(): CustomLayerInterface & { scene: SpikeScene } {
  const scene = new SpikeScene();
  let map: maplibregl.Map | null = null;
  let loggedFirstFrame = false;
  let frames = 0;
  const t0 = performance.now();

  return {
    id: "spike-three-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,
    scene,

    onAdd(mapInstance: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
      map = mapInstance;
      const w = window as unknown as Record<string, unknown>;
      w.__spikeGlInfo = {
        isWebGL2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
        ctor: gl.constructor.name,
        canvasIsMapCanvas: gl.canvas === mapInstance.getCanvas(),
      };
      console.log("[SPIKE] onAdd gl info:", JSON.stringify(w.__spikeGlInfo));
      scene.init(gl);
    },

    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
      const w = window as unknown as Record<string, unknown>;

      // 首幀：把 mapbox 慣用的 number[] 假設 vs maplibre 實際型別 dump 出來
      if (!loggedFirstFrame) {
        loggedFirstFrame = true;
        const mvp = options.modelViewProjectionMatrix;
        const main = options.defaultProjectionData?.mainMatrix;
        let maxDiff = -1;
        if (mvp && main) {
          maxDiff = 0;
          for (let i = 0; i < 16; i++) {
            maxDiff = Math.max(maxDiff, Math.abs((mvp[i] ?? 0) - (main[i] ?? 0)));
          }
        }
        const info = {
          secondArgType: typeof options,
          isArray: Array.isArray(options),
          keys: Object.keys(options),
          mvpCtor: mvp?.constructor?.name ?? null,
          mainCtor: main?.constructor?.name ?? null,
          maxAbsDiff_mvp_vs_main: maxDiff,
          nearZ: options.nearZ,
          farZ: options.farZ,
          fov: options.fov,
        };
        w.__spikeRenderArgInfo = info;
        console.log("[SPIKE] render() 2nd arg:", JSON.stringify(info));
      }

      // ✅ 實測結論：必須用 defaultProjectionData.mainMatrix
      //    （= mapbox custom layer 那把 mercator 0..1 → clip 的矩陣）。
      //    options.modelViewProjectionMatrix 是另一個座標系（world pixel），
      //    直接餵給 Three 會把物件投到畫面外幾萬 px。
      const choice = (w.__spikeMatrixChoice as MatrixChoice) ?? "main";
      const matrix =
        choice === "main"
          ? options.defaultProjectionData.mainMatrix
          : choice === "projectionOnly"
            ? options.projectionMatrix
            : options.modelViewProjectionMatrix;

      const phase = ((performance.now() - t0) / 20000) % 1;
      scene.update(phase);
      scene.render(matrix as ArrayLike<number>);

      frames++;
      w.__spikeFrames = frames;
      map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
logEngineParity();

const errors: string[] = [];
window.addEventListener("error", (e) => errors.push(`window.error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => errors.push(`unhandledrejection: ${String(e.reason)}`));
(window as unknown as Record<string, unknown>).__spikeErrors = errors;

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0b1220" } },
      { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.55 } },
    ],
  },
  center: [121.0, 23.8],
  zoom: 7,
  pitch: 0,
  attributionControl: false,
});

(window as unknown as Record<string, unknown>).__spikeMap = map;

const layer = createSpikeLayer();
(window as unknown as Record<string, unknown>).__spikeLayer = layer;

map.on("load", () => {
  // 地面真值：用 MapLibre 自己的 2D 圖層畫同一條線 + 兩端點。
  // Three 球若始終貼在這條線上，代表座標轉換與矩陣都對。
  map.addSource("truth", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [TAIPEI, KAOHSIUNG] },
        },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: TAIPEI } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: KAOHSIUNG } },
      ],
    },
  });
  map.addLayer({
    id: "truth-line",
    type: "line",
    source: "truth",
    paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "truth-pt",
    type: "circle",
    source: "truth",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 5,
      "circle-color": "#00ffff",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
    },
  });

  map.addLayer(layer);
  console.log("[SPIKE] layer added");
});

map.on("error", (e) => {
  const msg = `map.error: ${String((e as unknown as { error?: Error }).error?.message ?? e)}`;
  errors.push(msg);
  console.warn("[SPIKE]", msg);
});

(window as unknown as Record<string, unknown>).__spikeSetRadius = (m: number) => {
  sphereRadiusM = m;
  map.triggerRepaint();
  return m;
};

(window as unknown as Record<string, unknown>).__spikeSetAlt = (m: number) => {
  altitudeM = m;
  map.triggerRepaint();
  return m;
};

// 驗證輔助：比對「Three 投影出來的球位置」vs「MapLibre map.project 的地理位置」
(window as unknown as Record<string, unknown>).__spikeVerify = () => {
  const canvas = map.getCanvas();
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width; // device px
  const h = canvas.height;
  const out: Array<Record<string, number | null>> = [];
  for (let i = 0; i < SPHERE_COUNT; i += 5) {
    const three = layer.scene.projectInstance(i, w, h);
    const pos = layer.scene.positions[i];
    if (!pos) continue;
    const ml = map.project([pos.lng, pos.lat]); // CSS px
    out.push({
      i,
      lng: +pos.lng.toFixed(4),
      lat: +pos.lat.toFixed(4),
      three_cssX: three ? +(three.x / dpr).toFixed(1) : null,
      three_cssY: three ? +(three.y / dpr).toFixed(1) : null,
      maplibre_x: +ml.x.toFixed(1),
      maplibre_y: +ml.y.toFixed(1),
      dx: three ? +(three.x / dpr - ml.x).toFixed(2) : null,
      dy: three ? +(three.y / dpr - ml.y).toFixed(2) : null,
    });
  }
  return out;
};
