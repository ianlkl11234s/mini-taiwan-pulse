/** Renderer-free RdBu palette shared by the temperature-wave scene and legend. */
export interface DivergingStop {
  readonly t: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const DIVERGING_STOPS: readonly DivergingStop[] = [
  { t: 0.000, r: 0x21 / 255, g: 0x66 / 255, b: 0xac / 255 },
  { t: 0.222, r: 0x67 / 255, g: 0xa9 / 255, b: 0xcf / 255 },
  { t: 0.389, r: 0xd1 / 255, g: 0xe5 / 255, b: 0xf0 / 255 },
  { t: 0.556, r: 0xf7 / 255, g: 0xf7 / 255, b: 0xf7 / 255 },
  { t: 0.667, r: 0xfd / 255, g: 0xdb / 255, b: 0xc7 / 255 },
  { t: 0.778, r: 0xef / 255, g: 0x8a / 255, b: 0x62 / 255 },
  { t: 1.000, r: 0xb2 / 255, g: 0x18 / 255, b: 0x2b / 255 },
];
