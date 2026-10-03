import { getStatisticsVisual } from "../../data/statisticsVisuals";
import { ListRow } from "./LayerRow";
import { useRailTheme } from "./railTheme";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { layerControlThemeClass } from './LayerParamControls';
import type { LayerVisibility } from '../../types';
import { getMedicalStatisticsGroup, resolveMedicalStatisticsGroupKey } from '../../data/medicalStatisticsGroups';
import { prepareMedicalStatisticsVariant, selectMedicalStatisticsVariant } from '../../state/medicalStatisticsSelection';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { layerVisibilityStore } from '../../state/layerVisibilityStore';
import { statisticsDisplayModeStore } from '../../state/statisticsDisplayModeStore';
import { isStatisticsChoropleth } from '../../data/statisticsLayerRegistry';
import { FONT_SIZE } from '../../styles/designTokens';
import type { LayerClickIntent } from '../../lib/statisticsPopupSelection';

interface Props {
  groupKey: string;
  visibility: LayerVisibility;
  expandedLayer: string | null;
  onLayerClick: (key: keyof LayerVisibility, intent?: LayerClickIntent) => void;
  renderControls: (key: keyof LayerVisibility) => ReactNode;
  textColor?: string;
  dimColor?: string;
  colorScheme: 'light' | 'dark';
}

/**
 * 外觀交給共用的 `.lpc-select`（layerParamControls.css）；這裡只補原生選單清單要跟著的
 * color-scheme（暗色下拉清單才不會變白底）。
 */
export function medicalStatisticsSelectStyle(colorScheme: 'light' | 'dark') {
  return { colorScheme };
}

export function MedicalStatisticsGroupControls({ groupKey, visibility, expandedLayer, onLayerClick, renderControls, textColor = '#e5e7eb', dimColor = '#9ca3af', colorScheme }: Props) {
  const group = getMedicalStatisticsGroup(groupKey);
  const { DIM } = useRailTheme();
  const [preferred, setPreferred] = useState<keyof LayerVisibility | undefined>();
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);
  const switchRequest = useRef(0);
  useEffect(() => () => { switchRequest.current += 1; }, []);
  const selected = resolveMedicalStatisticsGroupKey(group, visibility, expandedLayer ?? undefined, preferred) ?? preferred ?? group?.options[0]?.key ?? 'statsHealthHospitalBedTotal';
  const sourceState = useSyncExternalStore(callback => regionalStatisticsStore.subscribe(selected, callback), () => regionalStatisticsStore.getSnapshot(selected), () => regionalStatisticsStore.getSnapshot(selected));
  if (!group) return null;
  const visual = getStatisticsVisual(group.options[0]!.key, group.label);
  const Icon = visual.icon;
  const members = group.options.map(option => option.key);
  const active = members.filter(key => visibility[key]);
  const expanded = members.some(key => key === expandedLayer);
  const choose = async (next: keyof LayerVisibility) => {
    if (next === selected && active.length <= 1) return;
    let switched=selectMedicalStatisticsVariant(selected, next, members);
    if (!switched) {
      const request=++switchRequest.current;
      setSwitching(true);
      switched=await prepareMedicalStatisticsVariant(selected,next,members,()=>request===switchRequest.current && layerVisibilityStore.getVisibility(selected));
      if (request!==switchRequest.current) return;
      setSwitching(false);
    }
    if (!switched) {
      setError(regionalStatisticsStore.getSnapshot(next).error ?? '此類型沒有相同期別的資料，請先調整年份。');
      return;
    }
    setPreferred(next);
    setError('');
    if (expandedLayer !== next) onLayerClick(next, 'statistics-variant-switch');
  };
  const toggle = () => {
    switchRequest.current += 1;
    setSwitching(false);
    if (!active.length) {
      onLayerClick(selected);
      return;
    }
    let next = layerVisibilityStore.getAll();
    for (const key of members) if (isStatisticsChoropleth(key)) next = statisticsDisplayModeStore.setVisible(key, false, next);
    layerVisibilityStore.setAll(next);
    setPreferred(selected);
  };
  return <div style={{ color: textColor }}>
    {/* 列外觀走共用 ListRow（layer-panel-unify P8）；「指標」在列外的結構屬 C 段，這裡不動 */}
    <ListRow
      ariaLabel={group.label}
      label={group.label}
      icon={<Icon size={14} color={active.length ? visual.accent : DIM} style={{ flexShrink: 0 }} />}
      accent={visual.accent}
      active={active.length > 0}
      expandable
      expanded={expanded}
      onClick={() => onLayerClick(selected)}
      toggle={{ on: active.length > 0, onChange: toggle, label: `${group.label} 顯示` }}
    />
    {expanded && <>
      <div className={layerControlThemeClass(colorScheme === 'dark')} style={{ padding: '4px 14px 8px', fontSize: FONT_SIZE.sm }}>
        <label className="lpc-k" style={{ display: 'block', marginBottom: 4 }}>{group.optionLabel ?? '指標'}</label>
        <select className="lpc-select" disabled={sourceState.loading || !sourceState.selection || switching} aria-busy={switching} aria-label={`${group.label} 類型`} value={selected} onChange={event => { void choose(event.target.value as keyof LayerVisibility); }} style={medicalStatisticsSelectStyle(colorScheme)}>
          {group.options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        {switching && <p role="status" style={{ color: dimColor }}>正在確認目標期別…</p>}
        {active.length > 1 && <p style={{ color: dimColor }}>目前重疊顯示 {active.length} 種；選擇類型後，此主題改為單一類型。</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      {renderControls(selected)}
    </>}
  </div>;
}
