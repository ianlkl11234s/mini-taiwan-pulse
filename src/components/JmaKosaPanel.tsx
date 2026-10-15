/**
 * JmaKosaPanel — 黃砂予測（地上濃度）圖片面板，瀏覽器直連 JMA。
 *
 * 僅當 jmaKosa 圖層開啟時由 App 掛在右下浮動堆疊（與 AqiProductSwitcher 同位置模式）。
 * 上游是 800×580 不透明 PNG（底圖、圖例燒在圖裡），所以不貼地圖，改成圖片＋時刻選單。
 * - 清單：s_jpjp_list.js，regex 取 12 碼 JST 時刻（parseKosaList，不 eval）；每 30 分重取。
 * - 預設跟隨時間軸：選最接近時間軸時刻的一報；使用者手選後停止跟隨，可按「跟隨時間軸」恢復。
 * - 上游只有最新一報（約 3 天預報），時間軸超出範圍時顯示最接近的時刻並註明。
 * - 圖高上限 24vh：右下堆疊和圖例共用高度，圖例長時不把面板頂到工具列底下。
 */
import { useEffect, useMemo, useState } from "react";
import { BORDER, CONTROL, ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SURFACE, COLORS } from "../styles/designTokens";
import { PanelHeader } from "./sidebar/PanelHeader";
import { useLocale } from "../state/localeStore";
import { useUiTime } from "../hooks/useTimeline";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { JMA_KOSA_ATTRIBUTION, JMA_KOSA_PAGE_URL, jmaKosaImageUrl } from "../data/jmaTypes";
import { fetchKosaList, kosaOutOfRange, kosaStampMs, nearestKosaStamp } from "../data/jmaUpstreamLoaders";

const REFRESH_MS = 30 * 60_000;

function formatKosaJst(stamp: string): string {
  return `${stamp.slice(4, 6)}/${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)} JST`;
}

export function JmaKosaPanel({ isDark }: { isDark: boolean }) {
  const i18n = useLocale();
  const uiTime = useUiTime();
  const [stamps, setStamps] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let disposed = false;
    const load = () => {
      fetchKosaList()
        .then((list) => { if (!disposed) { setStamps(list); setError(null); } })
        .catch((err: unknown) => { if (!disposed) setError(err instanceof Error ? err.message : String(err)); });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const tMs = uiTime * 1000;
  const followStamp = useMemo(() => (stamps ? nearestKosaStamp(stamps, tMs) : null), [stamps, tMs]);
  const selected = manual && stamps?.includes(manual) ? manual : followStamp;
  const outOfRange = stamps != null && !manual && kosaOutOfRange(stamps, tMs);
  useEffect(() => { setImgError(false); }, [selected]);

  const c = isDark
    ? { bg: SURFACE.strong, border: BORDER.panel, text: COLORS.textStrong, muted: COLORS.textMuted, dim: COLORS.textDim, ctrlBg: CONTROL.bg, ctrlBorder: CONTROL.border, optionBg: CONTROL.optionBg, link: COLORS.link, shadow: ELEVATION.lg }
    : { bg: LIGHT.surfaceStrong, border: LIGHT.border, text: LIGHT.textStrong, muted: LIGHT.textMuted, dim: LIGHT.textDim, ctrlBg: LIGHT.controlBg, ctrlBorder: LIGHT.controlBorder, optionBg: LIGHT.surfaceSolid, link: LIGHT.link, shadow: LIGHT.elevationLg };

  const title = i18n.t("legend.jma.kosaPanelTitle");
  const noteStyle = { fontSize: FONT_SIZE.xs, color: c.dim, lineHeight: 1.5 };

  return (
    <section
      aria-label={title}
      style={{
        width: "min(380px, calc(100vw - 32px))", background: c.bg, border: `1px solid ${c.border}`, borderRadius: RADIUS.xl,
        boxShadow: c.shadow, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", fontFamily: FONT_CJK, overflow: "hidden",
      }}
    >
      <PanelHeader
        eyebrow={i18n.t("legend.jma.kosaPanelEyebrow")} title={title}
        onClose={() => layerVisibilityStore.setVisibility("jmaKosa", false)}
        borderColor={c.border} mutedColor={c.muted} textColor={c.text}
      />
      <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FONT_SIZE.sm, color: c.muted }}>
          <label htmlFor="jma-kosa-time">{i18n.t("legend.jma.kosaSelectLabel")}</label>
          <select
            id="jma-kosa-time"
            value={selected ?? ""}
            disabled={!stamps || stamps.length === 0}
            onChange={(e) => setManual(e.target.value)}
            style={{
              flex: 1, minWidth: 0, fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA, color: c.text, background: c.ctrlBg,
              border: `1px solid ${c.ctrlBorder}`, borderRadius: RADIUS.md, padding: "3px 4px",
            }}
          >
            {(stamps ?? []).map((s) => <option key={s} value={s} style={{ background: c.optionBg }}>{formatKosaJst(s)}</option>)}
          </select>
          {manual && (
            <button
              type="button" onClick={() => setManual(null)}
              style={{ fontSize: FONT_SIZE.xs, color: c.link, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT_CJK }}
            >
              {i18n.t("legend.jma.kosaFollow")}
            </button>
          )}
        </div>
        {error && <div role="alert" style={{ ...noteStyle, color: isDark ? COLORS.statusErr : LIGHT.statusErr }}>{i18n.t("legend.jma.errorShown", { message: error })}</div>}
        {!stamps && !error && <div style={noteStyle}>{i18n.t("legend.jma.loading")}</div>}
        {stamps && stamps.length === 0 && <div style={noteStyle}>{i18n.t("legend.jma.kosaEmpty")}</div>}
        {outOfRange && <div style={noteStyle}>{i18n.t("legend.jma.kosaOutOfRange")}</div>}
        {selected && (imgError
          ? <div role="alert" style={noteStyle}>{i18n.t("legend.jma.kosaImageError")}</div>
          : <img
            src={jmaKosaImageUrl(selected)}
            alt={i18n.t("legend.jma.kosaImgAlt", { time: formatKosaJst(selected) })}
            width={800} height={580}
            onError={() => setImgError(true)}
            style={{ display: "block", width: "100%", height: "auto", maxHeight: "24vh", objectFit: "contain", borderRadius: RADIUS.md, background: c.ctrlBg }}
          />)}
        <div style={noteStyle}>
          {selected && kosaStampMs(selected) != null && <>{i18n.t("legend.jma.kosaValid", { time: formatKosaJst(selected) })} · </>}
          {JMA_KOSA_ATTRIBUTION} · <a href={JMA_KOSA_PAGE_URL} target="_blank" rel="noopener noreferrer" style={{ color: c.link }}>{i18n.t("legend.jma.kosaSourceLink")}</a>
        </div>
      </div>
    </section>
  );
}
