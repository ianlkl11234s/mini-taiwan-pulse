/** Rebuild the audit from the implemented registry, never from remembered counts. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATISTICS_RECIPES, STATISTICS_KEYS } from '../../src/data/regionalStatisticsRecipes';
import { COMPARISON_ENABLED_RECIPES } from '../../src/data/comparisonStatisticsRecipes';
import { EDUCATION_PRESENTATION_VIEWS } from '../../src/data/statisticsPresentationViews';
import { STATISTICS_TOGGLE_GROUPS } from '../../src/data/medicalStatisticsGroups';
const folder = 'docs/features/statistics-comparability';
const bundle = resolve(process.argv[2] ?? '../data/statistics-comparison-data/cdn');
const pointer = JSON.parse(readFileSync(resolve(bundle, 'current.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(bundle, pointer.manifest.path), 'utf8'));
const derived = new Set(COMPARISON_ENABLED_RECIPES.map(recipe => recipe.layer_key));
const original = STATISTICS_KEYS.filter(key => !derived.has(key as never)).map(key => {
  const recipe = STATISTICS_RECIPES[key];
  return { key, label: recipe.label, dataset_id: recipe.dataset_id, indicator_id: recipe.indicator_id, level: recipe.level, unit: recipe.unit,
    groups: STATISTICS_TOGGLE_GROUPS.filter(group => group.options.some(option => option.key === key)).map(group => group.label),
    educationViews: EDUCATION_PRESENTATION_VIEWS.filter(view => view.metrics.some(metric => metric.layerKey === key)).map(view => view.label),
    selectorCount: manifest.selectors.filter((s: Record<string, unknown>) => s.dataset_id === recipe.dataset_id && s.indicator_id === recipe.indicator_id && s.area_level === recipe.level).length };
});
const comparisons = COMPARISON_ENABLED_RECIPES.map(recipe => {
  const selector = manifest.selectors.find((s: Record<string, unknown>) => s.dataset_id === recipe.dataset_id && s.indicator_id === recipe.indicator_id);
  const artifact = JSON.parse(readFileSync(resolve(bundle, selector.artifact.path), 'utf8'));
  const source = artifact.sources.source;
  const processing = source.derivation ?? source.processing_summary;
  return { ...recipe, formula: processing.formula, interpretation: recipe.disclosure };
});
const inventory = { status: 'REBUILT_FROM_IMPLEMENTED_REGISTRY_20260917', originalRecipeCount: original.length,
  referenceEntries: ['crimeAreaMonthly', 'countyBoundary', 'townshipBoundary'], original, educationViews: EDUCATION_PRESENTATION_VIEWS,
  groups: STATISTICS_TOGGLE_GROUPS, comparisons, unavailable: ['national education accessibility', 'county VKT and A3', 'age-population education coverage', 'incomplete aquaculture/production national shares'] };
writeFileSync(`${folder}/inventory.json`, JSON.stringify(inventory, null, 2)+'\n');
const lines = ['# 統計圖層盤點與整合對照', '', '2026-09-17 依恢復後 registry 與本地 immutable 資料重建；不是原遺失盤點檔的逐位元備份。完整驗收與限制見 [acceptance.md](./acceptance.md)。', '', '## 教育固定入口', ''];
for (const view of EDUCATION_PRESENTATION_VIEWS) lines.push(`### ${view.label}`, '', ...view.metrics.map(metric => `- ${metric.label}（\`${metric.layerKey}\`）`), '');
lines.push('## 其他分組', '');
for (const group of STATISTICS_TOGGLE_GROUPS) lines.push(`### ${group.label}`, '', ...group.options.map(option => `- ${option.label}（\`${option.key}\`）`), '');
lines.push('## 原有資料完整盤點', '', '| 原始圖層 | 層級／單位 | 呈現入口 | 可用選項 |', '|---|---|---|---:|');
for (const r of original) lines.push(`| ${r.label} · \`${r.key}\` | ${r.level}／${r.unit} | ${[...r.groups,...r.educationViews].join('、') || '保留原入口'} | ${r.selectorCount} |`);
lines.push('', '## 新增計算口徑', '', '| 指標 | 公式 | 單位／限制 |', '|---|---|---|');
for (const r of comparisons) lines.push(`| ${r.label} · \`${r.layer_key}\` | ${String(r.formula).replaceAll('|','／')} | ${r.unit}；${r.interpretation.replaceAll('|','／')} |`);
writeFileSync(`${folder}/layer-audit.md`, lines.join('\n')+'\n');
console.log(JSON.stringify({original:original.length,comparison:comparisons.length,education:EDUCATION_PRESENTATION_VIEWS.length}));
