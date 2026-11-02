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
  /** 短片（mp4，例：TfL JamCams）：有給就先以 <video> 播放，失敗再退回 imageUrl 快照 */
  videoUrl?: string;
}

/** 已確認帶 X-Frame-Options: SAMEORIGIN 的 host，iframe 會被瀏覽器擋掉，直接走文字 fallback */
const XFO_BLOCKLIST = ["atis.ntpc.gov.tw"];

/** 私網 IP host（外部無法存取） */
const PRIVATE_IP_RE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

type Stage = "video" | "img" | "iframe" | "text";

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
function initialStage(decision: Decision, source?: string, videoUrl?: string): Stage {
  if (videoUrl && canEmbedVideo(videoUrl)) return "video";
  if (decision.blockedReason) return "text";
  if (source === "freeway") return decision.iframeBlocked ? "text" : "iframe";
  return "img";
}

/** 短片只走 https（http 在 https 頁面會被混合內容擋下）；其餘直接退回快照 */
function canEmbedVideo(videoUrl: string): boolean {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  return videoUrl.startsWith("https://") || (!isHttps && videoUrl.startsWith("http://"));
}

/** 影片失敗後的下一步：有快照就試快照，否則直接文字 */
function stageAfterVideo(decision: Decision, imageUrl: string | undefined): Stage {
  if (!imageUrl || decision.blockedReason) return "text";
  return "img";
}

/** 只需要 cleanup 用到的那幾個 DOM 成員，方便單元測試用假物件 */
export interface ReleasableMedia {
  readonly isConnected: boolean;
  src: string;
  removeAttribute(name: string): void;
  pause?: () => void;
  load?: () => void;
}

/**
 * effect cleanup：元素已離開 DOM（真的 unmount、或換階段被換掉）才清 src 切斷 MJPEG／影片下載。
 * React StrictMode（dev）會「掛載 → cleanup → 再掛載」同一個 DOM 元素，這時元素仍在 DOM，
 * 若照樣清 src，React 不會再補回（props 沒變），而清空 src 會觸發 onError → 彈窗卡在「無法載入」。
 * 回傳是否有清除（測試用）。
 */
export function releaseMediaIfDetached(el: ReleasableMedia | null): boolean {
  if (!el || el.isConnected) return false;
  try {
    el.pause?.();
    el.src = "";
    el.removeAttribute("src");
    el.load?.();
  } catch {
    /* noop */
  }
  return true;
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

export function CctvStreamView({ streamUrl, imageUrl, source, accentColor, videoUrl }: Props) {
  const { t } = useLocale();
  const decision = useMemo(() => decide(streamUrl, imageUrl), [streamUrl, imageUrl]);
  const imageOnly = !!imageUrl && streamUrl === imageUrl;

  const [stage, setStage] = useState<Stage>(() => initialStage(decision, source, videoUrl));
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 換選別支 / props 變動時重置狀態機
  useEffect(() => {
    setStage(initialStage(decision, source, videoUrl));
    setImgLoaded(false);
  }, [streamUrl, imageUrl, videoUrl, source, decision]);

  // 靜默黑畫面保險：6 秒內沒 onLoad 也沒 onError（HTTP/2 multipart 等）→ 視為失敗
  // img → iframe（或 text）；video → 快照（或 text）
  useEffect(() => {
    if ((stage !== "img" && stage !== "video") || imgLoaded) return;
    const t = window.setTimeout(() => {
      if (stage === "video") setStage(stageAfterVideo(decision, imageUrl));
      else setStage(imageOnly || decision.iframeBlocked ? "text" : "iframe");
    }, 6000);
    return () => window.clearTimeout(t);
  }, [stage, imgLoaded, imageOnly, decision, imageUrl]);

  // React 的 muted 只設 property、不輸出 attribute，部分瀏覽器據此擋自動播放 → 掛載後補一次 play()
  useEffect(() => {
    const el = videoRef.current;
    if (stage !== "video" || !el) return;
    el.muted = true;
    el.play?.()?.catch(() => { /* 自動播放被擋：保留第一格，由 onError／逾時處理真正失敗 */ });
  }, [stage]);

  // lifecycle 清理：元素離開 DOM 時切斷 MJPEG 長連線／影片下載（StrictMode 假 unmount 不清，見 releaseMediaIfDetached）
  useEffect(() => {
    const img = imgRef.current;
    const video = videoRef.current;
    return () => {
      releaseMediaIfDetached(img);
      releaseMediaIfDetached(video);
    };
  }, [stage]);

  const linkToVideo = !!videoUrl && stage === "video";
  const openLink = (
    <a
      href={linkToVideo ? videoUrl : streamUrl}
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
      {t(imageOnly && !linkToVideo ? "popup.infra.cctvOpenImage" : "popup.infra.cctvOpenStream")} ↗
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

  if (stage === "video") {
    // 短片：靜音自動循環、不顯示控制列；失敗退回快照
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
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            autoPlay
            loop
            playsInline
            aria-label={t("popup.infra.cctvLiveAlt")}
            onLoadedData={() => setImgLoaded(true)}
            onError={() => {
              setImgLoaded(false);
              setStage(stageAfterVideo(decision, imageUrl));
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
