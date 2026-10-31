import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { useLocale } from "../state/localeStore";
import type { MessageKey } from "../i18n/keys";

interface Props {
  /** VideoStreamURL — MJPEG 串流（freeway/highway/部分 city）或 HTML 播放頁（北市/桃園/台中等 city） */
  streamUrl: string;
  /** VideoImageURL — 部分 highway/city 提供的靜態快照，當 img 來源時優先 */
  imageUrl?: string;
  /** freeway / highway / city — 目前僅作 debug/未來分流用，逐支仍以 runtime fallback 為準 */
  source?: string;
  /** popup 主色，沿用各 panel 的 accent */
  accentColor: string;
}

/** 已確認帶 X-Frame-Options: SAMEORIGIN 的 host，iframe 會被瀏覽器擋掉，直接走文字 fallback */
const XFO_BLOCKLIST = ["atis.ntpc.gov.tw"];

/** 私網 IP host（外部無法存取） */
const PRIVATE_IP_RE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

type Stage = "img" | "iframe" | "text";

interface Decision {
  /** 是否一開始就確定無法內嵌（直接文字）：i18n key */
  blockedReason: MessageKey | null;
  /** img 來源（imageUrl 優先，否則 streamUrl） */
  imgSrc: string;
  /** iframe host 是否在黑名單 */
  iframeBlocked: boolean;
  host: string;
}

function decide(streamUrl: string, imageUrl: string | undefined): Decision {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  let host = "";
  try {
    host = new URL(streamUrl).hostname;
  } catch {
    host = "";
  }

  let blockedReason: MessageKey | null = null;
  if (streamUrl.startsWith("wss://")) {
    blockedReason = "popup.infra.cctvBlockedWebsocket";
  } else if (isHttps && streamUrl.startsWith("http://")) {
    blockedReason = "popup.infra.cctvBlockedHttp";
  } else if (PRIVATE_IP_RE.test(host)) {
    blockedReason = "popup.infra.cctvBlockedPrivate";
  }

  return {
    blockedReason,
    imgSrc: imageUrl && imageUrl.length > 0 ? imageUrl : streamUrl,
    iframeBlocked: XFO_BLOCKLIST.includes(host),
    host,
  };
}

/**
 * 初始階段：
 * - 明確不可能 → text
 * - 國道（freeway）的 MJPEG 走 HTTP/2 multipart，<img> 無法解碼會靜默黑畫面（onError 也不觸發），
 *   但 <iframe> 的子文件導航可正常渲染（實測確認）→ 直接 iframe
 * - 其餘 → 先試 <img>（MJPEG/JPEG 可顯示），失敗再 fallback
 */
function initialStage(decision: Decision, source?: string): Stage {
  if (decision.blockedReason) return "text";
  if (source === "freeway") return decision.iframeBlocked ? "text" : "iframe";
  return "img";
}

const BOX_STYLE: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  // CCTV 畫面多為 16:9，框用同比例隨寬度自適應，避免太扁造成上下裁切 / 左右黑邊
  aspectRatio: "16 / 9",
  borderRadius: RADIUS.md,
  overflow: "hidden",
  background: "#0a0a0a",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

export function CctvStreamView({ streamUrl, imageUrl, source, accentColor }: Props) {
  const { t } = useLocale();
  const decision = useMemo(() => decide(streamUrl, imageUrl), [streamUrl, imageUrl]);
  const imageOnly = !!imageUrl && streamUrl === imageUrl;

  const [stage, setStage] = useState<Stage>(() => initialStage(decision, source));
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 換選別支 / props 變動時重置狀態機
  useEffect(() => {
    setStage(initialStage(decision, source));
    setImgLoaded(false);
  }, [streamUrl, imageUrl, source, decision]);

  // img 靜默黑畫面保險：6 秒內沒 onLoad 也沒 onError（HTTP/2 multipart 等）→ 視為失敗，轉 iframe（或 text）
  useEffect(() => {
    if (stage !== "img" || imgLoaded) return;
    const t = window.setTimeout(() => {
      setStage(imageOnly || decision.iframeBlocked ? "text" : "iframe");
    }, 6000);
    return () => window.clearTimeout(t);
  }, [stage, imgLoaded, imageOnly, decision.iframeBlocked]);

  // lifecycle 清理：unmount 時切斷 MJPEG 長連線（清空 src）
  useEffect(() => {
    const el = imgRef.current;
    return () => {
      if (el) {
        try {
          el.src = "";
          el.removeAttribute("src");
        } catch {
          /* noop */
        }
      }
    };
  }, [stage]);

  const openLink = (
    <a
      href={streamUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-block",
        marginTop: 6,
        color: accentColor,
        fontSize: FONT_SIZE.base,
        textDecoration: "underline",
        wordBreak: "break-all",
      }}
    >
      {t(imageOnly ? "popup.infra.cctvOpenImage" : "popup.infra.cctvOpenStream")} ↗
    </a>
  );

  const textFallback = (msg: string) => (
    <div style={BOX_STYLE} data-cctv-source={source}>
      <span
        style={{
          fontSize: FONT_SIZE.base,
          color: COLORS.textMuted,
          textAlign: "center",
          padding: "0 12px",
          lineHeight: 1.5,
        }}
      >
        {msg}
      </span>
    </div>
  );

  if (stage === "text") {
    const msg = t(
      decision.blockedReason ??
      (decision.iframeBlocked ? "popup.infra.cctvIframeBlocked" : "popup.infra.cctvLoadFailed"),
    );
    return (
      <div style={{ marginTop: 8 }}>
        {textFallback(msg)}
        {openLink}
      </div>
    );
  }

  if (stage === "iframe") {
    // img 失敗 → 試 HTML 播放頁 iframe（黑名單 host 在 onError→stage 切換前已導向 text）
    if (decision.iframeBlocked) {
      return (
        <div style={{ marginTop: 8 }}>
          {textFallback(t("popup.infra.cctvIframeBlocked"))}
          {openLink}
        </div>
      );
    }
    return (
      <div style={{ marginTop: 8 }}>
        <div style={BOX_STYLE} data-cctv-source={source}>
          <iframe
            src={streamUrl}
            title={t("popup.infra.cctvLiveAlt")}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        </div>
        {openLink}
      </div>
    );
  }

  // stage === "img"
  return (
    <div style={{ marginTop: 8 }}>
      <div style={BOX_STYLE} data-cctv-source={source}>
        {!imgLoaded && (
          <span
            style={{
              position: "absolute",
              fontSize: FONT_SIZE.base,
              color: COLORS.textDim,
            }}
          >
            {t("popup.infra.cctvLoading")}
          </span>
        )}
        <img
          ref={imgRef}
          src={decision.imgSrc}
          alt={t("popup.infra.cctvLiveAlt")}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgLoaded(false);
            // img 失敗 → 若 host 在黑名單則直接 text，否則試 iframe
            setStage(imageOnly || decision.iframeBlocked ? "text" : "iframe");
          }}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      </div>
      {openLink}
    </div>
  );
}
