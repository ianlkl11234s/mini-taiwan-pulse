import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { signInWithGoogle, signOut, useUser } from "../../lib/auth";
import {
  COLORS,
  SURFACE,
  BORDER,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  FONT_CJK,
  SPACING,
  ELEVATION,
  WHITE_ALPHA,
} from "../../styles/designTokens";

/**
 * 右上角會員入口（member-byok-chat-plan §6.1）。
 * 未登入 → 「使用 Google 登入」按鈕；登入 → avatar + 名稱 + 下拉（登出）。
 * 純元件、獨立掛載，App.tsx 接線待 byok-chat PR 併回 master 後再做。
 */
/**
 * @param isOwner      是否為 owner（決定是否顯示「資料治理」入口）。
 * @param onOpenAdmin  點「資料治理」時開啟站內後台（僅 owner）。
 */
export function UserAvatar({ isOwner, onOpenAdmin, isDarkTheme = true, compact = false }: { isOwner?: boolean; onOpenAdmin?: () => void; isDarkTheme?: boolean; compact?: boolean } = {}) {
  const { user, loading } = useUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 下拉選單面板的中性 chrome 色票（頭像本體、accent、狀態色不受此控制）
  const c = isDarkTheme
    ? {
        menuBg: SURFACE.strong,
        border: BORDER.panel,
        shadow: ELEVATION.lg,
        divider: BORDER.soft,
        textStrong: COLORS.textDefault,
        textDim: COLORS.textMuted,
        hover: WHITE_ALPHA[8],
      }
    : {
        menuBg: "#FFFFFF",
        border: "rgba(0,0,0,0.10)",
        shadow: "0 8px 24px rgba(0,0,0,0.15)",
        divider: "rgba(0,0,0,0.08)",
        textStrong: "#111827",
        textDim: "#6B7280",
        hover: "rgba(0,0,0,0.05)",
      };

  // 下拉開啟時，點擊外部關閉
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (loading) return null;

  // ── 未登入：登入按鈕 ──
  if (!user) {
    return (
      <button
        type="button"
        aria-label="使用 Google 登入"
        title="使用 Google 登入"
        onClick={() => {
          void signInWithGoogle().catch((err) => console.error("[auth] signIn failed", err));
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: SPACING.sm,
          padding: compact ? 0 : `${SPACING.sm}px ${SPACING.lg}px`,
          width: compact ? 36 : undefined,
          height: compact ? 36 : undefined,
          background: SURFACE.panel,
          color: COLORS.textStrong,
          border: `1px solid ${BORDER.mid}`,
          borderRadius: RADIUS.md,
          fontSize: FONT_SIZE.md,
          fontWeight: FONT_WEIGHT.semibold,
          fontFamily: FONT_CJK,
          backdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
      >
        <LogIn size={14} />
        {!compact && "使用 Google 登入"}
      </button>
    );
  }

  // ── 已登入：avatar + 名稱 + 下拉 ──
  const meta = user.user_metadata ?? {};
  const displayName: string = meta.full_name ?? meta.name ?? user.email ?? "使用者";
  const avatarUrl: string | null = meta.avatar_url ?? meta.picture ?? null;

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`帳號選單：${displayName}`}
        title={displayName}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: SPACING.sm,
          padding: compact ? 0 : `${SPACING.xs}px ${SPACING.md}px`,
          width: compact ? 36 : undefined,
          height: compact ? 36 : undefined,
          background: SURFACE.panel,
          color: COLORS.textStrong,
          border: `1px solid ${BORDER.mid}`,
          borderRadius: RADIUS.pill,
          fontSize: FONT_SIZE.md,
          fontFamily: FONT_CJK,
          backdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
      >
        <Avatar url={avatarUrl} />
        {!compact && <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName}
        </span>}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 160,
            background: c.menuBg,
            border: `1px solid ${c.border}`,
            borderRadius: RADIUS.lg,
            boxShadow: c.shadow,
            backdropFilter: "blur(8px)",
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: `${SPACING.md}px ${SPACING.lg}px`,
              borderBottom: `1px solid ${c.divider}`,
              fontSize: FONT_SIZE.sm,
              fontFamily: FONT_CJK,
              color: c.textDim,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email ?? displayName}
          </div>
          {isOwner && onOpenAdmin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenAdmin();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACING.sm,
                width: "100%",
                padding: `${SPACING.md}px ${SPACING.lg}px`,
                background: "transparent",
                color: c.textStrong,
                border: "none",
                borderBottom: `1px solid ${c.divider}`,
                fontSize: FONT_SIZE.md,
                fontFamily: FONT_CJK,
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ShieldCheck size={14} />
              資料治理
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut().catch((err) => console.error("[auth] signOut failed", err));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              width: "100%",
              padding: `${SPACING.md}px ${SPACING.lg}px`,
              background: "transparent",
              color: c.textStrong,
              border: "none",
              fontSize: FONT_SIZE.md,
              fontFamily: FONT_CJK,
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={14} />
            登出
          </button>
        </div>
      )}
    </div>
  );
}

/** 圓形頭像：有圖顯示圖，無圖顯示 fallback 人形 icon */
function Avatar({ url }: { url: string | null }) {
  const size = 22;
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  };
  if (url) {
    return <img src={url} alt="" referrerPolicy="no-referrer" style={{ ...common, objectFit: "cover" }} />;
  }
  return (
    <span
      style={{
        ...common,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: WHITE_ALPHA[12],
        color: COLORS.textMuted,
      }}
    >
      <UserIcon size={13} />
    </span>
  );
}
