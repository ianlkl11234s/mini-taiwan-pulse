/**
 * 連動選單（圖層面板統一 C 段）：共用連動規則、統計 provider、控件、Agent get/set、場景存檔還原。
 *
 * 統計 provider 用 `statsMaritimeSubsidyCounty`（releaseSelector：年度 → 月份 → 基金）：期別清單直接塞進
 * store snapshot，`load` 換成假的（不打網路），驗的是「選項怎麼算、改值後落在哪個真實組合」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  linkedSelectHiddenFor, linkedSelectSnapshot, linkedSelectSpecs, linkedSelectValues, resolveLinkedSelectChange,
  restoreLinkedSelects, setLinkedSelect, type LinkedSelectTuple,
} from '../linkedSelect';
import { buildParamControls, visibleControlSpecs } from '../layerParamsControls';
import { regionalStatisticsStore } from '../regionalStatisticsStore';
import { statisticsRecipe } from '../../data/statisticsSelection';
import { statisticsLinkedSelects } from '../../data/statisticsParamsSpec';
import { STATISTICS_RECIPES } from '../../data/regionalStatisticsRecipes';
import { applyLayerControl, describeLayerControls } from '../../research/layerControls';
import { captureSceneParams, resolveSceneRestore } from '../../lib/memberSceneAdapter';
import { layerVisibilityStore, buildDefaultVisibility } from '../layerVisibilityStore';
import { statisticsDisplayModeStore } from '../statisticsDisplayModeStore';
import type { StatisticsRelease } from '../../data/regionalStatisticsLoader';

// ── 純函式 ──────────────────────────────────────────────────────────

const fields = [
  { name: 'year', dependsOn: [] },
  { name: 'month', dependsOn: ['year'] },
  { name: 'fund', dependsOn: ['year', 'month'] },
];
const tuple = (year: string, month: string, fund: string): LinkedSelectTuple => ({ values: { year, month, fund } });
const tuples = [tuple('114', '01', 'A'), tuple('114', '02', 'A'), tuple('114', '02', 'B'), tuple('113', '03', 'B')];

describe('連動規則（全部 provider 共用）', () => {
  it('選項只列與上游目前值相符的組合，依出現順序去重', () => {
    const current = { year: '114', month: '02', fund: 'A' };
    expect(linkedSelectValues(fields[0]!, tuples, current)).toEqual(['114', '113']);
    expect(linkedSelectValues(fields[1]!, tuples, current)).toEqual(['01', '02']);
    expect(linkedSelectValues(fields[2]!, tuples, current)).toEqual(['A', 'B']);
  });

  it('改上游：下游目前值仍合法就保留，否則改成第一個合法值', () => {
    const current = { year: '114', month: '02', fund: 'B' };
    expect(resolveLinkedSelectChange(fields, tuples, current, 'month', '01')).toBe(tuples[0]);
    expect(resolveLinkedSelectChange(fields, tuples, { year: '114', month: '01', fund: 'A' }, 'month', '02')).toBe(tuples[1]);
    expect(resolveLinkedSelectChange(fields, tuples, current, 'year', '113')).toBe(tuples[3]);
  });

  it('非法值回 null（不在當下選項內）', () => {
    expect(resolveLinkedSelectChange(fields, tuples, { year: '114', month: '01', fund: 'A' }, 'month', '03')).toBeNull();
    expect(resolveLinkedSelectChange(fields, tuples, { year: '114', month: '01', fund: 'A' }, 'nope', '01')).toBeNull();
  });

  it('組合缺某一列（例：別的指標尚未載入細項）時該列跳過，仍落在真實組合', () => {
    const partial = [...tuples, { values: { year: '112' } }];
    expect(resolveLinkedSelectChange(fields, partial, { year: '114', month: '01', fund: 'A' }, 'year', '112')).toBe(partial[4]);
  });
});

// ── 統計 provider ───────────────────────────────────────────────────

const KEY = 'statsMaritimeSubsidyCounty';
const release = (id: string, start: string): StatisticsRelease => ({
  release_id: id, dataset_id: STATISTICS_RECIPES[KEY].dataset_id, indicator_id: STATISTICS_RECIPES[KEY].indicator_id,
  boundary_version: 'COUNTY_MOI_1140318', period_start: start, period_end: start, levels: ['county'],
});
const R1 = release('2025-01-01-1450d8e18741-a', '2025-01-01'); // 114／01／航港建設基金
const R2 = release('2025-02-01-1450d8e18741-b', '2025-02-01'); // 114／02／航港建設基金
const R3 = release('2025-02-01-d6c9ce1998ef-c', '2025-02-01'); // 114／02／交通部航港局
const R4 = release('2024-03-01-d6c9ce1998ef-d', '2024-03-01'); // 113／03／交通部航港局
const names = { year: `${KEY}DimRocYear`, month: `${KEY}DimMonth`, fund: `${KEY}DimAgencyFund` };
const spec = (name: string) => linkedSelectSpecs(KEY).find((s) => s.name === name)!;

function seed(releaseId = R1.release_id, dimensions = { roc_year: '114', month: '01', agency_fund: '航港建設基金' }) {
  regionalStatisticsStore.setSelection(KEY, { ...statisticsRecipe(KEY), releaseId, dimensions, allowReleaseFallback: false });
  Object.assign(regionalStatisticsStore.getSnapshot(KEY), { releases: [R1, R2, R3, R4], loading: false, error: null });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async () => {
    Object.assign(regionalStatisticsStore.getSnapshot(KEY), { releases: [R1, R2, R3, R4], loading: false });
  });
  vi.spyOn(regionalStatisticsStore, 'registerRecipe').mockImplementation(() => {});
  statisticsDisplayModeStore.reset();
  layerVisibilityStore.setAll(buildDefaultVisibility());
});
afterEach(() => regionalStatisticsStore.setSelection(KEY, null));

describe('統計連動選單 provider', () => {
  it('規格：維度依 selector 宣告順序、下游依賴全部上游、第一列保底', () => {
    expect(statisticsLinkedSelects(KEY).map((s) => [s.name, s.label, s.dependsOn.length, Boolean(s.primary)])).toEqual([
      [names.year, '年度', 0, true], [names.month, '月份', 1, false], [names.fund, '基金', 2, false],
    ]);
  });

  it('未載入：只剩保底列（idle，無選項）；載入中：狀態文字只在第一個可見列', () => {
    regionalStatisticsStore.setSelection(KEY, null);
    expect(visibleControlSpecs(KEY).filter((s) => s.kind === 'linkedSelect').map((s) => s.name)).toEqual([names.year]);
    seed();
    Object.assign(regionalStatisticsStore.getSnapshot(KEY), { loading: true });
    const controls = (buildParamControls(KEY) ?? []).filter((c) => c.type === 'linkedSelect');
    expect(controls.map((c) => c.type === 'linkedSelect' && [c.label, c.status, c.statusText ?? null])).toEqual([
      ['年度', 'loading', '載入中…'], ['月份', 'loading', null],
    ]);
  });

  it('上游改變時重算下游選項；只有 1 個選項的列不顯示', () => {
    seed();
    expect(linkedSelectSnapshot(KEY, spec(names.year)).options.map((o) => o.label)).toEqual(['民國 114 年', '民國 113 年']);
    expect(linkedSelectSnapshot(KEY, spec(names.month)).options.map((o) => o.value)).toEqual(['01', '02']);
    expect(linkedSelectSnapshot(KEY, spec(names.fund)).options.map((o) => o.value)).toEqual(['航港建設基金']);
    expect(linkedSelectHiddenFor(KEY)(spec(names.fund))).toBe(true);
    void setLinkedSelect(KEY, spec(names.month), '02');
    expect(regionalStatisticsStore.getSnapshot(KEY).selection?.releaseId).toBe(R2.release_id); // 基金保留
    expect(linkedSelectSnapshot(KEY, spec(names.fund)).options.map((o) => o.value)).toEqual(['航港建設基金', '交通部航港局']);
    expect(linkedSelectHiddenFor(KEY)(spec(names.fund))).toBe(false);
  });

  it('目前值不再合法 → 改成第一個合法值；非法值丟錯且不改 selection', () => {
    seed(R3.release_id, { roc_year: '114', month: '02', agency_fund: '交通部航港局' });
    void setLinkedSelect(KEY, spec(names.year), '113');
    const selection = regionalStatisticsStore.getSnapshot(KEY).selection!;
    expect(selection.releaseId).toBe(R4.release_id);
    expect(selection.dimensions).toEqual({ roc_year: '113', month: '03', agency_fund: '交通部航港局' });
    expect(() => setLinkedSelect(KEY, spec(names.month), '01')).toThrow('LINKED_SELECT_VALUE_INVALID');
    expect(regionalStatisticsStore.getSnapshot(KEY).selection?.releaseId).toBe(R4.release_id);
  });

  it('沒有任何組合時設定回「未就緒」', () => {
    regionalStatisticsStore.setSelection(KEY, null);
    expect(() => setLinkedSelect(KEY, spec(names.year), '114')).toThrow('LINKED_SELECT_NOT_READY');
  });
});

describe('Agent（research/layerControls）', () => {
  it('get 列出連動選單的當下選項、狀態與上游；set 驗證值並等載入後讀回', async () => {
    seed();
    const month = describeLayerControls(KEY, new Set()).controls.find((c) => c.controlId === names.month)!;
    expect(month).toMatchObject({ kind: 'linkedSelect', value: '01', hidden: false, linked: { status: 'ready', dependsOn: [names.year], error: null } });
    expect(month.options.map((o) => o.value)).toEqual(['01', '02']);
    const fund = describeLayerControls(KEY, new Set()).controls.find((c) => c.controlId === names.fund)!;
    expect(fund).toMatchObject({ hidden: true, value: '航港建設基金' });
    await expect(applyLayerControl({ layerKey: KEY, controlId: names.month, expectedValue: '01', value: '02' }, new Set())).resolves.toBe('02');
    expect(() => applyLayerControl({ layerKey: KEY, controlId: names.month, expectedValue: '02', value: '07' }, new Set())).toThrow('LAYER_CONTROL_VALUE_INVALID');
    expect(() => applyLayerControl({ layerKey: KEY, controlId: names.month, expectedValue: '01', value: '02' }, new Set())).toThrow('LAYER_CONTROL_EXPECTED_VALUE_MISMATCH');
  });

  it('選項未載入時 set 回 LAYER_CONTROL_OPTIONS_NOT_READY', () => {
    regionalStatisticsStore.setSelection(KEY, null);
    vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async () => {});
    expect(() => applyLayerControl({ layerKey: KEY, controlId: names.year, expectedValue: '', value: '114' }, new Set())).toThrow('LAYER_CONTROL_OPTIONS_NOT_READY');
  });
});

describe('場景存檔與還原', () => {
  it('存：連動選單存 provider 目前值；群組「指標」不存', () => {
    seed(R2.release_id, { roc_year: '114', month: '02', agency_fund: '航港建設基金' });
    expect(captureSceneParams([KEY], {})[KEY]).toMatchObject({ [names.year]: '114', [names.month]: '02', [names.fund]: '航港建設基金' });
    const grouped = captureSceneParams(['statsHealthHospitalBedTotal'], {}).statsHealthHospitalBedTotal ?? {};
    expect(Object.keys(grouped).some((name) => name.endsWith('Variant'))).toBe(false);
  });

  it('還原：值放進 linked（不進 layerParamsStore），等選項就緒後逐列驗證套用；不合法的列略過', async () => {
    const scene = {
      version: 1 as const, camera: { lng: 121, lat: 25, zoom: 7, pitch: 0, bearing: 0 }, basemap: 'dark', layers: [KEY],
      params: { [KEY]: { [`${KEY}Opacity`]: 0.4, [names.year]: '113', [names.month]: '03', [names.fund]: '不存在的基金' } },
      time: { mode: 'realtime' as const, playback: 'live' as const, cursorISO: '2026-10-03T00:00:00.000Z', windowDays: 1 },
    };
    const resolved = resolveSceneRestore(scene as never, new Set([KEY]), new Set(), ['dark']);
    expect(resolved.params[KEY]).toEqual({ [`${KEY}Opacity`]: 0.4 });
    expect(resolved.linked[KEY]).toEqual({ [names.year]: '113', [names.month]: '03', [names.fund]: '不存在的基金' });
    expect(resolved.skipped).toEqual([]);
    seed();
    const skipped = await restoreLinkedSelects(resolved.linked, 1000);
    expect(regionalStatisticsStore.getSnapshot(KEY).selection?.releaseId).toBe(R4.release_id);
    expect(skipped).toEqual([`${KEY}.${names.fund}：選項已不存在，保留目前選擇`]);
  });

  it('還原：選項一直沒載入 → 逾時略過，不動 selection；舊存檔沒有連動值 → linked 為空', async () => {
    regionalStatisticsStore.setSelection(KEY, null);
    vi.spyOn(regionalStatisticsStore, 'load').mockImplementation(async () => {});
    const skipped = await restoreLinkedSelects({ [KEY]: { [names.year]: '113' } }, 20);
    expect(skipped).toEqual([`${KEY}.${names.year}：選項未能及時載入，保留目前選擇`]);
    const old = resolveSceneRestore({
      version: 1, camera: { lng: 121, lat: 25, zoom: 7, pitch: 0, bearing: 0 }, basemap: 'dark', layers: [KEY],
      params: { [KEY]: { [`${KEY}Opacity`]: 0.4 } },
      time: { mode: 'realtime', playback: 'live', cursorISO: '2026-10-03T00:00:00.000Z', windowDays: 1 },
    } as never, new Set([KEY]), new Set(), ['dark']);
    expect(old.linked).toEqual({});
    expect(old.skipped).toEqual([]);
  });
});

describe('統計群組「指標」（群組變體）', () => {
  it('選項＝群組成員、值＝目前可見成員；切換＝同期別換可見圖層，不存進場景', async () => {
    const { ensureStatisticsRecipeDetails } = await import('../../data/statisticsRecipeDetails');
    const { getSocialRecipeDetails } = await import('../../data/socialStatisticsRecipes');
    await ensureStatisticsRecipeDetails('social');
    const from = 'statsHealthHospitalBedTotal';
    const to = 'statsHealthAcuteBedTotal';
    const variant = linkedSelectSpecs(from).find((s) => s.name === `${from}Variant`)!;
    expect(variant).toMatchObject({ label: '指標', persist: false, dependsOn: [] });
    const recipe = getSocialRecipeDetails(from)!;
    const option = recipe.release_options.find((o) => o.dimensions.roc_year === '113')!;
    regionalStatisticsStore.setSelection(from, { layerKey: from, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id, level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions });
    layerVisibilityStore.setAll({ ...buildDefaultVisibility(), [from]: true });
    const before = linkedSelectSnapshot(from, variant);
    expect(before.value).toBe(from);
    expect(before.options.map((o) => o.value)).toContain(to);
    await setLinkedSelect(from, variant, to);
    expect(layerVisibilityStore.getAll()[from]).toBe(false);
    expect(layerVisibilityStore.getAll()[to]).toBe(true);
    expect(regionalStatisticsStore.getSnapshot(to).selection?.dimensions?.roc_year).toBe('113');
    expect(linkedSelectSnapshot(from, variant).value).toBe(to);
    await expect(Promise.resolve().then(() => setLinkedSelect(from, variant, 'statsBirthsTownship'))).rejects.toThrow('LINKED_SELECT_VALUE_INVALID');
    regionalStatisticsStore.setSelection(from, null);
    regionalStatisticsStore.setSelection(to, null);
  });
});

describe('releaseSelector 宣告的維度順序', () => {
  it('dimensionKeys 與 resolve 實際輸出的鍵與順序一致', async () => {
    const { busOperationReleaseSelector, maritimeSubsidyReleaseSelector } = await import('../../data/regionalStatisticsRecipes');
    expect(Object.keys(maritimeSubsidyReleaseSelector.resolve(R1)!.dimensions)).toEqual([...maritimeSubsidyReleaseSelector.dimensionKeys]);
    const bus = busOperationReleaseSelector.resolve({ release_id: '2025-114-column1-fcb90c6e6b05', period_start: '2025-01-01', period_end: '2025-12-31' })!;
    expect(Object.keys(bus.dimensions)).toEqual([...busOperationReleaseSelector.dimensionKeys]);
  });
});
