/**
 * 統計圖層「多年份並排」視窗（設計提案 Q-F 方案 1；版面 b、期別標示 S c、按鈕 B b，使用者 2026-11-12 選定；
 * spec §5.27 置中視窗、§5.37 連動選單右側的圖示鈕）。
 *
 * - 上方年份勾選列（全部年份），同時最多比 4 期；預設勾最早、最新加中間平均兩年。只載入勾選的期別。
 * - 下方大圖：每期一張 canvas（邊界用主地圖同一份、SHA 校驗過的參考邊界，前端簡化；不開額外的 Mapbox 地圖），
 *   共用目前選擇的色階與分級門檻（`statisticsRenderRecipe`），缺值／遮蔽畫法同主地圖；圖例只放一份。
 * - 滑鼠移到（或點一下固定）某區：所有大圖同一區同步描邊，每張圖下方寫區名、數值、與最早一期的差。
 * - 標題旁「切到主地圖」才把主地圖切到該期（`regionalStatisticsStore.setSelection`＝連動選單寫回的同一個 setter）並關窗；
 *   點大圖本身不切換。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, MapPinned, X } from 'lucide-react';
import { loadRegionalStatistics, type StatisticsRecipe } from '../../data/regionalStatisticsLoader';
import { statisticsBaseKey, statisticsRenderRecipe, type StatisticsRenderKey } from '../../data/regionalStatisticsRecipes';
import {
  compareArrangement, defaultComparison, periodNote, smallMultipleFill, smallMultiplesPlan, toggleComparison, SMALL_MULTIPLES_MAX,
  type PeriodPhrase, type SmallMultiplesPlan,
} from '../../data/statisticsSmallMultiples';
import type { PreparedBoundary, PreparedShape } from '../../map/smallMultiplesGeometry';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { statisticsSmallMultiplesStore, useSmallMultiplesOpenKey } from '../../state/statisticsSmallMultiplesStore';
import { layerParamsStore } from '../../state/layerParamsStore';
import { statisticsPresentationMode } from '../../state/statisticsPresentationStore';
import { statisticsPresentationOptions } from '../../data/statisticsPresentation';
import { statisticsFillOpacity } from '../../data/statisticsVisuals';
import { boundaryVersionLabel, statisticsPeriodLabel } from '../../data/statisticsLabels';
import { demographicsPeriodLabel, getDemographicsRecipe } from '../../data/demographicsStatisticsRecipes';
import { getSocialRecipe } from '../../data/socialStatisticsRecipes';
import { getAgriRecipe } from '../../data/agriStatisticsRecipes';
import { getLaborRecipe } from '../../data/laborStatisticsRecipes';
import { environmentLegendRows, getEnvironmentRecipe } from '../../data/environmentStatisticsRecipes';
import { getAddictionRecipe } from '../../data/addictionStatisticsRecipes';
import { getLandslideRecipe } from '../../data/landslideStatisticsRecipes';
import { atlasBinaryLegendRows, atlasCategoryRows, getAtlasRecipe } from '../../data/atlasStatisticsRecipes';
import { STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR } from '../../data/statisticsFillColor';
import { statisticsTitle, statisticsUnit } from '../../i18n/statisticsText';
import { enumLabel } from '../../i18n/dataText';
import { placeName } from '../../i18n/placeText';
import { useLocale, type LocaleSnapshot } from '../../state/localeStore';
import { DARK_LEGEND, LIGHT_LEGEND, LegendFillOpacityCtx, LegendRow, LegendThemeCtx, LegendTitle, SwatchHatch, SwatchSquare } from '../legend/legendKit';
import { statisticsLegendRows } from '../sidebar/StatisticsDetails';
import { paintMap, preparedBoundary, shapeBox, shapePath, type RenderRecipe } from './smallMultiplesPaint';
import './statisticsSmallMultiples.css';

// 每份 CDN 檔有 12 秒逾時；同時讀太多份在本機高負載時曾逾時，維持 2（失敗的圖可重試）
const CONCURRENCY = 2;
const TW_LEVELS = new Set(['county', 'township', 'prosecutor_district']);
/** 大圖的簡化基準寬度（約為最大顯示寬度）：抽稀容差相對細，鄉鎮邊界放大不鋸齒。 */
const BIG_BASE_WIDTH = 1000;
const MAP_GAP = 12;
/** 每張大圖上方標題列（26）＋間距（2×4）＋下方數值列（約 38）的高度。 */
const MAP_CHROME = 26 + 8 + 38;
const MOBILE_QUERY = '(max-width: 640px)';
/** 開啟按鈕的標記（關窗時按鈕可能因主地圖切期別而重繪，用它找回來還焦點）。 */
export const SMALL_MULTIPLES_OPENER_ATTR = 'data-small-multiples-open';

export type TileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; features: GeoJSON.Feature[]; effectiveRecipe: StatisticsRecipe; boundaryVersion: string };
type ReadyTile = Extract<TileState, { status: 'ready' }>;
type Period = SmallMultiplesPlan['periods'][number];

function periodLabelOf(layerKey: StatisticsRenderKey, release: Parameters<typeof statisticsPeriodLabel>[0], i18n: LocaleSnapshot, indicator?: string): string {
  const baseKey = statisticsBaseKey(layerKey, indicator);
  return (getDemographicsRecipe(baseKey) ? demographicsPeriodLabel(baseKey, release as never, i18n) : undefined) ?? statisticsPeriodLabel(release, i18n);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function monthText(month: number, i18n: LocaleSnapshot): string {
  return i18n.active === 'en' ? new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1))) : String(month);
}
function phraseText(phrase: PeriodPhrase, i18n: LocaleSnapshot): string {
  const { t } = i18n;
  switch (phrase.kind) {
    case 'fullYear': return t('smallMultiples.phrase.fullYear');
    case 'yearEnd': return t('smallMultiples.phrase.yearEnd');
    case 'monthEnd': return t('smallMultiples.phrase.monthEnd', { month: monthText(phrase.month, i18n) });
    case 'date': return t('smallMultiples.phrase.date', { month: monthText(phrase.month, i18n), day: phrase.day });
    case 'range': return t('smallMultiples.phrase.range', { from: t('smallMultiples.phrase.date', { month: monthText(phrase.from.month, i18n), day: phrase.from.day }), to: phraseText(phrase.to, i18n) });
  }
}

/** 上方說明句：各期一致時不顯示；否則「最新一期為 8 月底，其餘為各年年底」。 */
function periodSentence(periods: readonly Period[], i18n: LocaleSnapshot): string | null {
  const note = periodNote(periods);
  if (!note) return null;
  const { t } = i18n;
  const parts = note.exceptions.map(item => item.latest
    ? t('smallMultiples.note.latest', { phrase: phraseText(item.phrase, i18n) })
    : t('smallMultiples.note.year', { year: item.year, phrase: phraseText(item.phrase, i18n) }));
  return t('smallMultiples.note.rest', { parts: parts.join(t('smallMultiples.note.joiner')), phrase: phraseText(note.major, i18n) });
}

function formatNumber(value: number, format: { locale?: string; maximumFractionDigits?: number } | undefined, signed = false): string {
  const text = new Intl.NumberFormat(format?.locale, { maximumFractionDigits: format?.maximumFractionDigits ?? 2, ...(signed ? { signDisplay: 'exceptZero' as const } : {}) }).format(value);
  return text;
}

export function StatisticsSmallMultiplesHost({ layerKey, isDark }: { layerKey: StatisticsRenderKey; isDark: boolean }) {
  const openKey = useSmallMultiplesOpenKey();
  if (openKey !== layerKey || typeof document === 'undefined') return null;
  return createPortal(<SmallMultiplesDialog layerKey={layerKey} isDark={isDark} />, document.body);
}

interface LegendModel {
  unit: string;
  rows: { color: string; label: string }[];
  special: boolean;
  categorical: boolean;
}

function legendModel(baseKey: string, recipe: RenderRecipe, i18n: LocaleSnapshot): LegendModel {
  const social = getSocialRecipe(baseKey);
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
  return {
    unit: statisticsUnit(recipe.unit, i18n),
    rows: special ?? statisticsLegendRows(recipe, format, i18n),
    special: Boolean(special),
    categorical: Boolean('categories' in recipe && recipe.categories?.length),
  };
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
  // memo：recipe 物件換了會讓每張圖重畫
  const dimensions = snapshot.selection?.dimensions;
  const recipe = useMemo(() => statisticsRenderRecipe(layerKey, indicator, dimensions, { isDark }), [layerKey, indicator, dimensions, isDark]);
  const slider = layerParamsStore.getParam(layerKey, `${layerKey}Opacity`);
  const opacity = statisticsFillOpacity(typeof slider === 'number' ? slider : undefined, isDark);
  const title = statisticsTitle(baseKey, recipe.label, i18n, 'valueTransform' in recipe && Boolean(recipe.valueTransform));
  const periods = useMemo(() => plan?.periods ?? [], [plan]);
  const baseKeyText: string = baseKey;
  const legend = useMemo<LegendModel>(() => legendModel(baseKeyText, recipe, i18n), [baseKeyText, recipe, i18n]);

  const [selected, setSelected] = useState<number[]>(() => defaultComparison(periods.length));
  const [limitHint, setLimitHint] = useState(false);
  useEffect(() => {
    if (!limitHint) return;
    const id = setTimeout(() => setLimitHint(false), 3000);
    return () => clearTimeout(id);
  }, [limitHint]);
  const toggle = (index: number) => {
    const next = toggleComparison(selected, index);
    setSelected(next.selected);
    setLimitHint(next.rejected);
  };

  // ── 載入：只讀勾選的期別，同時最多 CONCURRENCY 份 ──
  const [tiles, setTiles] = useState<TileState[]>(() => periods.map(() => ({ status: 'idle' })));
  const [queueTick, setQueueTick] = useState(0);
  const controller = useRef(new AbortController());
  const inFlight = useRef(new Set<number>());
  // 關窗時取消還在讀的期別（withLoading 帶 signal，不記成失敗）；開發模式 StrictMode 會先卸載再掛一次，所以每次掛載換新的
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  useEffect(() => {
    const queue = [...selected].reverse().filter(index => tiles[index]?.status === 'idle' && !inFlight.current.has(index));
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
        setTiles(prev => prev.map((tile, i) => i === index ? { status: 'ready', features: result.features, effectiveRecipe: result.effectiveRecipe, boundaryVersion: result.geometryManifest.boundary_version } : tile));
      }, error => {
        if (cancelled()) return;
        setTiles(prev => prev.map((tile, i) => i === index ? { status: 'error', error: errorText(error) } : tile));
      }).finally(() => { inFlight.current.delete(index); setQueueTick(tick => tick + 1); });
    }
  }, [selected, tiles, periods, queueTick]);
  const retry = (index: number) => setTiles(prev => prev.map((tile, i) => i === index ? { status: 'idle' } : tile));

  const switchTo = (index: number) => {
    const tile = tiles[index];
    const period = periods[index];
    if (!period || tile?.status === 'error') return;
    if (!period.current) {
      regionalStatisticsStore.setSelection(layerKey, tile?.status === 'ready' ? tile.effectiveRecipe : period.candidate.recipe);
      void regionalStatisticsStore.load(layerKey);
    }
    close();
  };

  // ── 焦點：開窗聚焦關閉鈕、Tab 鎖在視窗內、Esc 關閉且不連帶關掉 popup；關窗還給開啟按鈕 ──
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
    return () => {
      window.removeEventListener('keydown', onKey, true);
      restoreFocus(opener, layerKey);
    };
  }, [close, layerKey]);

  const currentPeriod = periods.find(period => period.current);
  const presentation = statisticsPresentationMode(layerKey);
  const total = statisticsPresentationOptions(layerKey).includes('circle');
  const level = plan?.level ?? 'county';
  const firstReady = selected.map(index => tiles[index]).find((tile): tile is ReadyTile => tile?.status === 'ready');
  const prepared = firstReady ? preparedBoundary(firstReady.features, level, firstReady.boundaryVersion, BIG_BASE_WIDTH) : null;
  const undrawnNames = prepared?.undrawnCodes.map(code => String(firstReady!.features.find(f => f.properties?.area_code === code)?.properties?.area_name ?? code)) ?? [];
  const anySuppressed = tiles.some(tile => tile.status === 'ready' && tile.features.some(f => f.properties?.status === 'suppressed'));
  const sentence = periodSentence(periods, i18n);

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
          <div className="sm-picker">
            <div className="sm-chips" role="group" aria-label={t('smallMultiples.chipsLabel', { max: SMALL_MULTIPLES_MAX })}>
              {periods.map((period, index) => {
                const checked = selected.includes(index);
                const full = !checked && selected.length >= SMALL_MULTIPLES_MAX;
                const label = periodLabelOf(layerKey, period.candidate.release, i18n, indicator);
                return (
                  <button
                    key={`${period.year}:${period.candidate.releaseId}`}
                    type="button"
                    className={`sm-chip${checked ? ' is-on' : ''}`}
                    aria-pressed={checked}
                    aria-disabled={full || undefined}
                    aria-label={label}
                    title={label}
                    onClick={() => toggle(index)}
                  >
                    {checked && <Check size={11} strokeWidth={2.5} aria-hidden="true" />}
                    {t('smallMultiples.yearLabel', { year: period.year })}
                  </button>
                );
              })}
            </div>
            <div className="sm-picker-tools">
              <span className="sm-count">{t('smallMultiples.selected', { count: selected.length, max: SMALL_MULTIPLES_MAX })}</span>
              <button type="button" className="sm-link" onClick={() => { setSelected([]); setLimitHint(false); }} disabled={!selected.length}>{t('smallMultiples.clear')}</button>
            </div>
          </div>
          <p className="sm-hint" role="status">{limitHint ? t('smallMultiples.maxHint', { max: SMALL_MULTIPLES_MAX }) : ''}</p>
          <div className="sm-notes">
            {sentence && <p>{sentence}</p>}
            {total && <p>{t('smallMultiples.totalNote')}</p>}
            {presentation === 'circle' && <p>{t('smallMultiples.circleNote')}</p>}
            {presentation === 'dots' && <p>{t('smallMultiples.dotsNote')}</p>}
            {TW_LEVELS.has(level) && <p>{t('smallMultiples.insetNote')}{undrawnNames.length > 0 ? ` ${t('smallMultiples.undrawn', { names: undrawnNames.join('、') })}` : ''}</p>}
          </div>
          <div className="sm-legend">
            <LegendThemeCtx.Provider value={isDark ? DARK_LEGEND : LIGHT_LEGEND}>
              <LegendFillOpacityCtx.Provider value={opacity}>
                <SmallMultiplesLegend model={legend} recipe={recipe} showSuppressed={anySuppressed || Boolean(getAgriRecipe(baseKey) || getSocialRecipe(baseKey))} i18n={i18n} />
              </LegendFillOpacityCtx.Provider>
            </LegendThemeCtx.Provider>
          </div>
          <CompareMaps
            selected={selected}
            periods={periods}
            tiles={tiles}
            level={level}
            recipe={recipe}
            opacity={opacity}
            isDark={isDark}
            legend={legend}
            referenceBoundary={currentPeriod?.candidate.release.boundary_version}
            fullLabel={index => periodLabelOf(layerKey, periods[index]!.candidate.release, i18n, indicator)}
            onSwitch={switchTo}
            onRetry={retry}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 關窗還焦點：原按鈕可能因主地圖切期別而重繪或暫時不見，依標記找回（最多等 2 秒）。
 * Safari 滑鼠點按鈕不會給焦點，開窗時 activeElement 會是 body，這時也改依標記找。
 */
function restoreFocus(opener: HTMLElement | null, layerKey: string) {
  if (opener?.isConnected && opener !== document.body && !opener.closest('.sm-dialog')) { opener.focus(); return; }
  let tries = 0;
  const attempt = () => {
    const button = document.querySelector<HTMLElement>(`[${SMALL_MULTIPLES_OPENER_ATTR}="${CSS.escape(layerKey)}"]`);
    if (button) { button.focus(); return; }
    if ((tries += 1) < 20) setTimeout(attempt, 100);
  };
  attempt();
}

function SmallMultiplesLegend({ model, recipe, showSuppressed, i18n }: { model: LegendModel; recipe: RenderRecipe; showSuppressed: boolean; i18n: LocaleSnapshot }) {
  const { t } = i18n;
  return (
    <>
      <LegendTitle zh={model.unit} style={{ marginBottom: 0 }} />
      {!model.special && <span className="sm-legend-note">{t(recipe.breaks.some(value => value < 0) ? 'statistics.legend.diverging' : 'statistics.legend.sequential')}</span>}
      {model.rows.map(({ color, label }) => <LegendRow key={`${color}:${label}`} swatch={<SwatchSquare color={color} />}>{label}</LegendRow>)}
      {model.categorical ? <LegendRow swatch={<SwatchSquare color={STATISTICS_CATEGORY_NOT_APPLICABLE_COLOR} />}>{t('smallMultiples.notApplicable')}</LegendRow> : null}
      <LegendRow swatch={<SwatchHatch kind="missing" />}>{t('statistics.legend.hatchDefault')}</LegendRow>
      {showSuppressed && <LegendRow swatch={<SwatchHatch kind="suppressed" />}>{t('statistics.legend.crossHatch')}</LegendRow>}
    </>
  );
}

interface CompareMapsProps {
  selected: readonly number[];
  periods: readonly Period[];
  tiles: readonly TileState[];
  level: string;
  recipe: RenderRecipe;
  opacity: number;
  isDark: boolean;
  legend: LegendModel;
  referenceBoundary?: string;
  fullLabel: (index: number) => string;
  onSwitch: (index: number) => void;
  onRetry: (index: number) => void;
}

function CompareMaps(props: CompareMapsProps) {
  const { selected, periods, tiles, level } = props;
  const { t } = useLocale();
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, mobile: false });
  useEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight, mobile: window.matchMedia(MOBILE_QUERY).matches });
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  // 滑鼠指到的區（暫時）與點一下固定的區（觸控、再點取消）；指到優先
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [pinnedCode, setPinnedCode] = useState<string | null>(null);
  const activeCode = hoverCode ?? pinnedCode;

  const readyOf = (index: number | undefined) => { const tile = index === undefined ? undefined : tiles[index]; return tile?.status === 'ready' ? tile : undefined; };
  const firstReady = selected.map(readyOf).find(Boolean);
  const aspect = firstReady ? (() => { const p = preparedBoundary(firstReady.features, level, firstReady.boundaryVersion, BIG_BASE_WIDTH); return p.height / p.width; })() : 1.25;
  const { cols, mapWidth } = size.mobile
    ? { cols: 1, mapWidth: size.width }
    : compareArrangement(selected.length, size.width, size.height, aspect, MAP_CHROME, MAP_GAP);
  const baselineIndex = selected[0];
  const baselineTile = readyOf(baselineIndex);
  const baselineProps = activeCode && baselineTile ? baselineTile.features.find(f => f.properties?.area_code === activeCode)?.properties ?? null : null;

  return (
    <div className="sm-area" ref={areaRef} onMouseLeave={() => setHoverCode(null)}>
      {selected.length === 0 ? (
        <div className="sm-empty">{t('smallMultiples.empty', { max: SMALL_MULTIPLES_MAX })}</div>
      ) : mapWidth > 0 && (
        <div className="sm-maps" style={{ gridTemplateColumns: `repeat(${cols}, ${mapWidth}px)` }}>
          {selected.map((index, order) => {
            const tile = tiles[index] ?? { status: 'idle' as const };
            return (
              <BigMap
                key={periods[index]!.candidate.releaseId}
                {...props}
                index={index}
                period={periods[index]!}
                state={tile}
                prepared={tile.status === 'ready' ? preparedBoundary(tile.features, level, tile.boundaryVersion, BIG_BASE_WIDTH) : null}
                mapWidth={mapWidth}
                aspect={aspect}
                activeCode={activeCode}
                pinned={pinnedCode !== null && hoverCode === null}
                onHover={setHoverCode}
                onPin={code => setPinnedCode(prev => prev === code ? null : code)}
                baseline={order === 0 ? null : { year: periods[baselineIndex!]!.year, ready: Boolean(baselineTile), props: baselineProps }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BigMapProps extends CompareMapsProps {
  index: number;
  period: Period;
  state: TileState;
  prepared: PreparedBoundary | null;
  mapWidth: number;
  aspect: number;
  activeCode: string | null;
  pinned: boolean;
  onHover: (code: string | null) => void;
  onPin: (code: string) => void;
  /** 與最早一期比較的基準（第一張圖本身是基準 → null） */
  baseline: { year: string; ready: boolean; props: GeoJSON.GeoJsonProperties } | null;
}

let hitContext: CanvasRenderingContext2D | null = null;
function hitTest(prepared: PreparedBoundary, x: number, y: number): PreparedShape | null {
  hitContext ??= document.createElement('canvas').getContext('2d');
  if (!hitContext) return null;
  for (const shape of prepared.shapes) {
    const box = shapeBox(shape);
    if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) continue;
    if (hitContext.isPointInPath(shapePath(shape), x, y, 'evenodd')) return shape;
  }
  return null;
}

type ValueState = { kind: 'value'; value: number } | { kind: 'category'; label: string } | { kind: 'missing' } | { kind: 'suppressed' } | { kind: 'notApplicable' };
function valueState(props: GeoJSON.GeoJsonProperties | undefined, recipe: RenderRecipe, legend: LegendModel): ValueState {
  const fill = smallMultipleFill(props, recipe);
  if (fill.kind === 'suppressed') return { kind: 'suppressed' };
  if (fill.kind === 'missing') return { kind: 'missing' };
  if (fill.kind === 'notApplicable') return { kind: 'notApplicable' };
  if (legend.categorical) return { kind: 'category', label: legend.rows.find(row => row.color === fill.color)?.label ?? String(props?.value) };
  return { kind: 'value', value: Number(props?.value) };
}

function BigMap({ index, period, state, prepared, mapWidth, aspect, activeCode, pinned, onHover, onPin, recipe, opacity, isDark, legend, referenceBoundary, fullLabel, onSwitch, onRetry, baseline }: BigMapProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const mapHeight = Math.round(mapWidth * aspect);
  const features = state.status === 'ready' ? state.features : null;

  // 底圖：只在資料、尺寸、色階改變時重畫
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !features || !prepared || !mapWidth) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(mapWidth * dpr);
    canvas.height = Math.round(mapHeight * dpr);
    paintMap(canvas, prepared, features, recipe, opacity, isDark, dpr);
  }, [features, prepared, mapWidth, mapHeight, recipe, opacity, isDark]);

  // 同步描邊：獨立一層，只畫被指到的那一區（不重畫底圖）
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !prepared || !mapWidth) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(mapWidth * dpr);
    canvas.height = Math.round(mapHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = canvas.width / prepared.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, prepared.width, prepared.height);
    const shape = activeCode ? prepared.shapes.find(item => item.areaCode === activeCode) : undefined;
    if (!shape) return;
    const style = getComputedStyle(canvas);
    const path = shapePath(shape);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.getPropertyValue('--sm-halo').trim();
    ctx.lineWidth = 4 * dpr / scale;
    ctx.stroke(path);
    ctx.strokeStyle = style.getPropertyValue('--sm-accent').trim();
    ctx.lineWidth = 2 * dpr / scale;
    ctx.stroke(path);
  }, [activeCode, prepared, mapWidth, mapHeight]);

  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const codeAt = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!prepared) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * prepared.width / rect.width;
    const y = (event.clientY - rect.top) * prepared.width / rect.width;
    return hitTest(prepared, x, y)?.areaCode ?? null;
  };
  const onMove = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    cancelAnimationFrame(frame.current);
    const code = codeAt(event);
    frame.current = requestAnimationFrame(() => onHover(code));
  };
  const onClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const code = codeAt(event);
    if (code) onPin(code);
  };

  const label = fullLabel(index);
  const counts = features ? features.reduce((acc, feature) => {
    const fill = smallMultipleFill(feature.properties, recipe);
    if (fill.kind === 'missing') acc.missing += 1;
    if (fill.kind === 'suppressed') acc.suppressed += 1;
    return acc;
  }, { missing: 0, suppressed: 0 }) : null;
  const boundaryDiffers = state.status === 'ready' && referenceBoundary && state.boundaryVersion !== referenceBoundary;

  let readout: ReactNode;
  if (activeCode && features) {
    const props = features.find(f => f.properties?.area_code === activeCode)?.properties;
    const format = props?.format as { locale?: string; maximumFractionDigits?: number } | undefined;
    // 參考邊界只有區名（沒有縣市欄）；外文介面依代碼翻譯（`placeName`）
    const name = props?.area_name == null ? activeCode : placeName(String(props.area_name), i18n, activeCode);
    const value = valueState(props, recipe, legend);
    const statusText = (kind: ValueState['kind']) => t(kind === 'suppressed' ? 'smallMultiples.valueSuppressed' : kind === 'notApplicable' ? 'smallMultiples.valueNotApplicable' : 'smallMultiples.valueMissing');
    const valueText: ReactNode = value.kind === 'value' ? <>{formatNumber(value.value, format)}<small> {legend.unit}</small></>
      : value.kind === 'category' ? value.label : statusText(value.kind);
    let delta: ReactNode = null;
    if (!baseline) delta = <span className="sm-delta">{t('smallMultiples.deltaBaseline')}</span>;
    else if (value.kind === 'value' && !legend.categorical && baseline.ready) {
      const base = valueState(baseline.props ?? undefined, recipe, legend);
      if (base.kind === 'value') {
        const diff = value.value - base.value;
        delta = <span className={`sm-delta${diff > 0 ? ' is-up' : diff < 0 ? ' is-down' : ''}`}>{t('smallMultiples.deltaFrom', { year: baseline.year, delta: formatNumber(diff, format, true) })}</span>;
      } else {
        delta = <span className="sm-delta">{t('smallMultiples.deltaUnavailable', { year: baseline.year, reason: t('smallMultiples.reasonBaseline', { year: baseline.year, status: statusText(base.kind) }) })}</span>;
      }
    } else if (!legend.categorical && baseline.ready && value.kind !== 'value') {
      delta = <span className="sm-delta">{t('smallMultiples.deltaUnavailable', { year: baseline.year, reason: t('smallMultiples.reasonThis', { status: statusText(value.kind) }) })}</span>;
    }
    readout = (
      <>
        <span className="sm-readout-name">{name}{pinned && <span className="sm-pin">{t('smallMultiples.pinned')}</span>}</span>
        <span className="sm-readout-value">{valueText}</span>
        {delta}
      </>
    );
  } else {
    readout = (
      <span className="sm-readout-idle">
        {[
          counts?.missing ? t('smallMultiples.missingCount', { count: counts.missing }) : null,
          counts?.suppressed ? t('smallMultiples.suppressedCount', { count: counts.suppressed }) : null,
          features ? t('smallMultiples.hoverPrompt') : null,
        ].filter(Boolean).join(' · ')}
      </span>
    );
  }

  return (
    <figure className="sm-map" style={{ width: mapWidth }}>
      <figcaption className="sm-map-head">
        <span className="sm-map-year" title={label}>{t('smallMultiples.yearLabel', { year: period.year })}</span>
        {period.current && <span className="sm-flag">{t('smallMultiples.current')}</span>}
        {boundaryDiffers && <span className="sm-flag sm-flag--warn" title={boundaryVersionLabel(state.status === 'ready' ? state.boundaryVersion : '', i18n)}>{t('smallMultiples.boundaryDiffers')}</span>}
        {!period.current && state.status !== 'error' && (
          <button type="button" className="sm-switch" onClick={() => onSwitch(index)} aria-label={t('smallMultiples.switchMainLabel', { period: label })} title={t('smallMultiples.switchMainLabel', { period: label })}>
            <MapPinned size={11} aria-hidden="true" />{t('smallMultiples.switchMain')}
          </button>
        )}
      </figcaption>
      <div className="sm-canvas" style={{ height: mapHeight }}>
        {features && prepared ? (
          <>
            <canvas ref={canvasRef} style={{ width: mapWidth, height: mapHeight }} onMouseMove={onMove} onClick={onClick} role="img" aria-label={label} />
            <canvas ref={overlayRef} className="sm-overlay" style={{ width: mapWidth, height: mapHeight }} aria-hidden="true" />
          </>
        ) : (
          <div className={`sm-state${state.status === 'error' ? ' sm-state--error' : ''}`} role={state.status === 'error' ? 'alert' : undefined}>
            {state.status === 'error' ? t('smallMultiples.failed', { error: state.error }) : t('smallMultiples.loading')}
            {state.status === 'error' && <button type="button" className="sm-retry" onClick={() => onRetry(index)}>{t('smallMultiples.retry')}</button>}
          </div>
        )}
      </div>
      <div className="sm-readout" aria-live="polite">{readout}</div>
    </figure>
  );
}
