import { describe, expect, it } from 'vitest';
import { BUS_STATISTICS_GROUPS, HOUSING_MIXED_STATISTICS_GROUP, HOUSING_STATISTICS_GROUPS, LAND_STATISTICS_GROUPS, MEDICAL_STATISTICS_GROUPS, PRIMARY_STATISTICS_GROUPS, TRANSPORT_STATISTICS_GROUPS, WASTE_STATISTICS_GROUPS, getMedicalStatisticsGroup, resolveMedicalStatisticsGroupKey } from '../medicalStatisticsGroups';

describe('statistics toggle groups', () => {
 it('keeps medical raw, per-population, and per-area options together', () => {
  expect(getMedicalStatisticsGroup('statsHealthIcuBedTotal')?.key).toBe('hospitalBeds');
  expect(MEDICAL_STATISTICS_GROUPS.find(x=>x.key==='hospitalBeds')?.options.some(x=>String(x.key).includes('IcuBedTotalPer10000'))).toBe(true);
  expect(MEDICAL_STATISTICS_GROUPS.find(x=>x.key==='hospitalBeds')?.options.some(x=>String(x.key).includes('IcuBedTotalPerKm2'))).toBe(true);
  expect(MEDICAL_STATISTICS_GROUPS.find(x=>x.key==='hospitalCount')?.options.map(x=>x.key)).toEqual(expect.arrayContaining(['statsHealthHospitalCount', 'statsComparisonHospitalCountPer10000PopulationTownship', 'statsComparisonHospitalCountPerKm2Township']));
 });
 it('registers six housing groups plus the county-only mixed-use group', () => {
  expect(HOUSING_STATISTICS_GROUPS).toHaveLength(6);
  expect(HOUSING_MIXED_STATISTICS_GROUP.options.map(x=>x.key)).toContain('statsHousingMixedUseCounty');
  expect(HOUSING_MIXED_STATISTICS_GROUP.options.some(x=>String(x.key).includes('HousingMixedShare'))).toBe(true);
 });
 it('registers fifteen land families with their raw township measure and comparisons', () => {
  expect(LAND_STATISTICS_GROUPS).toHaveLength(15);
  expect(LAND_STATISTICS_GROUPS.every(group=>group.options[0]?.label==='鄉鎮：原始面積'&&group.options.length>=5)).toBe(true);
 });
 it('keeps every bus metric with raw, population, and area comparisons; accessibility and electric also retain shares', () => {
  expect(BUS_STATISTICS_GROUPS.map(x=>x.options.length)).toEqual([3,3,3,3,4,4,3,3]);
  expect(BUS_STATISTICS_GROUPS.find(x=>x.key==='busAccessible')?.options.map(x=>x.key)).toContain('statsComparisonBusAccessibleSharePct');
  expect(BUS_STATISTICS_GROUPS.find(x=>x.key==='busElectric')?.options.map(x=>x.key)).toContain('statsComparisonBusElectricSharePct');
 });
 it('keeps each accident, vehicle, parking, and licence metric in its own raw-to-rate group', () => {
  expect(TRANSPORT_STATISTICS_GROUPS.find(x=>x.key==='a1DeathCount')?.options.map(x=>x.key)).toEqual(['statsA1DeathCount', 'statsComparisonA1DeathCountPer10000Residents', 'statsComparisonA1DeathCountPerKm2']);
  expect(TRANSPORT_STATISTICS_GROUPS.find(x=>x.key==='a2AccidentCount')?.options.map(x=>x.key)).toEqual(['statsComparisonA2AccidentCount', 'statsComparisonA2AccidentCountPer10000Residents', 'statsComparisonA2AccidentCountPerKm2']);
  expect(TRANSPORT_STATISTICS_GROUPS.filter(group=>/(Parking|Registered|LicenseHolders)/.test(group.key)).every(group=>group.options.length===2&&group.options[0]?.key!==group.options[1]?.key)).toBe(true);
 });
 it('keeps waste vehicle totals and recycling vehicles with their own population and area rates', () => {
  expect(WASTE_STATISTICS_GROUPS.find(x=>x.key==='wasteTotalVehicles')?.options.map(x=>x.key)).toEqual(['statsWasteCounty', 'statsComparisonWasteTotalVehiclesPer10000Residents', 'statsComparisonWasteTotalVehiclesPerKm2']);
  expect(WASTE_STATISTICS_GROUPS.find(x=>x.key==='wasteRecyclingVehicles')?.options.map(x=>x.key)).toEqual(['statsRecyclingCounty', 'statsComparisonWasteRecyclingVehiclesPer10000Residents', 'statsComparisonWasteRecyclingVehiclesPerKm2']);
 });
 it('places livestock head/farm and fishery count/share in their topic families', () => {
  expect(PRIMARY_STATISTICS_GROUPS.find(x=>x.key==='livestockHeadAndFarm')?.options.map(x=>x.key)).toEqual(expect.arrayContaining(['statsLivestockHeadCountTownship', 'statsLivestockFarmCountTownship', 'statsComparisonLivestockHeadsPerFarmTownship']));
  expect(PRIMARY_STATISTICS_GROUPS.find(x=>x.key==='fisheryProduction')?.options.map(x=>x.key)).toEqual(expect.arrayContaining(['statsFisheryProductionCounty', 'statsComparisonFisheryProductionTonnesNationalSharePctCounty']));
 });
 it('prefers an expanded visible option without changing visibility', () => {
  const g=getMedicalStatisticsGroup('hospitalBeds')!;
  const visibility=Object.fromEntries(g.options.map((x,i)=>[x.key,i===0||i===1])) as never;
  expect(resolveMedicalStatisticsGroupKey(g,visibility,String(g.options[1]!.key))).toBe(g.options[1]!.key);
 });
});
