import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { useLocale } from "../state/localeStore";
import { longTermBarStore } from "../state/longTermBarStore";
import type { MeasureController } from "../map/measureController";
import {
  fetchRemoteVersion,
  isUpdateSimulated,
  startVersionWatcher,
  versionKey,
  type AppVersionInfo,
} from "../utils/appVersionCheck";
import "./newVersionNotice.css";

const LOCAL: AppVersionInfo = { version: __APP_VERSION__, build: __APP_BUILD__ };
const DISMISS_KEY = "pulse.updDismissed";
// 網址會被地圖狀態改寫（replaceState），參數在模組載入時讀一次
const INITIAL_SEARCH = typeof window === "undefined" ? "" : window.location.search;
const SIMULATED = isUpdateSimulated(INITIAL_SEARCH, safeStorage("localStorage"), import.meta.env.DEV);

function safeStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[kind];
  } catch {
    return null;
  }
}

/**
 * 「網站有新版本」提示（AG-10）：發版後已開著的分頁在回到前景或每 12 分鐘比對 /version.json，
 * 不同就提示重新整理；不強制。使用者操作中（AI 對話、Agent 操作地圖、量測、播放、拍攝模式）延後顯示。
 * 樣式為右下卡片（站主定案）；開發模式 `?upd_sim=1` 直接模擬有新版。
 */
export function NewVersionNotice({
  busy,
  measure,
  isDarkTheme = true,
  isMobile = false,
}: {
  busy: boolean;
  measure: MeasureController;
  isDarkTheme?: boolean;
  isMobile?: boolean;
}) {
  const { t } = useLocale();
  const [remote, setRemote] = useState<AppVersionInfo | null>(() => (SIMULATED ? { version: `${LOCAL.version}-sim`, build: "sim" } : null));
  const [dismissed, setDismissed] = useState<string | null>(() => (SIMULATED ? null : safeStorage("sessionStorage")?.getItem(DISMISS_KEY) ?? null));
  const measuring = useSyncExternalStore(measure.subscribe, () => measure.getSnapshot().active);
  const longTermPlaying = useSyncExternalStore(longTermBarStore.subscribe, () => longTermBarStore.getSnapshot().playing);

  useEffect(() => {
    // dev server 沒有 /version.json；開發模式只走模擬
    if (SIMULATED || import.meta.env.DEV) return;
    return startVersionWatcher({ local: LOCAL, fetchVersion: () => fetchRemoteVersion(), onUpdate: setRemote });
  }, []);

  const deferred = busy || measuring || longTermPlaying;
  const show = !!remote && !deferred && dismissed !== versionKey(remote);
  if (!show || !remote) return null;

  const reload = () => window.location.reload();
  const later = () => {
    const key = versionKey(remote);
    setDismissed(key);
    if (!SIMULATED) safeStorage("sessionStorage")?.setItem(DISMISS_KEY, key);
  };
  const cls = `upd upd--a${isDarkTheme ? "" : " upd--light"}${isMobile ? " upd--mobile" : ""}`;
  return (
    <div className={cls}>
      <section className="upd__card" role="status" aria-live="polite" aria-label={t("updateNotice.aria")}>
        <div className="upd__head">
          <RefreshCw size={13} aria-hidden="true" className="upd__icon" />
          <p className="upd__title">{t("updateNotice.title")}</p>
        </div>
        <p className="upd__detail">{t("updateNotice.detail")}</p>
        <div className="upd__actions">
          <button type="button" className="upd__btn upd__btn--primary" onClick={reload}>{t("updateNotice.reload")}</button>
          <button type="button" className="upd__btn" onClick={later}>{t("updateNotice.later")}</button>
        </div>
      </section>
    </div>
  );
}
