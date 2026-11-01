/**
 * 交通可及性播放層的「起點」連動選單（`kind: "linkedSelect"`，provider＝transitReachOrigin）：縣市 → 車站。
 * 選項來自 bundle 的 origins.json（county、name_en）；值只存在這裡（不進 layerParamsStore，同統計連動選單）。
 * 預設起點＝臺北（台鐵 tra:1000）；資料未就緒時也先回報這個值，載入後若不存在改用第一站。
 */
import { placeName } from "../i18n/placeText";
import type { I18nContext } from "../i18n/layerText";
import { loadTransitReachBase, subscribeTransitReachBase, transitReachBase } from "../data/transitReachStore";
import type { TransitReachOrigin } from "../data/transitReachTypes";
import { simBundleStatus } from "../data/simBundle";
import { TRANSIT_REACH_ORIGIN_PROVIDER, TRANSIT_REACH_SLUG } from "../data/transitReachTypes";
import {
  LINKED_SELECT_NOT_READY, LINKED_SELECT_VALUE_INVALID, registerLinkedSelectProvider,
  type LinkedSelectOption, type LinkedSelectSnapshot,
} from "./linkedSelect";

export const TRANSIT_REACH_DEFAULT_ORIGIN = "tra:1000";
/** 沒有縣市欄（舊版 bundle）時歸到這一組 */
const NO_COUNTY = "全部車站";

let selected = TRANSIT_REACH_DEFAULT_ORIGIN;
let loadError: string | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const l of listeners) l(); };
subscribeTransitReachBase(notify);

const countyOf = (o: TransitReachOrigin) => o.county ?? NO_COUNTY;

/** 目前選定的起點（資料未就緒回 null） */
export function transitReachSelectedOrigin(): TransitReachOrigin | null {
  const origins = transitReachBase()?.origins ?? [];
  return origins.find((o) => o.id === selected) ?? origins[0] ?? null;
}

export function subscribeTransitReachOrigin(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** 直接選一個起點 id（地圖點選、測試）；不存在丟錯 */
export function selectTransitReachOrigin(id: string): void {
  const origins = transitReachBase()?.origins;
  if (!origins) throw new Error(LINKED_SELECT_NOT_READY);
  if (!origins.some((o) => o.id === id)) throw new Error(LINKED_SELECT_VALUE_INVALID);
  if (selected === id) return;
  selected = id;
  notify();
}

/** 站名顯示：英文用 name_en（沒有就退回中文）；日文沿用中文漢字；高鐵站加註 */
export function originLabel(o: TransitReachOrigin, i18n?: I18nContext): string {
  const en = i18n?.active === "en";
  const name = en ? (o.name_en ?? o.name) : o.name;
  if (o.mode !== "thsr") return name;
  return en ? `${name} (HSR)` : i18n?.active === "ja" ? `${name}（新幹線）` : `${name}（高鐵）`;
}

function ensure() {
  loadTransitReachBase().then(() => { loadError = null; notify(); }, (error) => {
    loadError = error instanceof Error ? error.message : String(error);
    notify();
  });
}

function snapshot(field: string): LinkedSelectSnapshot {
  const base = transitReachBase();
  if (!base) {
    const status = simBundleStatus(TRANSIT_REACH_SLUG);
    if (loadError || status.status === "error") return { status: "error", error: loadError ?? (status.status === "error" ? status.message : ""), options: [], value: "" };
    return { status: "loading", options: [], value: "" };
  }
  const current = transitReachSelectedOrigin();
  if (field === "county") {
    const counties: string[] = [];
    for (const o of base.origins) if (!counties.includes(countyOf(o))) counties.push(countyOf(o));
    const options: LinkedSelectOption[] = counties.map((c) => ({ label: c, value: c, localize: (i18n) => placeName(c, i18n) }));
    return { status: "ready", options, value: current ? countyOf(current) : "" };
  }
  const county = current ? countyOf(current) : null;
  const options: LinkedSelectOption[] = base.origins.filter((o) => countyOf(o) === county).map((o) => ({
    label: originLabel(o), value: o.id, localize: (i18n) => originLabel(o, i18n),
  }));
  return { status: "ready", options, value: current?.id ?? "" };
}

registerLinkedSelectProvider(TRANSIT_REACH_ORIGIN_PROVIDER, {
  snapshot: (_layerKey, spec) => snapshot(spec.field),
  set(_layerKey, spec, value) {
    const base = transitReachBase();
    if (!base) throw new Error(LINKED_SELECT_NOT_READY);
    if (spec.field === "county") {
      const current = transitReachSelectedOrigin();
      if (current && countyOf(current) === value) return;
      // 換縣市：優先選與縣市同名的台鐵站（臺東縣 → 臺東），沒有才用清單第一站
      const inCounty = base.origins.filter((o) => countyOf(o) === value);
      if (!inCounty.length) throw new Error(LINKED_SELECT_VALUE_INVALID);
      const stem = value.replace(/[縣市]$/, "");
      const pick = inCounty.find((o) => o.mode === "tra" && o.name === stem) ?? inCounty[0]!;
      selectTransitReachOrigin(pick.id);
      return;
    }
    selectTransitReachOrigin(value);
  },
  subscribe: (_layerKey, callback) => subscribeTransitReachOrigin(callback),
  ensure,
  retry: ensure,
});
