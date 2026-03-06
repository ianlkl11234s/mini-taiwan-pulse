export interface ChangelogEntry {
  date: string;
  title: { zh: string; en: string };
  items: { zh: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-03-06",
    title: { zh: "每日更新進度頁 + 斷層圖層", en: "Changelog Page + Fault Layer" },
    items: [
      { zh: "Info Modal 新增「每日更新」子頁", en: "Added Daily Changelog page to Info Modal" },
      { zh: "活動斷層地質敏感區圖層（22 條斷層帶）", en: "Active fault geological sensitive area layer (22 fault zones)" },
      { zh: "Layers 面板頂部新增「All Off」全關按鈕", en: "Added 'All Off' button at top of Layers panel" },
    ],
  },
  {
    date: "2026-03-05",
    title: { zh: "點擊詳情面板", en: "Click Detail Panels" },
    items: [
      { zh: "港口/機場加入點擊詳情面板", en: "Added click detail panel for ports and airports" },
      { zh: "全部點位圖層支援點擊詳情（氣象站/自行車站/公車站/燈塔/車站）", en: "Click detail support for all point layers (weather/bike/bus/lighthouse/station)" },
      { zh: "關閉航班/鐵道圖層時不再誤觸 pickFlight/pickTrain", en: "Fixed accidental pickFlight/pickTrain when layers are off" },
    ],
  },
  {
    date: "2026-03-04",
    title: { zh: "學校超商 + 海纜圖層", en: "School/CVS + Submarine Cable Layers" },
    items: [
      { zh: "學校/超商點擊詳情面板 + 點大小 slider", en: "School/CVS click detail panel + point size slider" },
      { zh: "浮動毛玻璃面板取代滑出式抽屜，回歸 glassmorphism 風格", en: "Floating glassmorphism panel replaces slide-out drawer" },
      { zh: "通訊海纜/登陸站圖層 + 點擊資訊面板", en: "Submarine cable / landing station layer + info panel" },
    ],
  },
  {
    date: "2026-03-03",
    title: { zh: "FACILITY 圖層擴充", en: "FACILITY Layer Expansion" },
    items: [
      { zh: "新增學校（4,315）+ 超商（13,223）全台圖層", en: "Added school (4,315) + convenience store (13,223) nationwide layers" },
      { zh: "面板半透明毛玻璃效果", en: "Semi-transparent glassmorphism panel effect" },
      { zh: "INFRA/FACILITY 分類擴充", en: "Expanded INFRA/FACILITY categories" },
    ],
  },
  {
    date: "2026-03-02",
    title: { zh: "溫度波浪 3D + Icon Rail Sidebar", en: "Temperature Wave 3D + Icon Rail Sidebar" },
    items: [
      { zh: "溫度波浪 3D 圖層 — S3 真實時序資料、RdBu 發散色盤", en: "Temperature wave 3D layer — real-time S3 data, RdBu diverging palette" },
      { zh: "Icon Rail Sidebar 推移佈局、中文圖層名、白灰配色", en: "Icon Rail Sidebar push layout, Chinese layer names, light gray color scheme" },
    ],
  },
  {
    date: "2026-03-01",
    title: { zh: "H3 六角形人口視覺化", en: "H3 Hexagon Population Visualization" },
    items: [
      { zh: "H3 六角形網格 — deck.gl 改原生 Mapbox fill-extrusion", en: "H3 hexagonal grid — migrated from deck.gl to native Mapbox fill-extrusion" },
      { zh: "人流模擬層 — Plasma/Viridis 色階、Contrast 對比度", en: "Population flow simulation — Plasma/Viridis palettes, contrast control" },
      { zh: "SEGIS 村里人口指標雙層視覺化", en: "SEGIS village population index dual-layer visualization" },
    ],
  },
  {
    date: "2026-02-28",
    title: { zh: "地點跳轉 + 道路光暈", en: "Location Selector + Road Glow" },
    items: [
      { zh: "地點跳轉 Selector 重構 — 分類浮動面板取代原生 select", en: "Location selector refactor — categorized floating panel replaces native select" },
      { zh: "國道/省道線寬光暈可調、碼頭/機場光柱與光暈", en: "Highway/provincial road glow adjustable, port/airport light pillars" },
    ],
  },
  {
    date: "2026-02-27",
    title: { zh: "Info Modal 大改版", en: "Info Modal Overhaul" },
    items: [
      { zh: "重構 Info 面板為多分頁 Modal（sidebar + content 兩欄佈局）", en: "Refactored Info panel into multi-tab Modal (sidebar + content layout)" },
      { zh: "Info Modal 新增完整英文翻譯（ZH/EN 切換）", en: "Added full English translation to Info Modal (ZH/EN toggle)" },
      { zh: "個人頁面 — 真實頭貼、4 個專案卡片、社群連結", en: "Profile page — real avatar, 4 project cards, social links" },
    ],
  },
  {
    date: "2026-02-26",
    title: { zh: "公共自行車 + 圖層分類重構", en: "Public Bikes + Layer Category Refactor" },
    items: [
      { zh: "新增公共腳踏車站圖層（9,408 站）", en: "Added public bike station layer (9,408 stations)" },
      { zh: "自行車道、國道壅塞、氣象站三個新圖層", en: "Three new layers: bike paths, highway congestion, weather stations" },
      { zh: "Overlay Registry + custom hooks + LayerSidebar 三分類面板", en: "Overlay Registry + custom hooks + LayerSidebar three-category panel" },
    ],
  },
  {
    date: "2026-02-25",
    title: { zh: "Sidebar 收合 + FACILITY 圖層", en: "Collapsible Sidebar + FACILITY Layers" },
    items: [
      { zh: "LayerSidebar 可收合為側邊窄條", en: "LayerSidebar collapsible into thin side strip" },
      { zh: "FACILITY 圖層展開面板 + 3D 光柱/光束參數化", en: "FACILITY layer expand panel + 3D light pillar/beam parametric controls" },
      { zh: "車站光柱靜態預計算 + Rail 列車開關 + 軌道 2D/3D 切換", en: "Station light pillar precompute + Rail train toggle + track 2D/3D switch" },
    ],
  },
  {
    date: "2026-02-24",
    title: { zh: "燈塔 + 公路 + 圖層重構", en: "Lighthouse + Highway + Layer Refactor" },
    items: [
      { zh: "新增燈塔光束、國道/省道圖層", en: "Added lighthouse beams, highway and provincial road layers" },
      { zh: "Overlay Registry + custom hooks 重構", en: "Overlay Registry + custom hooks refactoring" },
    ],
  },
  {
    date: "2026-02-23",
    title: { zh: "鐵道對位修正", en: "Rail Alignment Fixes" },
    items: [
      { zh: "修正彰化三角環線 — 全部 112 條 TRA 軌道（333 列車）", en: "Fixed Changhua triangle loop — all 112 TRA tracks (333 trains)" },
      { zh: "TRA station_progress 重新計算以改善列車站點對齊", en: "Recalculated TRA station_progress for better train-station alignment" },
    ],
  },
  {
    date: "2026-02-22",
    title: { zh: "多運具整合 + 碼頭圖層", en: "Multi-Transport Integration + Port Layer" },
    items: [
      { zh: "整合船舶 + 鐵道視覺化", en: "Integrated ship + rail visualization" },
      { zh: "新增碼頭多邊形圖層（OSM dock boundaries）", en: "Added port polygon layer (OSM dock boundaries)" },
      { zh: "TRA 獨立引擎 + 多色列車分類", en: "Dedicated TRA engine + multi-color train types" },
      { zh: "3D 靜態鐵道軌跡 + Z 軸高度控制", en: "3D static rail tracks + Z-axis altitude control" },
    ],
  },
  {
    date: "2026-02-21",
    title: { zh: "航班互動 + 多運具初版", en: "Flight Interaction + Multi-Transport v1" },
    items: [
      { zh: "Display Mode 切換 + 航班點擊互動", en: "Display mode toggle + flight click interaction" },
      { zh: "追蹤單架航班鏡頭鎖定", en: "Camera lock for tracked single flight" },
      { zh: "Loading Screen + inline SVG favicon", en: "Loading screen + inline SVG favicon" },
    ],
  },
  {
    date: "2026-02-20",
    title: { zh: "S3 部署 + Docker", en: "S3 Deploy + Docker" },
    items: [
      { zh: "S3 增量更新 + Docker 部署架構", en: "S3 incremental update + Docker deployment architecture" },
      { zh: "大檔案移出 git → S3 + Volume 架構", en: "Large files moved from git → S3 + Volume architecture" },
      { zh: "S3 資料改走私密認證下載", en: "S3 data switched to private authenticated downloads" },
    ],
  },
];
