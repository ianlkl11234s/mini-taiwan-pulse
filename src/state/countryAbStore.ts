/**
 * 手機「兩國 A／B 切換」（G2-2，站主 2026-11-24 決定）：手機不並排兩張地圖，一次只開一張，
 * 在 A、B 兩國之間切換；每國記住自己的鏡頭（`countryCameraMemory`，G1-a）。
 *
 * - 這裡只存「哪兩國」；目前顯示哪一國＝`countryStore`（切換就是換國家＋飛到該國上次的鏡頭）。
 * - B 一律是外國（同桌機並排右側的規則，`pickRightCountry`）；A 可以是任何國家。
 * - 手機專用，不寫 localStorage、不寫網址：網址仍寫成桌機的 `cmp=2&cmpc=…`（App 把它放在手機寄放的比較狀態），
 *   回到桌機寬度時還原成兩國並排。
 */
import { useSyncExternalStore } from "react";
import type { CountryCamera, CountryCode } from "../constants/countries";
import type { UrlState } from "../lib/urlState";
import { pickRightCountry } from "./compareStore";
import { countryCameraMemory } from "./countryStore";

export interface CountryAb { a: CountryCode; b: CountryCode }

let state: CountryAb | null = null;
const listeners = new Set<() => void>();

function commit(next: CountryAb | null) {
  if (next === state || (next && state && next.a === state.a && next.b === state.b)) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export const countryAbStore = {
  getSnapshot: (): CountryAb | null => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** 開啟：A＝目前國家、B＝偏好的外國（合法才用）或下一個釘選外國。沒有外國可選就不開。 */
  open(current: CountryCode, pinned: readonly CountryCode[], visible: readonly CountryCode[], preferredB: CountryCode | null = null): boolean {
    const b = pickRightCountry(current, pinned, visible, preferredB);
    if (!b) return false;
    commit({ a: current, b });
    return true;
  },
  /** 換一組（`normalizeAb` 的結果）；null＝關閉 */
  set(next: CountryAb | null) { commit(next); },
  close() { commit(null); },
  /** 測試用 */
  reset() { commit(null); },
};

export function useCountryAb(): CountryAb | null {
  return useSyncExternalStore(countryAbStore.subscribe, countryAbStore.getSnapshot, countryAbStore.getSnapshot);
}

/**
 * 讓 A／B 保持合法：目前國家不在兩者之中（使用者從國家選單換了國家）→ 目前國家變成 A；
 * B 不合法（等於 A、台灣、這個身分看不到）→ 換成下一個釘選外國。回傳原物件＝沒變。
 */
export function normalizeAb(
  ab: CountryAb,
  current: CountryCode,
  pinned: readonly CountryCode[],
  visible: readonly CountryCode[],
): CountryAb | null {
  let a = current === ab.a || current === ab.b ? ab.a : current;
  // A 也要是這個身分看得到的國家（例如站主以中國為 A 後登出）：改用目前國家，仍不可見就關閉
  if (!visible.includes(a)) a = visible.includes(current) && current !== ab.b ? current : a;
  if (!visible.includes(a)) return null;
  const b = pickRightCountry(a, pinned, visible, ab.b);
  if (!b) return null;
  return a === ab.a && b === ab.b ? ab : { a, b };
}

/** 目前顯示的另一國（切換的目標） */
export function abOther(ab: CountryAb, current: CountryCode): CountryCode {
  return current === ab.a ? ab.b : ab.a;
}

/**
 * 切換：先把離開那一國的鏡頭記下來（moveend 平常就在記，這裡補最後一刻、以防還沒觸發），
 * 再回傳目標國與它上次的鏡頭（沒記錄＝國家預設鏡頭）。
 */
export function switchAb(
  ab: CountryAb,
  current: CountryCode,
  currentCamera: CountryCamera | null,
  target: CountryCode = abOther(ab, current),
): { country: CountryCode; camera: CountryCamera } {
  if (currentCamera) countryCameraMemory.record(current, currentCamera);
  return { country: target, camera: countryCameraMemory.resolve(target) };
}

/**
 * 手機寄放的比較狀態（網址用）：顯示中的國家＝左、另一國＝右（台灣不能放右邊，那時不寫 `cmpc`，桌機再挑預設）。
 * 同一個右國時沿用原本寄放的右圖鏡頭、比例尺同步與時間對齊設定（手機單地圖本身不換算時間）。
 */
export function abStash(ab: CountryAb, current: CountryCode, prev: UrlState["compare"]): NonNullable<UrlState["compare"]> {
  const other = abOther(ab, current);
  const right = other === "TW" ? undefined : other;
  const keep = prev?.mode === "countries" && prev.rightCountry === right ? prev : undefined;
  return {
    mode: "countries",
    ...(right ? { rightCountry: right } : {}),
    ...(keep?.rightCamera ? { rightCamera: keep.rightCamera } : {}),
    ...(keep?.scaleLocked === false ? { scaleLocked: false as const } : {}),
    // 時間對齊與「哪一國」無關：A↔B 切換（右國改變）時也要保留
    ...(prev?.mode === "countries" && prev.timeAlign === "local" ? { timeAlign: "local" as const } : {}),
  };
}
