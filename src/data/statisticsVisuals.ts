import {
  Baby,
  BedDouble,
  Beef,
  Bike,
  Bus,
  Car,
  ChartNoAxesCombined,
  Droplets,
  Fish,
  GraduationCap,
  HeartHandshake,
  Hospital,
  House,
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
  security: { theme: '治安', accent: '#ef4444', colors: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'] },
  fallback: { theme: '統計', accent: '#6baed6', colors: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] },
} as const satisfies Record<string, StatisticsTheme>;

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

/**
 * Presentation semantics only. This deliberately does not import recipe or manifest
 * modules, so the statistics registry can consume it without a dependency cycle.
 */
export function getStatisticsVisual(key: string, label?: string, group?: string): StatisticsVisual {
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
