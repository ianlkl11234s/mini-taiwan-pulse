import { memo, useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { SURFACE, ELEVATION, RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { fetchLiveVideos, type YtLiveVideo } from "../../../data/intelLoaders";
import { useInView } from "../../../hooks/useInView";

export interface LiveChannel {
  id: string;
  name: string;
  en: string;
  tag: "公廣" | "綜合" | "財經";
  /** YouTube @handle —— 與 collector HANDLES + realtime.yt_live_current.handle 對齊 */
  handle: string;
  note?: string;
  emergency?: boolean;
  emergencyLabel?: string;
  /**
   * 寫死可 embedded 的 video_id 備援，resolver 沒給 video_id（或該台 embedBlocked）
   * 時才會用到——resolver 有結果一律優先用 resolver（見 resolveSrc）。
   *
   * 2026-07-26 之前 resolver 是舊版 HTML 爬蟲、成功率極低（~0.2%），fallbackVideoId
   * 一度是「resolver 給的 primary live 常被關 embed」的主要繞路，因此當時優先序反過來。
   * 今日新版 resolver 改走 YouTube Data API v3（見 collectors/yt_live_video_resolver.py
   * commit d8b6f10），實測 tvbs/ebc/ftv 現在 resolver 給的 video_id 已與這裡寫死的值完全
   * 相同；cts 則反而是 fallbackVideoId（meHTKm4XBS8）已下播、resolver 給的新 id
   * （wM0g8EoUZ_E）才是活的——故改為 resolver 優先、fallbackVideoId 僅作安全網。
   */
  fallbackVideoId?: string;
  /**
   * 確認為 YouTube 官方封鎖第三方 embed（非「未開播」）→ 動態過濾會連同 resolver
   * 給的 video_id 一併隱藏，避免渲染必壞的 iframe。若之後該台開放 embed 或提供
   * 可嵌入的替代 video_id，改設 fallbackVideoId 或移除本 flag。
   *
   * 實測：2026-07-26 22:28（本地）— embed/<resolver video_id> 顯示 YouTube 官方訊息
   *   「無法播放影片：這部影片含有『TTV』的著作權內容，而對方已禁止在這個網站上或
   *     應用程式中播放這部影片」（ttv：@TTV_NEWS，見 embed-test3 診斷）
   */
  embedBlocked?: boolean;
}

/**
 * 14 家 24h YouTube 新聞直播 —— 依屬性分組
 *
 * 實際 video_id 由 `realtime.yt_live_current` 提供（collector 5 min cron 解析）。
 * 前端用 `embed/<video_id>` 才可靠（`embed/live_stream?channel=` 多數頻道找不到 primary live）。
 * 對應 collector：data-collectors/collectors/yt_live_video_resolver.py
 */
export const LIVE_CHANNELS: LiveChannel[] = [
  { id: "pts",    name: "公視新聞", en: "PTS",       tag: "公廣", handle: "@ptslivestream", note: "公廣保底，訊號最穩" },
  // fallbackVideoId 只在 resolver 沒給 video_id 時當安全網（見 fallbackVideoId 欄位註解）；
  // 2026-07-26 診斷：meHTKm4XBS8 本身已下播（「無法播放這部直播影片的錄影存檔」），
  // 現在 resolver 給的 video_id 才是活的，留著這個值只為未來 resolver 又斷線時墊底
  { id: "cts",    name: "華視新聞", en: "CTS",       tag: "公廣", handle: "@CtsTw", emergency: true, emergencyLabel: "防災直播", note: "災防可切防災直播", fallbackVideoId: "meHTKm4XBS8" },
  // tvbs/ebc fallback = 官方 24hr 常設直播（TVBS 開播 2023-05 至今未換、EBC 穩定 5+ 週）；
  // 2026-07-26 實測這兩台 resolver 給的 video_id 現在已跟這裡寫死的值完全相同，純安全網；
  // set 刻意不設：@SETN 輪播單場直播（會下播），寫死必成殭屍 ID，交給 resolver 下播補查
  { id: "tvbs",   name: "TVBS",     en: "TVBS NEWS", tag: "綜合", handle: "@TVBSNEWS01", note: "觀看數最高", fallbackVideoId: "m_dhMSvUCIc" },
  { id: "set",    name: "三立新聞", en: "SET",       tag: "綜合", handle: "@SETN", note: "iNEWS 24h" },
  { id: "ebc",    name: "東森新聞", en: "EBC",       tag: "綜合", handle: "@newsebc", fallbackVideoId: "V1p33hqPrUk" },
  { id: "ftv",    name: "民視新聞", en: "FTV",       tag: "綜合", handle: "@FTV_News", fallbackVideoId: "ylYJSBUgaMA" },
  { id: "era",    name: "年代新聞", en: "ERA",       tag: "綜合", handle: "@era_news" },
  { id: "mnews",  name: "鏡新聞",   en: "MIRROR",    tag: "綜合", handle: "@MnewsTw", note: "⏳ handle 待修" },
  // embedBlocked：TTV 對第三方網站封鎖 embed（見上方 embedBlocked 欄位註解的實測證據）
  { id: "ttv",    name: "台視新聞", en: "TTV",       tag: "綜合", handle: "@TTV_NEWS", embedBlocked: true },
  { id: "ctv",    name: "中視新聞", en: "CTV",       tag: "綜合", handle: "@twctvnews" },
  { id: "global", name: "寰宇新聞", en: "GLOBAL",    tag: "綜合", handle: "@globalnewstw" },
  { id: "ustv",   name: "非凡新聞", en: "USTV",      tag: "財經", handle: "@ustvnews", note: "⏳ handle 待修" },
  { id: "cna",    name: "中央社",   en: "CNA",       tag: "財經", handle: "@CNAvideo", note: "即時影音" },
];

function videoEmbedSrc(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`;
}

/**
 * 頻道目前可用的 embed src，沒有可用來源回傳 null。
 *
 * 優先序：resolver 給的 video_id（embedBlocked 的台跳過，不管 resolver 給了什麼 id）
 * → fallbackVideoId（人工挑選的安全網，resolver 沒結果時墊底）。
 *
 * 2026-07-26 由 fallbackVideoId 優先改成 resolver 優先：新版 resolver（YouTube Data API v3，
 * 5 min cron）實測可靠，tvbs/ebc/ftv 的 resolver video_id 現在已與人工寫死的 fallback 完全
 * 相同；cts 則是 fallback 已下播、resolver 給的 id 才是活的——resolver 優先才不會渲染出
 * 已下播的殭屍 fallback。
 *
 * 註：曾經還有第三層 `embed/live_stream?channel=` 備援，2026-07-26 診斷證實對多數頻道
 * 不可靠（TVBS 實測跳「無法播放這部影片」，intelLoaders.ts 也早有同樣註記），且原本仰賴
 * 這條路的中視（ctv）resolver 現在已能直接給可嵌入的 video_id，故整條移除，不再保留。
 */
function resolveSrc(ch: LiveChannel, resolved: YtLiveVideo | undefined): string | null {
  if (!ch.embedBlocked && resolved?.video_id) return videoEmbedSrc(resolved.video_id);
  if (ch.fallbackVideoId) return videoEmbedSrc(ch.fallbackVideoId);
  return null;
}

function isChannelAvailable(ch: LiveChannel, resolved: YtLiveVideo | undefined): boolean {
  return resolveSrc(ch, resolved) !== null;
}

interface MenuProps {
  value: string;
  onPick: (id: string) => void;
  usedIds: string[];
  /** 只顯示目前有有效 src 的頻道（資料驅動隱藏，LIVE_CHANNELS 本體不刪減） */
  channels: LiveChannel[];
}

function ChannelMenu({ value, onPick, usedIds, channels }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = LIVE_CHANNELS.find((c) => c.id === value) ?? LIVE_CHANNELS[0]!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: RADIUS.lg,
          background: "rgba(0,0,0,0.72)", color: "#fff",
          border: `1px solid ${COLORS.borderMid}`, cursor: "pointer",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          fontFamily: FONT_CJK, fontSize: 10.5,
        }}
      >
        <span style={{ fontWeight: 700 }}>{cur.name}</span>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
            color: COLORS.textMuted, letterSpacing: "0.5px",
          }}
        >
          {cur.en}
        </span>
        <span
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s",
            fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0,
            width: 232, zIndex: 30, borderRadius: RADIUS.xl, overflow: "hidden",
            border: `1px solid ${COLORS.borderMid}`,
            background: SURFACE.solid,
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            boxShadow: ELEVATION.md,
            animation: "drawerOpen .18s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 11px 7px",
              borderBottom: `1px solid ${COLORS.borderSoft}`,
            }}
          >
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: 8.5, letterSpacing: "1.4px",
                color: COLORS.textDim,
              }}
            >
              SELECT CHANNEL
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: FONT_CJK, fontSize: 8.5, color: COLORS.textFaint }}>
              {channels.length} 家可看
            </span>
          </div>
          <div className="mtp-scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
            {channels.map((c, i) => {
              const active = c.id === value;
              const inOther = !active && usedIds.includes(c.id);
              const prev = channels[i - 1];
              const newGroup = i === 0 || prev?.tag !== c.tag;
              return (
                <div key={c.id}>
                  {newGroup && (
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "7px 11px 3px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_CJK, fontSize: 8.5, letterSpacing: "1px",
                          color: COLORS.textDim,
                        }}
                      >
                        {c.tag}
                      </span>
                      <span style={{ flex: 1, height: 1, background: COLORS.borderSoft }} />
                      <span style={{ fontFamily: FONT_DATA, fontSize: 8, color: COLORS.textFaint }}>
                        {channels.filter((x) => x.tag === c.tag).length}
                      </span>
                    </div>
                  )}
                  <button
                    disabled={inOther}
                    onClick={() => {
                      onPick(c.id);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 11px",
                      background: active ? "rgba(100,170,255,0.12)" : "transparent",
                      border: "none",
                      borderLeft: active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                      cursor: inOther ? "not-allowed" : "pointer",
                      opacity: inOther ? 0.4 : 1, textAlign: "left",
                      transition: "background .12s",
                    }}
                  >
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: RADIUS.full, flexShrink: 0,
                        background: c.emergency ? COLORS.statusWarn : "#ff3b30",
                        boxShadow: `0 0 5px ${c.emergency ? COLORS.statusWarn : "#ff3b30"}`,
                        animation: "intelRing 1.6s ease-in-out infinite",
                      }}
                    />
                    <span
                      style={{
                        display: "flex", flexDirection: "column", gap: 1,
                        minWidth: 0, flex: 1,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span
                          style={{
                            fontFamily: FONT_CJK, fontSize: 11.5, fontWeight: 700,
                            color: active ? "#fff" : COLORS.textDefault,
                          }}
                        >
                          {c.name}
                        </span>
                        <span
                          style={{
                            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
                            color: COLORS.textFaint, letterSpacing: "0.5px",
                          }}
                        >
                          {c.en}
                        </span>
                        {c.emergency && (
                          <span
                            style={{
                              fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: "#04121f", fontWeight: 700,
                              padding: "0px 5px", borderRadius: RADIUS.md,
                              background: COLORS.statusWarn,
                            }}
                          >
                            防災
                          </span>
                        )}
                      </span>
                      {(c.note || inOther) && (
                        <span
                          style={{
                            fontFamily: FONT_CJK, fontSize: 8.5,
                            color: inOther ? COLORS.accent : COLORS.textFaint,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}
                        >
                          {inOther ? "另一格播放中" : c.note}
                        </span>
                      )}
                    </span>
                    {active && (
                      <span
                        style={{
                          fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, color: COLORS.accent, flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveSlot({
  chId, onPick, usedIds, resolved, channels,
}: {
  chId: string;
  onPick: (id: string) => void;
  usedIds: string[];
  resolved: YtLiveVideo | undefined;
  channels: LiveChannel[];
}) {
  const ch = LIVE_CHANNELS.find((c) => c.id === chId) ?? LIVE_CHANNELS[0]!;
  const emergency = !!ch.emergency;
  const src = resolveSrc(ch, resolved);
  // IntersectionObserver gate：iframe 只在 slot 首次進入視窗才掛，避免 MonitorPanel
  // 一開就把 4 個 YT player 全載起來吃 CPU/網路（rootMargin: 200px 預載）。
  const slotRef = useRef<HTMLDivElement>(null);
  const visible = useInView(slotRef);
  return (
    <div
      ref={slotRef}
      style={{
        position: "relative", borderRadius: RADIUS.xl, overflow: "visible",
        aspectRatio: "16 / 9", background: "#000",
        border: emergency ? "1px solid rgba(255,152,0,0.55)" : `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: RADIUS.xl, overflow: "hidden" }}>
        {src && visible ? (
          <iframe
            title={ch.name}
            src={src}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              border: "none", display: "block",
            }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        ) : (
          <div
            style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 6, color: COLORS.textFaint,
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, textAlign: "center", padding: 16,
            }}
          >
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px" }}>
              {resolved?.last_error ? "RESOLVER ERROR" : "RESOLVING…"}
            </span>
            <span>
              {resolved?.last_error
                ? `${ch.name}：${resolved.last_error}`
                : `等待 ${ch.handle} 的直播解析`}
            </span>
          </div>
        )}

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
              padding: "1px 6px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.9)",
            }}
          >
            <span
              style={{
                width: 5, height: 5, borderRadius: RADIUS.full, background: "#fff",
                animation: "intelRing 1.6s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: 8.5, fontWeight: 700,
                color: "#fff", letterSpacing: "0.5px",
              }}
            >
              LIVE
            </span>
          </span>
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: 700, color: "#fff",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {ch.name}
          </span>
          {emergency && (
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: "#04121f", fontWeight: 700,
                padding: "1px 6px", borderRadius: RADIUS.md, background: COLORS.statusWarn,
              }}
            >
              目前播放：{ch.emergencyLabel}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute", bottom: 7, left: 8,
          display: "flex", alignItems: "center", gap: 8, zIndex: 20,
        }}
      >
        <ChannelMenu value={chId} onPick={onPick} usedIds={usedIds} channels={channels} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
            textShadow: "0 1px 3px rgba(0,0,0,0.9)", pointerEvents: "none",
          }}
        >
          🔇 點擊解除靜音
        </span>
      </div>
    </div>
  );
}

export const LiveWall = memo(function LiveWall() {
  // 預設 4 格：公視 + 中視 + 三立 + 民視
  const [slots, setSlots] = useState(["pts", "ctv", "set", "ftv"]);
  const setSlot = (i: number) => (id: string) =>
    setSlots((prev) => prev.map((v, k) => (k === i ? id : v)));
  const ctsLive = slots.includes("cts");

  // 抓 realtime.yt_live_current → handle→video_id 對照（10 min refresh）
  const [resolvedRows, setResolvedRows] = useState<YtLiveVideo[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetchLiveVideos(false).then((rows) => {
        if (alive) setResolvedRows(rows);
      });
    };
    tick();
    const id = window.setInterval(tick, 10 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  const resolvedMap = useMemo(() => {
    const m = new Map<string, YtLiveVideo>();
    for (const r of resolvedRows) m.set(r.handle, r);
    return m;
  }, [resolvedRows]);

  // 動態過濾：只留「有有效 src」的頻道（fallbackVideoId 或 resolver 給的可嵌入 video_id）。
  // 沒開播 / embedBlocked 的台不進選單，開播後 resolvedRows 更新會自動回來。
  const availableChannels = useMemo(
    () => LIVE_CHANNELS.filter((ch) => isChannelAvailable(ch, resolvedMap.get(ch.handle))),
    [resolvedMap],
  );

  // 目前選中的格若失效（頻道被過濾掉），自動跳到下一個可用、且未被其他格佔用的頻道，
  // 避免白格。resolvedRows.length === 0 代表首次資料還沒回來，先不動，避免載入瞬間誤判。
  useEffect(() => {
    if (resolvedRows.length === 0) return;
    setSlots((prev) => {
      const next = [...prev];
      const used = new Set(next);
      let changed = false;
      for (let i = 0; i < next.length; i++) {
        const ch = LIVE_CHANNELS.find((c) => c.id === next[i]);
        if (ch && isChannelAvailable(ch, resolvedMap.get(ch.handle))) continue;
        used.delete(next[i]!);
        const replacement = availableChannels.find((c) => !used.has(c.id));
        if (replacement) {
          next[i] = replacement.id;
          used.add(replacement.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [resolvedRows, resolvedMap, availableChannels]);

  return (
    <div
      style={{
        gridColumn: "1 / -1", borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.panelBorder}`,
        background: "rgba(255,255,255,0.022)",
        padding: 13, display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <span style={{ width: 3, height: 12, borderRadius: RADIUS.sm, background: COLORS.accent }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, letterSpacing: "1.5px",
            color: COLORS.textDefault,
          }}
        >
          新聞直播 · LIVE WALL
        </span>
        <div style={{ flex: 1 }} />
        {ctsLive ? (
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.statusWarn,
              padding: "2px 8px", borderRadius: RADIUS.md,
              background: COLORS.statusWarnSoft,
              border: "1px solid rgba(255,152,0,0.3)",
            }}
          >
            ⚠ 華視已切換防災直播
          </span>
        ) : (
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
            4 格同步 · 可切換 {availableChannels.length} 家
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr", gap: 10,
        }}
      >
        {slots.map((chId, i) => {
          const ch = LIVE_CHANNELS.find((c) => c.id === chId);
          const resolved = ch ? resolvedMap.get(ch.handle) : undefined;
          return (
            <LiveSlot
              key={i}
              chId={chId}
              onPick={setSlot(i)}
              usedIds={slots}
              resolved={resolved}
              channels={availableChannels}
            />
          );
        })}
      </div>
      <div
        style={{
          marginTop: 7,
          textAlign: "center",
          fontFamily: FONT_CJK,
          fontSize: 9.5,
          color: COLORS.textFaint,
          lineHeight: 1.5,
        }}
      >
        ⓘ 因為與 YouTube 的連線關係，不一定每格都會有辦法顯示
      </div>
    </div>
  );
});
