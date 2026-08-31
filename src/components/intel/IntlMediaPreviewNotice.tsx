import { COLORS, FONT_CJK, FONT_DATA } from "./intelTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";

const PREVIEW_COLOR = "#f6c453";

export function IntlMediaPreviewNotice() {
  return (
    <aside
      role="note"
      aria-label="國際媒體研究樣本說明"
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 12,
        padding: "10px 12px 10px 15px",
        borderRadius: RADIUS.xl,
        background: "linear-gradient(110deg, rgba(246,196,83,0.16), rgba(246,196,83,0.055))",
        border: `1px solid ${PREVIEW_COLOR}66`,
        boxShadow: "inset 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute", inset: "0 auto 0 0", width: 3,
          background: PREVIEW_COLOR,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            padding: "2px 7px", borderRadius: RADIUS.md,
            background: `${PREVIEW_COLOR}22`, border: `1px solid ${PREVIEW_COLOR}55`,
            color: PREVIEW_COLOR, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
            fontWeight: 800, letterSpacing: "0.9px",
          }}
        >
          PREVIEW
        </span>
        <strong
          style={{
            color: COLORS.textStrong, fontFamily: FONT_CJK,
            fontSize: FONT_SIZE.base, fontWeight: 700,
          }}
        >
          7 日研究樣本
        </strong>
        <span
          style={{
            marginLeft: "auto", color: PREVIEW_COLOR,
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, fontWeight: 650,
          }}
        >
          非即時資料
        </span>
      </div>
      <div
        style={{
          color: COLORS.textMuted, fontFamily: FONT_CJK,
          fontSize: FONT_SIZE.sm, lineHeight: 1.55,
        }}
      >
        9 筆 GDELT 實測 metadata，用來檢視卡片與判讀品質；不代表正式收錄。
      </div>
    </aside>
  );
}
