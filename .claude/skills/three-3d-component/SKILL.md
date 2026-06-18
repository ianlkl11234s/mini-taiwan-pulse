---
name: three-3d-component
description: Mini Taiwan Pulse 新增 Three.js × Mapbox 立體圖層的設計與接線手冊。當用戶說「新增 3D 圖層」「立體元件」「3D layer」「Three.js scene」「立體呈現」「3D 視覺化」「點與點的連結」「燈塔轉圈/光柱/巨蛋/光弧」或要從 `public/three-showcase.html`（68 元件案例庫）挑元件接到實際圖層時觸發。導引用戶從「想表達什麼語意」→ 對應元件類別 → Scene/CustomLayer 範本 → 必過 checklist（座標 / blending / dispose / 動態時間源 / 性能）→ 最後跑 tsc -b。
---

# Three.js 3D 圖層設計手冊

> 目標：讓 Mini Taiwan Pulse 跳脫「只有點」的圖層形式。用立體幾何 + 動畫 + 光效 表達 **點的內涵**（燈塔轉圈）和 **點與點的關聯**（流動光弧、Sankey、力導向網路）。
>
> SSOT：
> - 案例庫：`public/three-showcase.html`（互動 demo，68 元件 9 大類）
> - 元件查表：`docs/three-showcase-library.md`
> - 已上線 Scene：`src/three/*Scene.ts`（16 個）
> - CustomLayer 接線：`src/map/*CustomLayer.ts`

---

## 一、何時用 3D，何時不用

| 情境 | 用 3D？ | 改用 |
|---|---|---|
| 單點靜態 POI（≤ 200 個，無時序） | ❌ | Mapbox `circle` / `symbol` |
| 大量點分佈（>1000）需呈現密度 | ❌ | h3 hexbin / heatmap |
| 點本身有語意動作（轉、發光、脈動） | ✅ | beam / radar / orb |
| 點與點之間有關係（流動、層級） | ✅ | flowline / arc / sankey / network |
| 範圍 / 影響力 / 覆蓋 | ✅ | dome / cone / ripple / hexgrid |
| 時序動態（隨 timeline 變化） | ✅ | 走 Three.js + timeStore |

**鐵則**：3D 是為了「**表達語意**」，不是為了酷。下手前先回答這題：
> 「拿掉這個 3D 元件，使用者會少看懂什麼？」

答不出來 → 用 2D。

---

## 二、設計流程（5 步）

### Step 1：定義語意

填寫這個句子：

> 「這個圖層的每個物件，是一個 **［主體名詞］**，它正在 **［動作 / 狀態 / 關係］**，影響範圍 **［大小 / 方向 / 對象］**。」

範例：
- 燈塔 = 一座 **燈塔**，正在 **旋轉發光**，影響 **半徑 N 公里的海域** → `beam` + 旋轉
- 火警分隊 = 一個 **救援基地**，正在 **發出脈動信號**，等時圈 **5/10/15 分鐘** → `cylinder` 光柱 + 多層 `ripple`
- 列車調度 = 多個 **車站**，彼此之間 **班次流動**，方向 **北→南為主** → `flowline` / `arc`

### Step 2：對照元件類別

| 想表達 | 看類別 | 推薦元件 ID |
|---|---|---|
| 即時單一物件 | 基礎幾何 / 光效 | `orb` `beam` `pin` `crystal` |
| 警示 / 脈動事件 | 動畫事件 | `ripple` `radar` `ring` `shockwave` `lightning` |
| 範圍 / 勢力 / 保護罩 | 基礎幾何 | `dome` `cone` `lightcone` |
| 數據量化（柱狀 / 等級） | 數據視覺化 | `bars` `polyextrude` `pie` `linechart` |
| 流動 / 路徑 / 班次 | 線條 / 路徑 | `flowline` `arc` `network` |
| 自然 / 氣體 / 大氣 | 體積 / 大氣 | `smoke` `noisecloud` `fog` |
| 慶典 / 強調 / 特殊 POI | Shader 變形 / 場景 | `aurora` `flow` `firework` `text` |
| 系統關係（多節點關聯） | 系統關係 | `sankey` `converge` `hydrocycle` `feedback` `cascade` |

完整對照查 `docs/three-showcase-library.md` 的「適合表達」欄位。

### Step 3：在 showcase 試參數

在 dev 啟動 `pnpm dev` → 開 `http://localhost:3721/three-showcase.html` → 找到對應元件 → 即時調 size / opacity / speed / color → **抄下用戶看得順的參數值**。

跳過這步是 80% 「上線後覺得太亮 / 太大」的根因。

### Step 4：依骨架接線（看 §三）

新檔 + 強制順序，**禁** improvising。

### Step 5：必過 checklist（看 §四）

---

## 三、Scene + CustomLayer 標準骨架

> 完整範例：複製 `src/three/LighthouseScene.ts` + `src/map/lighthouseCustomLayer.ts` 改名即可。

### 3.1 必守接線 5 點

1. **共用 GL context**：`new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl, antialias: true })` + `renderer.autoClear = false`
2. **座標轉換**：一律用 `src/utils/coordinates.ts` 的 `toMercator(lat, lng, alt)` — 不要自己算 mercator scale
3. **Blending 還原**：render() 前後備份 / 還原 `BLEND` 狀態（不然 Mapbox 之後的圖層會壞色）— 看 `LighthouseScene.render()` L66-96 是 SSOT pattern
4. **重繪驅動**：動態元件最後 `map?.triggerRepaint()`；靜態元件不要呼叫
5. **dispose**：`onRemove` 必走 `geometry.dispose()` + `material.dispose()` + `renderer.dispose()`

### 3.2 動態時間（時序圖層必看）

⚠️ **禁** 把 `currentTime` 放進 React `useEffect` / `useMemo` deps。

| 用法 | API |
|---|---|
| RAF / per-frame | `timeStore.getTime()` 同步讀 |
| filter / lookup | `timeStore.subscribeThrottled(ms, cb)` |
| 跨日載入 | `timeStore.subscribeDate(cb)` |
| UI 顯示 | `useSyncExternalStore + subscribeThrottled(250)` |

理由見 `.claude/memory/feedback_dynamic_layer_principle.md`。

### 3.3 Scene class 範本（最小）

```ts
// src/three/MyScene.ts
import * as THREE from "three";
import { toMercator } from "../utils/coordinates";

export class MyScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private groups: THREE.Group[] = [];
  private lastT = Date.now();
  playing = true;

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setPositions(positions: [number, number][]) {
    this.disposeGroups();
    for (const [lng, lat] of positions) {
      const group = new THREE.Group();
      const mc = toMercator(lat, lng, 0);
      group.position.set(mc.x, mc.y, mc.z);
      // → 在這裡建你的 mesh / shader / sprite
      this.scene.add(group);
      this.groups.push(group);
    }
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const be = gl.isEnabled(gl.BLEND);
    const bs = gl.getParameter(gl.BLEND_SRC_RGB);
    const bd = gl.getParameter(gl.BLEND_DST_RGB);
    const bsa = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const bda = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    const now = Date.now();
    const dt = this.playing ? (now - this.lastT) / 1000 : 0;
    this.lastT = now;
    // → 在這裡更新動畫狀態（rotation / opacity sin / particle 位置）

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (be) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(bs, bd, bsa, bda);
  }

  private disposeGroups() {
    for (const g of this.groups) {
      this.scene.remove(g);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.groups = [];
  }

  dispose() {
    this.disposeGroups();
    this.renderer?.dispose();
  }
}
```

CustomLayer 範本看 `src/map/lighthouseCustomLayer.ts`（53 行 SSOT）。

---

## 四、必過 Checklist（新增 3D 圖層）

### A. 設計層
- [ ] 已填「§二 Step 1 語意句」並貼進 PR description
- [ ] 元件 ID 從 `docs/three-showcase-library.md` 挑選（不自創）
- [ ] 在 `three-showcase.html` 試過參數，截圖貼 PR

### B. 程式層（看「§5 新增 Layer 強制順序」CLAUDE.md）
- [ ] `src/three/XxxScene.ts` 走 §3.3 骨架，blending 備份還原
- [ ] `src/map/xxxCustomLayer.ts` 走 §3.1 5 點
- [ ] 座標**一律** `toMercator(lat, lng, alt)`，禁手算
- [ ] `onRemove` 走完整 dispose

### C. 圖層 UX 四鐵則（CLAUDE.md §5a）
- [ ] 透明度 slider（`useTransportParams.ts`）
- [ ] 分類 ≥ 2 → `LegendPanel.tsx` + `LEGEND_REGISTRY`
- [ ] 可點選 → `useMapInteraction.ts` + `featureInfo/registry.tsx`
- [ ] Options ≥ 4 → 原生 `<select>` dropdown

### D. 時間訂閱（動態圖層）
- [ ] `currentTime` 不在 React deps
- [ ] 走 `timeStore` 訂閱（RAF / throttled / date）
- [ ] 暫停時 `playing = false`、`dt = 0`

### E. 性能
- [ ] 元件數 > 500 → 用 `InstancedMesh`，不用 N 個 Group
- [ ] Shader uniform 更新走 ref，不要每 frame `new Material`
- [ ] Particle 系統用 `BufferGeometry` + `Points`，禁 N 個 Mesh

### F. 驗證
- [ ] `npx tsc -b` 過（必跑，project references）
- [ ] `pnpm test`（`layerConsistency` 擋漏接圖例）
- [ ] Browser 手測：Wall mode / pause / 切日 / 切城市 不 leak

---

## 五、3 個跨點關聯典型情境（自己加新題）

點與點的關聯 = 這套 3D 系統的最大價值。先看現有 3 種：

### 5.1 流動方向（A → B 連續）

- 元件：`flowline`（曲線發光 + 流動 dash）/ `arc`（拋物線高弧）
- 已上線案例：列車軌道光跡 (`RailScene`)、班次路線
- 何時用：起終點明確、有時序、單向
- 變化：箭頭粒子化 (`particles` + 路徑取樣) / 多色分類（按運具）

### 5.2 層級匯流（多 → 一 或 一 → 多）

- 元件：`sankey`（寬度 = 流量）/ `converge`（多源收斂光弧）/ `hydrocycle`（水循環四箭頭）
- 何時用：N 個輸入點滙到 1 個 hub、或 1 點散出多支
- 變化：水資源「水庫 → 淨水場 → 用戶」/ 醫療「救護車 → 醫院」

### 5.3 系統反饋（環狀 / 雙向）

- 元件：`feedback`（雙箭頭環）/ `cascade`（階梯式）/ `network`（force-directed）
- 何時用：節點之間「互相影響」，非單向
- 變化：交通號誌連動、電網潮流、生態鏈

> 新題範例：「捷運轉乘關係」→ network；「電廠 → 變電所 → 區塊負載」→ cascade；「漁港彼此調船」→ feedback。

---

## 六、外部 GIS 3D 案例參考（設計借鑒）

> 完整研究筆記 + URL 見 `references/gis-references.md`。

| 案例 / 工具 | 啟發 | 我們已採用？ |
|---|---|---|
| **threebox** (Mapbox + Three.js plugin) | CustomLayer 標準骨架、3D model 載入 | ✅ 骨架一致，未引入 plugin（避免依賴） |
| **deck.gl** ArcLayer / HexagonLayer | 流動弧線高度 ∝ 距離 / hexbin 量化 | ✅ `flowline`/`arc`/`hexgrid` 借用 |
| **Cesium 3D Tiles** | 真實建築 + 點雲串流 | ❌（投影差異，未來 LOD 可參考） |
| **Kepler.gl** | UI 一鍵切 2D/3D + 圖層配色 | 借用「同一圖層 2D/3D 開關」概念 |
| **GeoGraphViz** (arxiv 2304.09864) | 地理約束 + 3D force-directed | 對應 §5.3 network 元件 |
| **OD-flow immersive** (arxiv 1908.02089) | 3D 弧高度 ∝ 流量 vs 距離權衡 | `arc` 高度可調 = 同款設計 |
| **Map UI Patterns / Flow map** | Bezier 比 geodesic 美 + 邊束 (edge bundling) | 多 flow 重疊時走 edge bundling（待做） |

設計原則摘要（綜合上方）：

1. **高度承載第二維度**：弧高 = 流量 / 距離 / 重要性，不要只用顏色
2. **邊束 (edge bundling)**：>50 條流線時必束，否則 spaghetti
3. **語意一致性**：球 = 物件、罩 = 範圍、柱 = 量、弧 = 關係。混用會降低可讀性
4. **離散時序 + 連續位移**：班次走離散（出現 / 消失），運動軌跡走 lerp 插值（看 `feedback_animation_preference.md`）

---

## 七、產出規格（給用戶或自己 review）

每個新 3D 圖層的 PR 必附：

```
## 立體元件設計卡

- 語意句：__________
- 元件 ID：__________
- 元件來源：docs/three-showcase-library.md §__
- 參數實測值（從 showcase 抄）：size/opacity/speed/color = __________
- 跨點關聯類型：5.1 / 5.2 / 5.3 / 無
- 外部參考案例：__________（若有）
- 性能模式：單元件 / InstancedMesh / Particles
- Checklist：A/B/C/D/E/F 全打勾
```

---

## 八、何時更新本 Skill

- 案例庫加新元件（>5 個）→ 同步 §二對照表
- 新題的關聯類型超過 §五 3 種 → 新增 5.4 段
- 跨 repo 接線改變（gis-platform RPC pattern 等）→ 更新 §3
- 用戶踩到新坑（如 InstancedMesh 顯隱錯亂、shader 在 Safari 黑屏）→ 進 §四 E 性能段
