/**
 * 盤點圖層設定面板會顯示的中文（params.json 的 key 來源）。
 * 測試用它擋「中文改了、翻譯變孤兒」；`scripts/i18n/export-param-texts.ts` 用它列出待翻清單。
 */
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../../data/layerParamsSpec";
import { TRAILING_OPERATOR } from "../../state/layerParamsControls";

const CJK = /[㐀-鿿]/u;

export interface ParamTextInventory {
  /** 中文原文 → 用到它的「layerKey.參數名」 */
  texts: Map<string, string[]>;
  /** 所有「layerKey.參數名」與「layerKey.該層用到的中文」（覆寫 key 的合法範圍） */
  targets: Set<string>;
}

export function collectParamTexts(): ParamTextInventory {
  const texts = new Map<string, string[]>();
  const targets = new Set<string>();
  const add = (zh: string | undefined, where: string) => {
    if (!zh || !CJK.test(zh)) return;
    const list = texts.get(zh) ?? [];
    list.push(where);
    texts.set(zh, list);
    // 單一圖層的文字覆寫 `param.<layerKey>.<中文>`（layerParamsControls 的 tx 先查它）
    targets.add(`${where.slice(0, where.indexOf("."))}.${zh}`);
  };
  for (const [layerKey, specs] of Object.entries(LAYER_PARAMS_SPEC as Record<string, readonly LayerParamSpec[]>)) {
    for (const s of specs) {
      const where = `${layerKey}.${s.name}`;
      targets.add(where);
      if (s.kind === "slider") {
        const op = TRAILING_OPERATOR.exec(s.labelPrefix);
        add((op ? op[1]! : s.labelPrefix).trim(), where);
        add(s.labelSuffix, where);
        add(s.zeroLabel, where);
        continue;
      }
      add(s.label, where);
      if ("labelByValue" in s && s.labelByValue) Object.values(s.labelByValue).forEach((v) => add(v, where));
      if (s.kind === "select" || s.kind === "multiSelect") s.options.forEach((o) => add(o.label, where));
      if (s.kind === "select") {
        Object.values(s.optionsByParam?.byValue ?? {}).forEach((opts) => opts.forEach((o) => add(o.label, where)));
        add(s.disableRule?.reason, where);
      }
    }
  }
  return { texts, targets };
}
