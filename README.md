# Taiwan Flight Arc

台灣交通動態視覺化 — 以 3D 弧線、光球、拖尾光軌呈現航班、船舶、軌道列車的即時移動。

## Screenshots

![RCTP - 桃園國際機場（Capture 模式）](screenshots/RCTP-capture.png)
![RCQC - 澎湖馬公機場（All Taiwan）](screenshots/RCQC-all-taiwan.png)
![全台航班廣角全景](screenshots/all-flights-globe.png)

## 三種交通工具

| 圖層 | 渲染方式 | 資料來源 |
|------|---------|---------|
| 航班 | 3D 弧線 + 光球 + 彗尾光軌 + 靜態軌跡 | FlightRadar24 API |
| 船舶 | InstancedMesh 光球 + LineSegments 拖尾線 | AIS 船舶資料（ship-gis SQLite） |
| 軌道 | 3D 靜態軌道線 + InstancedMesh 列車光球 + 拖尾線 | mini-taipei-v3 時刻表 + GeoJSON |

### 航班

- **光軌**：航班軌跡以彗尾狀漸層光軌呈現，additive blending 疊加自然增亮
- **光球**：多層發光球體標示當前位置，搭配呼吸動畫 + 紅色防撞閃爍燈
- **靜態軌跡**：3D 模式依高度著色（暖橘→冷藍），2D 模式每航班隨機配色

### 船舶

- **光球**：青藍色 InstancedMesh，視口剔除（bounds check），呼吸動畫
- **拖尾線**：LineSegments per-vertex color gradient（30 分鐘遞延）
- **時間範圍過濾**：僅顯示路徑時間範圍內的船舶（末端 +10 分鐘寬限）
- **GPS 異常過濾**：匯出時排除隱含速度 >40 節的異常跳躍點

### 軌道列車

- **6 個系統**：台鐵（TRA）、高鐵（THSR）、台北捷運（TRTC）、高雄捷運（KRTC）、高雄輕軌（KLRT）、台中捷運（TMRT）
- **靜態軌道**：Three.js 3D LineSegments，支援 Z 軸偏移（Rail Z 滑桿）
- **列車光球**：per-instance color，各系統不同顏色（台鐵依車種再細分 6 色）
- **拖尾線**：台鐵 + 高鐵專屬（3 分鐘遞延）
- **台鐵專用引擎**：TraTrainEngine 處理 OD 軌道、golden track、彰化三角線等複雜路線
- **排除**：貓空纜車（MK-*）

## 地圖標記

| 標記類型 | 渲染方式 | 資料來源 |
|---------|---------|---------|
| 機場邊界 | Mapbox fill + line + glow | OSM Overpass API |
| 大站 Polygon（TRA class 0-1 + THSR） | fill + glow（類機場風格） | OSM Overpass API |
| 小站 + 捷運站 Point（491 站） | circle glow 圓環 | mini-taipei-v3 車站 GeoJSON |
| 港口邊界 | fill + line + glow | OSM Overpass API |

## 視覺概念

- **機場邊界**：OSM 機場多邊形，暗色主題白色填充 + 光暈，亮色主題金黃色填充 + 光暈
- **車站標記**：大站 Polygon + 小站/捷運站 circle glow，各系統依色彩區分
- **港口邊界**：OSM 碼頭多邊形，青藍色 fill + glow
- **主題適應**：所有 UI 元件與視覺效果自動適應底圖明暗
- **拍攝模式**：一鍵隱藏 UI，暗角 vignette 效果，適合截圖輸出
- **圖層開關**：Flight / Ship / Rail / Station 各自獨立開關，顯示活躍數量

## 功能

### 檢視模式

| 模式 | 說明 |
|------|------|
| This Airport | 選定機場相關航班 |
| All Taiwan | 全台 1,500+ 航班 |
| ±12h Window | 當前時間前後 12 小時 |
| Track Single | 追蹤單一航班 |

### 即時參數調整

**第一排 — 航班參數**

| 控制項 | 說明 |
|--------|------|
| Alt ×1.0~5.0 | 高度誇張倍率 |
| Z +0~200m | 基準高度偏移 |
| Opacity | 靜態軌跡不透明度 |
| Orb | 航班光球大小 |
| APT | 機場填充不透明度 |
| Glow | 機場光暈強度 |

**第二排 — 軌道 + 船舶參數**

| 控制項 | 說明 |
|--------|------|
| Rail Z | 軌道 Z 軸偏移（公尺） |
| Rail Orb | 列車光球大小 |
| Rail Trk | 軌道線 + 拖尾線透明度 |
| Ship Orb | 船舶光球大小 |
| Ship Trail | 船舶拖尾線透明度 |

### 其他

- 6 種 Mapbox 底圖樣式（Dark / Light / Satellite / Navigation Night 等）
- 14 座台灣機場預設視角，選單顯示中文名稱與 IATA 代碼
- 時間軸播放控制（30x~600x 加速）
- Capture 拍攝模式（暗角 vignette + 機場名稱 + 時間標記）
- Info 面板 + 外部連結

### 手機版適配

768px 以下自動切換：Compact Header、Timeline Bar、三段式 Bottom Sheet、Safe Area 適配。

## 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| 框架 | React 19 + TypeScript + Vite | 應用骨架 |
| 地圖 | Mapbox GL JS v3 | 3D terrain、底圖、相機控制 |
| 3D 渲染 | Three.js r172 | 光軌、光球、InstancedMesh、LineSegments |
| Shader | GLSL | 光軌漸層材質 |
| 航班資料 | FlightRadar24 API | `[lat, lng, alt_m, timestamp]` 軌跡格式 |
| 船舶資料 | AIS / ship-gis SQLite | 台灣周邊海域船舶位置 |
| 軌道資料 | mini-taipei-v3 | 時刻表 + GeoJSON 軌道 |
| 地理 | OpenStreetMap / Overpass API | 機場、車站、港口邊界多邊形 |
| 雲端 | AWS S3 | 航班 / 船舶 / 軌道資料增量同步 |

## 架構

### Three.js + Mapbox 整合

透過 Mapbox `CustomLayer` 在同一個 WebGL context 中嵌入 Three.js 場景。三個獨立 CustomLayer 分別管理飛機、船舶、軌道列車。

```
Mapbox GL JS（底圖 + 3D terrain + 相機控制）
  ├── CustomLayer: flight-3d
  │     └── FlightScene
  │           ├── Static Trails（LineSegments, per-vertex altitude color）
  │           ├── LightTrail（GLSL gradient shader trail）
  │           ├── LightOrb（IcosahedronGeometry + AdditiveBlending）
  │           └── BlinkingLight（red flash mesh）
  ├── CustomLayer: ship-3d
  │     └── ShipScene
  │           ├── InstancedMesh（光球 + 呼吸動畫）
  │           └── LineSegments（拖尾線 per-vertex color gradient）
  ├── CustomLayer: rail-3d
  │     └── RailScene
  │           ├── InstancedMesh（列車光球 per-instance color）
  │           ├── LineSegments（TRA/THSR 拖尾線）
  │           └── LineSegments（靜態軌道 3D 線段）
  └── Mapbox GL Layers
        ├── airport-poly-*（機場邊界 fill + glow）
        ├── station-poly-*（大站 Polygon fill + glow）
        ├── station-point-*（小站 circle glow）
        └── port-poly-*（港口邊界 fill + glow）
```

### 專案結構

```
plan-art/
├── public/
│   ├── aviation_data.json          # FR24 航班軌跡（gitignored）
│   ├── ship_data.json              # AIS 船舶軌跡（gitignored）
│   ├── airports.geojson            # OSM 台灣 14 座機場邊界
│   ├── station_polygons.geojson    # 大站 Polygon（TRA class 0-1 + THSR）
│   ├── station_points.geojson      # 小站 + 捷運站 Point（491 站）
│   ├── port_polygons.geojson       # 港口邊界 Polygon
│   └── rail/                       # 軌道時刻表 + GeoJSON（gitignored）
│       ├── tra/                    # 台鐵（265 OD 軌道 + 39 golden tracks）
│       ├── thsr/                   # 高鐵
│       ├── trtc/                   # 台北捷運
│       ├── krtc/                   # 高雄捷運
│       ├── klrt/                   # 高雄輕軌
│       └── tmrt/                   # 台中捷運
├── scripts/
│   ├── fetch-flights.ts            # 航班清單擷取
│   ├── fetch-tracks.ts             # 飛行軌跡擷取
│   ├── upload-to-s3.ts             # 航班資料上傳 S3
│   ├── upload-ships-to-s3.ts       # 船舶資料上傳 S3
│   ├── upload-rail-to-s3.ts        # 軌道資料上傳 S3
│   ├── export-ship-data.py         # 從 ship-gis SQLite 匯出船舶資料
│   ├── export-rail-data.py         # 從 mini-taipei-v3 複製軌道資料
│   ├── bundle-rail-data.py         # 打包軌道資料成單一 JSON
│   ├── fetch-station-polygons.py   # 從 OSM 下載大站 Polygon
│   ├── build-station-points.py     # 合併小站 Point GeoJSON
│   ├── fix-changhua-loop.py        # 修復彰化三角線軌道迴圈
│   └── fix-station-progress.py     # 重算車站 progress 對照表
├── src/
│   ├── App.tsx                     # 主應用 + 狀態管理 + UI
│   ├── types/index.ts              # 型別定義
│   ├── constants/
│   │   └── traTrainTypes.ts        # TRA 列車類型常數（6 色分類）
│   ├── data/
│   │   ├── flightLoader.ts         # 航班資料載入 + S3 增量更新
│   │   ├── shipLoader.ts           # 船舶資料載入
│   │   ├── railLoader.ts           # 軌道資料載入（6 系統）
│   │   └── s3Loader.ts             # S3 增量同步客戶端
│   ├── engines/
│   │   ├── TraTrainEngine.ts       # 台鐵專用引擎（OD + golden track）
│   │   ├── RailEngine.ts           # 通用軌道列車插值引擎
│   │   └── railUtils.ts            # 軌道工具函式
│   ├── map/
│   │   ├── MapView.tsx             # Mapbox 容器 + 圖層管理
│   │   ├── customLayer.ts          # CustomLayer ↔ Three.js 橋接（3 圖層）
│   │   ├── staticTrails.ts         # 2D Mapbox 原生軌跡圖層
│   │   ├── railTracks.ts           # 軌道 Mapbox 2D 線圖層
│   │   ├── stationOverlay.ts       # 車站 Polygon + Point 圖層
│   │   ├── portOverlay.ts          # 港口 Polygon 圖層
│   │   └── cameraPresets.ts        # 台灣機場視角預設
│   ├── three/
│   │   ├── FlightScene.ts          # 航班場景（靜態 + 動態軌跡）
│   │   ├── ShipScene.ts            # 船舶場景（InstancedMesh + LineSegments）
│   │   ├── RailScene.ts            # 軌道場景（靜態軌道 + 列車 + 拖尾）
│   │   ├── LightOrb.ts             # 多層球體光球
│   │   ├── LightTrail.ts           # GLSL 光軌渲染
│   │   ├── BlinkingLight.ts        # 紅色閃爍燈
│   │   └── shaders/                # GLSL vertex/fragment shaders
│   ├── hooks/
│   │   ├── useFlightData.ts        # 航班資料 hook
│   │   ├── useShipData.ts          # 船舶資料 hook
│   │   ├── useRailData.ts          # 軌道資料 hook
│   │   ├── useTimeline.ts          # 時間軸播放 hook
│   │   └── useIsMobile.ts          # 響應式偵測
│   ├── components/
│   │   ├── AirportSelector.tsx     # 機場選擇器
│   │   ├── FlightPicker.tsx        # 航班選擇器
│   │   ├── TimelineControls.tsx    # 時間軸控制
│   │   ├── StyleSelector.tsx       # 底圖樣式切換
│   │   ├── LayerToggle.tsx         # Flight / Ship / Rail / Station 開關
│   │   └── MobileBottomSheet.tsx   # 手機版底部抽屜
│   └── utils/
│       ├── coordinates.ts          # MercatorCoordinate 轉換
│       └── interpolation.ts        # 軌跡時間插值
├── Dockerfile                      # Multi-stage build（node:22-alpine → nginx:alpine）
├── docker-compose.yml              # Port 3721，volume mount 資料檔
├── nginx.conf                      # Nginx 反向代理
├── .env.example
├── package.json
├── vite.config.ts
└── README.md
```

## 資料準備

### 航班資料

本專案使用 [FlightRadar24 API](https://fr24api.flightradar24.com/) 作為航班軌跡資料來源。

```bash
# Step 1: 取得航班清單
npm run fetch:flights

# Step 2: 擷取飛行軌跡
npm run fetch:tracks -- --date 2026-02-18
```

產出 `public/aviation_data.json`（~44MB，gitignored）。

### 船舶資料

從 `ship-gis` 專案的 SQLite 匯出台灣周邊海域的 AIS 船舶軌跡：

```bash
# 預設 2026-02-18
python3 scripts/export-ship-data.py

# 指定日期範圍
python3 scripts/export-ship-data.py 2026-02-18 2026-02-19
```

產出 `public/ship_data.json`（~23MB，gitignored）。匯出包含：
- 台灣周邊 bounding box 過濾（lat 20-28, lng 116-126）
- 至少 5 個 SOG>0.5 的移動資料點
- GPS 異常過濾（隱含速度 >40 節的點被移除）
- 無效 MMSI 過濾（0, 111111111, 123456789 等測試信號）

### 軌道資料

從 `mini-taipei-v3` 專案複製時刻表 + 軌道 GeoJSON：

```bash
python3 scripts/export-rail-data.py
```

產出 `public/rail/` 目錄，包含 6 個系統的時刻表、軌道 GeoJSON、車站進度對照表。

### 車站 + 港口標記

```bash
# 下載大站 OSM Polygon（TRA class 0-1 + THSR 12 站）
python3 scripts/fetch-station-polygons.py

# 合併小站 + 捷運站 Point（491 站）
python3 scripts/build-station-points.py
```

### 軌道資料修正腳本

```bash
# 修復彰化三角線迴圈（112 條軌道、333 列火車）
python3 scripts/fix-changhua-loop.py

# 重算 station_progress（修正列車停站位置偏移）
python3 scripts/fix-station-progress.py
```

### S3 上傳

```bash
npm run s3:upload          # 航班資料
npm run s3:upload:ships    # 船舶資料
npm run s3:upload:rail     # 軌道資料
```

## 開發

### 安裝與啟動

```bash
npm install

cp .env.example .env
# 填入 VITE_MAPBOX_TOKEN 和 FR24_API_TOKEN

npm run dev     # 開發模式
npm run build   # 正式建置
```

### 環境需求

- Node.js 22+
- Python 3（用於資料匯出腳本）
- Mapbox Access Token（免費方案即可）
- FlightRadar24 API Token（Explorer 方案以上）

### 涵蓋機場

| ICAO | 機場 |
|------|------|
| RCTP | 桃園國際機場 |
| RCSS | 台北松山機場 |
| RCKH | 高雄國際機場 |
| RCMQ | 台中清泉崗機場 |
| RCYU | 花蓮機場 |
| RCBS | 金門尚義機場 |
| RCFG | 馬祖南竿機場 |
| RCFN | 台東豐年機場 |
| RCKU | 嘉義機場 |
| RCNN | 台南機場 |
| RCQC | 澎湖馬公機場 |
| RCCM | 七美機場 |
| RCGI | 綠島機場 |
| RCMT | 馬祖北竿機場 |

## License

MIT License. 詳見 [LICENSE](LICENSE)。
