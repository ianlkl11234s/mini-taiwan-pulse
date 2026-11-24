import type { PlaceSearchHit } from "../lib/placeSearch";

/**
 * Locations 搜尋選到的暫時標記槽：同時只有一個。
 * 站主版私人地址（hit.private）的標記在撤權（登出、失去站主權限）時必須撤掉；
 * 這個槽由 App（常駐）持有，不能綁在會卸載的搜尋面板上。
 */
export interface PlaceMarkerSlot {
  set(place: PlaceSearchHit | null): void;
  /** 撤權：目前標記若是私人地址就撤掉；公開地點不動 */
  revokePrivate(): void;
}

export function createPlaceMarkerSlot(show: (place: PlaceSearchHit) => (() => void) | null): PlaceMarkerSlot {
  let cleanup: (() => void) | null = null;
  let current: PlaceSearchHit | null = null;
  const clear = () => { cleanup?.(); cleanup = null; current = null; };
  return {
    set(place) {
      clear();
      if (!place) return;
      cleanup = show(place);
      current = place;
    },
    revokePrivate() {
      if (current?.private) clear();
    },
  };
}
