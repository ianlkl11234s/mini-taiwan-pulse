import { useState } from "react";

type BottomTab = "guide" | "about" | "profile";
type GuidePage = "getting-started" | "feature-legend" | "data-sources";
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

/* ── 五個頁面 ── */

function GettingStartedPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: 0 }}>
        歡迎使用 Mini Taiwan Pulse — 以 3D 呈現台灣航班、船舶、鐵道的即時動態視覺化。
      </p>

      <SectionTitle>基本操作</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        <Card title="旋轉">右鍵 + 拖曳</Card>
        <Card title="縮放">滾輪 滾動</Card>
        <Card title="平移">左鍵 + 拖曳</Card>
      </div>

      <SectionTitle>你會看到</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card title="航班 Flights" accentColor="#64aaff">
          即時航班弧線 + 飛行光球，點擊可查看航班資訊，雙擊追蹤
        </Card>
        <Card title="船舶 Ships" accentColor="#1ad9e5">
          AIS 船舶軌跡，附帶航向與船名
        </Card>
        <Card title="列車 Trains" accentColor="#ee6c00">
          高鐵 · 台鐵 · 捷運即時位置，沿軌道路線行進
        </Card>
      </div>
    </div>
  );
}

function FeatureLegendPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle>頂部工具列</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        <Card title="Dark / Light">切換深色/淺色地圖樣式</Card>
        <Card title="Capture">截取當前畫面為 PNG</Card>
        <Card title="3D / 2D">切換 3D 高度模式與 2D 平面模式</Card>
        <Card title="Info">開啟此說明面板</Card>
      </div>

      <SectionTitle>左側面板 — 圖層分類</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Card title="MOVING">航班、船舶、列車等動態運具</Card>
        <Card title="STATION">機場、車站、港口等站點標記</Card>
        <Card title="ROUTE">航線、鐵道路線、航道等路徑</Card>
        <Card title="INFRA">燈塔、腳踏車站等基礎設施</Card>
        <Card title="MONITOR">氣象觀測站即時資料</Card>
        <Card title="ENVIRON">地形、邊界等環境圖層</Card>
      </div>

      <SectionTitle>底部資訊列</SectionTitle>
      <Card>即時運具計數（航班 / 船舶 / 列車）、相機 pitch · bearing · zoom 參數</Card>
    </div>
  );
}

function DataSourcesPage() {
  const sources = [
    { name: "航班", source: "FR24 (Flightradar24)", desc: "全球航班即時追蹤資料" },
    { name: "船舶", source: "AIS", desc: "船舶自動識別系統" },
    { name: "鐵路", source: "TDX (運輸資料流通服務)", desc: "THSR 高鐵 · TRA 台鐵 · Metro 捷運 時刻表" },
    { name: "氣象", source: "CWA (中央氣象署)", desc: "氣象觀測站即時資料" },
    { name: "基礎設施", source: "政府開放資料", desc: "燈塔、公共腳踏車站等" },
    { name: "地圖底圖", source: "Mapbox GL JS", desc: "向量地圖瓦片 + 3D 地形" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: "0 0 6px" }}>
        本專案整合多個即時與開放資料來源：
      </p>
      {sources.map((s) => (
        <Card key={s.name} title={s.name}>
          <span style={{ color: S.active }}>{s.source}</span>
          <span style={{ margin: "0 6px" }}>—</span>
          {s.desc}
        </Card>
      ))}
    </div>
  );
}

function AboutPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: S.text, margin: 0 }}>
        Mini Taiwan Pulse 是一個台灣多運具即時脈動視覺化專案，將航班、船舶、鐵道的動態以 3D 方式呈現於互動地圖上，
        展現台灣交通運輸的即時脈動。
      </p>

      <SectionTitle>技術堆疊</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["React 19", "TypeScript", "Three.js", "Mapbox GL", "WebGL"].map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>

      <SectionTitle>資料來源</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["FR24", "AIS", "TDX", "CWA", "Mapbox", "政府開放資料"].map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
    </div>
  );
}

function ProfilePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Avatar + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #64aaff 0%, #1ad9e5 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 700, color: "#fff",
        }}>
          M
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: S.text }}>Migu</div>
          <div style={{ fontSize: 12, color: S.sub }}>Developer / GIS Enthusiast</div>
        </div>
      </div>

      {/* 社群連結 */}
      <SectionTitle>社群連結</SectionTitle>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="https://github.com/ianlkl11234s/flight-arc-graph"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: S.cardBg, border: `1px solid ${S.cardBorder}`,
            borderRadius: 8, textDecoration: "none", color: S.text, fontSize: 12,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
        <a
          href="https://www.threads.com/@ianlkl1314"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: S.cardBg, border: `1px solid ${S.cardBorder}`,
            borderRadius: 8, textDecoration: "none", color: S.text, fontSize: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.784 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.346-.789-.96-1.42-1.744-1.838.164 3.1-1.063 5.453-3.693 5.453-1.602 0-2.97-.767-3.652-2.048-.585-1.098-.63-2.545.013-3.878.926-1.916 3.083-2.878 5.29-2.472.1-.612.133-1.266.08-1.952l2.036-.244c.083.87.06 1.693-.06 2.455 1.038.497 1.892 1.2 2.494 2.1.864 1.29 1.196 2.86.96 4.539-.32 2.28-1.462 4.1-3.298 5.272C15.692 23.347 13.718 24 12.186 24zm.512-7.17c.828 0 1.474-.31 1.858-.892.532-.806.56-2.04-.02-2.834-.328-.21-.702-.382-1.126-.506-.078 1.072-.29 2.089-.648 2.983-.137.343-.5 1.25.064 1.25h-.128z"/>
          </svg>
          Threads
        </a>
      </div>

      {/* 其他專案 */}
      <SectionTitle>其他專案</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a
          href="https://mini-taiwan-learning-project.zeabur.app/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", padding: "12px 14px",
            background: S.cardBg, border: `1px solid ${S.cardBorder}`,
            borderRadius: 8, textDecoration: "none",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 4 }}>Mini Taiwan</div>
          <div style={{ fontSize: 11, color: S.sub }}>前一代台灣學習專案視覺化</div>
        </a>
        <a
          href="https://github.com/ianlkl11234s/flight-arc-graph"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", padding: "12px 14px",
            background: S.cardBg, border: `1px solid ${S.cardBorder}`,
            borderRadius: 8, textDecoration: "none",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 4 }}>GitHub Repository</div>
          <div style={{ fontSize: 11, color: S.sub }}>flight-arc-graph 原始碼</div>
        </a>
      </div>
    </div>
  );
}

/* ── 頁面標題 ── */
const PAGE_TITLES: Record<string, Record<Lang, string>> = {
  "getting-started": { zh: "操作指南", en: "Getting Started" },
  "feature-legend": { zh: "功能圖例", en: "Feature Legend" },
  "data-sources": { zh: "資料來源", en: "Data Sources" },
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
  ];

  const bottomTabs: { key: BottomTab; label: Record<Lang, string> }[] = [
    { key: "guide", label: { zh: "指南", en: "Guide" } },
    { key: "about", label: { zh: "關於", en: "About" } },
    { key: "profile", label: { zh: "個人", en: "Profile" } },
  ];

  function renderContent() {
    if (activeTab === "guide") {
      switch (guidePage) {
        case "getting-started": return <GettingStartedPage />;
        case "feature-legend": return <FeatureLegendPage />;
        case "data-sources": return <DataSourcesPage />;
      }
    }
    if (activeTab === "about") return <AboutPage />;
    if (activeTab === "profile") return <ProfilePage />;
    return null;
  }

  /* ── Sidebar (desktop) ── */
  function renderSidebar() {
    return (
      <div style={{
        width: 200, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        borderRight: `1px solid ${S.border}`,
        padding: "20px 0",
      }}>
        {/* Top: sub-nav (guide only) */}
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 11, color: S.label, letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>
            使用指南
          </div>
          {activeTab === "guide" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {guideSubNav.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setGuidePage(item.key)}
                  style={{
                    background: guidePage === item.key ? "rgba(100,170,255,0.12)" : "transparent",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    textAlign: "left",
                    color: guidePage === item.key ? S.active : S.sub,
                    fontSize: 12,
                    fontFamily: S.font,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {item.label[lang]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: main tabs */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {bottomTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? "rgba(100,170,255,0.12)" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "8px 12px",
                textAlign: "left",
                color: activeTab === tab.key ? S.active : S.sub,
                fontSize: 12,
                fontFamily: S.font,
                cursor: "pointer",
                fontWeight: activeTab === tab.key ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {tab.label[lang]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Mobile Tab Bar ── */
  function renderMobileNav() {
    return (
      <div style={{ borderBottom: `1px solid ${S.border}`, padding: "12px 16px 0" }}>
        {/* Bottom tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: activeTab === "guide" ? 0 : 0 }}>
          {bottomTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${S.active}` : "2px solid transparent",
                padding: "8px 0",
                color: activeTab === tab.key ? S.active : S.sub,
                fontSize: 12,
                fontFamily: S.font,
                cursor: "pointer",
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label[lang]}
            </button>
          ))}
        </div>

        {/* Sub-tabs for guide */}
        {activeTab === "guide" && (
          <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
            {guideSubNav.map((item) => (
              <button
                key={item.key}
                onClick={() => setGuidePage(item.key)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  borderBottom: guidePage === item.key ? `2px solid ${S.active}` : "2px solid transparent",
                  padding: "6px 0",
                  color: guidePage === item.key ? S.active : S.sub,
                  fontSize: 11,
                  fontFamily: S.font,
                  cursor: "pointer",
                }}
              >
                {item.label[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        fontFamily: S.font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: isMobile ? "100vw" : "min(860px, 90vw)",
          height: isMobile ? "92vh" : "min(620px, 85vh)",
          background: S.bg,
          backdropFilter: "blur(24px)",
          border: isMobile ? "none" : `1px solid ${S.border}`,
          borderRadius: isMobile ? "16px 16px 0 0" : 16,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          overflow: "hidden",
          color: "#fff",
        }}
      >
        {/* Desktop sidebar / Mobile top nav */}
        {isMobile ? renderMobileNav() : renderSidebar()}

        {/* Content area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: isMobile ? "14px 16px" : "20px 28px",
            borderBottom: `1px solid ${S.border}`,
            flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, letterSpacing: 1, color: S.text }}>
              {title}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Lang toggle */}
              <div style={{
                display: "flex", borderRadius: 6, overflow: "hidden",
                border: `1px solid ${S.border}`,
              }}>
                {(["zh", "en"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      background: lang === l ? "rgba(100,170,255,0.15)" : "transparent",
                      border: "none",
                      padding: "3px 10px",
                      color: lang === l ? S.active : S.sub,
                      fontSize: 11,
                      fontFamily: S.font,
                      cursor: "pointer",
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  border: "none", color: S.sub,
                  fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: isMobile ? "16px" : "24px 28px",
          }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
