/**
 * 主站右下「資料來源 N」＋展開清單（attribution-compact）。
 *
 * - 收合：一行，掛在 Mapbox 版權列左側（AttributionHostControl 的 DOM 節點，portal）。
 *   N＝目前可見圖層的去重來源數；N=0 時不顯示「資料來源」，只留「隱私」連結（/privacy，新分頁）。
 * - 展開：向上彈出小卡（portal 到 body，fixed，Z_INDEX.popover），依授權分組列出來源，
 *   有網址者可開原始頁。Esc／點外面／✕ 關閉。
 * - 底圖版權（© Mapbox © OpenStreetMap、Improve this map）一律由內建控制項常駐顯示，
 *   不收進卡片（Mapbox 條款）；卡片底部只重述一行「地圖：…」。
 *
 * 來源收集與底圖分流見 src/map/attribution/mapAttribution.ts；字串解析見 attributionParse.ts。
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useLocale } from "../state/localeStore";
import { privacyHref } from "../privacy/privacyLocale";
import { Z_INDEX } from "../styles/designTokens";
import { collectLayerAttributions, readMapSourceViews } from "../map/attribution/mapAttribution";
import { groupAttributions, OTHER_LICENSE, parseAttributions } from "../map/attribution/attributionParse";
import "./attributionBar.css";

/** 訂閱地圖 source／style 變動，回傳目前可見圖層的 attribution 原字串（內容不變時維持同一陣列）。 */
function useLayerAttributions(map: MapboxMap | null): string[] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (!map) return;
    let frame = 0;
    let lastKey = "";
    const refresh = () => {
      frame = 0;
      const next = collectLayerAttributions(readMapSourceViews(map));
      const key = next.join("\u0001");
      if (key === lastKey) return;
      lastKey = key;
      setList(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(refresh);
    };
    // 與內建 AttributionControl 相同的觸發條件：style 變動、source metadata／visibility 變動
    const onSourceData = (e: { dataType?: string; sourceDataType?: string }) => {
      if (e.dataType === "style" || e.sourceDataType === "metadata" || e.sourceDataType === "visibility") schedule();
    };
    map.on("styledata", schedule);
    map.on("sourcedata", onSourceData);
    map.on("idle", schedule);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      map.off("styledata", schedule);
      map.off("sourcedata", onSourceData);
      map.off("idle", schedule);
    };
  }, [map]);
  return list;
}

interface AttributionBarProps {
  map: MapboxMap | null;
  /** 右下角落 host 節點（AttributionHostControl.element） */
  host: HTMLElement | null;
  isDark: boolean;
}

export function AttributionBar({ map, host, isDark }: AttributionBarProps) {
  const { t, active } = useLocale();
  const raws = useLayerAttributions(map);
  const entries = useMemo(() => parseAttributions(raws), [raws]);
  const groups = useMemo(() => groupAttributions(entries), [entries]);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();
  const count = entries.length;

  // 圖層全關 → 卡片跟著收
  useEffect(() => {
    if (count === 0) setOpen(false);
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (cardRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 本卡是最上層暫態 UI：吃掉這次 Esc，避免同時關掉 popup／選取（useMapInteraction 會看 defaultPrevented）
      e.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!host) return null;
  const theme = isDark ? "pulse-attrib--dark" : "pulse-attrib--light";
  const label = t("attribution.sources");

  return (
    <>
      {createPortal(
        <span className={`pulse-attrib-row ${theme}`}>
          {count > 0 && <>
          <button
            ref={toggleRef}
            type="button"
            className="pulse-attrib-toggle"
            aria-expanded={open}
            aria-controls={cardId}
            title={t("attribution.title")}
            onClick={() => setOpen((v) => !v)}
          >
            <span>{label}</span>
            <span className="pulse-attrib-count">{count}</span>
            {open ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronUp size={11} aria-hidden="true" />}
          </button>
          <span className="pulse-attrib-sep" aria-hidden="true">·</span>
          </>}
          <a className="pulse-attrib-link" href={privacyHref(active)} target="_blank" rel="noopener noreferrer">{t("attribution.privacy")}</a>
          <span className="pulse-attrib-sep" aria-hidden="true">·</span>
        </span>,
        host,
      )}
      {open && createPortal(
        <div
          ref={cardRef}
          id={cardId}
          role="dialog"
          aria-label={t("attribution.title")}
          className={`pulse-attrib-card ${theme}`}
          style={{ zIndex: Z_INDEX.popover }}
        >
          <div className="pulse-attrib-card-head">
            <span className="pulse-attrib-card-title">{label}<span className="pulse-attrib-count">{count}</span></span>
            <button
              type="button"
              className="pulse-attrib-close"
              aria-label={t("attribution.close")}
              title={t("attribution.close")}
              onClick={() => { setOpen(false); toggleRef.current?.focus(); }}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="pulse-attrib-card-body">
            {groups.map((group) => (
              <section key={group.license} className="pulse-attrib-group">
                <h3 className="pulse-attrib-license">
                  {group.license === OTHER_LICENSE ? t("attribution.other") : group.license}
                </h3>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={entry.key}>
                      {entry.url ? (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" title={t("attribution.openSource")}>
                          {entry.text}
                          <ExternalLink size={10} aria-hidden="true" className="pulse-attrib-ext" />
                        </a>
                      ) : (
                        <span>{entry.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="pulse-attrib-card-foot">
            {t("attribution.basemap", { credit: "© Mapbox © OpenStreetMap" })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
