/**
 * 圖層色對底圖的合成與對比（design-system map-layers §3.9 C-1–C-3）。
 *
 * - 合成：gamma（sRGB 編碼值）空間 source-over，與 Mapbox GL 畫半透明 fill／circle／line 的結果一致
 *   （2026-11-10 稽核以正式站截圖逐像素驗證：`#3182bd`@0.55 疊 `#292828` → `#2d5a7a`）。
 * - 對比：WCAG 2 相對亮度比。
 * - 色差：OKLab 距離 ×100（ΔE）。
 *
 * 純函式、零相依：圖例（legendKit）、統計色階測試、對比契約測試共用。
 */

export type Rgb = readonly [number, number, number];

/** `#rgb`／`#rrggbb`／`#rrggbbaa`／`rgb()`／`rgba()` → 0–1 通道＋alpha；其他格式回 null。 */
export function parseColor(input: string): { rgb: Rgb; alpha: number } | null {
  const text = input.trim().toLowerCase();
  const hexMatch = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hexMatch) {
    let digits = hexMatch[1]!;
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((d) => d + d).join("");
    if (digits.length !== 6 && digits.length !== 8) return null;
    const values = [0, 2, 4, 6].slice(0, digits.length / 2).map((i) => Number.parseInt(digits.slice(i, i + 2), 16) / 255);
    return { rgb: [values[0]!, values[1]!, values[2]!], alpha: values[3] ?? 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(text);
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (part: string) => (part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part) / 255);
    const rgb = parts.slice(0, 3).map(channel);
    if (rgb.some((value) => Number.isNaN(value))) return null;
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3]);
    return { rgb: [rgb[0]!, rgb[1]!, rgb[2]!], alpha: Number.isNaN(alpha) ? 1 : alpha };
  }
  return null;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(clamp01(channel) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** `fg` 以 `alpha` 疊在不透明的 `bg` 上（gamma 空間 source-over）。 */
export function compositeOver(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  const a = clamp01(alpha);
  return [a * fg[0] + (1 - a) * bg[0], a * fg[1] + (1 - a) * bg[1], a * fg[2] + (1 - a) * bg[2]];
}

/** 字串版：色值本身帶 alpha（rgba、#rrggbbaa）時再乘上去；解析不了回原字串。 */
export function compositeHex(color: string, background: string, alpha: number): string {
  const fg = parseColor(color);
  const bg = parseColor(background);
  if (!fg || !bg) return color;
  return toHex(compositeOver(fg.rgb, bg.rgb, alpha * fg.alpha));
}

const linear = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function oklab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(linear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab 距離 ×100。 */
export function deltaE(a: Rgb, b: Rgb): number {
  const A = oklab(a);
  const B = oklab(b);
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

const gammaEncode = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);

/** OKLab → sRGB（0–1，未裁切；超出 0–1＝不在色域）。 */
export function fromOklab(lab: Rgb): Rgb {
  const [L, a, b] = lab;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gammaEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gammaEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gammaEncode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** OKLCH（L、C、h 度）→ 色域內 sRGB：超出色域時保留 L 與色相、降彩度。 */
export function fromOklch(L: number, C: number, hueDeg: number): Rgb {
  const h = (hueDeg * Math.PI) / 180;
  const at = (c: number) => fromOklab([L, c * Math.cos(h), c * Math.sin(h)]);
  const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let rgb = at(C);
  if (inGamut(rgb)) return rgb;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid; else hi = mid;
  }
  rgb = at(lo);
  return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
}

/** sRGB → OKLCH（L、C、h 度）。 */
export function oklch(rgb: Rgb): Rgb {
  const [L, a, b] = oklab(rgb);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}

/** 色字串正規化（大小寫、#rgb、rgb()）成小寫 hex（帶 alpha 時 8 碼），供對照表當鍵；解析不了回小寫原字串。 */
export function normalizeColor(color: string): string {
  const p = parseColor(color);
  if (!p) return color.trim().toLowerCase();
  return p.alpha >= 1 ? toHex(p.rgb) : `${toHex(p.rgb)}${Math.round(p.alpha * 255).toString(16).padStart(2, "0")}`;
}
