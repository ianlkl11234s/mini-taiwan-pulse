import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { LayerVisibility } from '../../types';
import { getMedicalStatisticsGroup, resolveMedicalStatisticsGroupKey, type MedicalStatisticsOptionKey } from '../../data/medicalStatisticsGroups';
import { selectMedicalStatisticsVariant } from '../../state/medicalStatisticsSelection';
import { regionalStatisticsStore } from '../../state/regionalStatisticsStore';
import { layerVisibilityStore } from '../../state/layerVisibilityStore';
import { statisticsDisplayModeStore } from '../../state/statisticsDisplayModeStore';
import { isStatisticsChoropleth } from '../../data/statisticsLayerRegistry';
import { FONT_SIZE, RADIUS } from '../../styles/designTokens';

interface Props {
  groupKey: string;
  visibility: LayerVisibility;
  expandedLayer: string | null;
  onLayerClick: (key: keyof LayerVisibility) => void;
  renderControls: (key: MedicalStatisticsOptionKey) => ReactNode;
  textColor?: string;
  dimColor?: string;
}

export function MedicalStatisticsGroupControls({ groupKey, visibility, expandedLayer, onLayerClick, renderControls, textColor = '#e5e7eb', dimColor = '#9ca3af' }: Props) {
  const group = getMedicalStatisticsGroup(groupKey);
  const [preferred, setPreferred] = useState<MedicalStatisticsOptionKey | undefined>();
  const [error, setError] = useState('');
  const selected = resolveMedicalStatisticsGroupKey(group, visibility, expandedLayer ?? undefined, preferred) ?? preferred ?? group?.options[0].key ?? 'statsHealthHospitalBedTotal';
  const sourceState = useSyncExternalStore(callback => regionalStatisticsStore.subscribe(selected, callback), () => regionalStatisticsStore.getSnapshot(selected), () => regionalStatisticsStore.getSnapshot(selected));
  if (!group) return null;
  const members = group.options.map(option => option.key);
  const active = members.filter(key => visibility[key]);
  const expanded = members.some(key => key === expandedLayer);
  const choose = (next: MedicalStatisticsOptionKey) => {
    if (next === selected && active.length <= 1) return;
    if (!selectMedicalStatisticsVariant(selected, next, members)) {
      setError('此類型沒有相同期別的資料，請先調整年份。');
      return;
    }
    setPreferred(next);
    setError('');
    if (expandedLayer !== next) onLayerClick(next);
  };
  const toggle = () => {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderLeft: active.length ? '2px solid #60a5fa' : '2px solid transparent' }}>
      <Layers size={14} color={active.length ? '#60a5fa' : dimColor} />
      <button type="button" aria-expanded={expanded} onClick={() => onLayerClick(selected)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left', color: active.length ? textColor : dimColor, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontSize: FONT_SIZE.md }}>
        {group.label}{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      <button type="button" role="switch" aria-label={`${group.label} 顯示`} aria-checked={active.length > 0} onClick={toggle} style={{ border: 0, borderRadius: RADIUS.full, background: active.length ? '#60a5fa' : '#4b5563', color: active.length ? '#111827' : '#fff', fontSize: FONT_SIZE.xs, cursor: 'pointer', padding: '2px 7px' }}>{active.length ? '開' : '關'}</button>
    </div>
    {expanded && <>
      <div style={{ padding: '4px 14px 8px', fontSize: FONT_SIZE.sm }}>
        <label style={{ display: 'block', color: dimColor, marginBottom: 4 }}>{group.key === 'hospitalBeds' ? '床位類型' : '人員類型'}</label>
        <select disabled={sourceState.loading || !sourceState.selection} aria-label={`${group.label} 類型`} value={selected} onChange={event => choose(event.target.value as MedicalStatisticsOptionKey)} style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: RADIUS.md, border: '1px solid #64748b', background: '#182230', color: '#f3f4f6', font: 'inherit' }}>
          {group.options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        {active.length > 1 && <p style={{ color: dimColor }}>目前重疊顯示 {active.length} 種；選擇類型後，此主題改為單一類型。</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      {renderControls(selected)}
    </>}
  </div>;
}
