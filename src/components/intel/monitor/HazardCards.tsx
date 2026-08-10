/**
 * 監看模式的四張 hazard 資訊卡：颱風 / 地震 / 輻射 / 落雷。
 *
 * 四張共用同一個外殼（HazardShell）—— 版型是 PrisonCard / AirportPaxCard 那一系：
 * SectionLabel ＋ 圓角面板（主題色漸層）＋ 狀態點 ＋ 大數字 ＋ 次要列 ＋ 來源註腳。
 *
 * ⚠️ 四張都是**牆面掃視**用途，所以每張都必須有「沒事」與「拿不到」兩種畫面：
 *   - 沒事（無活躍颱風 / 近期無地震 / 全部正常 / 今日無落雷）→ 綠點 + 一句話，不留空白
 *   - 拿不到（查詢失敗）→ 灰點 + 明說「資料暫時無法取得」，**不可畫成 0**
 * 落雷還多一層：台電源自 2026-07-10 起端點活著但永遠回空（BACKLOG DS-01/03），
 * 卡片主來源改氣象署，台電當日計數只用來標示「上游斷供」狀態。
 *
 * 資料一律走 src/data/*Loader.ts（元件內不直接打 supabase）。
 */

import { useEffect, useState, type ReactNode } from "react";
import { COLORS, FONT_CJK, FONT_DATA, relTime } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchTyphoonSummary, invalidateTyphoonSummary, type TyphoonSummary,
} from "../../../data/typhoonTracksLoader";
import {
  fetchEarthquakeSummary, invalidateEarthquakeSummary, type EarthquakeSummary,
} from "../../../data/earthquakeLoader";
import { fetchNuclearSummary, type NuclearSummary } from "../../../data/nuclearLoader";
import {
  fetchLightningSummary, invalidateLightningSummary,
  LIGHTNING_TYPE_LABELS, type LightningSummary,
} from "../../../data/lightningLoader";

interface Props {
  open: boolean;
  nowTs: number;
}

type Phase = "loading" | "ready" | "error";

/* ── 共用外殼 ─────────────────────────────────────────── */

function HazardShell({
  label, labelColor, tint, dot, title, badges, children, footer,
}: {
  label: string;
  labelColor: string;
  /** 面板漸層底色（rgba 字串） */
  tint: string;
  dot: string;
  title: string;
  badges?: string[];
  children?: ReactNode;
  footer: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={labelColor}>{label}</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl,
          border: `1px solid ${COLORS.panelBorder}`,
          background: `linear-gradient(160deg, ${tint}, rgba(255,255,255,0.012))`,
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 11, height: 11, borderRadius: RADIUS.full, background: dot,
              boxShadow: `0 0 7px ${dot}`, flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, fontWeight: 700,
              color: COLORS.textStrong, minWidth: 0,
            }}
          >
            {title}
          </span>
          <div style={{ flex: 1 }} />
          {badges?.map((b) => (
            <span
              key={b}
              style={{
                fontFamily: FONT_DATA, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.5px",
                color: COLORS.accent, padding: "1px 5px", borderRadius: RADIUS.md,
                background: COLORS.accentFaint, border: `1px solid ${COLORS.accentSoft}`,
                whiteSpace: "nowrap",
              }}
            >
              {b}
            </span>
          ))}
        </div>
        {children}
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>{footer}</div>
      </div>
    </div>
  );
}

/** 大數字 + 單位 */
function Metric({ value, unit, color }: { value: string; unit: string; color?: string }) {
  return (
    <div>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700,
          color: color ?? COLORS.textStrong,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginLeft: 4 }}>{unit}</span>
    </div>
  );
}

/** 大數字那一排（大數字 + 右側次要字） */
function MetricRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
      {children}
    </div>
  );
}

function Note({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: color ?? COLORS.textMuted, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

/** 左右對齊的小字列 */
function MetaRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        fontSize: FONT_SIZE.xs, color: COLORS.textDim,
        display: "flex", justifyContent: "space-between", gap: 8,
      }}
    >
      <span>{left}</span>
      {right != null && <span>{right}</span>}
    </div>
  );
}

/** 每張卡共用的輪詢：open 時立刻抓一次，之後每 pollMs 失效重抓 */
function usePolledSummary<T>(
  open: boolean,
  fetcher: () => Promise<T>,
  invalidate: (() => void) | null,
  pollMs: number,
  tag: string,
): { data: T | null; phase: Phase } {
  const [data, setData] = useState<T | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = () => {
      fetcher()
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setPhase("ready");
        })
        .catch((e) => {
          console.warn(tag, e);
          if (!cancelled) setPhase("error");
        });
    };
    tick();
    const id = window.setInterval(() => {
      invalidate?.();
      tick();
    }, pollMs);
    return () => { cancelled = true; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pollMs]);
  return { data, phase };
}

/* ── 颱風 ─────────────────────────────────────────────── */

/** 逼近程度：< 500km 警戒、< 1500km 留意，其餘只是「海上有颱風」 */
function typhoonTone(s: TyphoonSummary): { dot: string; distColor: string } {
  if (s.distance_km <= 500) return { dot: COLORS.statusErr, distColor: COLORS.statusErr };
  if (s.distance_km <= 1500) return { dot: COLORS.statusWarn, distColor: COLORS.statusWarn };
  return { dot: COLORS.accent, distColor: COLORS.textStrong };
}

export function TyphoonCard({ open, nowTs }: Props) {
  const { data, phase } = usePolledSummary<TyphoonSummary | null>(
    open, fetchTyphoonSummary, invalidateTyphoonSummary, 30 * 60_000, "[TyphoonCard]",
  );
  const label = "颱風 · TYPHOON";
  const tint = "rgba(56,189,248,0.06)";
  const footer = "來源：JMA / JTWC 颱風路徑 · 活躍判定 24h";

  if (phase === "error") {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="颱風資料暫時無法取得" footer={footer}>
        <Note>下次輪詢（30 分鐘）會再試一次。</Note>
      </HazardShell>
    );
  }
  if (phase === "loading") {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="活躍颱風（載入中）" footer={footer} />
    );
  }
  if (!data) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.statusLive} title="目前無活躍颱風" footer={footer}>
        <Note>JMA / JTWC 近 24 小時無颱風觀測回報。</Note>
      </HazardShell>
    );
  }

  const tone = typhoonTone(data);
  const name = data.name_en || data.name_local || data.storm_id;
  const windMs = data.max_wind_kt != null ? Math.round(data.max_wind_kt * 0.514) : null;
  return (
    <HazardShell
      label={label} labelColor={COLORS.accent} tint={tint}
      dot={tone.dot} title={name} badges={data.sources} footer={footer}
    >
      <MetricRow>
        <Metric value={data.distance_km.toLocaleString("zh-TW")} unit="km 距台灣" color={tone.distColor} />
        <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          中心氣壓 {data.center_pressure ?? "—"} hPa
        </div>
      </MetricRow>
      {/* 右側刻意放 storm_id 而非 name_local —— JMA 的 name_local 是日文片假名
          （實測「ドルフィン」），單獨擺在小字列上像亂碼；storm_id 還能對照地圖層 */}
      <MetaRow
        left={`最大風速 ${data.max_wind_kt ?? "—"} kt${windMs != null ? ` · ${windMs} m/s` : ""}`}
        right={`${data.storm_id} · ${relTime(data.valid_ts, nowTs)}`}
      />
    </HazardShell>
  );
}

/* ── 地震 ─────────────────────────────────────────────── */

/** 規模語意色：≥5 警戒紅、≥4 留意橙、其餘平時綠 */
function magColor(mag: number): string {
  if (mag >= 5) return COLORS.statusErr;
  if (mag >= 4) return COLORS.statusWarn;
  return COLORS.statusLive;
}

export function EarthquakeCard({ open, nowTs }: Props) {
  const { data, phase } = usePolledSummary<EarthquakeSummary>(
    open, fetchEarthquakeSummary, invalidateEarthquakeSummary, 15 * 60_000, "[EarthquakeCard]",
  );
  const label = "地震 · SEISMIC";
  const tint = "rgba(255,152,0,0.05)";
  const footer = "來源：中央氣象署 CWA 地震報告";

  if (phase === "error") {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="地震資料暫時無法取得" footer={footer}>
        <Note>下次輪詢（15 分鐘）會再試一次。</Note>
      </HazardShell>
    );
  }
  if (phase === "loading" || !data) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="最新有感地震（載入中）" footer={footer} />
    );
  }
  const latest = data.latest;
  if (!latest) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.statusLive} title="無地震紀錄" footer={footer}>
        <Note>資料庫中查無地震事件。</Note>
      </HazardShell>
    );
  }

  const color = magColor(latest.magnitude);
  return (
    <HazardShell
      label={label} labelColor={COLORS.accent} tint={tint}
      dot={color} title="最新有感地震" footer={footer}
    >
      <MetricRow>
        <div>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginRight: 3 }}>M</span>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
            {latest.magnitude.toFixed(1)}
          </span>
        </div>
        <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          深度 {latest.depth_km.toFixed(1)} km
        </div>
      </MetricRow>
      {latest.location_desc && <Note color={COLORS.textDefault}>{latest.location_desc}</Note>}
      <MetaRow
        left={`24h 內 ${data.count24h} 次`}
        right={relTime(latest.occurred_ts, nowTs)}
      />
    </HazardShell>
  );
}

/* ── 輻射 ─────────────────────────────────────────────── */

function fmtDose(v: number | null): string {
  return v == null ? "—" : v.toFixed(3);
}

export function RadiationCard({ open }: Props) {
  const { data, phase } = usePolledSummary<NuclearSummary>(
    open, fetchNuclearSummary, null, 5 * 60_000, "[RadiationCard]",
  );
  const label = "輻射 · RADIATION";
  const tint = "rgba(34,197,94,0.05)";
  const footer = "來源：全國環境輻射即時監測站 · 自然背景 0.039–0.072 µSv/h";

  if (phase === "error") {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="輻射資料暫時無法取得" footer={footer}>
        <Note>下次輪詢（5 分鐘）會再試一次。</Note>
      </HazardShell>
    );
  }
  if (phase === "loading" || !data) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="全國環境輻射（載入中）" footer={footer} />
    );
  }
  if (data.total === 0) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="全國環境輻射" footer={footer}>
        <Note>上游未回報任何監測站。</Note>
      </HazardShell>
    );
  }

  const alarm = data.alarm_count > 0;
  const watch = data.warning_count > 0;
  const dot = alarm ? COLORS.statusErr : watch ? COLORS.statusWarn : COLORS.statusLive;
  return (
    <HazardShell
      label={label} labelColor={COLORS.accent} tint={tint}
      dot={dot} title="全國環境輻射" badges={[`${data.reporting}/${data.total} 站`]} footer={footer}
    >
      <MetricRow>
        <Metric value={fmtDose(data.avg_usvh)} unit="µSv/h 平均" />
        <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          最高 {fmtDose(data.max_usvh)}{data.max_station ? ` · ${data.max_station}` : ""}
        </div>
      </MetricRow>
      {alarm ? (
        <Note color={COLORS.statusErr}>
          警戒 {data.alarm_count} 站：
          {data.anomalies.filter((a) => a.level === "alarm").map((a) => `${a.name}(${a.dose.toFixed(2)})`).join("、")}
        </Note>
      ) : watch ? (
        <Note color={COLORS.statusWarn}>
          觀察 {data.warning_count} 站：
          {data.anomalies.map((a) => `${a.name}(${a.dose.toFixed(2)})`).join("、")}
        </Note>
      ) : (
        <MetaRow left="全部正常（無站超過 0.2 µSv/h）" />
      )}
    </HazardShell>
  );
}

/* ── 落雷 ─────────────────────────────────────────────── */

export function LightningCard({ open, nowTs }: Props) {
  const { data, phase } = usePolledSummary<LightningSummary>(
    open, fetchLightningSummary, invalidateLightningSummary, 5 * 60_000, "[LightningCard]",
  );
  const label = "落雷 · LIGHTNING";
  const tint = "rgba(251,146,60,0.05)";
  const footer = "來源：氣象署 CWA 落雷觀測（滾動 1h，無電流強度）";

  if (phase === "loading" || !data) {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="全國落雷（載入中）" footer={footer} />
    );
  }
  // 查詢失敗與「真的沒打雷」必須分得出來 —— 失敗畫成 0 次會謊報平安
  if (data.failed || phase === "error") {
    return (
      <HazardShell label={label} labelColor={COLORS.accent} tint={tint}
        dot={COLORS.textDim} title="落雷資料暫時無法取得" footer={footer}>
        <Note>查詢失敗，非「無落雷」。下次輪詢（5 分鐘）會再試一次。</Note>
      </HazardShell>
    );
  }

  const active = data.count1h > 0;
  const quiet = data.countDay === 0;
  const dot = active ? COLORS.statusWarn : COLORS.statusLive;
  // 台電源 2026-07-10 起端點活著但永遠回空 → 明說斷供，不混進主數字
  const fallbackNote = data.fallbackCountDay > 0
    ? `台電源 今日 ${data.fallbackCountDay.toLocaleString("zh-TW")} 筆`
    : "台電源 上游斷供中（端點回空）";

  return (
    <HazardShell
      label={label} labelColor={COLORS.accent} tint={tint}
      dot={dot} title={quiet ? "今日尚無落雷" : "全國落雷"} badges={["CWA"]} footer={footer}
    >
      {quiet ? (
        <Note>氣象署源今日（{data.dateKey}）尚無落雷紀錄。</Note>
      ) : (
        <>
          <MetricRow>
            <Metric
              value={data.count1h.toLocaleString("zh-TW")}
              unit="次 / 近 1h"
              color={active ? COLORS.statusWarn : COLORS.textStrong}
            />
            <div style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
              今日累計 {data.countDay.toLocaleString("zh-TW")} 次
            </div>
          </MetricRow>
          <MetaRow
            left={
              data.latest
                ? `最新 ${relTime(data.latest.ts, nowTs)} · ${LIGHTNING_TYPE_LABELS[data.latest.strikeType] ?? "未知型別"}`
                : "最新 —"
            }
          />
        </>
      )}
      <MetaRow left={fallbackNote} />
    </HazardShell>
  );
}
