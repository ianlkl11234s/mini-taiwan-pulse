/**
 * 統計圖層「多年份並排」視窗（設計提案 Q-F 方案 1；spec §5.27 置中視窗、§5.37 連動選單下的動作鈕）。
 *
 * - 每年一張 canvas 小圖，邊界用主地圖同一份參考邊界（`loadRegionalStatistics` 共用 SHA 校驗過的
 *   `statisticsGeometryCache`），前端簡化一次、各年共用；不開額外的 Mapbox 地圖。
 * - 所有小圖共用目前選擇的色階與分級門檻（`statisticsRenderRecipe`）；缺值／遮蔽畫法同主地圖。
 * - 每年各讀一份統計快照（走 loadingRegistry，最多 4 份同時），某年失敗在該格顯示原因與重試。
 * - 點任一張：主地圖切到那一期（`regionalStatisticsStore.setSelection`＝連動選單寫回的同一個 setter）、視窗關閉。
 * - 只放一份共用圖例；主圖例不變。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { loadRegionalStatistics, type StatisticsRecipe } from '../../data/regionalStatisticsLoader';
import { statisticsBaseKey, statisticsRenderRecipe, type StatisticsRenderKey } from '../../data/regionalStatisticsRecipes';
import { initialLoadIndexes, smallMultipleFill, smallMultiplesPlan, SMALL_MULTIPLES_PAGE, type SmallMultiplesPlan } from '../../data/statisticsSmallMultiples';
import { BASE_WIDTH, prepareSmallMultiplesBoundary, type PreparedBoundary, type PreparedShape } from '../../map/smallMultiplesGeometry';
import { BOUNDARY_GRAY, GRADED_SEAM, basemapLandColor, hatchImageData, mapSeamColor, type HatchKind } from '../../map/mapStyleScale';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { statisticsSmallMultiplesStore, useSmallMultiplesOpenKey } from '../../state/statisticsSmallMultiplesStore';
import { layerParamsStore } from '../../state/layerParamsStore';
import { statisticsPresentationMode } from '../../state/statisticsPresentationStore';
import { statisticsPresentationOptions } from '../../data/statisticsPresentation';
import { statisticsFillOpacity } from '../../data/statisticsVisuals';
import { statisticsPeriodLabel } from '../../data/statisticsLabels';
import { demographicsPeriodLabel, getDemographicsRecipe } from '../../data/demographicsStatisticsRecipes';
import { getSocialRecipe } from '../../data/socialStatisticsRecipes';
import { getAgriRecipe } from '../../data/agriStatisticsRecipes';
import { getLaborRecipe } from '../../data/laborStatisticsRecipes';
import { environmentLegendRows, getEnvironmentRecipe } from '../../data/environmentStatisticsRecipes';
import { getAddictionRecipe } from '../../data/addictionStatisticsRecipes';
import { getLandslideRecipe } from '../../data/landslideStatisticsRecipes';
import { atlasBinaryLegendRows, atlasCategoryRows, getAtlasRecipe } from '../../data/atlasStatisticsRecipes';
import { STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR } from '../../data/statisticsFillColor';
import { boundaryVersionLabel } from '../../data/statisticsLabels';
import { statisticsTitle, statisticsUnit } from '../../i18n/statisticsText';
import { enumLabel } from '../../i18n/dataText';
import { useLocale, type LocaleSnapshot } from '../../state/localeStore';
import { DARK_LEGEND, LIGHT_LEGEND, LegendFillOpacityCtx, LegendRow, LegendThemeCtx, LegendTitle, SwatchHatch, SwatchSquare } from '../legend/legendKit';
import { statisticsLegendRows } from '../sidebar/StatisticsDetails';
import './statisticsSmallMultiples.css';

// 每份 CDN 檔有 12 秒逾時；同時 4 份在本機高負載時曾逾時，降為 2（失敗格仍可重試）
const CONCURRENCY = 2;
const TW_LEVELS = new Set(['county', 'township', 'prosecutor_district']);

type TileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; features: GeoJSON.Feature[]; effectiveRecipe: StatisticsRecipe; boundaryVersion: string };

/** 每個邊界版本只簡化一次（所有年份共用）；最多留 4 份。 */
const preparedCache = new Map<string, PreparedBoundary>();
function preparedBoundary(features: readonly GeoJSON.Feature[], level: string, boundaryVersion: string): PreparedBoundary {
  const key = `${level}|${boundaryVersion}|${features.length}`;
  const hit = preparedCache.get(key);
  if (hit) return hit;
  const prepared = prepareSmallMultiplesBoundary(features, level);
  preparedCache.set(key, prepared);
  while (preparedCache.size > 4) preparedCache.delete(preparedCache.keys().next().value!);
  return prepared;
}
const pathCache = new WeakMap<PreparedShape, Path2D>();
function shapePath(shape: PreparedShape): Path2D {
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
function hatchPattern(ctx: CanvasRenderingContext2D, kind: HatchKind, isDark: boolean, scale: number): CanvasPattern | null {
  const { width, height, data } = hatchImageData(kind, isDark);
  const tile = document.createElement('canvas');
  tile.width = width; tile.height = height;
  tile.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  // 斜線間距固定在約 6 CSS px（不隨小圖縮放變密）
  pattern?.setTransform(new DOMMatrix().scale(0.75 / scale));
  return pattern;
}

function periodLabelOf(layerKey: StatisticsRenderKey, release: Parameters<typeof statisticsPeriodLabel>[0], i18n: LocaleSnapshot, indicator?: string): string {
  const baseKey = statisticsBaseKey(layerKey, indicator);
  return (getDemographicsRecipe(baseKey) ? demographicsPeriodLabel(baseKey, release as never, i18n) : undefined) ?? statisticsPeriodLabel(release, i18n);
}

function spanText(release: { period_start: string; period_end: string }, t: LocaleSnapshot['t']): string {
  const start = release.period_start.slice(5, 10), end = release.period_end.slice(5, 10);
  if (start === '01-01' && end === '12-31') return t('smallMultiples.spanYear');
  if (release.period_start === release.period_end) return t('smallMultiples.spanPoint', { date: end });
  return t('smallMultiples.spanRange', { from: start, to: end });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function StatisticsSmallMultiplesHost({ layerKey, isDark }: { layerKey: StatisticsRenderKey; isDark: boolean }) {
  const openKey = useSmallMultiplesOpenKey();
  if (openKey !== layerKey || typeof document === 'undefined') return null;
  return createPortal(<SmallMultiplesDialog layerKey={layerKey} isDark={isDark} />, document.body);
}

function SmallMultiplesDialog({ layerKey, isDark }: { layerKey: StatisticsRenderKey; isDark: boolean }) {
  const i18n = useLocale();
  const { t } = i18n;
  const close = useCallback(() => statisticsSmallMultiplesStore.close(), []);
  // 開窗當下的選擇決定年份清單與色階（視窗開著時主地圖不會變）
  const [snapshot] = useState(() => regionalStatisticsStore.getSnapshot(layerKey));
  const plan = useMemo<SmallMultiplesPlan | null>(() => smallMultiplesPlan(layerKey, snapshot), [layerKey, snapshot]);
  const indicator = snapshot.selection?.indicatorId;
  const baseKey = statisticsBaseKey(layerKey, indicator);
  // memo：recipe 物件換了會讓每張小圖重畫（每次有格子載完都會重繪全部）
  const dimensions = snapshot.selection?.dimensions;
  const recipe = useMemo(() => statisticsRenderRecipe(layerKey, indicator, dimensions, { isDark }), [layerKey, indicator, dimensions, isDark]);
  const slider = layerParamsStore.getParam(layerKey, `${layerKey}Opacity`);
  const opacity = statisticsFillOpacity(typeof slider === 'number' ? slider : undefined, isDark);
  const title = statisticsTitle(baseKey, recipe.label, i18n, 'valueTransform' in recipe && Boolean(recipe.valueTransform));
  const periods = useMemo(() => plan?.periods ?? [], [plan]);

  const [tiles, setTiles] = useState<TileState[]>(() => periods.map(() => ({ status: 'idle' })));
  const [wanted, setWanted] = useState<Set<number>>(() => initialLoadIndexes(periods.length));
  const controller = useRef(new AbortController());
  const inFlight = useRef(new Set<number>());
  // 關窗時取消還在讀的期別（withLoading 帶 signal，不記成失敗）；開發模式 StrictMode 會先卸載再掛一次，所以每次掛載換新的
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);

  // 載入佇列：想看的格子（初始最近 12 年＋捲動進視野）依序載，同時最多 CONCURRENCY 份
  useEffect(() => {
    const queue = [...wanted].filter(index => tiles[index]?.status === 'idle' && !inFlight.current.has(index)).sort((a, b) => b - a);
    for (const index of queue) {
      if (inFlight.current.size >= CONCURRENCY) break;
      const period = periods[index];
      if (!period) continue;
      inFlight.current.add(index);
      setTiles(prev => prev.map((tile, i) => i === index ? { status: 'loading' } : tile));
      const owner = controller.current;
      // 被取消的請求：視窗還開著（只是換了 controller）就退回待載，讓佇列重排
      const cancelled = () => {
        if (!owner.signal.aborted) return false;
        if (controller.current !== owner && !controller.current.signal.aborted) setTiles(prev => prev.map((tile, i) => i === index ? { status: 'idle' } : tile));
        return true;
      };
      loadRegionalStatistics(period.candidate.recipe, owner.signal).then(result => {
        if (cancelled()) return;
        const boundaryVersion = result.geometryManifest.boundary_version;
        setTiles(prev => prev.map((tile, i) => i === index ? { status: 'ready', features: result.features, effectiveRecipe: result.effectiveRecipe, boundaryVersion } : tile));
      }, error => {
        if (cancelled()) return;
        setTiles(prev => prev.map((tile, i) => i === index ? { status: 'error', error: errorText(error) } : tile));
      }).finally(() => { inFlight.current.delete(index); setWanted(prev => new Set(prev)); });
    }
  }, [wanted, tiles, periods]);

  const retry = (index: number) => setTiles(prev => prev.map((tile, i) => i === index ? { status: 'idle' } : tile));
  const select = (index: number) => {
    const tile = tiles[index];
    const period = periods[index];
    if (!period || tile?.status === 'error') return;
    if (!period.current) {
      regionalStatisticsStore.setSelection(layerKey, tile?.status === 'ready' ? tile.effectiveRecipe : period.candidate.recipe);
      void regionalStatisticsStore.load(layerKey);
    }
    close();
  };

  // 焦點：開窗聚焦關閉鈕、Tab 鎖在視窗內、關窗還給原本的按鈕；Esc 關閉且不連帶關掉 popup
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); opener?.focus?.(); };
  }, [close]);

  // 年份多時：一開始捲到最近的年份
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (periods.length > SMALL_MULTIPLES_PAGE && gridRef.current) gridRef.current.scrollTop = gridRef.current.scrollHeight;
  }, [periods.length]);

  const currentPeriod = periods.find(period => period.current);
  const circle = statisticsPresentationMode(layerKey) === 'circle';
  const total = statisticsPresentationOptions(layerKey).includes('circle');
  const level = plan?.level ?? 'county';
  const firstReady = tiles.find((tile): tile is Extract<TileState, { status: 'ready' }> => tile.status === 'ready');
  const prepared = firstReady ? preparedBoundary(firstReady.features, level, firstReady.boundaryVersion) : null;
  const undrawnNames = prepared?.undrawnCodes.map(code => String(firstReady!.features.find(f => f.properties?.area_code === code)?.properties?.area_name ?? code)) ?? [];
  const anySuppressed = tiles.some(tile => tile.status === 'ready' && tile.features.some(f => f.properties?.status === 'suppressed'));

  return (
    <div className="sm-backdrop" onClick={close}>
      <div
        ref={dialogRef}
        className={`sm-dialog${isDark ? '' : ' sm-dialog--light'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('smallMultiples.dialogLabel', { title })}
        onClick={event => event.stopPropagation()}
      >
        <div className="sm-head">
          <div>
            <div className="sm-eyebrow">{t('smallMultiples.eyebrow')}</div>
            <h2 className="sm-title">{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="sm-close" aria-label={t('smallMultiples.close')} onClick={close}>
            <X size={14} />
          </button>
        </div>
        <div className="sm-body">
          <div className="sm-grid-wrap" ref={gridRef}>
            <div className="sm-notes">
              <p>{t('smallMultiples.summary', { count: periods.length })}</p>
              {currentPeriod && <p>{t('smallMultiples.periodRule', { span: spanText(currentPeriod.candidate.release, t) })}</p>}
              {circle && <p>{t('smallMultiples.circleNote')}</p>}
              {total && <p>{t('smallMultiples.totalNote')}</p>}
              {TW_LEVELS.has(level) && <p>{t('smallMultiples.insetNote')}</p>}
              {undrawnNames.length > 0 && <p>{t('smallMultiples.undrawn', { names: undrawnNames.join('、') })}</p>}
              {periods.length > SMALL_MULTIPLES_PAGE && <p>{t('smallMultiples.many', { count: SMALL_MULTIPLES_PAGE })}</p>}
            </div>
            <div className="sm-grid">
              {periods.map((period, index) => (
                <SmallMultipleTile
                  key={`${period.year}:${period.candidate.releaseId}`}
                  index={index}
                  label={periodLabelOf(layerKey, period.candidate.release, i18n, indicator)}
                  current={period.current}
                  sameSpan={period.sameSpan}
                  referenceBoundary={currentPeriod?.candidate.release.boundary_version}
                  state={tiles[index] ?? { status: 'idle' }}
                  waiting={wanted.has(index)}
                  level={level}
                  recipe={recipe}
                  opacity={opacity}
                  isDark={isDark}
                  onVisible={() => setWanted(prev => prev.has(index) ? prev : new Set(prev).add(index))}
                  onSelect={() => select(index)}
                  onRetry={() => retry(index)}
                />
              ))}
            </div>
          </div>
          <aside className="sm-legend">
            <LegendThemeCtx.Provider value={isDark ? DARK_LEGEND : LIGHT_LEGEND}>
              <LegendFillOpacityCtx.Provider value={opacity}>
                <SmallMultiplesLegend layerKey={layerKey} baseKey={baseKey} recipe={recipe} anySuppressed={anySuppressed} i18n={i18n} />
              </LegendFillOpacityCtx.Provider>
            </LegendThemeCtx.Provider>
          </aside>
        </div>
      </div>
    </div>
  );
}

type RenderRecipe = ReturnType<typeof statisticsRenderRecipe>;

function SmallMultiplesLegend({ baseKey, recipe, anySuppressed, i18n }: { layerKey: StatisticsRenderKey; baseKey: string; recipe: RenderRecipe; anySuppressed: boolean; i18n: LocaleSnapshot }) {
  const { t } = i18n;
  const social = getSocialRecipe(baseKey);
  const agri = getAgriRecipe(baseKey);
  const labor = getLaborRecipe(baseKey);
  const environment = getEnvironmentRecipe(baseKey);
  const demographics = getDemographicsRecipe(baseKey);
  const addiction = getAddictionRecipe(baseKey);
  const landslide = getLandslideRecipe(baseKey);
  const atlas = getAtlasRecipe(baseKey);
  const atlasBinary = atlas ? atlasBinaryLegendRows(atlas, recipe.colors)?.map(row => ({ ...row, label: enumLabel('statLegendNote', row.label, row.label, i18n) })) ?? null : null;
  const atlasCategories = atlas ? atlasCategoryRows(atlas)?.map(row => ({ color: row.color, label: enumLabel('statLegendNote', row.label, row.label, i18n) })) ?? null : null;
  const special = (environment ? environmentLegendRows(environment, recipe.colors) : null) ?? atlasBinary ?? atlasCategories;
  const format = social?.format ?? labor?.format ?? environment?.format ?? demographics?.format ?? addiction?.format ?? landslide?.format ?? atlas?.format;
  const rows = special ?? statisticsLegendRows(recipe, format, i18n);
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 'var(--font-sm)' }}>
      <LegendTitle zh={statisticsUnit(recipe.unit, i18n)} style={{ marginBottom: 0 }} />
      {!special && <span>{t(recipe.breaks.some(value => value < 0) ? 'statistics.legend.diverging' : 'statistics.legend.sequential')}</span>}
      {rows.map(({ color, label }) => <LegendRow key={`${color}:${label}`} swatch={<SwatchSquare color={color} />}>{label}</LegendRow>)}
      {'categories' in recipe && recipe.categories?.length ? <LegendRow swatch={<SwatchSquare color={STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR} />}>{t('smallMultiples.notApplicable')}</LegendRow> : null}
      <LegendRow swatch={<SwatchHatch kind="missing" />}>{t('statistics.legend.hatchDefault')}</LegendRow>
      {(anySuppressed || agri || social) && <LegendRow swatch={<SwatchHatch kind="suppressed" />}>{t('statistics.legend.crossHatch')}</LegendRow>}
    </div>
  );
}

interface TileProps {
  index: number;
  label: string;
  current: boolean;
  sameSpan: boolean;
  referenceBoundary?: string;
  state: TileState;
  /** 已排進載入佇列（idle 時顯示「等待載入」而非「捲動到這裡時載入」） */
  waiting: boolean;
  level: string;
  recipe: RenderRecipe;
  opacity: number;
  isDark: boolean;
  onVisible: () => void;
  onSelect: () => void;
  onRetry: () => void;
}

function SmallMultipleTile({ label, current, sameSpan, referenceBoundary, state, waiting, level, recipe, opacity, isDark, onVisible, onSelect, onRetry }: TileProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prepared = state.status === 'ready' ? preparedBoundary(state.features, level, state.boundaryVersion) : null;
  const aspect = prepared ? prepared.height / prepared.width : 1.34;

  // 進入視野才排入載入
  useEffect(() => {
    const node = boxRef.current;
    if (!node || state.status !== 'idle' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) onVisible(); }, { rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [state.status, onVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || state.status !== 'ready' || !prepared) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = box.clientWidth;
      if (!cssWidth) return;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssWidth * aspect * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = canvas.width / BASE_WIDTH;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, BASE_WIDTH, prepared.height);
      const byCode = new Map(state.features.map(feature => [String(feature.properties?.area_code), feature.properties]));
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
    };
    draw();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    observer?.observe(box);
    return () => observer?.disconnect();
  }, [state, prepared, aspect, recipe, opacity, isDark]);

  const counts = state.status === 'ready' ? state.features.reduce((acc, feature) => {
    const fill = smallMultipleFill(feature.properties, recipe);
    if (fill.kind === 'missing') acc.missing += 1;
    if (fill.kind === 'suppressed') acc.suppressed += 1;
    return acc;
  }, { missing: 0, suppressed: 0 }) : null;
  const boundaryDiffers = state.status === 'ready' && referenceBoundary && state.boundaryVersion !== referenceBoundary;

  const failed = state.status === 'error';
  const body = (
    <>
      <div ref={boxRef} className="sm-canvas-box" style={{ aspectRatio: `${1 / aspect}` }}>
        {state.status === 'ready' && <canvas ref={canvasRef} aria-hidden="true" />}
        {state.status !== 'ready' && (
          <div className={`sm-tile-state${failed ? ' sm-tile-state--error' : ''}`} role={failed ? 'alert' : undefined}>
            {state.status === 'error' ? t('smallMultiples.failed', { error: state.error }) : state.status === 'loading' || waiting ? t('smallMultiples.loading') : t('smallMultiples.queued')}
            {failed && <button type="button" className="sm-retry" onClick={onRetry}>{t('smallMultiples.retry')}</button>}
          </div>
        )}
      </div>
      <span className="sm-caption">
        {label}
        {current && <span className="sm-flag">{t('smallMultiples.current')}</span>}
        {!sameSpan && <span className="sm-flag sm-flag--warn">{t('smallMultiples.spanDiffers')}</span>}
      </span>
      {(counts?.missing || counts?.suppressed || boundaryDiffers) ? (
        <span className="sm-meta">
          {[
            counts?.missing ? t('smallMultiples.missingCount', { count: counts.missing }) : null,
            counts?.suppressed ? t('smallMultiples.suppressedCount', { count: counts.suppressed }) : null,
            boundaryDiffers ? t('smallMultiples.boundaryDiffers', { boundary: boundaryVersionLabel(state.status === 'ready' ? state.boundaryVersion : '', i18n) }) : null,
          ].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </>
  );
  // 載入失敗的期別不能切換：整格改成一般區塊，格內只留「重試」鈕（不把按鈕套在按鈕裡）
  if (failed) return <div className="sm-tile sm-tile--failed" role="group" aria-label={label}>{body}</div>;
  return (
    <button type="button" className="sm-tile" aria-current={current ? 'true' : undefined} aria-label={t('smallMultiples.switchTo', { period: label })} onClick={onSelect}>
      {body}
    </button>
  );
}
