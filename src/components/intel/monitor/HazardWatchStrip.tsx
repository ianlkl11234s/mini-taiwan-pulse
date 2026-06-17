/**
 * 災防觀測 HAZARD WATCH —— 與 LiveWall 風格一致但獨立的並排區塊
 *
 * 放兩個與災防直接相關的 24h 直播：
 *   - 台灣地震監視 KyT4qSK8lJo（地震速報 / 強震即時警報）
 *   - 台灣颱風論壇 LzOTY4mZG00（天氣即時監測 + 颱風）
 *
 * 不走 collector — 直接寫死 video_id（這兩個都是長年穩定、官方公開 embed）。
 * 樣式 1:1 對齊 LiveWall 的 16:9 容器 + LIVE badge + 邊框。
 */

import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";

interface HazardCh {
  videoId: string;
  name: string;
  en: string;
  hint: string;
}

const HAZARD_CHANNELS: HazardCh[] = [
  {
    videoId: "KyT4qSK8lJo",
    name: "台灣地震監視",
    en: "EQ MONITOR",
    hint: "地震速報 · 強震即時警報",
  },
  {
    videoId: "LzOTY4mZG00",
    name: "台灣颱風論壇",
    en: "WEATHER LIVE",
    hint: "氣溫 · 雨量 · 雷達 · 颱風",
  },
];

function embedSrc(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`;
}

function HazardSlot({ ch }: { ch: HazardCh }) {
  return (
    <div
      style={{
        position: "relative", borderRadius: 8, overflow: "visible",
        aspectRatio: "16 / 9", background: "#000",
        border: "1px solid rgba(255,152,0,0.45)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden" }}>
        <iframe
          title={ch.name}
          src={embedSrc(ch.videoId)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            border: "none", display: "block",
          }}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />

        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 8px", pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(0,0,0,0.7), transparent)",
          }}
        >
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 6px", borderRadius: 3,
              background: "rgba(255,152,0,0.95)",
            }}
          >
            <span
              style={{
                width: 5, height: 5, borderRadius: "50%", background: "#fff",
                animation: "intelRing 1.6s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: 8.5, fontWeight: 700,
                color: "#04121f", letterSpacing: "0.5px",
              }}
            >
              LIVE
            </span>
          </span>
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: 11, fontWeight: 700, color: "#fff",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {ch.name}
          </span>
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 8.5, color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.5px",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            }}
          >
            {ch.en}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute", bottom: 7, left: 8, right: 8,
          display: "flex", alignItems: "center", gap: 8, zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 5,
            background: "rgba(0,0,0,0.72)",
            border: `1px solid ${COLORS.borderMid}`,
            fontFamily: FONT_CJK, fontSize: 10,
            color: COLORS.textDefault,
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          }}
        >
          {ch.hint}
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 8, color: "rgba(255,255,255,0.55)",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          🔇 點擊解除靜音
        </span>
      </div>
    </div>
  );
}

export function HazardWatchStrip() {
  return (
    <div
      style={{
        gridColumn: "1 / -1", borderRadius: 9,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,152,0,0.04)",
        padding: 13, display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <span style={{ width: 3, height: 12, borderRadius: 2, background: COLORS.statusWarn }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: 10, letterSpacing: "1.5px",
            color: COLORS.textDefault,
          }}
        >
          災防觀測 · HAZARD WATCH
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_CJK, fontSize: 9, color: COLORS.textFaint }}>
          地震 + 天氣 · 24h 監測
        </span>
      </div>

      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        }}
      >
        {HAZARD_CHANNELS.map((ch) => (
          <HazardSlot key={ch.videoId} ch={ch} />
        ))}
      </div>
    </div>
  );
}
