/**
 * 主站分享網址的圖層參數（`p.*`，D8-1）：控制項的值 ⇄ overlayParams 數字。
 *
 * 契約沿用 `/embed` 既有的 `p.<overlay out key>=<數字>`（`encodeParamValue` 的編碼：
 * slider 原值、toggle 0/1、select 索引或數值、多選 bitmask），所以同一條網址換成 `/embed` 也吃得到。
 * 共用值（sharedGroup）的成員宣告同一個 out key，自然只寫一次；讀回時 `setManyDirect` 會展開到全部成員。
 *
 * 範圍：只處理有 out key 的參數。`out: null` 的參數（色盤、第二通道 select、資料篩選多選、連動選單、播放）
 * 不進 `p.*`；統計的期別與細項走 `sel=`／`cmpdl=`（`state/compareStatistics.ts`）。
 *
 * 獨立成檔是為了讓 `urlState.ts` 維持純解析（`/embed` 也引用它，不該牽入整份圖層規格）。
 */
import {
  LAYER_PARAMS_SPEC, MULTI_SELECT_ALL, MULTI_SELECT_NONE, encodeParamValue, resolveSelectOptions,
  serializeMultiSelectValues, specOutKey, type LayerParamSpec, type ParamValue,
} from "../data/layerParamsSpec";

const specsFor = (key: string): readonly LayerParamSpec[] => (LAYER_PARAMS_SPEC as Record<string, LayerParamSpec[]>)[key] ?? [];
/** 播放類開關一律不分享（看網址的人從暫停開始，同場景存檔） */
const PLAYBACK_NAME_RE = /playing|autoplay/i;

type ParamsSnapshot = Readonly<Record<string, Readonly<Record<string, ParamValue>>>>;

/**
 * 目前畫面要寫進網址的 `p.*`：只看傳入的圖層（呼叫端傳開著且可公開的），只寫與預設不同的值。
 * `defaultOf` 讓呼叫端覆寫「預設」（統計透明度的預設隨底圖變，見 `statisticsDefaultOpacity`）。
 */
export function layerParamsForUrl(
  keys: readonly string[],
  all: ParamsSnapshot,
  defaultOf?: (key: string, spec: LayerParamSpec) => ParamValue | undefined,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const values = all[key];
    if (!values) continue;
    for (const spec of specsFor(key)) {
      const outKey = specOutKey(spec);
      if (outKey === null || outKey in out || PLAYBACK_NAME_RE.test(spec.name)) continue;
      const value = values[spec.name];
      if (value === undefined) continue;
      const encoded = encodeParamValue(spec, value);
      if (!Number.isFinite(encoded) || (encoded < 0 && spec.kind === "select" && !spec.encodeNumeric)) continue;
      if (encoded === encodeParamValue(spec, defaultOf?.(key, spec) ?? spec.default)) continue;
      out[outKey] = encoded;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** 數字解回控制項的值；不合法回 undefined（越界、選項已不存在或停用、編碼錯位） */
function decodeParam(spec: LayerParamSpec, n: number, siblings: Readonly<Record<string, ParamValue>>): ParamValue | undefined {
  switch (spec.kind) {
    case "slider":
      return n >= spec.min && n <= spec.max ? n : undefined;
    case "toggle":
      return n === 1 ? true : n === 0 ? false : undefined;
    case "select": {
      const value = spec.encodeNumeric
        ? spec.options.find((option) => Number(option.value) === n)?.value
        : spec.encode && Number.isInteger(n) ? spec.encode[n] : undefined;
      if (value === undefined) return undefined;
      const option = resolveSelectOptions(spec, siblings).find((candidate) => candidate.value === value);
      return option && !option.disabled ? value : undefined;
    }
    case "multiSelect": {
      if (spec.out === null || !Number.isInteger(n) || n < 0 || n >= 2 ** spec.options.length) return undefined;
      const selected = spec.options.filter((_, index) => (n & (1 << index)) !== 0).map((option) => option.value);
      if (selected.length === spec.options.length) return MULTI_SELECT_ALL;
      return selected.length ? serializeMultiSelectValues(selected) : MULTI_SELECT_NONE;
    }
    default:
      return undefined;
  }
}

/**
 * 網址的 `p.*` → 要寫進 layerParamsStore 的值。只處理 `allowedKeys`（網址裡有開、看網址的人有權限的圖層），
 * 依規格宣告順序解：後面的 select 看到的是已解好的上游值（大類 → 細項）。不合法的項目略過、保留預設。
 */
export function resolveUrlLayerParams(
  params: Readonly<Record<string, number>> | undefined,
  allowedKeys: Iterable<string>,
  current: ParamsSnapshot,
): { key: string; name: string; value: ParamValue }[] {
  if (!params) return [];
  const writes: { key: string; name: string; value: ParamValue }[] = [];
  for (const key of allowedKeys) {
    const siblings: Record<string, ParamValue> = { ...(current[key] ?? {}) };
    for (const spec of specsFor(key)) {
      const outKey = specOutKey(spec);
      if (outKey === null || PLAYBACK_NAME_RE.test(spec.name) || !Object.prototype.hasOwnProperty.call(params, outKey)) continue;
      const value = decodeParam(spec, params[outKey]!, siblings);
      if (value === undefined) continue;
      siblings[spec.name] = value;
      writes.push({ key, name: spec.name, value });
    }
  }
  return writes;
}
