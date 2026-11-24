/**
 * 全球重大事件每月期別檔（scripts/export/export-global-event-months.sh 產生，format `global-events-month-v1`）。
 * 給長期時間條「事件點」類用（STANDARD §4 globalEvents）：每列＝一個 AI 初判候選（不含雜訊），月份依台北時間切；
 * 地點是新聞提及的城市／國家代表點（不是精確發生地），座標到小數 2 位。
 * 時間條接線（manifest longTerm、adapter、地圖層）要等檔案上 R2 才能登記（layerLongTerm.test 要求有部署路徑），見 PR 說明。
 */
export type GlobalEventMonthPlaceKind = "country_center" | "city_center" | "event_point" | "other";

export interface GlobalEventMonthEvent {
  id: string;
  /** 收錄時間（unix 秒） */
  t: number;
  category: string | null;
  severity: number | null;
  title: string;
  places: { lng: number; lat: number; kind: GlobalEventMonthPlaceKind }[];
}

export interface GlobalEventMonth {
  month: string;
  partial: boolean;
  candidates: number;
  noiseExcluded: number;
  /** 沒有任何可畫地點、因此不在 events 裡的候選數 */
  noLocation: number;
  events: GlobalEventMonthEvent[];
}

const KINDS: Record<string, GlobalEventMonthPlaceKind> = { n: "country_center", c: "city_center", e: "event_point", o: "other" };

export function globalEventMonthFile(month: string): string {
  return `/static-rpc/get_global_event_month_${month.replace("-", "")}.json`;
}

/** 欄式 cols／rows 轉成物件；座標不合法的地點略過、沒有地點的列略過（不補 0、不猜座標）。 */
export function parseGlobalEventMonth(value: unknown): GlobalEventMonth {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("global event month file is not an object");
  const file = value as Record<string, unknown>;
  if (file.format !== "global-events-month-v1" || typeof file.month !== "string" || !Array.isArray(file.cols) || !Array.isArray(file.rows)) {
    throw new Error("global event month file has an unknown format");
  }
  const cols = file.cols as unknown[];
  const at = { id: cols.indexOf("id"), t: cols.indexOf("t"), cat: cols.indexOf("cat"), sev: cols.indexOf("sev"), title: cols.indexOf("title"), pts: cols.indexOf("pts") };
  if (Object.values(at).some((index) => index < 0)) throw new Error("global event month file is missing columns");
  const events = (file.rows as unknown[]).flatMap((row): GlobalEventMonthEvent[] => {
    if (!Array.isArray(row)) return [];
    const t = Number(row[at.t]);
    if (!Number.isFinite(t)) return [];
    const places = (Array.isArray(row[at.pts]) ? row[at.pts] as unknown[] : []).flatMap((pt) => {
      if (!Array.isArray(pt) || typeof pt[0] !== "number" || typeof pt[1] !== "number") return [];
      const lng = pt[0]; const lat = pt[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) return [];
      return [{ lng, lat, kind: KINDS[String(pt[2])] ?? "other" }];
    });
    if (!places.length) return [];
    const severity = row[at.sev] === null ? null : Number(row[at.sev]);
    return [{ id: String(row[at.id] ?? ""), t, places,
      category: typeof row[at.cat] === "string" ? row[at.cat] as string : null,
      severity: severity !== null && Number.isFinite(severity) ? severity : null,
      title: String(row[at.title] ?? "") }];
  });
  return { month: file.month, partial: file.partial === true, candidates: Number(file.candidates ?? 0),
    noiseExcluded: Number(file.noise_excluded ?? 0), noLocation: Number(file.no_location ?? 0), events };
}
