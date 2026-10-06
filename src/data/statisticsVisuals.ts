import {
  Baby,
  Cigarette,
  HandHeart,
  Leaf,
  MapPin,
  Pill,
  Ribbon,
  Smartphone,
  Syringe,
  TestTube,
  Wine,
  Briefcase,
  CalendarClock,
  BedDouble,
  Beef,
  Bike,
  Bus,
  Car,
  ChartNoAxesCombined,
  ClipboardCheck,
  Droplets,
  Factory,
  Feather,
  Flower2,
  Gem,
  Globe,
  IdCard,
  ArrowLeftRight,
  TrendingUpDown,
  Flame,
  FlaskConical,
  Gauge,
  Gavel,
  Megaphone,
  Shovel,
  Utensils,
  Waves,
  Wind,
  Fish,
  GraduationCap,
  HeartHandshake,
  Hospital,
  Hourglass,
  House,
  HousePlus,
  PersonStanding,
  Scale,
  Users,
  UsersRound,
  Plane,
  Presentation,
  Recycle,
  Route,
  School,
  Shield,
  Ship,
  Stethoscope,
  Trash2,
  TrainFront,
  Trees,
  TriangleAlert,
  Wheat,
  Volume2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface StatisticsVisual {
  icon: LucideIcon;
  accent: string;
  colors: readonly string[];
  theme: string;
}

type StatisticsTheme = Omit<StatisticsVisual, 'icon'>;

// ColorBrewer sequential five-class schemes, ordered from low to high values.
const THEMES = {
  education: { theme: '教育', accent: '#9e9ac8', colors: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'] },
  health: { theme: '醫療', accent: '#66c2a4', colors: ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'] },
  housing: { theme: '住宅', accent: '#fd8d3c', colors: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'] },
  transport: { theme: '交通', accent: '#6baed6', colors: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] },
  agriculture: { theme: '農業', accent: '#78c679', colors: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'] },
  livestock: { theme: '畜牧', accent: '#fe9929', colors: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'] },
  fishery: { theme: '漁業', accent: '#74a9cf', colors: ['#f1eef6', '#bdc9e1', '#74a9cf', '#2b8cbe', '#045a8d'] },
  forestry: { theme: '林業', accent: '#74c476', colors: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'] },
  environment: { theme: '環境', accent: '#8c96c6', colors: ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'] },
  utilities: { theme: '公用事業', accent: '#7bccc4', colors: ['#f0f9e8', '#bae4bc', '#7bccc4', '#43a2ca', '#0868ac'] },
  income: { theme: '所得', accent: '#8d8778', colors: ['#fee838', '#d8c55c', '#b2a56c', '#8d8778', '#6c6b7c', '#4c526e', '#2b3f5d', '#00224e'] },
  labor: { theme: '工作與所得', accent: '#2a9d8f', colors: ['#edf8fb', '#b2e2e2', '#66c2a4', '#2ca25f', '#006d2c'] },
  // 人口統計：ColorBrewer RdPu（淺粉→深紫）。序列色只表數量高低；老化、性比例都不是好壞，不用紅綠。
  population: { theme: '人口', accent: '#c51b8a', colors: ['#feebe2', '#fbb4b9', '#f768a1', '#c51b8a', '#7a0177'] },
  security: { theme: '治安', accent: '#ef4444', colors: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'] },
  fallback: { theme: '統計', accent: '#6baed6', colors: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] },
} as const satisfies Record<string, StatisticsTheme>;

/** 五階序列色（低 → 高）供點圖層漸層共用；與 Statistics 同一組 ColorBrewer 色，不另造色號。 */
export const STATISTICS_SEQUENTIAL_SCHEMES = THEMES;

const textFor = (key: string, label?: string, group?: string) => `${key} ${label ?? ''} ${group ?? ''}`.toLocaleLowerCase();
const has = (text: string, terms: readonly string[]) => terms.some(term => text.includes(term.toLocaleLowerCase()));

const PU_OR_6 = ['#b35806', '#f1a340', '#fee0b6', '#d8daeb', '#998ec3', '#542788'] as const;

function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function displayChannel(value: number): number {
  const normalized = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, normalized)) * 255);
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(index => linearChannel(Number.parseInt(hex.slice(index, index + 2), 16))) as [number, number, number];
}

function hex(channels: readonly number[]): string {
  return `#${channels.map(displayChannel).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

/** Resamples a ColorBrewer palette in linear RGB, retaining both endpoints. */
function resample(colors: readonly string[], size: number): string[] {
  if (size <= 0) return [];
  if (size === 1) return [colors[0]!];
  if (size === colors.length) return [...colors];
  return Array.from({ length: size }, (_, index) => {
    const position = index * (colors.length - 1) / (size - 1);
    const left = Math.floor(position);
    const right = Math.ceil(position);
    const mix = position - left;
    const from = rgb(colors[left]!);
    const to = rgb(colors[right]!);
    return hex(from.map((channel, channelIndex) => channel + (to[channelIndex]! - channel) * mix));
  });
}

function visual(theme: StatisticsTheme, icon: LucideIcon): StatisticsVisual {
  return { ...theme, icon };
}

type ThemeName = keyof typeof THEMES;
/**
 * 環境統計 37 層（environmentStatisticsRecipes）以 key 明確指定，避免「機車」「水」等
 * 字詞落入交通或供水分支。環境＝BuPu；自來水／污水下水道屬公用事業＝GnBu。
 * 刻意不 import recipe，維持本檔無循環依賴。
 */
const ENVIRONMENT_KEY_VISUALS: Record<string, readonly [ThemeName, LucideIcon]> = {
  statsComplaintsCounty: ['environment', Megaphone], statsComplaintsPer10kDerivedCounty: ['environment', Megaphone],
  statsComplaintTargetCounty: ['environment', Megaphone], statsComplaintCasesPndCounty: ['environment', Megaphone],
  statsComplaintPopulationCounty: ['environment', Megaphone], statsComplaintsPer10kCounty: ['environment', Megaphone],
  statsBurningComplaintsCounty: ['environment', Flame], statsBurningComplaintsPer10kCounty: ['environment', Flame],
  statsSoilControlAreaCounty: ['environment', Shovel], statsSoilRemediationAreaCounty: ['environment', Shovel],
  statsEnvInspectionsCounty: ['environment', ClipboardCheck], statsEnvInspectionsPerFacilityCounty: ['environment', ClipboardCheck],
  statsEnvFineCasesCounty: ['environment', Gavel], statsEnvFineRateCounty: ['environment', Gavel],
  statsEnvFineAmountCounty: ['environment', Gavel], statsEnvFineCollectedCounty: ['environment', Gavel],
  statsAqiPoorRatioCounty: ['environment', Wind],
  statsMotorArrivalRateCounty: ['environment', Gauge], statsMotorNotifiedCounty: ['environment', Gauge], statsMotorTestedCounty: ['environment', Gauge],
  statsBodGeneratedCounty: ['environment', FlaskConical], statsBodDischargedCounty: ['environment', FlaskConical], statsBodDischargedPerKm2County: ['environment', FlaskConical],
  statsWasteGeneratedCounty: ['environment', Trash2], statsWasteGeneratedPer10kCounty: ['environment', Trash2], statsWastePerCapitaCounty: ['environment', Trash2],
  statsGeneralGarbageCounty: ['environment', Trash2], statsGeneralGarbagePer10kCounty: ['environment', Trash2],
  statsFoodWasteCounty: ['environment', Utensils],
  statsRecyclingAmountCounty: ['environment', Recycle], statsRecyclingPer10kCounty: ['environment', Recycle],
  statsResponsibleEnterprisesCounty: ['environment', Factory],
  statsTapWaterTestsCounty: ['utilities', Droplets], statsTapWaterFailuresCounty: ['utilities', Droplets], statsTapWaterFailureRateCounty: ['utilities', Droplets],
  statsSewerConnectionCounty: ['utilities', Waves], statsSewageTreatmentCounty: ['utilities', Waves],
};

/**
 * 成癮與減害統計（addictionStatisticsRecipes）以 key 明確指定，避免「酒駕」「HIV」「據點」落入
 * 交通或 fallback 分支。疾病／行為調查／服務據點＝醫療 BuGn；執法（警政、地檢署）＝既有治安 Reds
 * （同犯罪統計，色相只是主題提示，不表示好壞）。不新增色票；刻意不 import recipe。
 */
const ADDICTION_KEY_ICONS: ReadonlyArray<readonly [RegExp, ThemeName, LucideIcon]> = [
  [/^statsHiv(?:NewCases|Per100k|Cases|Per100kYear)(?:County|Township)$/, 'health', Ribbon],
  [/^statsDrug(?:Use|Grade1|Grade2)?SuspectsCounty$|^statsDrug(?:Use|Grade1|Grade2)?SuspectsPer100kCounty$/, 'security', Pill],
  [/^statsDui(?:Cases|Rate|Enforcement|EnforcementPer100k)County$/, 'security', Wine],
  [/^statsProsecutor/, 'security', Gavel],
  [/^statsAdultSmokingRateCounty$/, 'health', Cigarette],
  [/^statsAdultBetelRateCounty$/, 'health', Leaf],
  [/^statsNeedle(?:EducationStations|VendingMachines|ReturnBins)/, 'health', Syringe],
  [/^statsDrugTreatmentFacilities/, 'health', Pill],
  [/^statsAlcoholTreatmentFacilities/, 'health', Wine],
  [/^statsHivTestingSites/, 'health', TestTube],
  [/^statsHivSelftestOutlets/, 'health', TestTube],
  [/^statsPrepServiceSites/, 'health', HandHeart],
  [/^statsSmokingCessationProviders/, 'health', Cigarette],
  [/^statsInternetAddictionServices/, 'health', Smartphone],
  [/^statsDrugPreventionCenters/, 'health', MapPin],
];

function addictionVisual(key: string): StatisticsVisual | undefined {
  const match = ADDICTION_KEY_ICONS.find(([pattern]) => pattern.test(key));
  return match ? visual(THEMES[match[1]], match[2]) : undefined;
}

/**
 * 人口統計（demographicsStatisticsRecipes）以 key 前綴 `statsDemographics` 明確指定，避免未來
 * 「出生」「死亡」等標籤落入出生登記（公用事業）分支；icon 依 key 的指標段。
 * 可正可負的指標（自然增加、淨遷徙及其率；recipe 門檻對稱於 0）由 statisticsVisualColors 走 PuOr 雙向色階。
 */
const DEMOGRAPHICS_KEY = /^statsDemographics(?:County|Township|Village)(.+)$/;
const DEMOGRAPHICS_ICONS: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/^Household/, HousePlus],
  [/^PopulationDensity$/, UsersRound],
  [/^(?:PopAge|ShareAge)/, PersonStanding],
  [/^(?:AgingIndex|DependencyRatio|ChildDependencyRatio|OldDependencyRatio)$/, Hourglass],
  [/^SexRatio$/, Scale],
  [/^MedianAge$/, CalendarClock],
  [/^(?:Births|CrudeBirthRate)/, Baby],
  [/^(?:Deaths|CrudeDeathRate)/, Flower2],
  [/^NaturalIncrease/, TrendingUpDown],
  [/^(?:Marriages|Divorces|CrudeMarriageRate|CrudeDivorceRate)/, Gem],
  [/^(?:In|Out|Net)Migration/, ArrowLeftRight],
  [/^Indigenous/, Feather],
  [/^ForeignOrigin/, Globe],
  [/^Naturalization/, IdCard],
];

function demographicsVisual(key: string): StatisticsVisual | undefined {
  const metric = DEMOGRAPHICS_KEY.exec(key)?.[1];
  if (!metric) return undefined;
  return visual(THEMES.population, DEMOGRAPHICS_ICONS.find(([pattern]) => pattern.test(metric))?.[1] ?? Users);
}

/**
 * Presentation semantics only. This deliberately does not import recipe or manifest
 * modules, so the statistics registry can consume it without a dependency cycle.
 */
export function getStatisticsVisual(key: string, label?: string, group?: string): StatisticsVisual {
  const environment = ENVIRONMENT_KEY_VISUALS[key];
  if (environment) return visual(THEMES[environment[0]], environment[1]);
  const demographics = demographicsVisual(key);
  if (demographics) return demographics;
  const addiction = addictionVisual(key);
  if (addiction) return addiction;
  const text = textFor(key, label, group);

  if (has(text, ['教育', 'education', '學校', '學院', '幼兒園', '國小', '國中', '高中'])) {
    if (has(text, ['teacher', '教師', '師資', 'staff', '職員'])) return visual(THEMES.education, Presentation);
    if (has(text, ['student', '學生', '幼生', '班級', 'class'])) return visual(THEMES.education, GraduationCap);
    return visual(THEMES.education, School);
  }

  if (has(text, ['醫療', 'health', 'hospital', '醫院', '病床', 'bed', 'icu', '安寧', '護理之家', '產後護理'])) {
    if (has(text, ['bed', '病床', 'icu', '安寧', 'openbeds'])) return visual(THEMES.health, BedDouble);
    if (has(text, ['長照', 'careworker', '照護', '護理之家', '產後護理'])) return visual(THEMES.health, HeartHandshake);
    if (has(text, ['physician', 'doctor', 'nurse', 'professional', '醫師', '護理師', '醫事人員', '醫療人員'])) return visual(THEMES.health, Stethoscope);
    return visual(THEMES.health, Hospital);
  }

  if (has(text, ['出生', 'birth', '新生兒'])) return visual(THEMES.utilities, Baby);
  if (has(text, ['用電', 'electricity', '售電', '電力', '供電'])) return visual(THEMES.utilities, Zap);
  if (has(text, ['供水', 'water', '用水', '水量'])) return visual(THEMES.utilities, Droplets);
  if (has(text, ['回收', 'recycl'])) return visual(THEMES.environment, Recycle);
  if (has(text, ['噪音', 'noise'])) return visual(THEMES.environment, Volume2);
  if (has(text, ['垃圾', '廢棄物', 'waste', '污染', 'pollution'])) return visual(THEMES.environment, Trash2);

  if (has(text, ['事故', 'accident', '違規', 'violation'])) return visual(THEMES.transport, TriangleAlert);
  // crimeAreaMonthly retains its existing red renderer; this only supplies sidebar semantics.
  if (has(text, ['治安', 'crime', '警政', '犯罪'])) return visual(THEMES.security, Shield);
  if (has(text, ['公車', 'bus', '客運'])) return visual(THEMES.transport, Bus);
  if (has(text, ['自行車', 'bicycle', 'bike', 'youbike'])) return visual(THEMES.transport, Bike);
  if (has(text, ['tmrt', '捷運', '鐵路', 'rail'])) return visual(THEMES.transport, TrainFront);
  if (has(text, ['機場', 'airport', '航空', 'aeronautics'])) return visual(THEMES.transport, Plane);
  if (has(text, ['港', 'maritime', '船', '航運', 'portland'])) return visual(THEMES.transport, Ship);
  if (has(text, ['道路', 'road'])) return visual(THEMES.transport, Route);
  if (has(text, ['汽車', 'automobile', 'car', '停車', 'parking', '機車', 'motorcycle'])) return visual(THEMES.transport, Car);

  if (has(text, ['住宅', 'housing', '住戶', '空屋', '居住', '建物'])) {
    return visual(THEMES.housing, House);
  }

  if (has(text, ['statslaborvillageincomemedian', '綜合所得'])) return visual(THEMES.income, Briefcase);
  if (has(text, ['勞動', '所得', '薪資', '就業', '失業', 'labor', 'employment', 'salary', 'income'])) {
    return visual(THEMES.labor, Briefcase);
  }

  if (has(text, ['漁業', 'fishery', 'aquaculture', '水產', '養殖'])) return visual(THEMES.fishery, Fish);
  if (has(text, ['畜牧', 'livestock', '養豬', '豬', '牧場', 'pasture'])) return visual(THEMES.livestock, Beef);
  if (has(text, ['林業', 'forest', '森林', '竹林', '林地', '林產'])) return visual(THEMES.forestry, Trees);
  if (has(text, ['農業', 'agricultur', '農地', '水田', '旱地', 'dryfield', '果園', '作物', '稻', 'crop'])) return visual(THEMES.agriculture, Wheat);
  if (has(text, ['urbanrental', 'riverside', 'rentaltrip'])) return visual(THEMES.transport, Bike);

  return visual(THEMES.fallback, ChartNoAxesCombined);
}

/**
 * Returns one colour per Mapbox step interval. Negative-valued metrics use the
 * six-class ColorBrewer PuOr diverging scheme; zero remains the break between
 * adjacent classes, rather than an invented neutral class.
 */
export function statisticsVisualColors(key: string, label: string, breaks: readonly number[]): string[] {
  const palette = breaks.some(value => value < 0) ? PU_OR_6 : getStatisticsVisual(key, label).colors;
  return resample(palette, breaks.length + 1);
}
