# plan-art

航班軌跡生成式藝術（Generative Art）視覺化。以台灣機場為中心，將航班起降軌跡轉化為光軌藝術作品。

## 視覺概念

- **光軌**：航班軌跡以彗尾狀漸層光軌呈現，additive blending 疊加自然增亮
- **光球**：每架飛機以多層發光球體標示當前位置，搭配呼吸動畫
- **閃爍燈**：紅色雙閃警示燈，模擬真實防撞燈號
- **靜態軌跡**：全部航班路徑同時顯示，3D 模式依高度著色（暖橘→冷藍），2D 模式每航班隨機橘白色
- **機場邊界**：OSM 機場多邊形，白色填充 + 光暈效果
- **拍攝模式**：一鍵隱藏 UI，暗角 vignette 效果，適合截圖輸出

## 功能

### 檢視模式

| 模式 | 說明 |
|------|------|
| This Airport | 選定機場相關航班 |
| All Taiwan | 全台 1,500+ 航班 |
| ±12h Window | 當前時間前後 12 小時 |
| Track Single | 追蹤單一航班 |

### 渲染模式

| 模式 | 靜態軌跡 | 特色 |
|------|---------|------|
| 3D Altitude | Three.js LineSegments | 航線有高度，依海拔著色漸變 |
| 2D Flat | Mapbox 原生 line layer | 平面俯瞰，每航班獨立配色 |

### 即時參數調整

| 控制項 | 說明 |
|--------|------|
| Alt ×1.0~5.0 | 高度誇張倍率 |
| Z +0~2000m | 基準高度偏移（避免被地形遮擋） |
| Opacity | 靜態軌跡不透明度 |
| Orb | 光球大小 |
| APT | 機場填充不透明度 |
| Glow | 機場光暈強度 |

### 其他

- 6 種 Mapbox 底圖樣式（Dark / Light / Satellite / Navigation Night 等）
- 5 座機場預設視角（RCTP / RCSS / RCKH / RCMQ / RCYU）
- 時間軸播放控制（1x~240x 加速）
- Capture 拍攝模式（暗角 vignette + 標題，ESC 退出）

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| 框架 | React 19 + TypeScript + Vite | 應用骨架 |
| 地圖 | Mapbox GL JS v3 | 3D terrain、底圖、相機控制 |
| 3D 渲染 | Three.js r172 | 光軌、光球、閃爍燈、靜態軌跡 |
| Shader | GLSL | 光軌漸層材質 |
| 資料 | FlightRadar24 | `[lat, lng, alt_m, timestamp]` 軌跡格式 |
| 地理 | OpenStreetMap / Overpass API | 機場邊界多邊形 |

## 架構

### Three.js + Mapbox 整合

透過 Mapbox `CustomLayer` 在同一個 WebGL context 中嵌入 Three.js 場景。Mapbox 負責地圖 + 相機，Three.js 負責光軌渲染，座標透過 `MercatorCoordinate` 同步。

```
Mapbox GL JS（底圖 + 3D terrain + 相機控制）
  └── CustomLayer（renderingMode: '3d'）
        └── Three.js Scene
              ├── Static Trails（LineSegments, per-vertex altitude color）
              ├── LightTrail（GLSL gradient shader trail）
              ├── LightOrb（IcosahedronGeometry + AdditiveBlending）
              └── BlinkingLight（red flash mesh）
```

### 專案結構

```
plan-art/
├── public/
│   ├── aviation_data.json        # FR24 航班軌跡（34MB, gitignored）
│   └── airports.geojson          # OSM 台灣機場邊界（13 座）
├── src/
│   ├── App.tsx                   # 主應用 + 所有狀態管理 + UI
│   ├── types/index.ts            # 型別定義
│   ├── data/
│   │   └── flightLoader.ts       # 資料載入、篩選
│   ├── map/
│   │   ├── MapView.tsx           # Mapbox 容器 + 機場圖層
│   │   ├── customLayer.ts        # CustomLayer ↔ Three.js 橋接
│   │   ├── staticTrails.ts       # 2D Mapbox 原生軌跡圖層
│   │   └── cameraPresets.ts      # 台灣機場視角預設
│   ├── three/
│   │   ├── FlightScene.ts        # 場景管理器（靜態 + 動態軌跡）
│   │   ├── LightOrb.ts           # 多層球體光球
│   │   ├── LightTrail.ts         # GLSL 光軌渲染
│   │   ├── BlinkingLight.ts      # 紅色閃爍燈
│   │   └── shaders/              # GLSL vertex/fragment shaders
│   ├── hooks/
│   │   ├── useFlightData.ts      # 資料載入 hook
│   │   └── useTimeline.ts        # 時間軸播放 hook
│   ├── components/
│   │   ├── AirportSelector.tsx
│   │   ├── FlightPicker.tsx
│   │   ├── TimelineControls.tsx
│   │   └── StyleSelector.tsx
│   └── utils/
│       ├── coordinates.ts        # MercatorCoordinate 轉換 + 動態高度參數
│       └── interpolation.ts      # 軌跡時間插值
├── color-preview.html            # 調色盤獨立預覽
├── .env.example
├── package.json
└── vite.config.ts
```

## 資料格式

航班軌跡來自 FlightRadar24，每筆航班包含完整路徑點：

```json
{
  "fr24_id": "3e617f8a",
  "callsign": "UAE366",
  "aircraft_type": "A388",
  "origin_iata": "DXB",
  "dest_iata": "TPE",
  "path": [
    [25.245, 55.371, 0, 1771371753],
    [25.300, 56.100, 10058, 1771373000]
  ]
}
```

`path` 每個點：`[緯度, 經度, 高度(m), Unix timestamp]`

## 開發

```bash
npm install
cp .env.example .env
# 編輯 .env 填入 Mapbox token

npm run dev     # 開發
npm run build   # 建置
```

需將 `aviation_data.json` 放置於 `public/` 目錄（未包含在 git 中）。

## 靈感參考

- 長曝光航空攝影（airport long exposure photography）
- Aaron Koblin「Flight Patterns」— 美國航班軌跡視覺化
- Mapbox 3D terrain + custom layer
