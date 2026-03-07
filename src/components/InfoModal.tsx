import { useState } from "react";
import { CHANGELOG } from "../data/changelog";

type BottomTab = "guide" | "about" | "profile";
type GuidePage = "getting-started" | "feature-legend" | "data-sources" | "daily-changelog";
type Lang = "zh" | "en";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

/* ── 樣式常量 ── */
const S = {
  bg: "rgba(14,14,22,0.96)",
  border: "rgba(255,255,255,0.1)",
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  label: "rgba(255,255,255,0.4)",
  text: "rgba(255,255,255,0.85)",
  sub: "rgba(255,255,255,0.5)",
  active: "#64aaff",
  font: "monospace",
} as const;

/* ── i18n helper ── */
type T = { zh: string; en: string };
const t = (obj: T, lang: Lang) => obj[lang];

/* ── Sub-components ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, color: S.label, margin: "0 0 10px", letterSpacing: 1.5, textTransform: "uppercase" }}>
      {children}
    </h3>
  );
}

function Card({ title, children, accentColor, style }: {
  title?: string;
  children: React.ReactNode;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: S.cardBg,
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 8,
      padding: "12px 14px",
      borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
      ...style,
    }}>
      {title && <div style={{ fontSize: 12, color: S.text, fontWeight: 600, marginBottom: 6 }}>{title}</div>}
      <div style={{ fontSize: 12, lineHeight: 1.7, color: S.sub }}>{children}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      background: S.cardBg,
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 4,
      fontSize: 11,
      color: S.sub,
    }}>
      {children}
    </span>
  );
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 3,
      fontSize: 11,
      fontFamily: S.font,
      color: S.text,
    }}>
      {children}
    </span>
  );
}

function ParamRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6, marginBottom: 4 }}>
      <span style={{ color: S.active, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ color: S.sub }}>{desc}</span>
    </div>
  );
}

function ExpandableParams({ lang, items }: { lang: Lang; items: { label: string; zh: string; en: string }[] }) {
  return (
    <div style={{ borderTop: `1px solid ${S.cardBorder}`, paddingTop: 8, marginTop: 4 }}>
      <div style={{ fontSize: 11, color: S.label, marginBottom: 6 }}>
        {lang === "zh" ? "▸ 展開可調整：" : "▸ Expandable parameters:"}
      </div>
      {items.map((p) => <ParamRow key={p.label} label={p.label} desc={t(p, lang)} />)}
    </div>
  );
}

/* ── 五個頁面 ── */

function GettingStartedPage({ lang }: { lang: Lang }) {
  const L = lang === "zh";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: 0 }}>
        {L
          ? <>歡迎使用 <b>Mini Taiwan Pulse</b> — 以 3D 呈現台灣航班、船舶、鐵道的即時動態視覺化。地圖預設以全台鳥瞰視角開啟，你可以自由旋轉、縮放來探索。</>
          : <>Welcome to <b>Mini Taiwan Pulse</b> — a real-time 3D visualization of Taiwan's flights, ships, and trains. The map opens with a bird's-eye view of Taiwan. Feel free to rotate and zoom to explore.</>
        }
      </p>

      <SectionTitle>{L ? "地圖操作" : "MAP CONTROLS"}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        <Card title={L ? "旋轉視角" : "Rotate View"}>
          <KeyBadge>{L ? "右鍵" : "Right-click"}</KeyBadge> + {L ? "拖曳 — 改變俯仰角（pitch）與方位角（bearing）" : "Drag — Change pitch and bearing angles"}
        </Card>
        <Card title={L ? "縮放地圖" : "Zoom Map"}>
          <KeyBadge>{L ? "滾輪" : "Scroll wheel"}</KeyBadge> {L ? "上下滾動 — 放大或縮小地圖" : "— Zoom in or out"}
        </Card>
        <Card title={L ? "平移地圖" : "Pan Map"}>
          <KeyBadge>{L ? "左鍵" : "Left-click"}</KeyBadge> + {L ? "拖曳 — 移動地圖中心位置" : "Drag — Move the map center"}
        </Card>
      </div>

      <SectionTitle>{L ? "點擊互動" : "CLICK INTERACTIONS"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card title={L ? "點擊飛機光球" : "Click Flight Orb"}>
          {L
            ? "顯示航班浮動資訊卡：航班號（callsign）、起降機場、飛行高度。再次點擊其他位置可關閉。"
            : "Shows a floating info card with callsign, departure/arrival airports, and altitude. Click elsewhere to dismiss."}
        </Card>
        <Card title={L ? "點擊列車光球" : "Click Train Orb"}>
          {L
            ? "顯示列車浮動資訊卡：列車編號、所屬系統（THSR / TRA / Metro 等）、行駛狀態與座標。"
            : "Shows a floating info card with train ID, system (THSR / TRA / Metro, etc.), running status, and coordinates."}
        </Card>
      </div>

      <SectionTitle>{L ? "右上角工具列" : "TOP-RIGHT TOOLBAR"}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        <Card title={L ? "底圖樣式 ▾" : "Map Style ▾"}>
          {L
            ? "下拉選單切換 6 種 Mapbox 底圖：Dark · Light · Satellite · Satellite Streets · Navigation Night · Streets"
            : "Dropdown to switch between 6 Mapbox styles: Dark · Light · Satellite · Satellite Streets · Navigation Night · Streets"}
        </Card>
        <Card title="Capture">
          {L
            ? <>進入拍攝模式 — 畫面加上電影感暗角（vignette）、標題和時間戳記。按 <KeyBadge>ESC</KeyBadge> 退出拍攝模式。</>
            : <>Enter capture mode — adds a cinematic vignette, title overlay, and timestamp. Press <KeyBadge>ESC</KeyBadge> to exit.</>
          }
        </Card>
        <Card title="3D / 2D">
          {L
            ? <><b>3D Altitude</b>：航線依實際高度呈現弧線 + Three.js 光球。<b>2D Flat</b>：所有運具投影到平面上。</>
            : <><b>3D Altitude</b>: Flight arcs rendered at actual altitude with Three.js orbs. <b>2D Flat</b>: All vehicles projected onto a flat plane.</>
          }
        </Card>
        <Card title="Info">
          {L ? "開啟此說明面板（你正在看的就是它）。" : "Opens this info panel (you're looking at it right now)."}
        </Card>
      </div>

      <SectionTitle>{L ? "地點跳轉" : "LOCATION JUMP"}</SectionTitle>
      <Card>
        {L
          ? <>右上角底圖樣式左側有 <b>地點選單</b>，可快速飛行到台灣 14 座機場的預設視角（動畫 2 秒）。包含：桃園 TPE · 松山 TSA · 高雄 KHH · 台中 RMQ · 花蓮 HUN · 台東 TTT · 台南 TNN · 嘉義 CYI · 金門 KNH · 馬祖南竿 LZN · 北竿 MFK · 澎湖 MZG · 七美 CMJ · 綠島 GNI。</>
          : <>A <b>location dropdown</b> next to the style selector lets you fly to preset views of Taiwan's 14 airports (2-second animation). Includes: Taoyuan TPE · Songshan TSA · Kaohsiung KHH · Taichung RMQ · Hualien HUN · Taitung TTT · Tainan TNN · Chiayi CYI · Kinmen KNH · Matsu Nangan LZN · Beigan MFK · Penghu MZG · Qimei CMJ · Green Island GNI.</>
        }
      </Card>

      <SectionTitle>{L ? "時間軸控制（底部）" : "TIMELINE CONTROLS (BOTTOM)"}</SectionTitle>
      <Card>
        {L ? "畫面底部的時間軸以日期為中心，控制航班 / 船舶 / 列車的播放時間：" : "The date-centric timeline at the bottom controls playback time for flights, ships, and trains:"}
        <div style={{ marginTop: 6 }}>
          <ParamRow label={L ? "日期導航" : "Date Nav"} desc={L ? "◀ ▶ 切換日期，點擊日期可展開日期選擇器" : "◀ ▶ to switch dates, click the date to open a date picker"} />
          <ParamRow label="Now" desc={L ? "跳至今日（Live 模式）" : "Jump to today (Live mode)"} />
          <ParamRow label={L ? "範圍" : "Range"} desc={L ? "1d / 3d / 7d 控制瀏覽天數" : "1d / 3d / 7d to control the browsing range"} />
          <ParamRow label="▶ / ⏸" desc={L ? "播放或暫停時間推進" : "Play or pause time progression"} />
          <ParamRow label={L ? "速度" : "Speed"} desc={L ? "可選 30x · 60x · 120x · 300x · 600x · 1800x · 3600x 加速倍率" : "Choose from 30x · 60x · 120x · 300x · 600x · 1800x · 3600x acceleration"} />
          <ParamRow label={L ? "滑桿" : "Slider"} desc={L ? "拖曳跳轉到資料時間範圍內的任意時刻" : "Drag to jump to any moment within the data time range"} />
        </div>
      </Card>

      <SectionTitle>{L ? "你會看到" : "WHAT YOU'LL SEE"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card title={L ? "航班 Flights" : "Flights"} accentColor="#64aaff">
          {L
            ? "3D 弧線 + 飛行光球 + 彗尾光軌。弧線高度依實際飛行高度計算，暗色主題下依高度著色（暖橘→冷藍）。點擊光球可查看航班資訊。"
            : "3D arcs + flight orbs + comet-like light trails. Arc height follows actual altitude; in dark theme, colored by altitude (warm orange → cool blue). Click an orb to view flight info."}
        </Card>
        <Card title={L ? "船舶 Ships" : "Ships"} accentColor="#1ad9e5">
          {L
            ? "青藍色光球標示船舶位置 + 半透明拖尾線顯示航跡（30 分鐘遞延）。資料範圍為台灣周邊海域。"
            : "Cyan-blue orbs mark ship positions + translucent trailing lines show tracks (30-minute fade). Data covers Taiwan's surrounding waters."}
        </Card>
        <Card title={L ? "列車 Trains" : "Trains"} accentColor="#ee6c00">
          {L
            ? "高鐵 · 台鐵 · 捷運 · 輕軌共 6 個系統即時模擬。列車光球沿軌道行進，各系統以不同顏色區分。點擊光球可查看列車資訊。"
            : "6 rail systems (THSR · TRA · Taipei/Kaohsiung/Taichung Metro · Kaohsiung LRT) simulated in real-time. Train orbs move along tracks, each system color-coded. Click an orb to view train info."}
        </Card>
      </div>

      <SectionTitle>{L ? "手機版操作" : "MOBILE UI"}</SectionTitle>
      <Card>
        {L
          ? <>螢幕寬度 768px 以下自動切換手機版 UI。底部有<b>拖曳面板</b>，點擊把手可在三種高度間循環：收合 → 半開（圖層列表）→ 全開（含底圖切換和地點跳轉）。</>
          : <>Screen width below 768px automatically switches to mobile UI. A <b>bottom sheet</b> cycles through three heights on tap: collapsed → half (layer list) → full (including style selector and location jump).</>
        }
      </Card>
    </div>
  );
}

function FeatureLegendPage({ lang }: { lang: Lang }) {
  const L = lang === "zh";

  const flightParams = [
    { label: "Alt ×", zh: "高度誇張倍率（1~5）。數值越大，航線弧線越高聳誇張，適合遠景觀賞。", en: "Altitude exaggeration (1–5). Higher values make flight arcs taller, ideal for distant viewing." },
    { label: "Z offset", zh: "基準高度偏移（0~200m）。讓弧線整體往上抬升，避免低空航線貼地。", en: "Base altitude offset (0–200m). Lifts all arcs upward to prevent low-altitude flights from clipping the ground." },
    { label: "Opacity", zh: "靜態軌跡線透明度（0.02~0.5）。數值越大，歷史航線越明顯。", en: "Static trail opacity (0.02–0.5). Higher values make historical flight paths more visible." },
    { label: "Orb", zh: "飛行光球大小。數值越大，光球越醒目，適合遠距離觀看。", en: "Flight orb size. Larger values make orbs more visible from a distance." },
    { label: "APT", zh: "機場區域填充透明度（0~0.3）。控制機場邊界底色的深淺。", en: "Airport fill opacity (0–0.3). Controls the intensity of airport boundary shading." },
    { label: "Glow", zh: "機場光暈強度（0~2）。讓機場周圍散發光暈效果，數值越大越明亮。", en: "Airport glow intensity (0–2). Creates a glow effect around airports; higher values are brighter." },
  ];

  const shipParams = [
    { label: "Ship Orb", zh: "船舶光球大小。增大可在低 zoom 時更容易看見。", en: "Ship orb size. Increase to make ships more visible at low zoom levels." },
    { label: "Ship Trail", zh: "拖尾線透明度（0.05~1）。控制航跡線的醒目程度。", en: "Trail opacity (0.05–1). Controls how prominent the ship's track line appears." },
  ];

  const railParams = [
    { label: "Train", zh: "列車光球開關（ON/OFF）。關閉後只看軌道線，不顯示列車。", en: "Train orb toggle (ON/OFF). When off, only track lines are shown without trains." },
    { label: "Track", zh: "軌道渲染模式（2D / 3D）。2D 為 Mapbox 平面線條，3D 為 Three.js 立體軌道。", en: "Track rendering mode (2D/3D). 2D uses flat Mapbox lines; 3D uses Three.js elevated tracks." },
    { label: "Rail Z", zh: "軌道 Z 軸偏移（0~500m）。3D 模式下控制軌道漂浮的高度。", en: "Track Z-axis offset (0–500m). Controls the floating height of tracks in 3D mode." },
    { label: "Rail Orb", zh: "列車光球大小。增大讓列車在地圖上更顯眼。", en: "Train orb size. Increase to make trains more prominent on the map." },
    { label: "Rail Trk", zh: "軌道線透明度（0.05~1）。控制軌道路線的醒目程度。", en: "Track line opacity (0.05–1). Controls how prominent track lines appear." },
  ];

  const stationParams = [
    { label: "Stn", zh: "車站圓環大小（0.3~3x）。放大讓車站在低 zoom 時更清晰。", en: "Station circle size (0.3–3×). Enlarge for better visibility at low zoom." },
    { label: "Pillar", zh: "3D 光柱開關（ON/OFF）。關閉後只顯示平面標記，不顯示立體光柱。", en: "3D pillar toggle (ON/OFF). When off, only flat markers are shown." },
    { label: "Height", zh: "光柱高度倍率（0.2~3x）。數值越大，光柱越高聳，停靠差異越明顯。", en: "Pillar height multiplier (0.2–3×). Higher values amplify the difference between stations." },
  ];

  const lighthouseParams = [
    { label: "LH", zh: "燈塔標記大小（0.3~3x）。", en: "Lighthouse marker size (0.3–3×)." },
    { label: "Beam", zh: "光束開關（ON/OFF）。控制 3D 旋轉光束是否顯示。", en: "Beam toggle (ON/OFF). Controls whether the 3D rotating beam is visible." },
    { label: "Dist", zh: "光束投射距離（0.2~3）。數值越大，光束在地圖上延伸越遠。", en: "Beam projection distance (0.2–3). Higher values extend the beam further on the map." },
    { label: "Opa", zh: "光束透明度（0.05~0.8）。控制光束的醒目程度。", en: "Beam opacity (0.05–0.8). Controls beam visibility." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: 0 }}>
        {L
          ? <>左側面板包含 <b>23 個圖層</b>，分為 10 大分類。每個圖層有 <b>圓形開關</b> 控制可見性。帶 <b>▸ 三角形</b> 的圖層可展開參數面板，拖曳 slider 即時調整視覺效果。</>
          : <>The left panel contains <b>23 layers</b> organized into 10 categories. Each layer has a <b>circle toggle</b> for visibility. Layers with a <b>▸ triangle</b> can expand a parameter panel — drag sliders to adjust visuals in real-time.</>
        }
      </p>

      {/* MOVING */}
      <SectionTitle>MOVING — {L ? "動態運具" : "Moving Vehicles"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "航班 Flight" : "Flight"} accentColor="#64aaff">
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? <>3D 弧線 + 光球 + 彗尾光軌。支援 <b>Live Status</b>（只看光球）與 <b>Trails</b>（含完整軌跡線）兩種模式切換。</>
              : <>3D arcs + orbs + comet trails. Supports <b>Live Status</b> (orbs only) and <b>Trails</b> (with full flight paths) mode toggle.</>
            }
          </div>
          <ExpandableParams lang={lang} items={flightParams} />
        </Card>

        <Card title={L ? "船舶 Ship" : "Ship"} accentColor="#1ad9e5">
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L ? "InstancedMesh 光球 + 拖尾線，顯示台灣周邊海域的船舶動態。" : "InstancedMesh orbs + trailing lines, showing ship movements around Taiwan's waters."}
          </div>
          <ExpandableParams lang={lang} items={shipParams} />
        </Card>

        <Card title={L ? "鐵道 Rail" : "Rail"} accentColor="#ee6c00">
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "6 個軌道系統（台鐵 · 高鐵 · 台北/高雄/台中捷運 · 高雄輕軌）的列車即時位置。"
              : "Real-time train positions across 6 rail systems (TRA · THSR · Taipei/Kaohsiung/Taichung Metro · Kaohsiung LRT)."}
          </div>
          <ExpandableParams lang={lang} items={railParams} />
        </Card>
      </div>

      {/* NEWS */}
      <SectionTitle>NEWS — {L ? "新聞" : "News"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "新聞事件 News" : "News Events"} accentColor="#ff9800">
          <div style={{ color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。顯示中央通訊社 CNA RSS 新聞事件的地理標記，透過 Gemini API 自動地理編碼。主要新聞以較大橘色圓點顯示，次要新聞以較小灰色圓點顯示。點擊可查看新聞標題、摘要、分類與連結。"
              : "Off by default. Shows CNA RSS news events as geographic markers, auto-geocoded via Gemini API. Primary news shown as larger orange dots, secondary as smaller gray dots. Click to view title, summary, category, and link."}
          </div>
        </Card>
      </div>

      {/* STATION */}
      <SectionTitle>STATION — {L ? "站點標記" : "Station Markers"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "高鐵站 / 台鐵站 / 捷運站" : "THSR / TRA / Metro Stations"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "三種車站各自獨立控制。大站以 Polygon 渲染邊界，小站以圓環標記。3D 模式下支援光柱效果，光柱高度代表該站每日停靠次數。"
              : "Three station types independently controlled. Large stations rendered as polygon boundaries, small ones as circle markers. 3D mode supports light pillars — pillar height represents daily stop count."}
          </div>
          <ExpandableParams lang={lang} items={stationParams} />
        </Card>

        <Card title={L ? "市區公車站 / 公路客運站" : "City Bus / Intercity Bus Stations"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L ? "預設關閉。開啟後以小圓點顯示全台公車站點分佈。" : "Off by default. When enabled, shows bus stop distribution as small dots across Taiwan."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Bus", zh: "圓點大小（0.3~3x）。放大讓高密度城市區域的站點更可辨識。", en: "Dot size (0.3–3×). Enlarge to make stops in high-density urban areas more distinguishable." },
          ]} />
        </Card>

        <Card title={L ? "公共腳踏車 Bike" : "Public Bike"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L ? "預設關閉。顯示全台 YouBike 等公共腳踏車站點位置。" : "Off by default. Shows YouBike and other public bike station locations across Taiwan."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Bike", zh: "圓點大小（0.3~3x）。", en: "Dot size (0.3–3×)." },
          ]} />
        </Card>
      </div>

      {/* ROUTE */}
      <SectionTitle>ROUTE — {L ? "路徑" : "Routes"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "國道 Highway / 省道 Prov.Road" : "Highway / Provincial Road"}>
          <div style={{ color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。國道以紅色線條顯示，省道以橘色線條顯示，寬度隨 zoom 層級自動調整。純開關，無額外可調參數。"
              : "Off by default. Highways shown in red, provincial roads in orange. Line width auto-adjusts with zoom level. Toggle only, no adjustable parameters."}
          </div>
        </Card>
        <Card title={L ? "自行車道 Cycling" : "Cycling Routes"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L ? "預設關閉。以綠色線條顯示全台自行車專用道。" : "Off by default. Shows cycling paths across Taiwan in green."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Cycling", zh: "線條寬度倍率（0.3~3x）。", en: "Line width multiplier (0.3–3×)." },
          ]} />
        </Card>
      </div>

      {/* INFRA */}
      <SectionTitle>INFRA — {L ? "基礎設施" : "Infrastructure"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "碼頭 Port / 機場 Airport" : "Port / Airport"}>
          <div style={{ color: S.text, fontSize: 12 }}>
            {L
              ? "港口與機場以 Polygon 邊界 + 光暈效果顯示。機場的透明度和光暈可透過航班面板的 APT / Glow 調整。碼頭為純開關。"
              : "Ports and airports rendered as polygon boundaries with glow effects. Airport opacity and glow are adjustable via the Flight panel's APT / Glow. Ports are toggle only."}
          </div>
        </Card>
        <Card title={L ? "燈塔 Lighthouse" : "Lighthouse"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? <>全台 36 座燈塔位置，3D 模式下附帶<b>旋轉錐形光束</b>動畫效果。</>
              : <>All 36 lighthouses in Taiwan. In 3D mode, features an animated <b>rotating cone-shaped beam</b>.</>
            }
          </div>
          <ExpandableParams lang={lang} items={lighthouseParams} />
        </Card>
      </div>

      {/* MONITOR */}
      <SectionTitle>MONITOR — {L ? "監測" : "Monitoring"}</SectionTitle>
      <Card title={L ? "國道壅塞 Congestion" : "Freeway Congestion"}>
        <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
          {L
            ? "預設關閉。以色彩編碼顯示國道各路段壅塞程度（顏色從資料欄位取得）。"
            : "Off by default. Color-coded display of freeway congestion levels (colors derived from data fields)."}
        </div>
        <ExpandableParams lang={lang} items={[
          { label: "Freeway", zh: "線條寬度倍率（0.3~3x）。放大讓壅塞路段更醒目。", en: "Line width multiplier (0.3–3×). Increase to make congested segments more visible." },
        ]} />
      </Card>

      {/* ANALYTICS */}
      <SectionTitle>ANALYTICS — {L ? "分析" : "Analytics"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "人流模擬 Pop. Flow" : "Population Flow Simulation"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。以六角形網格顯示全台日間/夜間人流分布。色階：日間 Plasma（深靛→亮黃）、夜間 Viridis（深紫→亮黃），感知均勻、色盲友善。Zoom 自動切換網格精度。"
              : "Off by default. Displays day/night population flow distribution across Taiwan using hexagonal grids. Color scales: day = Plasma (indigo → yellow), night = Viridis (purple → yellow), perceptually uniform and colorblind-safe. Grid resolution auto-switches by zoom level."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Opacity", zh: "六角格填充不透明度（0.1~1）。", en: "Hexagon fill opacity (0.1–1)." },
            { label: "Contrast", zh: "Gamma 對比度（0.5~4）。越大高人流區域越突出、低人流越暗。", en: "Gamma contrast (0.5–4). Higher values make high-flow areas pop while suppressing low-flow regions." },
            { label: "3D", zh: "切換 2D 平面填充 / 3D 柱狀高度模式。", en: "Toggle between 2D flat fill and 3D extruded column mode." },
            { label: "Height", zh: "3D 模式下柱狀高度倍率（10~200）。", en: "Column height multiplier in 3D mode (10–200)." },
            { label: "Metric", zh: "切換日間人流（Day）/ 夜間人流（Night）。兩者共用高度基準，可直接比對差異。", en: "Switch between day and night flow. Both share the same height baseline for direct comparison." },
          ]} />
        </Card>
        <Card title={L ? "人口數 Population" : "Population Count"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。以六角形網格顯示全台村里總人口密度。資料來源：SEGIS 社會經濟統計地理資訊網（114 年 6 月，7,748 村里）。色階：Inferno（深黑→紫紅→橘黃→亮黃白），log1p 正規化適合重尾分布。"
              : "Off by default. Displays village-level total population density using hexagonal grids. Source: SEGIS (2025/06, 7,748 villages). Color scale: Inferno (black → purple-red → orange → bright yellow-white), log1p normalization for heavy-tailed distribution."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Opacity", zh: "六角格填充不透明度（0.1~1）。", en: "Hexagon fill opacity (0.1–1)." },
            { label: "Contrast", zh: "Gamma 對比度（0.5~4）。越大高密度區域越突出。", en: "Gamma contrast (0.5–4). Higher values make dense areas pop." },
            { label: "3D", zh: "切換 2D 平面填充 / 3D 柱狀高度模式。", en: "Toggle between 2D flat fill and 3D extruded column mode." },
            { label: "Height", zh: "3D 模式下柱狀高度倍率（10~200）。", en: "Column height multiplier in 3D mode (10–200)." },
          ]} />
        </Card>
        <Card title={L ? "人口指標 Indicators" : "Population Indicators"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。9 項村里人口衍生指標，分三類：數量（戶數/男/女）、結構（性別比/每戶人數）、負擔（扶養比/扶幼比/扶老比/老化指數）。數量指標 log 正規化，比率指標 linear 正規化。比率欄位以人口加權平均聚合至 H3 網格。"
              : "Off by default. 9 derived demographic indicators in 3 categories: Count (households/male/female), Structure (sex ratio/persons per household), Burden (dependency/child dependency/elderly dependency/aging index). Count metrics use log normalization, ratio metrics use linear normalization. Ratios are population-weighted when aggregated to H3 grids."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Category", zh: "指標分類：數量 Count / 結構 Struct / 負擔 Burden。切換時自動 reset Metric 為該類第一項。", en: "Indicator category: Count / Struct / Burden. Switching auto-resets Metric to the first item in that category." },
            { label: "Metric", zh: "依 Category 動態顯示可選指標。數量類：戶數 HH · 男 M · 女 F；結構類：性別比 Sex · 每戶 PPH；負擔類：扶養 Dep · 扶幼 Child · 扶老 Elder · 老化 Aging。", en: "Dynamically shows available metrics based on Category. Count: HH · M · F; Struct: Sex · PPH; Burden: Dep · Child · Elder · Aging." },
            { label: "Opacity", zh: "六角格填充不透明度（0.1~1）。", en: "Hexagon fill opacity (0.1–1)." },
            { label: "Contrast", zh: "Gamma 對比度（0.5~4）。", en: "Gamma contrast (0.5–4)." },
            { label: "3D", zh: "切換 2D 平面填充 / 3D 柱狀高度模式。", en: "Toggle between 2D flat fill and 3D extruded column mode." },
            { label: "Height", zh: "3D 模式下柱狀高度倍率（10~200）。", en: "Column height multiplier in 3D mode (10–200)." },
          ]} />
        </Card>
      </div>

      {/* ENVIRON */}
      <SectionTitle>ENVIRON — {L ? "環境" : "Environment"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title={L ? "氣象站 Weather" : "Weather Stations"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L ? "預設關閉。顯示全台氣象觀測站點位置。" : "Off by default. Shows weather observation station locations across Taiwan."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "Weather", zh: "標記大小（0.3~3x）。", en: "Marker size (0.3–3×)." },
          ]} />
        </Card>
        <Card title={L ? "風場範圍 Wind Farm" : "Wind Farm"}>
          <div style={{ color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。以半透明填充顯示台灣離岸風場規劃範圍。純開關，無額外可調參數。"
              : "Off by default. Shows Taiwan's offshore wind farm planning zones as translucent fills. Toggle only, no adjustable parameters."}
          </div>
        </Card>
        <Card title={L ? "溫度波浪 Temperature" : "Temperature Wave"}>
          <div style={{ marginBottom: 6, color: S.text, fontSize: 12 }}>
            {L
              ? "預設關閉。以 3D 波浪曲面或 2D 色圖顯示台灣溫度場分佈，資料來自中央氣象署 0.03° 格點每小時快照。色盤使用 RdBu 發散色階（深藍→白→深紅），動畫以 vertex lerp 平滑過渡。"
              : "Off by default. Displays Taiwan's temperature field as a 3D wave surface or 2D color map, using hourly snapshots from CWA's 0.03° grid. Uses RdBu diverging color scale (blue → white → red), with smooth vertex lerp animation."}
          </div>
          <ExpandableParams lang={lang} items={[
            { label: "3D", zh: "切換 3D 波浪曲面 / 2D 平面色圖模式。", en: "Toggle between 3D wave surface and 2D flat color map." },
            { label: "Height", zh: "溫度造成的高低起伏振幅（0~400）。", en: "Temperature-driven height amplitude (0–400)." },
            { label: "Z Offset", zh: "整塊曲面的 Z 軸抬升高度（0~1000）。", en: "Z-axis elevation for the entire surface (0–1000)." },
            { label: "Opacity", zh: "曲面透明度（0.1~1）。", en: "Surface opacity (0.1–1)." },
            { label: "Grid", zh: "網格線覆蓋開關。", en: "Grid line overlay toggle." },
          ]} />
        </Card>
      </div>

      {/* 面板操作說明 */}
      <SectionTitle>{L ? "面板操作說明" : "PANEL USAGE"}</SectionTitle>
      <Card>
        <div style={{ color: S.text, fontSize: 12, lineHeight: 1.8 }}>
          {L ? (
            <>
              <b>收合/展開面板</b>：點擊面板左上角 ◀ 收合為窄條，點擊窄條展開。收合狀態下，彩色小點顯示各圖層啟用狀態。<br />
              <b>圓形開關</b>：每個圖層名稱左側的圓圈，點擊切換該圖層的顯示/隱藏。<br />
              <b>展開面板</b>：帶 ▸ 的圖層可點擊名稱或三角形展開參數面板。面板中可拖曳 slider 即時調整參數，點擊 <b>Hide</b> 可同時隱藏該圖層並關閉面板。<br />
              <b>運具計數</b>：MOVING 區塊的三個運具按鈕會顯示當前活躍數量（如 1,523 架航班）。
            </>
          ) : (
            <>
              <b>Collapse/Expand</b>: Click the ◀ button at the top-left to collapse the panel into a narrow strip. Click the strip to expand. Colored dots indicate active layers when collapsed.<br />
              <b>Circle Toggle</b>: The circle to the left of each layer name toggles its visibility on/off.<br />
              <b>Parameter Panel</b>: Layers with ▸ can be expanded by clicking the name or triangle. Drag sliders to adjust parameters in real-time. Click <b>Hide</b> to hide the layer and close the panel.<br />
              <b>Vehicle Count</b>: The three vehicle buttons in the MOVING section display current active counts (e.g., 1,523 flights).
            </>
          )}
        </div>
      </Card>

      {/* 底部資訊列 */}
      <SectionTitle>{L ? "底部資訊列" : "BOTTOM STATUS BAR"}</SectionTitle>
      <Card>
        <div style={{ color: S.text, fontSize: 12, lineHeight: 1.8 }}>
          {L
            ? <>畫面底部顯示：即時運具數量（航班 / 船舶 / 列車各自計數）、以及相機參數 <b>Pitch</b>（俯仰角）· <b>Bearing</b>（方位角）· <b>Zoom</b>（縮放層級）。</>
            : <>The bottom bar displays: real-time vehicle counts (flights / ships / trains), and camera parameters <b>Pitch</b> · <b>Bearing</b> · <b>Zoom</b>.</>
          }
        </div>
      </Card>
    </div>
  );
}

function DataSourcesPage({ lang }: { lang: Lang }) {
  const L = lang === "zh";
  const sources = [
    {
      name: { zh: "航班", en: "Flights" },
      source: "FlightRadar24 (FR24)",
      desc: { zh: "全球航班即時追蹤資料。透過 FR24 API 取得台灣相關航班的飛行軌跡、航班號、機型、高度等資訊。涵蓋全台 14 座機場，每次擷取約 1,500+ 航班。", en: "Global real-time flight tracking data. Flight trajectories, callsigns, aircraft types, and altitudes retrieved via FR24 API for Taiwan-related flights. Covers all 14 airports, ~1,500+ flights per capture." },
      color: "#64aaff",
    },
    {
      name: { zh: "船舶", en: "Ships" },
      source: "AIS (Automatic Identification System)",
      desc: { zh: "船舶自動識別系統。經 ship-gis 專案的 SQLite 資料庫匯出，資料含 MMSI、船名、船型、航向、位置座標等。過濾台灣周邊海域 bounding box，排除 GPS 異常跳躍點。", en: "Automatic Identification System data. Exported from the ship-gis project's SQLite database, containing MMSI, ship names, types, headings, and coordinates. Filtered by Taiwan's surrounding waters bounding box with GPS anomaly removal." },
      color: "#1ad9e5",
    },
    {
      name: { zh: "鐵路", en: "Rail" },
      source: "TDX + OpenStreetMap",
      desc: { zh: "高鐵（THSR）、台鐵（TRA）、台北捷運（TRTC）、高雄捷運（KRTC）、高雄輕軌（KLRT）、台中捷運（TMRT）共 6 個系統。時刻表來自 TDX，軌道 GeoJSON 來自 OpenStreetMap。", en: "6 rail systems: THSR, TRA, TRTC, KRTC, KLRT, TMRT. Timetables from TDX (Transport Data eXchange), track GeoJSON from OpenStreetMap." },
      color: "#ee6c00",
    },
    {
      name: { zh: "氣象", en: "Weather" },
      source: "CWA (Central Weather Administration)",
      desc: { zh: "氣象觀測站位置資料，由中央氣象署開放資料平台取得。", en: "Weather observation station locations from Taiwan's Central Weather Administration open data platform." },
      color: "#4dd0e1",
    },
    {
      name: { zh: "溫度格點", en: "Temperature Grid" },
      source: "CWA (Central Weather Administration)",
      desc: { zh: "中央氣象署小時溫度觀測分析格點（O-A0038-003），0.03° 解析度（~3.3km），120×67 格網。每小時一個 frame，經 data-collectors 收集存入 S3。", en: "Hourly temperature observation analysis grid (O-A0038-003) from CWA, 0.03° resolution (~3.3km), 120×67 grid. One frame per hour, collected by data-collectors and stored in S3." },
      color: "#ff6b35",
    },
    {
      name: { zh: "車站", en: "Stations" },
      source: "OpenStreetMap + TDX",
      desc: { zh: "大站邊界 Polygon 來自 OSM Overpass API，小站 Point 從各系統 GeoJSON 合併（491 站）。車站光柱高度依每日停靠次數正規化預計算（535 站）。公車站位來自 TDX。", en: "Large station boundary polygons from OSM Overpass API, small station points merged from system GeoJSONs (491 stations). Pillar heights precomputed from daily stop counts (535 stations). Bus stops from TDX." },
      color: "#ffa726",
    },
    {
      name: { zh: "基礎設施", en: "Infrastructure" },
      source: L ? "政府開放資料" : "Government Open Data",
      desc: { zh: "燈塔位置（36 座）— 交通部航港局。機場 / 港口邊界 — OSM Overpass API。國道 / 省道路網 — 交通部公路局。離岸風場範圍 — 經濟部能源局。自行車道 — 交通部。公共腳踏車站 — TDX。", en: "Lighthouses (36) — Maritime and Port Bureau. Airport/port boundaries — OSM Overpass API. Highway/provincial road networks — Directorate General of Highways. Offshore wind farms — Bureau of Energy. Cycling routes — MOTC. Public bike stations — TDX." },
      color: "#66bb6a",
    },
    {
      name: { zh: "國道壅塞", en: "Freeway Congestion" },
      source: L ? "交通部公路局" : "Directorate General of Highways",
      desc: { zh: "國道各路段即時壅塞程度資料，以色彩編碼顯示車流狀態。資料來自交通部公路局即時路況系統。", en: "Real-time freeway congestion data by road segment, color-coded to display traffic flow status. Data from the Directorate General of Highways real-time traffic system." },
      color: "#FF6B35",
    },
    {
      name: { zh: "新聞事件", en: "News Events" },
      source: "CNA RSS + Google Gemini API",
      desc: { zh: "中央通訊社 RSS 新聞摘要，透過 Google Gemini API 自動萃取地理座標，標記新聞事件發生地點。區分主要新聞（is_primary）與一般新聞。", en: "CNA RSS news summaries, auto-geocoded via Google Gemini API to mark event locations. Differentiates primary (is_primary) and regular news events." },
      color: "#ff9800",
    },
    {
      name: { zh: "人流模擬", en: "Pop. Flow" },
      source: L ? "內政部最小統計區" : "Ministry of the Interior",
      desc: { zh: "全台最小統計區日夜間人流資料（157,933 區），經六角形網格化後以 Plasma / Viridis 感知均勻色階視覺化。支援多層解析度，Zoom 自動切換。", en: "Day/night population flow data from 157,933 statistical areas, gridded into hexagons and visualized with Plasma/Viridis perceptually uniform color scales. Multi-resolution support with automatic zoom-based switching." },
      color: "#ff6b6b",
    },
    {
      name: { zh: "村里人口指標", en: "Demographics" },
      source: L ? "SEGIS 社會經濟統計地理資訊網（114 年 6 月）" : "SEGIS (Social Economic GIS, 2025/06)",
      desc: { zh: "全台 7,748 村里人口統計，含總人口、戶數、男女人數、性別比、每戶人數、扶養比、扶幼比、扶老比、老化指數共 10 項指標。經 H3 六角形網格化（res7/res8），數量欄位直接分配，比率欄位人口加權平均聚合。Inferno 色階視覺化。", en: "Population statistics for 7,748 villages across Taiwan, including total population, households, male/female counts, sex ratio, persons per household, dependency ratios, and aging index (10 indicators). Gridded to H3 hexagons (res7/res8) with direct distribution for counts and population-weighted averaging for ratios. Visualized with Inferno color scale." },
      color: "#f9bd31",
    },
    {
      name: { zh: "地圖底圖", en: "Base Map" },
      source: "Mapbox GL JS v3",
      desc: { zh: "向量地圖瓦片、3D 地形、衛星影像。提供 Dark / Light / Satellite / Navigation Night 等 6 種底圖樣式。", en: "Vector map tiles, 3D terrain, satellite imagery. 6 map styles available: Dark / Light / Satellite / Satellite Streets / Navigation Night / Streets." },
      color: "#ab47bc",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: "0 0 6px" }}>
        {L
          ? "本專案整合多個即時與開放資料來源，所有資料經腳本擷取、轉換、過濾後呈現："
          : "This project integrates multiple real-time and open data sources, all processed through automated scripts:"}
      </p>
      {sources.map((s) => (
        <Card key={t(s.name, lang)} accentColor={s.color}>
          <div style={{ fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 4 }}>{t(s.name, lang)}</div>
          <div style={{ fontSize: 11, color: S.active, marginBottom: 4 }}>{s.source}</div>
          <div style={{ fontSize: 12, color: S.sub, lineHeight: 1.7 }}>{t(s.desc, lang)}</div>
        </Card>
      ))}
    </div>
  );
}

function ChangelogPage({ lang }: { lang: Lang }) {
  const L = lang === "zh";
  const sorted = [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sorted.map((entry) => (
        <div key={entry.date}>
          <SectionTitle>{entry.date}</SectionTitle>
          <Card title={L ? entry.title.zh : entry.title.en}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {entry.items.map((item, i) => (
                <li key={i}>{L ? item.zh : item.en}</li>
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}

function AboutPage({ lang }: { lang: Lang }) {
  const L = lang === "zh";
  const stats = [
    { num: "1,500+", label: { zh: "航班", en: "Flights" } },
    { num: "1,000+", label: { zh: "船舶", en: "Ships" } },
    { num: "300+", label: { zh: "列車", en: "Trains" } },
    { num: "6", label: { zh: "軌道系統", en: "Rail Systems" } },
    { num: "14", label: { zh: "機場", en: "Airports" } },
    { num: "535", label: { zh: "車站光柱", en: "Station Pillars" } },
    { num: "36", label: { zh: "燈塔", en: "Lighthouses" } },
    { num: "23", label: { zh: "地圖圖層", en: "Map Layers" } },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 18, color: S.text, margin: "0 0 10px", letterSpacing: 1 }}>Mini Taiwan Pulse</h2>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: S.text, margin: 0 }}>
          {L ? "用開放資料，感受台灣的脈動。" : "Feel Taiwan's pulse through open data."}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: S.sub, margin: "8px 0 0" }}>
          {L
            ? "天空中的航班劃出弧線、海面上的船舶穿梭往返、軌道上的列車準時奔馳 — 這座島嶼每一刻都在呼吸。Mini Taiwan Pulse 將這些交通運輸的即時動態，以 3D 光球、光軌、拖尾線呈現在同一張地圖上，讓你看見台灣的脈搏。"
            : "Flights tracing arcs across the sky, ships navigating coastal waters, trains running on time along their tracks — this island breathes every moment. Mini Taiwan Pulse renders all this transportation activity as 3D orbs, light trails, and glowing paths on a single interactive map, letting you see Taiwan's heartbeat."}
        </p>
      </div>

      <SectionTitle>{L ? "規模" : "SCALE"}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {stats.map((item) => (
          <div key={t(item.label, lang)} style={{
            background: S.cardBg, border: `1px solid ${S.cardBorder}`, borderRadius: 8,
            padding: "12px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: S.active }}>{item.num}</div>
            <div style={{ fontSize: 11, color: S.sub, marginTop: 2 }}>{t(item.label, lang)}</div>
          </div>
        ))}
      </div>

      <SectionTitle>{L ? "技術堆疊" : "TECH STACK"}</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["React 19", "TypeScript", "Vite", "Mapbox GL JS v3", "Three.js r172", "GLSL Shaders", "WebGL", "Docker", "AWS S3"].map((x) => (
          <Tag key={x}>{x}</Tag>
        ))}
      </div>

      <SectionTitle>{L ? "資料來源" : "DATA SOURCES"}</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["FR24", "AIS", "TDX", "CWA", "OpenStreetMap", "Mapbox", L ? "政府開放資料" : "Gov Open Data"].map((x) => (
          <Tag key={x}>{x}</Tag>
        ))}
      </div>

      <SectionTitle>{L ? "架構亮點" : "ARCHITECTURE"}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card title="Overlay Registry">
          {L
            ? "所有 Mapbox GL 靜態圖層透過配置驅動的 Registry 統一管理，新增圖層只需改 3 個檔案。"
            : "All Mapbox GL static layers managed through a config-driven Registry. Adding a new overlay requires editing only 3 files."}
        </Card>
        <Card title="Three.js CustomLayer">
          {L
            ? "透過 Mapbox CustomLayer 在同一個 WebGL context 中嵌入 Three.js 場景，6 個獨立 CustomLayer 各自管理航班、船舶、軌道、燈塔、車站光柱、溫度波浪的 3D 渲染。"
            : "Three.js scenes embedded in Mapbox via CustomLayer sharing the same WebGL context. 6 independent CustomLayers handle 3D rendering for flights, ships, rail, lighthouses, station pillars, and temperature waves."}
        </Card>
        <Card title={L ? "台鐵專用引擎" : "TRA Dedicated Engine"}>
          {L
            ? "處理 OD 軌道配對、golden track 選擇、彰化三角線等複雜路線的列車運動插值。"
            : "Handles OD track pairing, golden track selection, and complex routing (e.g., Changhua triangle junction) for train motion interpolation."}
        </Card>
        <Card title="Data Source Registry">
          {L
            ? "多資料源時間管理中央註冊表。每個資料源宣告時間類型（track/snapshot/cyclic/static），系統自動計算時間軸聯集範圍、日期可用性、資料覆蓋率。搭配 Data Calendar 面板視覺化。"
            : "Central registry for multi-source timeline management. Each source declares its time type (track/snapshot/cyclic/static), and the system auto-computes timeline union ranges, date availability, and data coverage. Paired with Data Calendar panel for visualization."}
        </Card>
      </div>
    </div>
  );
}

function ProjectCard({ name, desc, screenshot, site, github }: {
  name: string; desc: string; screenshot?: string; site?: string; github: string;
}) {
  return (
    <div style={{
      background: S.cardBg, border: `1px solid ${S.cardBorder}`, borderRadius: 8,
      overflow: "hidden",
    }}>
      {screenshot && (
        <div style={{ width: "100%", height: 120, overflow: "hidden" }}>
          <img src={screenshot} alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      <div style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 11, color: S.sub, marginBottom: 8, lineHeight: 1.5 }}>{desc}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: S.active, textDecoration: "none" }}>
              Live
            </a>
          )}
          <a href={github} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: S.sub, textDecoration: "none" }}>
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ lang }: { lang: Lang }) {
  const L = lang === "zh";

  const projects = [
    {
      name: L ? "Mini-Taiwan 軌道運輸模擬" : "Mini-Taiwan Rail Simulation",
      desc: L ? "台灣軌道運輸即時模擬視覺化" : "Real-time Taiwan rail transit simulation",
      screenshot: "./screenshots/mini-taiwan.png",
      site: "https://mini-taiwan-learning-project.zeabur.app/",
      github: "https://github.com/ianlkl11234s/mini-taiwan-learning-project",
    },
    {
      name: "Taiwan Flight Arc",
      desc: L ? "台灣航班弧線 3D 視覺化" : "Taiwan flight arc 3D visualization",
      screenshot: "./screenshots/taiwan-flight-arc.png",
      site: "https://flight-arc.zeabur.app/",
      github: "https://github.com/ianlkl11234s/flight-arc-graph",
    },
    {
      name: L ? "Taiwan Weather Timelapse 台灣氣象模擬" : "Taiwan Weather Timelapse",
      desc: L ? "台灣氣象時序動畫視覺化" : "Taiwan weather time-series animation",
      screenshot: "./screenshots/weather.png",
      site: "https://taiwan-weather-timelapse.zeabur.app/",
      github: "https://github.com/ianlkl11234s/taiwan-weather-timelapse",
    },
    {
      name: L ? "Ship GIS — 台灣海域船舶動態" : "Ship GIS — Taiwan Maritime Viz",
      desc: L ? "台灣海域船舶動態視覺化平台" : "Taiwan maritime vessel visualization platform",
      github: "https://github.com/ianlkl11234s/tw-ship-viz",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Avatar + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src="./screenshots/頭貼.jpg" alt="Migu"
          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: S.text }}>Migu</div>
          <div style={{ fontSize: 12, color: S.sub }}>Senior Data Analyst / GIS</div>
        </div>
      </div>

      {/* 社群連結 */}
      <SectionTitle>{L ? "社群連結" : "SOCIAL LINKS"}</SectionTitle>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="https://github.com/ianlkl11234s" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: S.cardBg, border: `1px solid ${S.cardBorder}`, borderRadius: 8, textDecoration: "none", color: S.text, fontSize: 12 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub
        </a>
        <a href="https://www.threads.com/@ianlkl1314" target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: S.cardBg, border: `1px solid ${S.cardBorder}`, borderRadius: 8, textDecoration: "none", color: S.text, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.784 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.346-.789-.96-1.42-1.744-1.838.164 3.1-1.063 5.453-3.693 5.453-1.602 0-2.97-.767-3.652-2.048-.585-1.098-.63-2.545.013-3.878.926-1.916 3.083-2.878 5.29-2.472.1-.612.133-1.266.08-1.952l2.036-.244c.083.87.06 1.693-.06 2.455 1.038.497 1.892 1.2 2.494 2.1.864 1.29 1.196 2.86.96 4.539-.32 2.28-1.462 4.1-3.298 5.272C15.692 23.347 13.718 24 12.186 24zm.512-7.17c.828 0 1.474-.31 1.858-.892.532-.806.56-2.04-.02-2.834-.328-.21-.702-.382-1.126-.506-.078 1.072-.29 2.089-.648 2.983-.137.343-.5 1.25.064 1.25h-.128z"/></svg>
          Threads
        </a>
      </div>

      {/* 其他專案 */}
      <SectionTitle>{L ? "其他專案" : "OTHER PROJECTS"}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {projects.map((p) => (
          <ProjectCard key={p.github} {...p} />
        ))}
      </div>
    </div>
  );
}

/* ── 頁面標題 ── */
const PAGE_TITLES: Record<string, Record<Lang, string>> = {
  "getting-started": { zh: "操作指南", en: "Getting Started" },
  "feature-legend": { zh: "功能圖例", en: "Feature Legend" },
  "data-sources": { zh: "資料來源", en: "Data Sources" },
  "daily-changelog": { zh: "每日更新", en: "Daily Changelog" },
  about: { zh: "關於專案", en: "About" },
  profile: { zh: "個人介紹", en: "Profile" },
};

/* ── 主元件 ── */

export function InfoModal({ open, onClose, isMobile }: InfoModalProps) {
  const [activeTab, setActiveTab] = useState<BottomTab>("guide");
  const [guidePage, setGuidePage] = useState<GuidePage>("getting-started");
  const [lang, setLang] = useState<Lang>("zh");

  if (!open) return null;

  const currentPageKey = activeTab === "guide" ? guidePage : activeTab;
  const title = PAGE_TITLES[currentPageKey]?.[lang] ?? "";

  const guideSubNav: { key: GuidePage; label: Record<Lang, string> }[] = [
    { key: "getting-started", label: { zh: "操作指南", en: "Getting Started" } },
    { key: "feature-legend", label: { zh: "功能圖例", en: "Feature Legend" } },
    { key: "data-sources", label: { zh: "資料來源", en: "Data Sources" } },
    { key: "daily-changelog", label: { zh: "每日更新", en: "Changelog" } },
  ];

  const bottomTabs: { key: BottomTab; label: Record<Lang, string> }[] = [
    { key: "guide", label: { zh: "指南", en: "Guide" } },
    { key: "about", label: { zh: "關於", en: "About" } },
    { key: "profile", label: { zh: "個人", en: "Profile" } },
  ];

  function renderContent() {
    if (activeTab === "guide") {
      switch (guidePage) {
        case "getting-started": return <GettingStartedPage lang={lang} />;
        case "feature-legend": return <FeatureLegendPage lang={lang} />;
        case "data-sources": return <DataSourcesPage lang={lang} />;
        case "daily-changelog": return <ChangelogPage lang={lang} />;
      }
    }
    if (activeTab === "about") return <AboutPage lang={lang} />;
    if (activeTab === "profile") return <ProfilePage lang={lang} />;
    return null;
  }

  function renderSidebar() {
    return (
      <div style={{
        width: 200, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        borderRight: `1px solid ${S.border}`,
        padding: "20px 0",
      }}>
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 11, color: S.label, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>
            {lang === "zh" ? "使用指南" : "User Guide"}
          </div>
          {activeTab === "guide" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {guideSubNav.map((item) => (
                <button key={item.key} onClick={() => setGuidePage(item.key)}
                  style={{
                    background: guidePage === item.key ? "rgba(100,170,255,0.12)" : "transparent",
                    border: "none", borderRadius: 6, padding: "8px 12px", textAlign: "left",
                    color: guidePage === item.key ? S.active : S.sub,
                    fontSize: 12, fontFamily: S.font, cursor: "pointer", transition: "all 0.15s",
                  }}>
                  {item.label[lang]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {bottomTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? "rgba(100,170,255,0.12)" : "transparent",
                border: "none", borderRadius: 6, padding: "8px 12px", textAlign: "left",
                color: activeTab === tab.key ? S.active : S.sub,
                fontSize: 12, fontFamily: S.font, cursor: "pointer",
                fontWeight: activeTab === tab.key ? 600 : 400, transition: "all 0.15s",
              }}>
              {tab.label[lang]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderMobileNav() {
    return (
      <div style={{ borderBottom: `1px solid ${S.border}`, padding: "12px 16px 0" }}>
        <div style={{ display: "flex", gap: 0 }}>
          {bottomTabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, background: "transparent", border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${S.active}` : "2px solid transparent",
                padding: "8px 0", color: activeTab === tab.key ? S.active : S.sub,
                fontSize: 12, fontFamily: S.font, cursor: "pointer",
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}>
              {tab.label[lang]}
            </button>
          ))}
        </div>
        {activeTab === "guide" && (
          <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
            {guideSubNav.map((item) => (
              <button key={item.key} onClick={() => setGuidePage(item.key)}
                style={{
                  flex: 1, background: "transparent", border: "none",
                  borderBottom: guidePage === item.key ? `2px solid ${S.active}` : "2px solid transparent",
                  padding: "6px 0", color: guidePage === item.key ? S.active : S.sub,
                  fontSize: 11, fontFamily: S.font, cursor: "pointer",
                }}>
                {item.label[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center", fontFamily: S.font,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: isMobile ? "100vw" : "min(920px, 92vw)",
          height: isMobile ? "92vh" : "min(680px, 88vh)",
          background: S.bg, backdropFilter: "blur(24px)",
          border: isMobile ? "none" : `1px solid ${S.border}`,
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          display: "flex", flexDirection: isMobile ? "column" : "row",
          overflow: "hidden", color: "#fff",
        }}>
        {isMobile ? renderMobileNav() : renderSidebar()}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: isMobile ? "14px 16px" : "20px 28px",
            borderBottom: `1px solid ${S.border}`, flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, letterSpacing: 1, color: S.text }}>{title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${S.border}` }}>
                {(["zh", "en"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    style={{
                      background: lang === l ? "rgba(100,170,255,0.15)" : "transparent",
                      border: "none", padding: "3px 10px",
                      color: lang === l ? S.active : S.sub,
                      fontSize: 11, fontFamily: S.font, cursor: "pointer",
                    }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <button onClick={onClose}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)", border: "none", color: S.sub,
                  fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                ✕
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "24px 28px" }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
