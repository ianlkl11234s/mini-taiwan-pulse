/**
 * 多年份並排的 canvas 繪製：邊界依「層級＋邊界版本＋基準寬度」各簡化一次（所有年份共用），
 * 填色語意同主地圖（`smallMultipleFill`）；`shapeBox`／`shapePath` 也給滑鼠點選判斷用。
 */
import { smallMultipleFill } from '../../data/statisticsSmallMultiples';
import type { statisticsRenderRecipe } from '../../data/regionalStatisticsRecipes';
import { BASE_WIDTH, prepareSmallMultiplesBoundary, type PreparedBoundary, type PreparedShape } from '../../map/smallMultiplesGeometry';
import { BOUNDARY_GRAY, GRADED_SEAM, basemapLandColor, hatchImageData, mapSeamColor, type HatchKind } from '../../map/mapStyleScale';

export type RenderRecipe = ReturnType<typeof statisticsRenderRecipe>;

const preparedCache = new Map<string, PreparedBoundary>();
export function preparedBoundary(features: readonly GeoJSON.Feature[], level: string, boundaryVersion: string, baseWidth = BASE_WIDTH): PreparedBoundary {
  const key = `${level}|${boundaryVersion}|${features.length}|${baseWidth}`;
  const hit = preparedCache.get(key);
  if (hit) return hit;
  const prepared = prepareSmallMultiplesBoundary(features, level, baseWidth);
  preparedCache.set(key, prepared);
  while (preparedCache.size > 6) preparedCache.delete(preparedCache.keys().next().value!);
  return prepared;
}

const pathCache = new WeakMap<PreparedShape, Path2D>();
export function shapePath(shape: PreparedShape): Path2D {
  let path = pathCache.get(shape);
  if (!path) {
    path = new Path2D();
    for (const ring of shape.rings) {
      path.moveTo(ring[0]!, ring[1]!);
      for (let i = 2; i < ring.length; i += 2) path.lineTo(ring[i]!, ring[i + 1]!);
      path.closePath();
    }
    pathCache.set(shape, path);
  }
  return path;
}

export interface ShapeBox { x0: number; y0: number; x1: number; y1: number }
const boxCache = new WeakMap<PreparedShape, ShapeBox>();
export function shapeBox(shape: PreparedShape): ShapeBox {
  let box = boxCache.get(shape);
  if (!box) {
    box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const ring of shape.rings) for (let i = 0; i < ring.length; i += 2) {
      const x = ring[i]!, y = ring[i + 1]!;
      if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y;
    }
    boxCache.set(shape, box);
  }
  return box;
}

function hatchPattern(ctx: CanvasRenderingContext2D, kind: HatchKind, isDark: boolean, scale: number): CanvasPattern | null {
  const { width, height, data } = hatchImageData(kind, isDark);
  const tile = document.createElement('canvas');
  tile.width = width; tile.height = height;
  tile.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  // 斜線間距固定在約 6 CSS px（不隨圖縮放變密）
  pattern?.setTransform(new DOMMatrix().scale(0.75 / scale));
  return pattern;
}

/** 畫一張地圖：canvas 寬高需已設定；`dpr` 用來讓邊界線維持約 0.5 CSS px。 */
export function paintMap(canvas: HTMLCanvasElement, prepared: PreparedBoundary, features: readonly GeoJSON.Feature[], recipe: RenderRecipe, opacity: number, isDark: boolean, dpr: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = canvas.width / prepared.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, prepared.width, prepared.height);
  const byCode = new Map(features.map(feature => [String(feature.properties?.area_code), feature.properties]));
  const hatch = { missing: hatchPattern(ctx, 'missing', isDark, scale), suppressed: hatchPattern(ctx, 'suppressed', isDark, scale) };
  const theme = isDark ? 'dark' : 'light';
  for (const shape of prepared.shapes) {
    const path = shapePath(shape);
    const fill = smallMultipleFill(byCode.get(shape.areaCode), recipe);
    // 底圖陸地色打底（同主地圖疊在底圖上），有值的面再以滑桿透明度上色；缺值／遮蔽只畫斜線
    ctx.globalAlpha = 1;
    ctx.fillStyle = basemapLandColor(isDark);
    ctx.fill(path, 'evenodd');
    if (fill.kind === 'value' || fill.kind === 'notApplicable') {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = fill.color;
      ctx.fill(path, 'evenodd');
    } else {
      const pattern = hatch[fill.kind];
      if (pattern) { ctx.globalAlpha = opacity; ctx.fillStyle = pattern; ctx.fill(path, 'evenodd'); }
    }
    const hasValue = fill.kind === 'value';
    ctx.globalAlpha = hasValue ? GRADED_SEAM.opacity[theme] : GRADED_SEAM.noValueOpacity;
    ctx.strokeStyle = hasValue ? mapSeamColor(isDark) : BOUNDARY_GRAY[theme];
    ctx.lineWidth = 0.5 * dpr / scale;
    ctx.stroke(path);
  }
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = BOUNDARY_GRAY[theme];
  ctx.lineWidth = 0.75 * dpr / scale;
  for (const frame of prepared.insetFrames) ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);
  ctx.globalAlpha = 1;
}
