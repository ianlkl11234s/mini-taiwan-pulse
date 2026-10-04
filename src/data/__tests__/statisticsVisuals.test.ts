import { describe, expect, it } from 'vitest';
import {
  Baby, BedDouble, Beef, Bike, Bus, Car, ChartNoAxesCombined, Droplets, Fish,
  Briefcase, GraduationCap, HeartHandshake, Hospital, House, Plane, Presentation,
  Recycle, Route, School, Shield, Ship, Stethoscope, Trash2, Trees, TriangleAlert,
  Volume2, Wheat, Zap, Users, HousePlus, CalendarClock,
} from 'lucide-react';
import { LAYER_MANIFEST } from '../layerManifest';
import { STATISTICS_KEYS, STATISTICS_RECIPES, STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from '../regionalStatisticsRecipes';
import { getStatisticsVisual, statisticsVisualColors } from '../statisticsVisuals';

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
};

describe('getStatisticsVisual', () => {
  it.each([
    ['教育學校', 'statsEducationCountyInstitutionCount', undefined, undefined, School],
    ['教育教師', 'statsEducationCountyTeacherCount', undefined, undefined, Presentation],
    ['教育學生', 'statsEducationCountyStudentCount', undefined, undefined, GraduationCap],
    ['醫療機構', 'statsHealthHospitalCount', undefined, undefined, Hospital],
    ['醫療病床', 'statsHealthHospitalBedTotal', undefined, undefined, BedDouble],
    ['醫療人員', 'statsHealthWesternPhysicianCount', undefined, undefined, Stethoscope],
    ['長照', 'statsHealthCareWorkerRegistration', undefined, undefined, HeartHandshake],
    ['住宅', 'statsHousingOccupiedCounty', undefined, undefined, House],
    ['工作與所得', 'statsLaborCountyEmployment', undefined, undefined, Briefcase],
    ['公車', 'statsBusOperatingTripCount', undefined, undefined, Bus],
    ['自行車', 'statsTaipeiUrbanRentalTrips', undefined, undefined, Bike],
    ['汽車', 'statsAutomobileRegisteredCount', undefined, undefined, Car],
    ['機場', 'statsAirportCargoTonnes', undefined, undefined, Plane],
    ['航港', 'statsMaritimeSubsidyCounty', undefined, undefined, Ship],
    ['事故', 'statsA1AccidentCount', undefined, undefined, TriangleAlert],
    ['農業', 'statsCropProductionTownship', undefined, undefined, Wheat],
    ['畜牧', 'statsLivestockHeadCountTownship', undefined, undefined, Beef],
    ['漁業', 'statsFisheryProductionCounty', undefined, undefined, Fish],
    ['林業', 'statsBambooForestAreaTownship', undefined, undefined, Trees],
    ['回收', 'statsRecyclingCounty', undefined, undefined, Recycle],
    ['廢棄物', 'statsWasteCounty', undefined, undefined, Trash2],
    ['電力', 'statsResidentialElectricity', undefined, undefined, Zap],
    ['供水', 'statsWaterSupplyHistorical', undefined, undefined, Droplets],
    ['出生', 'statsBirthsTownship', undefined, undefined, Baby],
    ['道路', 'statsRoadLandAreaTownship', undefined, undefined, Route],
    ['噪音', 'statsTaichungRoadNoiseMonitoringStations', undefined, undefined, Volume2],
    ['治安', 'unknown', '犯罪率', '治安', Shield],
    ['fallback', 'unknown', undefined, undefined, ChartNoAxesCombined],
  ])('%s uses a semantic icon', (_name, key, label, group, icon) => {
    expect(getStatisticsVisual(key, label, group).icon).toBe(icon);
  });

  it('keeps raw and derived metrics in the same semantic theme', () => {
    expect(getStatisticsVisual('statsEducationCountyStudentCount').theme).toBe(getStatisticsVisual('statsComparisonEducationStudentCountPerKm2').theme);
    expect(getStatisticsVisual('statsHealthHospitalBedTotal').theme).toBe(getStatisticsVisual('statsComparisonHospitalBedTotalPerKm2Township').theme);
    expect(getStatisticsVisual('statsHousingUnoccupiedCounty').theme).toBe(getStatisticsVisual('statsComparisonHousingUnoccupiedSharePctCounty').theme);
    expect(getStatisticsVisual('statsBusOperatingTripCount').theme).toBe(getStatisticsVisual('statsComparisonBusOperatingTripCountPerKm2').theme);
  });

  it('uses sequential palettes with at least five ordered classes', () => {
    for (const key of STATISTICS_KEYS) {
      const recipe = STATISTICS_RECIPES[key]!;
      const colors = getStatisticsVisual(key, recipe.label).colors;
      expect(colors.length).toBeGreaterThanOrEqual(5);
      for (let index = 1; index < colors.length; index += 1) {
        expect(luminance(colors[index - 1]!)).toBeGreaterThan(luminance(colors[index]!));
      }
    }
  });

  it('routes environment statistics to BuPu and water utilities to GnBu, never transport or fallback', () => {
    expect(getStatisticsVisual('statsMotorArrivalRateCounty', '機車定檢到檢率').theme).toBe('環境');
    expect(getStatisticsVisual('statsComplaintsCounty', '公害陳情案件數').theme).toBe('環境');
    expect(getStatisticsVisual('statsBodDischargedPerKm2County', '廢（污）水 BOD 排放量每平方公里').theme).toBe(getStatisticsVisual('statsBodDischargedCounty').theme);
    expect(getStatisticsVisual('statsTapWaterFailuresCounty', '自來水不合格件數').theme).toBe('公用事業');
    expect(getStatisticsVisual('statsSewerConnectionCounty', '公共污水下水道用戶接管普及率').theme).toBe('公用事業');
    // 既有層不因新增 key 映射而改道
    expect(getStatisticsVisual('statsWaterSupplyHistorical').icon).toBe(Droplets);
    expect(getStatisticsVisual('statsWasteCounty').icon).toBe(Trash2);
  });

  it('routes demographics to the RdPu population theme by key prefix, never births/utilities or red–green', () => {
    expect(getStatisticsVisual('statsDemographicsCountyPopulationTotal', '戶籍人口數').theme).toBe('人口');
    expect(getStatisticsVisual('statsDemographicsTownshipShareAge65Plus', '65 歲以上人口占比').theme).toBe('人口');
    expect(getStatisticsVisual('statsDemographicsCountyPopulationTotal').icon).toBe(Users);
    expect(getStatisticsVisual('statsDemographicsCountyHouseholdSize').icon).toBe(HousePlus);
    expect(getStatisticsVisual('statsDemographicsCountyMedianAge').icon).toBe(CalendarClock);
    // 未來出生／死亡等指標仍走人口主題，不落入出生登記（公用事業）分支
    expect(getStatisticsVisual('statsDemographicsCountyBirths', '出生數').theme).toBe('人口');
    expect(getStatisticsVisual('statsDemographicsCountyAgingIndex').colors).toEqual(['#feebe2', '#fbb4b9', '#f768a1', '#c51b8a', '#7a0177']);
    expect(getStatisticsVisual('statsBirthsTownship').icon).toBe(Baby);
    expect(getStatisticsVisual('statsDemographicsCountyBirths').icon).toBe(Baby);
  });

  it('uses PuOr centred on 0 for signed demographics (natural increase, net migration and their rates)', () => {
    for (const [key, breaks] of [
      ['statsDemographicsCountyNaturalIncrease', [-5000, -2000, 0, 2000, 5000]],
      ['statsDemographicsTownshipNetMigrationRate', [-10, -5, 0, 5, 10]],
      ['statsDemographicsCountyNetMigrationYtd', [-2000, -1000, 0, 1000, 2000]],
    ] as const) {
      expect(STATISTICS_RECIPES[key].breaks).toEqual(breaks);
      expect(statisticsRenderRecipe(key).colors).toEqual(['#b35806', '#f1a340', '#fee0b6', '#d8daeb', '#998ec3', '#542788']);
    }
    // 非負指標仍為 RdPu 序列色
    expect(statisticsRenderRecipe('statsDemographicsCountyBirths').colors[0]).toBe('#feebe2');
  });

  it('uses the eight-class colorblind-friendly income palette for village income', () => {
    expect(getStatisticsVisual('statsLaborVillageIncomeMedian', '綜合所得中位數').colors).toEqual([
      '#fee838', '#d8c55c', '#b2a56c', '#8d8778', '#6c6b7c', '#4c526e', '#2b3f5d', '#00224e',
    ]);
  });

  it('resamples sequential colors to the number of Mapbox step intervals', () => {
    const colors = statisticsVisualColors('statsBusOperatingTripCount', '營業行車次數', [1, 2, 3, 4, 5, 6]);
    expect(colors).toHaveLength(7);
    for (let index = 1; index < colors.length; index += 1) {
      expect(luminance(colors[index - 1]!)).toBeGreaterThan(luminance(colors[index]!));
    }
  });

  it('uses PuOr on both sides of a negative-to-positive break sequence without inventing a zero class', () => {
    expect(statisticsVisualColors('statsEducationCountyStudentYearChange', '學生年增減數', [-1000, -100, 0, 100, 1000])).toEqual([
      '#b35806', '#f1a340', '#fee0b6', '#d8daeb', '#998ec3', '#542788',
    ]);
    expect(statisticsVisualColors('statsEducationCountyStudentYearChangePct', '學生年增減率', [-10, -3, 0, 3, 10])).toHaveLength(6);
  });

  it('covers every registered statistics key without the generic fallback', () => {
    const uncovered = STATISTICS_KEYS.filter(key => {
      const recipe = STATISTICS_RECIPES[key]!;
      return getStatisticsVisual(key, recipe.label).icon === ChartNoAxesCombined;
    });
    expect(uncovered).toEqual([]);
  });

  it('covers all source keys, presentation views, and their manifest entries', () => {
    // 2026-10-02: +37 環境統計（環境部／國土管理署 18 dataset）。
    // 2026-10-04: +32 人口統計（戶籍人口 8＋年齡結構 24；村里 HOLD 不收）。
    // 2026-10-04: +65 人口統計 P3–P6（人口動態 30＋遷徙 14＋原住民 8＋外來人口 13）。
    // 2026-10-04: +20 人口統計村里（戶籍人口 4＋年齡結構 12＋原住民 4；只有 11508 一期）。
    expect(STATISTICS_KEYS).toHaveLength(462);
    expect(STATISTICS_RENDER_KEYS).toHaveLength(474);
    const uncoveredRenderKeys = STATISTICS_RENDER_KEYS.filter(key => {
      const recipe = statisticsRenderRecipe(key);
      return getStatisticsVisual(key, recipe.label).icon === ChartNoAxesCombined;
    });
    expect(uncoveredRenderKeys).toEqual([]);
    for (const key of STATISTICS_KEYS) {
      const entry = LAYER_MANIFEST[key];
      expect(entry?.icon).not.toBe(ChartNoAxesCombined);
      expect(entry?.color).toBe(getStatisticsVisual(key, STATISTICS_RECIPES[key].label, entry?.section?.group).accent);
    }
  });
});
