import { useEffect, useMemo, useRef, useState } from "react";

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
  /** 是否一開始就確定無法內嵌（直接文字） */
  blockedReason: string | null;
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

  let blockedReason: string | null = null;
  if (streamUrl.startsWith("wss://")) {
    blockedReason = "此攝影機為 WebSocket 串流，無法內嵌";
  } else if (isHttps && streamUrl.startsWith("http://")) {
    blockedReason = "無法顯示（來源為非加密 http，瀏覽器封鎖）";
  } else if (PRIVATE_IP_RE.test(host)) {
    blockedReason = "此攝影機為內網位址，外部無法存取";
  }

  return {
    blockedReason,
    imgSrc: imageUrl && imageUrl.length > 0 ? imageUrl : streamUrl,
    iframeBlocked: XFO_BLOCKLIST.includes(host),
    host,
  };
}

const BOX_STYLE: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  height: 176,
  borderRadius: 4,
  overflow: "hidden",
  background: "#0a0a0a",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

export function CctvStreamView({ streamUrl, imageUrl, source, accentColor }: Props) {
  const decision = useMemo(() => decide(streamUrl, imageUrl), [streamUrl, imageUrl]);

  // 初始階段：明確不可能 → text；否則先試 img
  const [stage, setStage] = useState<Stage>(decision.blockedReason ? "text" : "img");
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 換選別支 / props 變動時重置狀態機
  useEffect(() => {
    setStage(decision.blockedReason ? "text" : "img");
    setImgLoaded(false);
  }, [streamUrl, imageUrl, decision.blockedReason]);

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
        fontSize: 11,
        textDecoration: "underline",
        wordBreak: "break-all",
      }}
    >
      在新分頁開啟原始串流 ↗
    </a>
  );

  const textFallback = (msg: string) => (
    <div style={BOX_STYLE} data-cctv-source={source}>
      <span
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
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
    const msg =
      decision.blockedReason ??
      (decision.iframeBlocked
        ? "此攝影機播放頁禁止內嵌，請於新分頁開啟"
        : "無法載入即時畫面，請於新分頁開啟");
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
          {textFallback("此攝影機播放頁禁止內嵌，請於新分頁開啟")}
          {openLink}
        </div>
      );
    }
    return (
      <div style={{ marginTop: 8 }}>
        <div style={BOX_STYLE} data-cctv-source={source}>
          <iframe
            src={streamUrl}
            title="CCTV 即時畫面"
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
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            載入中…
          </span>
        )}
        <img
          ref={imgRef}
          src={decision.imgSrc}
          alt="CCTV 即時畫面"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgLoaded(false);
            // img 失敗 → 若 host 在黑名單則直接 text，否則試 iframe
            setStage(decision.iframeBlocked ? "text" : "iframe");
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
