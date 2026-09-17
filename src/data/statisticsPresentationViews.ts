import type { SocialStatisticsLayerKey } from './socialStatisticsRecipes';
import { STATISTICS_COMPARISONS_UI_ENABLED, type ComparisonStatisticsLayerKey } from './comparisonStatisticsRecipes';

export type EducationStage = 'preschool' | 'elementary' | 'junior_high' | 'senior_high';
export type EducationPresentationViewKey =
  | 'statsEducationPreschoolSchool' | 'statsEducationPreschoolTeacher' | 'statsEducationPreschoolStudent'
  | 'statsEducationElementarySchool' | 'statsEducationElementaryTeacher' | 'statsEducationElementaryStudent'
  | 'statsEducationJuniorHighSchool' | 'statsEducationJuniorHighTeacher' | 'statsEducationJuniorHighStudent'
  | 'statsEducationSeniorHighSchool' | 'statsEducationSeniorHighTeacher' | 'statsEducationSeniorHighStudent';

export interface EducationPresentationMetric {
  layerKey: SocialStatisticsLayerKey | ComparisonStatisticsLayerKey;
  label: string;
}
export interface EducationPresentationView {
  key: EducationPresentationViewKey;
  label: string;
  stage: EducationStage;
  side: '學校端' | '老師端' | '學生端';
  metrics: readonly EducationPresentationMetric[];
}

const visibleMetrics = (metrics: EducationPresentationMetric[]) => STATISTICS_COMPARISONS_UI_ENABLED
  ? metrics
  : metrics.filter(metric => !metric.layerKey.startsWith('statsComparison'));

const school: EducationPresentationMetric[] = [
  { layerKey: 'statsEducationCountyInstitutionCount', label: '機構或學校數' },
  { layerKey: 'statsComparisonEducationInstitutionCountPer10000Residents', label: '機構或學校數（每萬名居民）' },
  { layerKey: 'statsComparisonEducationInstitutionCountPerKm2', label: '機構或學校數（每平方公里）' },
];
const teacher: EducationPresentationMetric[] = [
  { layerKey: 'statsEducationCountyTeacherCount', label: '教師數' },
  { layerKey: 'statsComparisonEducationTeacherCountPer10000Residents', label: '教師數（每萬名居民）' },
  { layerKey: 'statsComparisonEducationTeacherCountPerKm2', label: '教師數（每平方公里）' },
  { layerKey: 'statsEducationCountyStaffCount', label: '職員數' },
  { layerKey: 'statsComparisonEducationStaffCountPer10000Residents', label: '職員數（每萬名居民）' },
  { layerKey: 'statsComparisonEducationStaffCountPerKm2', label: '職員數（每平方公里）' },
];
const student: EducationPresentationMetric[] = [
  { layerKey: 'statsEducationCountyStudentCount', label: '學生或幼生數' },
  { layerKey: 'statsComparisonEducationStudentCountPer10000Residents', label: '學生或幼生數（每萬名居民）' },
  { layerKey: 'statsComparisonEducationStudentCountPerKm2', label: '學生或幼生數（每平方公里）' },
  { layerKey: 'statsEducationCountyClassCount', label: '班級數' },
  { layerKey: 'statsComparisonEducationClassCountPer10000Residents', label: '班級數（每萬名居民）' },
  { layerKey: 'statsComparisonEducationClassCountPerKm2', label: '班級數（每平方公里）' },
  { layerKey: 'statsEducationCountyStudentsPerClass', label: '每班學生數' },
  { layerKey: 'statsEducationCountyStudentYearChange', label: '學生或幼生年增減數' },
  { layerKey: 'statsEducationCountyStudentYearChangePct', label: '學生或幼生年增減率' },
];
const elementarySchool: EducationPresentationMetric[] = [...school,
  { layerKey: 'statsEducationCountySmallSchoolCount', label: '12班以下學校數' },
  { layerKey: 'statsEducationCountySmallSchoolSharePct', label: '12班以下學校占比' },
];
const teacherWithRatio: EducationPresentationMetric[] = [...teacher,
  { layerKey: 'statsEducationCountyStudentTeacherRatio', label: '生師比' },
];

export const EDUCATION_PRESENTATION_VIEWS = [
  { key: 'statsEducationPreschoolSchool', label: '幼兒園－學校端', stage: 'preschool', side: '學校端', metrics: visibleMetrics(school) },
  { key: 'statsEducationPreschoolTeacher', label: '幼兒園－老師端', stage: 'preschool', side: '老師端', metrics: visibleMetrics(teacher) },
  { key: 'statsEducationPreschoolStudent', label: '幼兒園－學生端', stage: 'preschool', side: '學生端', metrics: visibleMetrics([student[0]!, student[1]!, student[2]!, student[7]!, student[8]!]) },
  { key: 'statsEducationElementarySchool', label: '國小－學校端', stage: 'elementary', side: '學校端', metrics: visibleMetrics(elementarySchool) },
  { key: 'statsEducationElementaryTeacher', label: '國小－老師端', stage: 'elementary', side: '老師端', metrics: visibleMetrics(teacherWithRatio) },
  { key: 'statsEducationElementaryStudent', label: '國小－學生端', stage: 'elementary', side: '學生端', metrics: visibleMetrics(student) },
  { key: 'statsEducationJuniorHighSchool', label: '國中－學校端', stage: 'junior_high', side: '學校端', metrics: visibleMetrics(school) },
  { key: 'statsEducationJuniorHighTeacher', label: '國中－老師端', stage: 'junior_high', side: '老師端', metrics: visibleMetrics(teacherWithRatio) },
  { key: 'statsEducationJuniorHighStudent', label: '國中－學生端', stage: 'junior_high', side: '學生端', metrics: visibleMetrics(student) },
  { key: 'statsEducationSeniorHighSchool', label: '高中－學校端', stage: 'senior_high', side: '學校端', metrics: visibleMetrics(school) },
  { key: 'statsEducationSeniorHighTeacher', label: '高中－老師端', stage: 'senior_high', side: '老師端', metrics: visibleMetrics(teacherWithRatio) },
  { key: 'statsEducationSeniorHighStudent', label: '高中－學生端', stage: 'senior_high', side: '學生端', metrics: visibleMetrics(student) },
] as const satisfies readonly EducationPresentationView[];

export const EDUCATION_PRESENTATION_VIEW_KEYS = EDUCATION_PRESENTATION_VIEWS.map(view => view.key) as EducationPresentationViewKey[];
export const EDUCATION_PRESENTATION_VIEW_BY_KEY = Object.fromEntries(EDUCATION_PRESENTATION_VIEWS.map(view => [view.key, view])) as unknown as Record<EducationPresentationViewKey, EducationPresentationView>;
export function getEducationPresentationView(key: string): EducationPresentationView | undefined {
  return EDUCATION_PRESENTATION_VIEW_BY_KEY[key as EducationPresentationViewKey];
}
