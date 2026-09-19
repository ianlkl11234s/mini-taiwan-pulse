import { describe, expect, it } from 'vitest';
import {
  Baby, BedDouble, Beef, Bike, Bus, Car, ChartNoAxesCombined, Droplets, Fish,
  GraduationCap, HeartHandshake, Hospital, House, Plane, Presentation,
  Recycle, Route, School, Shield, Ship, Stethoscope, Trash2, Trees, TriangleAlert,
  Volume2, Wheat, Zap,
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

  it('uses five-step sequential palettes with monotonically decreasing luminance', () => {
    for (const key of STATISTICS_KEYS) {
      const recipe = STATISTICS_RECIPES[key]!;
      const colors = getStatisticsVisual(key, recipe.label).colors;
      expect(colors).toHaveLength(5);
      for (let index = 1; index < colors.length; index += 1) {
        expect(luminance(colors[index - 1]!)).toBeGreaterThan(luminance(colors[index]!));
      }
    }
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
    expect(STATISTICS_KEYS).toHaveLength(299);
    expect(STATISTICS_RENDER_KEYS).toHaveLength(311);
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
