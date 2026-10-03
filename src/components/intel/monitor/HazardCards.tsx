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

import { useState, type ReactNode } from "react";
import { FONT_CJK, FONT_DATA, relTime } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import { HazardTrendBars, type HazardBar } from "./HazardTrendBars";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { useMonitorTheme } from "./monitorTheme";
import type { IntelPalette } from "../intelTheme";
import { fs, MF } from "./monitorFont";
import { MonitorMetric, MonitorNote, MonitorSub, type MonitorTone } from "./MonitorMetric";
import { useMonitorFreshness } from "./monitorFreshness";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import type { IntelQueryState } from "../../../hooks/useIntelPollingQuery";
import {
  fetchTyphoonProximityDaily, fetchTyphoonSummary,
  type TyphoonProximityDay, type TyphoonSummary,
} from "../../../data/typhoonTracksLoader";
import {
  fetchEarthquakeDaily, fetchEarthquakeSummary,
  type EarthquakeDay, type EarthquakeSummary,
} from "../../../data/earthquakeLoader";
import {
  fetchNuclearDaily, fetchNuclearSummary, type NuclearDoseDay, type NuclearSummary,
} from "../../../data/nuclearLoader";
import { MS_PER_DAY, taipeiDateKeyFromMs } from "../../../lib/taipeiDay";
import {
  fetchLightningDaily, fetchLightningSummary,
  LIGHTNING_TYPE_LABELS, type LightningDay, type LightningSummary,
} from "../../../data/lightningLoader";

interface Props {
  open: boolean;
  nowTs: number;
}

type MonitorQuery = Pick<IntelQueryState<unknown>, "status" | "lastSuccessAt">;

/* ── 共用外殼 ─────────────────────────────────────────── */

function HazardShell({
  label, labelColor, tint, dot, title, badges, status, children, footer, query, dailyQuery,
}: {
  label: string;
  labelColor: string;
  /** 面板漸層底色（rgba 字串） */
  tint: string;
  dot: string;
  title: string;
  badges?: string[];
  /** v2 專用：有狀態意義的小字（無颱風接近、載入中…）；省略＝卡內不再重複外框標題 */
  status?: string;
  children?: ReactNode;
  footer: string;
  query?: MonitorQuery;
  dailyQuery?: MonitorQuery;
}) {
  const queries = [query, dailyQuery].filter((q): q is MonitorQuery => q != null);
  const denied = queries.some((q) => q.status === "denied");
  const failed = queries.some((q) => q.status === "error");
  const healthTitle = denied ? "資料無權限讀取" : failed ? "資料更新中斷" : title;
  const theme = useMonitorTheme();
  const healthDot = denied || failed ? theme.p.textDim : dot;
  const v2 = useMonitorV2();
  // v2：外框已有標題，卡內只留有狀態意義的小字（中斷／受限／無颱風接近…）
  const v2Status = denied || failed ? healthTitle : status;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* v2：段落標與外框由 MonitorCardFrame 畫 */}
      {!v2 && <SectionLabel color={labelColor}>{label}</SectionLabel>}
      <div
        style={v2 ? { display: "flex", flexDirection: "column", gap: 8 } : {
          borderRadius: RADIUS.xl,
          border: `1px solid ${theme.p.panelBorder}`,
          background: `linear-gradient(160deg, ${tint}, rgba(255,255,255,0.012))`,
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {v2 ? (
          v2Status && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: healthDot, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted, overflowWrap: "anywhere" }}>
                {v2Status}
              </span>
            </div>
          )
        ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 11, height: 11, borderRadius: RADIUS.full, background: healthDot,
              boxShadow: `0 0 7px ${healthDot}`, flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.md), fontWeight: 700,
              color: theme.p.textStrong, minWidth: 0,
              ...(v2 ? { overflowWrap: "anywhere" as const } : null),
            }}
          >
            {healthTitle}
          </span>
          <div style={{ flex: 1 }} />
          {badges?.map((b) => (
            <span
              key={b}
              style={{
                fontFamily: FONT_DATA, fontSize: fs(v2, 8.5), fontWeight: 700, letterSpacing: "0.5px",
                color: theme.p.accent, padding: "1px 5px", borderRadius: RADIUS.md,
                background: theme.p.accentFaint, border: `1px solid ${theme.p.accentSoft}`,
                whiteSpace: "nowrap",
              }}
            >
              {b}
            </span>
          ))}
        </div>
        )}
        {query && <MonitorDataStatus label={label} query={query} />}
        {dailyQuery && <MonitorDataStatus label={`${label} 趨勢`} query={dailyQuery} />}
        {children}
        <div style={{ fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim }}>{footer}</div>
      </div>
    </div>
  );
}

/** 大數字 + 單位 */
function Metric({ value, unit, color, muted }: { value: string; unit: string; color?: string; muted?: boolean }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  if (v2) return <MonitorMetric value={value} unit={unit} color={color} muted={muted} />;
  return (
    <div>
      <span
        style={{
          fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xxl), fontWeight: 700,
          color: color ?? theme.p.textStrong,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted, marginLeft: 4 }}>{unit}</span>
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

/** v2：狀態色的說明改走 MonitorNote；內文色（地點、展開明細）維持正文字級 */
function noteTone(color: string, p: IntelPalette): MonitorTone | undefined {
  if (color === p.textMuted) return "neutral";
  if (color === p.statusWarn) return "warn";
  if (color === p.statusErr) return "err";
  return undefined;
}

function Note({ children, color }: { children: ReactNode; color?: string }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const tone = noteTone(color ?? theme.p.textMuted, theme.p);
  if (v2 && tone) return <MonitorNote tone={tone}>{children}</MonitorNote>;
  return (
    <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), color: color ?? theme.p.textMuted, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

/** 左右對齊的小字列 */
function MetaRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  // v2 左右兩項 → 副資訊列（每項不拆）；單句（例「全部正常（…）」）可能比 1/3 格寬，留原本可換行的寫法
  if (v2 && right != null) return <MonitorSub items={[left, right]} />;
  return (
    <div
      style={{
        fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim,
        display: "flex", justifyContent: "space-between", gap: 8,
        // v2：1/3 寬格約 207px、13px 字下左右兩段放不下就換行，不重疊
        ...(v2 ? { flexWrap: "wrap" as const, rowGap: 2 } : null),
      }}
    >
      <span>{left}</span>
      {right != null && <span>{right}</span>}
    </div>
  );
}

/** 四張卡的趨勢柱一律看同一個窗，卡與卡之間才比得起來 */
const TREND_DAYS = 14;

/**
 * 颱風看 45 天而不是共用的 14 天：颱風是季節性事件，14 天窗常常整片空白
 * （2026-08 中旬實測只有 8/1–8/11 有颱風在 1000km 內），拉長才看得出這一季的節奏。
 * 其餘三卡維持 14 天 —— 地震／落雷／輻射是天天有數字的連續量。
 */
const TYPHOON_TREND_DAYS = 45;
const EMPTY_TYHOON_PROXIMITY: TyphoonProximityDay[] = [];
const EMPTY_EARTHQUAKE_DAILY: EarthquakeDay[] = [];
const EMPTY_NUCLEAR_DAILY: NuclearDoseDay[] = [];
const EMPTY_LIGHTNING_DAILY: LightningDay[] = [];
const fetchTyphoonProximity = () => fetchTyphoonProximityDaily(TYPHOON_TREND_DAYS);

/* ── 颱風 ─────────────────────────────────────────────── */

/** 逼近程度：< 500km 警戒、< 1500km 留意，其餘只是「海上有颱風」 */
function typhoonTone(s: TyphoonSummary, p: IntelPalette): { dot: string; distColor: string } {
  if (s.distance_km <= 500) return { dot: p.statusErr, distColor: p.statusErr };
  if (s.distance_km <= 1500) return { dot: p.statusWarn, distColor: p.statusWarn };
  return { dot: p.accent, distColor: p.textStrong };
}

/**
 * 距離分級 —— 颱風卡唯一有意義的嚴重度軸。
 *
 * 用距離不用風速：一顆 100kt 的強颱在 3000km 外對台灣是零威脅，
 * 而 40kt 的輕颱在 300km 內就要準備。閾值取 CWA 發布警報的量級。
 */
function proximityLevel(km: number | null): number {
  if (km == null) return 0;
  if (km < 300) return 2;   // 海警量級
  if (km < 800) return 1;   // 需要留意
  return 0;
}
const proximityColors = (p: IntelPalette) => [p.accent, p.statusWarn, p.statusErr];
const nearbyColors = (p: IntelPalette) => [p.statusLive, p.statusWarn, p.statusErr];

/**
 * 柱高換算：距離越近柱越高。`PROXIMITY_CEIL - km`，超出天花板的一律 0。
 *
 * 直接拿距離當柱高會反過來 —— 颱風在地球另一邊時柱子最高，正好與「該不該緊張」
 * 相反。1500km 是「還構得上關心」的外圈，再遠的差異對台灣沒有意義。
 */
const PROXIMITY_CEIL_KM = 1500;
function proximityHeight(km: number | null): number | null {
  if (km == null) return null;
  return Math.max(0, PROXIMITY_CEIL_KM - km);
}

/**
 * 45 天接近程度趨勢柱（兩排）＋ 點柱展開明細 —— 有活躍颱風／無活躍颱風兩條路徑
 * 共用同一份 render。RPC 349 的設計初衷就是回答「這段期間有沒有颱風靠近」，
 * 無颱風時才是最該看它的時候，因此兩條路徑都要能畫、都要能點展開（見檔頭 bug 說明）。
 */
function TyphoonTrendSection({
  days, pickedDate, onSelectBar,
}: {
  days: TyphoonProximityDay[];
  pickedDate: string | null;
  onSelectBar: (b: HazardBar) => void;
}) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const distBars: HazardBar[] = days.map((d) => ({
    key: d.dateKey,
    label: d.dateKey.slice(5).replace("-", "/"),
    value: proximityHeight(d.nearestKm),
    level: proximityLevel(d.nearestKm),
    note: d.nearestKm == null
      ? "無觀測"
      : `${d.name ?? d.stormId ?? "—"} ${Math.round(d.nearestKm).toLocaleString("zh-TW")} km`
        + (d.windKt != null ? ` · ${d.windKt} kt` : ""),
  }));
  // v2：沒有觀測的天 stormsNearby=null → 灰樁（與上排 nearestKm=null 同步）；舊版維持補 0
  const nearbyBars: HazardBar[] = days.map((d) => {
    const n = v2 ? d.stormsNearby : (d.stormsNearby ?? 0);
    return {
      key: d.dateKey,
      label: d.dateKey.slice(5).replace("-", "/"),
      value: n,
      level: Math.min(n ?? 0, 2),
      note: n == null ? "無觀測" : `${n} 顆在 1000km 內`,
    };
  });
  const picked = pickedDate != null ? days.find((d) => d.dateKey === pickedDate) ?? null : null;
  const closestKm = days.reduce<number | null>(
    (m, d) => (d.nearestKm != null && (m == null || d.nearestKm < m) ? d.nearestKm : m), null,
  );
  return (
    <>
      {/* 上排：接近程度。柱高刻意反轉（越近越高）—— 直接用距離當柱高的話，
          颱風在地球另一邊時柱子最高，與「該不該緊張」完全相反 */}
      <HazardTrendBars
        bars={distBars}
        levelColors={proximityColors(theme.p)}
        caption={`${v2 ? `近 ${TYPHOON_TREND_DAYS} 天` : `${TYPHOON_TREND_DAYS}D`} · 接近程度（柱越高越近）／距離（色）· 可點`}
        footer={closestKm != null ? `最近 ${Math.round(closestKm).toLocaleString("zh-TW")} km` : undefined}
        height={34}
        heightTier="std"
        unit=" km（距 1500 圈）"
        onSelectBar={onSelectBar}
        selectedKey={pickedDate}
      />
      {/* 下排：顆數。JMA/JTWC 同一顆有兩套編號，RPC 349 已跨來源去重 */}
      <HazardTrendBars
        bars={nearbyBars}
        levelColors={nearbyColors(theme.p)}
        caption={`${v2 ? `近 ${TYPHOON_TREND_DAYS} 天` : `${TYPHOON_TREND_DAYS}D`} · 1000km 內颱風數`}
        height={26}
        heightTier="std"
        unit=" 顆"
        onSelectBar={onSelectBar}
        selectedKey={pickedDate}
      />
      {/* 點某一天展開那天是哪顆 —— 兩排圖只看得出「有沒有／幾顆」，看不出是誰 */}
      {picked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Note color={theme.p.textDefault}>
            {picked.dateKey.slice(5).replace("-", "/")} ·{" "}
            {(picked.stormsNearby ?? 0) > 0
              ? `${picked.stormsNearby} 顆在 1000km 內`
              : picked.nearestKm == null
                ? "當天無颱風觀測"
                : `無颱風在 1000km 內（最近 ${picked.name ?? "—"} `
                  + `${Math.round(picked.nearestKm).toLocaleString("zh-TW")} km）`}
          </Note>
          {/* 一顆一行 —— 說「2 顆」卻只列得出最近那顆，另一顆是誰看不到 */}
          {picked.nearby.map((n) => (
            <MetaRow
              key={n.stormId}
              left={`· ${n.name}`}
              right={`${Math.round(n.km).toLocaleString("zh-TW")} km${n.kt != null ? ` · ${n.kt} kt` : ""}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function TyphoonCard({ open, nowTs }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const summaryQuery = useMonitorResource<TyphoonSummary | null>({
    open, queryKey: "typhoon-summary", intervalMs: 30 * 60_000, emptyData: null,
    load: fetchTyphoonSummary,
  });
  // 標題列資料時間＝最新颱風觀測時刻（valid_ts）；event 型不判過期。
  // 無活躍颱風不是「無資料」：time 為 null 時 fresh 會是 none，但本卡不畫 G2，維持「目前無活躍颱風」文案
  useMonitorFreshness("typhoon", { time: summaryQuery.data ? summaryQuery.data.valid_ts * 1000 : null });
  // 逐日接近程度（RPC 349）。與快照分開輪詢：這份跨日才變，且 RPC 實測 45 天約 900ms
  const dailyQuery = useMonitorResource<TyphoonProximityDay[]>({
    open, queryKey: "typhoon-proximity-45d", intervalMs: 30 * 60_000, emptyData: EMPTY_TYHOON_PROXIMITY,
    load: fetchTyphoonProximity,
  });
  // 點某一天的柱 → 下方展開那天是哪顆颱風。兩排圖共用同一個選取（同一天的兩種切面）
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const pickBar = (b: HazardBar) => {
    const k = b.key ?? b.label;
    setPickedDate((prev) => (prev === k ? null : k));
  };
  const label = "颱風 · TYPHOON";
  const tint = "rgba(56,189,248,0.06)";
  const footer = "來源：JMA / JTWC 颱風路徑 · 活躍判定 24h";

  if (summaryQuery.lastSuccessAt === null) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.textDim} title="活躍颱風（載入中）" status="載入中" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        {summaryQuery.status === "error" && <Note>查詢失敗，非「無活躍颱風」。</Note>}
      </HazardShell>
    );
  }
  const data = summaryQuery.data;
  const days = dailyQuery.data;

  if (!data) {
    // 無活躍颱風時，45 天趨勢柱照常畫（見檔頭 bug 說明：RPC 349 的設計初衷就是回答
    // 「這段期間有沒有颱風靠近」，無颱風時才是最該看它的時候）。只有 45 天內完全
    // 沒資料（RPC 失敗或窗內真的零觀測）才退回純一句話的空狀態。
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.statusLive} title="目前無活躍颱風" status="目前無活躍颱風" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        <Note>JMA / JTWC 近 24 小時無颱風觀測回報。</Note>
        {days.length > 0 && (
          <TyphoonTrendSection days={days} pickedDate={pickedDate} onSelectBar={pickBar} />
        )}
      </HazardShell>
    );
  }

  const tone = typhoonTone(data, theme.p);
  const name = data.name_en || data.name_local || data.storm_id;
  const windMs = data.max_wind_kt != null ? Math.round(data.max_wind_kt * 0.514) : null;
  // 「活躍」只看近 24h 有觀測，東太平洋 10,000km 外的颱風也算活躍 —— 對台灣是零威脅，
  // 標題直說沒颱風接近，主數字仍留著（知道最近的一顆在哪還是有意義）
  const remote = data.distance_km > PROXIMITY_CEIL_KM;
  return (
    <HazardShell
      label={label} labelColor={theme.p.accent} tint={tint}
      dot={remote ? theme.p.statusLive : tone.dot}
      title={remote ? "無颱風接近" : name} status={remote ? "無颱風接近" : name}
      query={summaryQuery} dailyQuery={dailyQuery}
      badges={data.sources} footer={footer}
    >
      <MetricRow>
        <Metric
          value={data.distance_km.toLocaleString("zh-TW")}
          unit={remote ? `km · 最近的是 ${name}` : "km 距台灣"}
          color={remote ? theme.p.textStrong : tone.distColor}
        />
      </MetricRow>
      <TyphoonTrendSection days={days} pickedDate={pickedDate} onSelectBar={pickBar} />
      {/* 右側刻意放 storm_id 而非 name_local —— JMA 的 name_local 是日文片假名
          （實測「ドルフィン」），單獨擺在小字列上像亂碼；storm_id 還能對照地圖層 */}
      <MetaRow
        left={`最大風速 ${data.max_wind_kt ?? "—"} kt${windMs != null ? ` · ${windMs} m/s` : ""}`}
        right={v2 ? relTime(data.valid_ts, nowTs) : `${data.storm_id} · ${relTime(data.valid_ts, nowTs)}`}
      />
    </HazardShell>
  );
}

/* ── 地震 ─────────────────────────────────────────────── */

/** 規模語意色：≥5 警戒紅、≥4 留意橙、其餘平時綠 */
function magColor(mag: number, p: IntelPalette): string {
  if (mag >= 5) return p.statusErr;
  if (mag >= 4) return p.statusWarn;
  return p.statusLive;
}

/** 趨勢柱的規模分級 —— index 與色盤對齊，語意同 `magColor()` */
function magLevel(mag: number | null): number {
  if (mag == null) return 0;
  if (mag >= 5) return 2;
  if (mag >= 4) return 1;
  return 0;
}
const eqLevelColors = (p: IntelPalette) => [p.statusLive, p.statusWarn, p.statusErr];
const fetchEqDaily = () => fetchEarthquakeDaily(TREND_DAYS);

export function EarthquakeCard({ open, nowTs }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const summaryQuery = useMonitorResource<EarthquakeSummary | null>({
    open, queryKey: "earthquake-summary", intervalMs: 15 * 60_000, emptyData: null,
    load: fetchEarthquakeSummary,
  });
  // 標題列資料時間＝最新有感地震發生時刻（event 型不判過期；無地震紀錄走自己的文案，不畫 G2）
  useMonitorFreshness("earthquake", { time: summaryQuery.data?.latest ? summaryQuery.data.latest.occurred_ts * 1000 : null });
  // 逐日趨勢與當下快照分開輪詢：兩者資料來源同一張表但聚合方式不同，
  // 且趨勢只有跨日才會變，沒必要跟快照綁在同一次請求裡。
  const dailyQuery = useMonitorResource({
    open, queryKey: "earthquake-daily-14d", intervalMs: 15 * 60_000, emptyData: EMPTY_EARTHQUAKE_DAILY,
    load: fetchEqDaily,
  });
  const label = "地震 · SEISMIC";
  const tint = "rgba(255,152,0,0.05)";
  const footer = "來源：中央氣象署 CWA 地震報告";

  if (summaryQuery.lastSuccessAt === null || !summaryQuery.data) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.textDim} title="最新有感地震（載入中）" status="載入中" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        {summaryQuery.status === "error" && <Note>查詢失敗，非「無地震紀錄」。</Note>}
      </HazardShell>
    );
  }
  const data = summaryQuery.data;
  const latest = data.latest;
  if (!latest) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.statusLive} title="無地震紀錄" status="無地震紀錄" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        <Note>資料庫中查無地震事件。</Note>
      </HazardShell>
    );
  }

  // 來源沒給規模／深度（null）：v2 顯示「M—」「—」不是 M0.0；舊版維持原本補 0 的畫面
  const mag = latest.magnitude;
  const depth = latest.depth_km;
  const color = mag == null && v2 ? theme.p.textMuted : magColor(mag ?? 0, theme.p);
  const magText = mag == null ? "—" : mag.toFixed(1);
  const depthText = depth == null ? "—" : depth.toFixed(1);
  const eqBars: HazardBar[] = dailyQuery.data.map((d) => ({
    label: d.dateKey.slice(5).replace("-", "/"),
    value: d.count,
    level: magLevel(d.maxMag),
    note: d.maxMag != null ? `最大 M${d.maxMag.toFixed(1)}` : "無地震",
  }));
  const eqTotal = dailyQuery.data.reduce((s, d) => s + d.count, 0);
  return (
    <HazardShell
      label={label} labelColor={theme.p.accent} tint={tint}
      dot={color} title="最新有感地震" footer={footer} query={summaryQuery} dailyQuery={dailyQuery}
    >
      {v2 ? (
        // 「M」前綴放進 value：unit 欄位是尾綴，要保持「M5.9」慣用寫法只能放前面；規模色走 color
        <MonitorMetric value={`M${magText}`} color={color} />
      ) : (
      <MetricRow>
        <div>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.md), color: theme.p.textMuted, marginRight: 3 }}>M</span>
          <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xxl), fontWeight: 700, color }}>
            {(mag ?? 0).toFixed(1)}
          </span>
        </div>
        <div style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted }}>
          深度 {(depth ?? 0).toFixed(1)} km
        </div>
      </MetricRow>
      )}
      {latest.location_desc && <Note color={theme.p.textDefault}>{latest.location_desc}</Note>}
      <HazardTrendBars
        bars={eqBars}
        levelColors={eqLevelColors(theme.p)}
        caption={`${v2 ? `近 ${TREND_DAYS} 天` : `${TREND_DAYS}D`} · 次數（柱）／規模（色）`}
        footer={eqTotal ? `共 ${eqTotal} 次` : undefined}
        heightTier="std"
        unit=" 次"
      />
      {v2 ? (
        <MonitorSub items={[`深度 ${depthText} km`, `24h 內 ${data.count24h} 次`, relTime(latest.occurred_ts, nowTs)]} />
      ) : (
      <MetaRow
        left={`24h 內 ${data.count24h} 次`}
        right={relTime(latest.occurred_ts, nowTs)}
      />
      )}
    </HazardShell>
  );
}

/* ── 輻射 ─────────────────────────────────────────────── */

function fmtDose(v: number | null): string {
  return v == null ? "—" : v.toFixed(3);
}

/**
 * 劑量分級：自然背景上限 0.072 µSv/h（卡片註腳寫的那條）、警戒 0.2（既有異常判定閾值）。
 * 不用相對分位 —— 輻射的意義在「絕對值有沒有離開自然背景」，不在「比前幾天高」。
 */
function doseLevel(v: number | null): number {
  if (v == null) return 0;
  if (v >= 0.2) return 2;
  if (v > 0.072) return 1;
  return 0;
}
const doseLevelColors = (p: IntelPalette) => [p.statusLive, p.statusWarn, p.statusErr];
const fetchNuclearTrend = () => fetchNuclearDaily(TREND_DAYS);
/** v2：日序列錨在今天，停更時尾段出現灰樁 */
const fetchNuclearTrendToday = () => fetchNuclearDaily(TREND_DAYS, { anchorToday: true });

export function RadiationCard({ open }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const summaryQuery = useMonitorResource<NuclearSummary | null>({
    open, queryKey: "nuclear-summary", intervalMs: 5 * 60_000, emptyData: null,
    load: fetchNuclearSummary,
  });
  // 標題列資料時間＝有回報站的最新觀測時間（台電 CSV「日期時間」，15 分週期）；過期／停更畫 G2
  const fresh = useMonitorFreshness("radiation", {
    time: summaryQuery.data?.latest_observed_ts != null ? summaryQuery.data.latest_observed_ts * 1000 : null,
  });
  // v2 只有 stale／stopped 才把日序列補到今天（灰樁尾段）；平常錨最後一列，避免「今天」常態灰樁
  const staleNow = v2 && fresh.muted && fresh.state !== "none";
  const dailyQuery = useMonitorResource({
    open, queryKey: staleNow ? "nuclear-daily-14d-today" : "nuclear-daily-14d", intervalMs: 30 * 60_000,
    emptyData: EMPTY_NUCLEAR_DAILY,
    load: staleNow ? fetchNuclearTrendToday : fetchNuclearTrend,
  });
  const label = "輻射 · RADIATION";
  const tint = "rgba(34,197,94,0.05)";
  const footer = "來源：全國環境輻射即時監測站 · 自然背景 0.039–0.072 µSv/h";

  if (summaryQuery.lastSuccessAt === null || !summaryQuery.data) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.textDim} title="全國環境輻射（載入中）" status="載入中" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        {summaryQuery.status === "error" && <Note>查詢失敗，非「上游未回報任何監測站」。</Note>}
      </HazardShell>
    );
  }
  const data = summaryQuery.data;
  if (data.total === 0) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.textDim} title="全國環境輻射" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        <Note>上游未回報任何監測站。</Note>
      </HazardShell>
    );
  }

  const alarm = data.alarm_count > 0;
  const watch = data.warning_count > 0;
  const dot = alarm ? theme.p.statusErr : watch ? theme.p.statusWarn : theme.p.statusLive;
  const doseBars: HazardBar[] = dailyQuery.data.map((d) => ({
    label: d.dateKey.slice(5).replace("-", "/"),
    // 沒有量測的日子是 null（畫灰樁）；不是 0 —— 0 µSv/h 在物理上不會發生，畫成 0 會誤導
    value: d.meanUsvh == null ? null : Number(d.meanUsvh.toFixed(3)),
    level: doseLevel(d.meanUsvh),
    // 沒有資料的天（日序列補到今天後的尾段）不寫「0 站」；舊版維持原本寫法
    note: d.stationCount == null && v2 ? "無資料" : `最高 ${fmtDose(d.maxUsvh)} · ${d.stationCount ?? 0} 站`,
  }));
  return (
    <HazardShell
      label={label} labelColor={theme.p.accent} tint={tint}
      dot={dot} title="全國環境輻射" badges={[`${data.reporting}/${data.total} 站`]} footer={footer}
      query={summaryQuery} dailyQuery={dailyQuery}
    >
      {v2 ? (
        <>
          <Metric
            value={fresh.state === "none" ? "—" : fmtDose(data.avg_usvh)}
            unit="µSv/h 平均" muted={fresh.muted}
          />
          <MonitorSub items={[
            `最高 ${fmtDose(data.max_usvh)}${data.max_station ? ` · ${data.max_station}` : ""}`,
            `${data.reporting}/${data.total} 站回報`,
          ]} />
          {fresh.reason && (
            <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>
          )}
        </>
      ) : (
      <MetricRow>
        <Metric value={fmtDose(data.avg_usvh)} unit="µSv/h 平均" />
        <div style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted }}>
          最高 {fmtDose(data.max_usvh)}{data.max_station ? ` · ${data.max_station}` : ""}
        </div>
      </MetricRow>
      )}
      {alarm ? (
        <Note color={theme.p.statusErr}>
          警戒 {data.alarm_count} 站：
          {data.anomalies.filter((a) => a.level === "alarm").map((a) => `${a.name}(${a.dose.toFixed(2)})`).join("、")}
        </Note>
      ) : watch ? (
        <Note color={theme.p.statusWarn}>
          觀察 {data.warning_count} 站：
          {data.anomalies.map((a) => `${a.name}(${a.dose.toFixed(2)})`).join("、")}
        </Note>
      ) : (
        <MetaRow left="全部正常（無站超過 0.2 µSv/h）" />
      )}
      <HazardTrendBars
        bars={doseBars}
        levelColors={doseLevelColors(theme.p)}
        caption={`${v2 ? `近 ${TREND_DAYS} 天` : `${TREND_DAYS}D`} · 全站平均（柱）／水位（色）`}
        heightTier="std"
        unit=" µSv/h"
      />
    </HazardShell>
  );
}

/* ── 落雷 ─────────────────────────────────────────────── */

/**
 * 從一組每日次數算出「相對多寡」的兩條分界。
 *
 * 分位只拿**有落雷的日子**算：乾季一連好幾天 0，全算進去會把中位數壓成 0，
 * 於是任何一點雷都跳成「偏多」。當日是 0 就自然落在最低級。
 *
 * 一次排序算完 p50/p90 —— 分級與中位數共用同一份，不要在每根柱的 map 裡重算。
 */
function strikeThresholds(values: number[]): { p50: number; p90: number } {
  const s = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!s.length) return { p50: 0, p90: 0 };
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))]!;
  return { p50: q(0.5), p90: q(0.9) };
}
const strikeLevelColors = (p: IntelPalette) => [p.statusLive, p.statusWarn, p.statusErr];
const fetchLightningTrend = () => fetchLightningDaily(TREND_DAYS);
/** v2：日序列錨在今天；最後收集日之後的天＝null（灰樁），也用來判斷來源是否停更 */
const fetchLightningTrendToday = () => fetchLightningDaily(TREND_DAYS, { anchorToday: true });

export function LightningCard({ open, nowTs }: Props) {
  const v2 = useMonitorV2();
  const theme = useMonitorTheme();
  const summaryQuery = useMonitorResource<LightningSummary | null>({
    open, queryKey: "lightning-summary", intervalMs: 5 * 60_000, emptyData: null,
    load: fetchLightningSummary,
  });
  // 標題列資料時間＝最新一筆落雷時刻（event 型不判過期）；今日無落雷時不送。
  // 來源是否停更改由下方「逐日彙整最後收集日」判斷（見 sourceUnconfirmed）
  useMonitorFreshness("lightning", { time: summaryQuery.data?.latest ? summaryQuery.data.latest.ts * 1000 : null });
  const dailyQuery = useMonitorResource({
    open, queryKey: v2 ? "lightning-daily-14d-today" : "lightning-daily-14d", intervalMs: 30 * 60_000,
    emptyData: EMPTY_LIGHTNING_DAILY,
    load: v2 ? fetchLightningTrendToday : fetchLightningTrend,
  });
  const label = "落雷 · LIGHTNING";
  const tint = "rgba(251,146,60,0.05)";
  const footer = "來源：氣象署 CWA 落雷觀測（滾動 1h，無電流強度）";

  if (summaryQuery.lastSuccessAt === null || !summaryQuery.data) {
    return (
      <HazardShell label={label} labelColor={theme.p.accent} tint={tint}
        dot={theme.p.textDim} title="全國落雷（載入中）" status="載入中" footer={footer}
        query={summaryQuery} dailyQuery={dailyQuery}
      >
        {summaryQuery.status === "error" && <Note>查詢失敗，非「無落雷」。</Note>}
      </HazardShell>
    );
  }
  const data = summaryQuery.data;

  // 計數沒給（null）≠ 0：v2 顯示「—」＋原因。舊版維持原本補 0 的畫面
  const countUnknown = data.countDay == null || data.count1h == null;
  const count1h = data.count1h ?? 0;
  const countDay = data.countDay ?? 0;
  // 今日 0 筆時，要有「來源還活著」的證據才能說「今日尚無落雷」：
  // 逐日彙整（cron 補昨天）最後一個有資料的台灣日，落後超過 1 個整天（< 前天）就是來源停更的徵兆
  const lastDataKey = dailyQuery.data.reduce<string | null>((m, d) => (d.count != null ? d.dateKey : m), null);
  const aliveCutoff = taipeiDateKeyFromMs(nowTs * 1000 - 2 * MS_PER_DAY);
  // 逐日彙整落後 > 2 天：最後一筆之後的天才是 null（灰樁）；否則到今天都是真 0（乾季無雷正常）
  const dailyBehind = v2 && dailyQuery.lastSuccessAt !== null && (lastDataKey == null || lastDataKey < aliveCutoff);
  const sourceUnconfirmed = dailyBehind && !countUnknown && countDay === 0;
  const uncertain = v2 && (countUnknown || sourceUnconfirmed);
  const active = count1h > 0;
  const quiet = countDay === 0;
  const dot = active ? theme.p.statusWarn : theme.p.statusLive;
  // 台電源 2026-07-10 起端點活著但永遠回空 → 明說斷供，不混進主數字
  const fb = data.fallbackCountDay;
  const fallbackNote = fb == null && v2
    ? "台電源 今日計數無法取得"
    : (fb ?? 0) > 0
      ? `台電源 今日 ${(fb ?? 0).toLocaleString("zh-TW")} 筆`
      : "台電源 上游斷供中（端點回空）";
  const dayCounts = dailyQuery.data.map((d) => d.count ?? (dailyBehind ? null : 0));
  const { p50: strikeMedian, p90: strikeP90 } = strikeThresholds(
    dayCounts.flatMap((c) => (c != null ? [c] : [])),
  );
  const strikeBars: HazardBar[] = dailyQuery.data.map((d, i) => ({
    label: d.dateKey.slice(5).replace("-", "/"),
    value: dayCounts[i] ?? null,
    level: dayCounts[i] == null ? 0 : dayCounts[i]! > strikeP90 ? 2 : dayCounts[i]! > strikeMedian ? 1 : 0,
    note: d.cloudToGround != null ? `雲地 ${d.cloudToGround.toLocaleString("zh-TW")}` : undefined,
  }));

  return (
    <HazardShell
      label={label} labelColor={theme.p.accent} tint={tint}
      dot={uncertain ? theme.p.textDim : dot}
      title={uncertain ? "今日落雷數無法確認" : quiet ? "今日尚無落雷" : "全國落雷"}
      status={uncertain ? "今日落雷數無法確認" : quiet ? "今日尚無落雷" : undefined}
      badges={["CWA"]} footer={footer}
      query={summaryQuery} dailyQuery={dailyQuery}
    >
      {uncertain ? (
        <>
          <Metric value="—" unit="次 / 近 1h" muted />
          <Note color={theme.p.statusWarn}>
            {countUnknown
              ? "落雷計數查詢沒有回應，無法判斷今日是否有落雷。"
              : lastDataKey == null
                ? "今日尚無落雷紀錄，但逐日彙整沒有任何資料，無法確認來源是否正常。"
                : `今日尚無落雷紀錄，但逐日彙整停在 ${lastDataKey.slice(5).replace("-", "/")}，無法確認來源是否正常。`}
          </Note>
        </>
      ) : quiet ? (
        <Note>氣象署源今日（{data.dateKey}）尚無落雷紀錄。</Note>
      ) : (
        v2 ? (
          <>
            <Metric
              value={count1h.toLocaleString("zh-TW")}
              unit="次 / 近 1h"
              color={active ? theme.p.statusWarn : theme.p.textStrong}
            />
            <MonitorSub items={[
              `今日累計 ${countDay.toLocaleString("zh-TW")} 次`,
              data.latest
                ? `最新 ${relTime(data.latest.ts, nowTs)} · ${LIGHTNING_TYPE_LABELS[data.latest.strikeType] ?? "未知型別"}`
                : "最新 —",
            ]} />
          </>
        ) : (
        <>
          <MetricRow>
            <Metric
              value={count1h.toLocaleString("zh-TW")}
              unit="次 / 近 1h"
              color={active ? theme.p.statusWarn : theme.p.textStrong}
            />
            <div style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textMuted }}>
              今日累計 {countDay.toLocaleString("zh-TW")} 次
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
        )
      )}
      <HazardTrendBars
        bars={strikeBars}
        levelColors={strikeLevelColors(theme.p)}
        caption={`${v2 ? `近 ${TREND_DAYS} 天` : `${TREND_DAYS}D`} · 次數（柱）／相對多寡（色）`}
        footer={strikeMedian ? `有雷日中位 ${strikeMedian.toLocaleString("zh-TW")}` : undefined}
        heightTier="std"
        unit=" 次"
      />
      <MetaRow left={fallbackNote} />
    </HazardShell>
  );
}
