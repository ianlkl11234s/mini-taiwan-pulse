# plan-art

航班軌跡生成式藝術（Generative Art）視覺化應用。以台灣機場為中心，將航班降落軌跡轉化為光軌藝術作品。

## 視覺概念

- **視角**：機場附近地平線高度，觀察飛機降落的低角度視角
- **光球**：每架飛機以發光球體呈現，搭配 additive blending 疊加效果
- **光軌**：球體後方拖曳漸層透明的彗尾狀軌跡，越近球體越亮、尾端衰減消失
- **閃爍燈**：光球旁規律閃爍的紅色警示小點，模擬真實航空燈號
- **疊合模式**：單日所有航班軌跡疊合，呈現機場整體起降的光軌全貌

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| 框架 | React 19 + TypeScript + Vite | 應用骨架 |
| 地圖 | Mapbox GL JS v3 | 3D terrain 底圖、低角度視角控制 |
| 3D 渲染 | Three.js | 光軌、發光球體、閃爍燈的 WebGL 渲染 |
| Shader | GLSL | 自訂光軌漸層材質、發光效果 |
| 資料 | FlightRadar24 軌跡資料 | `[lat, lng, alt_m, timestamp]` 格式 |

## 架構

### Three.js + Mapbox 整合

透過 Mapbox GL JS 的 `CustomLayer` 介面，在 Mapbox 的 WebGL context 中嵌入 Three.js 場景。Mapbox 負責地圖渲染與相機控制，Three.js 負責光軌藝術效果，兩者共用同一個 WebGL context 並保持座標同步。

```
Mapbox GL JS（底圖 + 相機）
  └── CustomLayer（renderingMode: '3d'）
        └── Three.js Scene
              ├── LightOrb（發光球體 Sprite）
              ├── LightTrail（光軌 TubeGeometry + gradient shader）
              └── BlinkingLight（紅色閃爍點）
```

### 資料流

```
aviation_data.json
  → flightLoader（載入 + 解析）
  → 依機場 / 日期 / 航班篩選
  → MercatorCoordinate 座標轉換
  → timeline 時間插值（當前播放時間 → 插值位置）
  → Three.js 場景每幀更新
```

### 專案結構

```
plan-art/
├── public/
│   └── aviation_data.json          # 航班軌跡資料（從 fr24/ 匯入）
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/                      # 型別定義
│   ├── data/
│   │   └── flightLoader.ts         # 資料載入與解析
│   ├── map/
│   │   ├── MapView.tsx             # Mapbox GL 容器元件
│   │   ├── cameraPresets.ts        # 各機場低角度視角預設值
│   │   └── customLayer.ts          # Mapbox CustomLayer ↔ Three.js 橋接
│   ├── three/
│   │   ├── FlightScene.ts          # Three.js 場景管理
│   │   ├── LightOrb.ts             # 發光球體
│   │   ├── LightTrail.ts           # 光軌渲染
│   │   ├── BlinkingLight.ts        # 紅色閃爍燈
│   │   └── shaders/
│   │       ├── trail.vert           # 光軌頂點 shader
│   │       ├── trail.frag           # 光軌片段 shader（漸層透明度）
│   │       └── glow.frag            # 發光效果 shader
│   ├── hooks/
│   │   ├── useFlightData.ts        # 資料載入 + 篩選邏輯
│   │   └── useTimeline.ts          # 時間軸播放控制
│   ├── components/
│   │   ├── AirportSelector.tsx     # 機場選擇器
│   │   ├── FlightPicker.tsx        # 單一航班追蹤選擇
│   │   ├── TimelineControls.tsx    # 播放 / 暫停 / 速度
│   │   └── ViewToggle.tsx          # 單一航班 vs 疊合模式切換
│   └── utils/
│       ├── coordinates.ts          # lat/lng/alt → MercatorCoordinate 轉換
│       └── interpolation.ts        # 軌跡時間插值
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 功能

### 核心功能

1. **單一航班追蹤**：選定特定航班，跟隨其降落軌跡，近距離觀察光軌效果
2. **機場全貌疊合**：以機場為中心，將某日所有起降航班的光軌疊合呈現
3. **時間軸播放**：控制播放速度，觀察航班隨時間展開的過程

### 視覺效果

| 效果 | 實現方式 |
|------|---------|
| 發光球體 | `THREE.Sprite` + 高斯模糊紋理 + `AdditiveBlending`，多層疊加模擬 bloom |
| 光軌拖尾 | `TubeGeometry` + 自訂 GLSL shader，沿軌跡 `vProgress` 控制 alpha 漸變 |
| 紅色閃爍 | shader uniform `sin(time)` 驅動 opacity 週期變化 |
| 光軌疊加 | `AdditiveBlending` 讓多條光軌重疊處自然增亮 |

### 台灣機場預設視角

| 機場 | ICAO | 特色 |
|------|------|------|
| 桃園國際機場 | RCTP | 主要國際航線，軌跡最密集 |
| 松山機場 | RCSS | 城市背景，市區降落視角 |
| 高雄國際機場 | RCKH | 海岸線方向起降 |
| 台中清泉崗 | RCMQ | 中部航線 |

## 資料格式

航班軌跡資料來自 FlightRadar24，每筆航班包含完整軌跡點：

```json
{
  "fr24_id": "3e617f8a",
  "callsign": "UAE366",
  "aircraft_type": "A388",
  "origin_iata": "DXB",
  "dest_iata": "TPE",
  "path": [
    [25.245, 55.371, 0, 1771371753],
    [25.300, 56.100, 10058, 1771373000],
    ...
  ]
}
```

`path` 中每個點：`[緯度, 經度, 高度(公尺), Unix timestamp]`

## 開發階段

| Phase | 內容 | 說明 |
|-------|------|------|
| 1 | 專案骨架 | Vite + React + Mapbox 暗色底圖 + 資料載入 |
| 2 | Three.js 橋接 | CustomLayer 整合、基本軌跡線條渲染 |
| 3 | 光軌效果 | GLSL shader 漸層透明 + additive blending + 發光球體 |
| 4 | 動畫系統 | 時間軸播放 + 紅色閃爍燈 + 軌跡隨時間展開 |
| 5 | UI 控制 | 機場選擇、航班追蹤、疊合模式、視角切換 |
| 6 | 調校優化 | 視覺微調、大量軌跡效能優化、相機動畫 |

## 開發

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建置
npm run build
```

需要設定 Mapbox access token：

```bash
# .env.local
VITE_MAPBOX_TOKEN=your_mapbox_access_token
```

## 靈感參考

- 長曝光航空攝影（airport long exposure photography）
- Aaron Koblin「Flight Patterns」— 美國航班軌跡視覺化
- Mapbox 官方 3D terrain + custom layer 範例
