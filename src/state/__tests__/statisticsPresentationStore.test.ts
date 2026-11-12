import { afterEach, describe, expect, it } from 'vitest';
import { layerParamsStore } from '../layerParamsStore';
import { layerVisibilityStore } from '../layerVisibilityStore';
import { buildParamControls } from '../layerParamsControls';
import {
  applyPresentationUrlEntries, presentationUrlEntries, resetStatisticsPresentationNotes, statisticsPresentationMode, statisticsPresentationNote,
} from '../statisticsPresentationStore';
import { presentationParamName } from '../../data/statisticsPresentation';

const A = 'statsDemographicsTownshipPopulationTotal';
const B = 'statsDemographicsTownshipPopAge65Plus';
const RATIO = 'statsDemographicsTownshipShareAge65Plus';

afterEach(() => {
  layerParamsStore.reset();
  layerVisibilityStore.reset();
  resetStatisticsPresentationNotes();
});

describe('statistics presentation store', () => {
  it('keeps at most one circle layer: the newest wins and the visible loser is named in a note', () => {
    layerVisibilityStore.setVisibility(A as never, true);
    layerVisibilityStore.setVisibility(B as never, true);
    layerParamsStore.setParam(A, presentationParamName(A), 'circle');
    expect(statisticsPresentationMode(A)).toBe('circle');
    layerParamsStore.setParam(B, presentationParamName(B), 'circle');
    expect(statisticsPresentationMode(B)).toBe('circle');
    expect(statisticsPresentationMode(A)).toBe('choropleth');
    expect(statisticsPresentationNote(B, presentationParamName(B))).toBe('已把「戶籍人口數」改回面量圖（比例圓與點密度同時只能有一層）');
    // 說明只出現在新比例圓層的「呈現方式」那一列
    const control = buildParamControls(B)!.find((c) => c.type === 'select' && c.label === '呈現方式');
    expect(control).toMatchObject({ value: 'circle', note: expect.stringContaining('戶籍人口數') });
    expect(statisticsPresentationNote(A, presentationParamName(A))).toBeUndefined();
    // 切回面量圖，說明消失
    layerParamsStore.setParam(B, presentationParamName(B), 'choropleth');
    expect(statisticsPresentationNote(B, presentationParamName(B))).toBeUndefined();
  });

  it('circles and dot density share the one-layer rule: switching another layer to dots demotes the circle layer', () => {
    layerVisibilityStore.setVisibility(A as never, true);
    layerVisibilityStore.setVisibility(B as never, true);
    layerParamsStore.setParam(A, presentationParamName(A), 'circle');
    layerParamsStore.setParam(B, presentationParamName(B), 'dots');
    expect(statisticsPresentationMode(B)).toBe('dots');
    expect(statisticsPresentationMode(A)).toBe('choropleth');
    expect(statisticsPresentationNote(B, presentationParamName(B))).toContain('戶籍人口數');
    layerParamsStore.setParam(A, presentationParamName(A), 'dots');
    expect(statisticsPresentationMode(A)).toBe('dots');
    expect(statisticsPresentationMode(B)).toBe('choropleth');
  });

  it('hidden losers are demoted silently (no note)', () => {
    layerVisibilityStore.setVisibility(B as never, true);
    layerParamsStore.setParam(A, presentationParamName(A), 'circle');
    layerParamsStore.setParam(B, presentationParamName(B), 'circle');
    expect(statisticsPresentationMode(A)).toBe('choropleth');
    expect(statisticsPresentationNote(B, presentationParamName(B))).toBeUndefined();
  });

  it('ratio layers have no presentation control and always read choropleth', () => {
    expect(buildParamControls(RATIO)!.some((c) => c.label === '呈現方式')).toBe(false);
    expect(statisticsPresentationMode(RATIO)).toBe('choropleth');
  });

  it('pm= round trip: only visible non-default layers are written; invalid entries are ignored on apply', () => {
    applyPresentationUrlEntries({ [A]: 'circle', [RATIO]: 'circle', notALayer: 'circle', [B]: 'bogus' });
    expect(statisticsPresentationMode(A)).toBe('circle');
    expect(statisticsPresentationMode(RATIO)).toBe('choropleth');
    expect(statisticsPresentationMode(B)).toBe('choropleth');
    expect(presentationUrlEntries(() => false)).toBeUndefined();
    expect(presentationUrlEntries((key) => key === A)).toEqual({ [A]: 'circle' });
    // 點密度：pm=<key>:dots 可還原、也會寫回網址；比率層不給點密度
    applyPresentationUrlEntries({ [B]: 'dots', [RATIO]: 'dots' });
    expect(statisticsPresentationMode(B)).toBe('dots');
    expect(statisticsPresentationMode(RATIO)).toBe('choropleth');
    expect(presentationUrlEntries((key) => key === B)).toEqual({ [B]: 'dots' });
  });
});
