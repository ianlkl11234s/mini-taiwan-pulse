import { getStatisticsVisual } from "../../data/statisticsVisuals";
import { LayerToggleSwitch } from "./LayerToggleSwitch";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LayerVisibility } from '../../types';
import { getMedicalStatisticsGroup, resolveMedicalStatisticsGroupKey } from '../../data/medicalStatisticsGroups';
import { prepareMedicalStatisticsVariant, selectMedicalStatisticsVariant } from '../../state/medicalStatisticsSelection';
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
  renderControls: (key: keyof LayerVisibility) => ReactNode;
  renderToggle?: (on: boolean, onChange: () => void, label: string) => ReactNode;
  textColor?: string;
  dimColor?: string;
}

export function MedicalStatisticsGroupControls({ groupKey, visibility, expandedLayer, onLayerClick, renderControls, renderToggle, textColor = '#e5e7eb', dimColor = '#9ca3af' }: Props) {
  const group = getMedicalStatisticsGroup(groupKey);
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
    if (expandedLayer !== next) onLayerClick(next);
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderLeft: active.length ? `2px solid ${visual.accent}` : '2px solid transparent' }}>
      <Icon size={14} color={visual.accent} style={{ flexShrink: 0 }} />
      <button type="button" aria-expanded={expanded} onClick={() => onLayerClick(selected)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left', color: textColor, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontSize: FONT_SIZE.md }}>
        {group.label}{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {renderToggle ? renderToggle(active.length > 0, toggle, `${group.label} 顯示`) : <LayerToggleSwitch on={active.length > 0} onChange={toggle} label={`${group.label} 顯示`} />}
    </div>
    {expanded && <>
      <div style={{ padding: '4px 14px 8px', fontSize: FONT_SIZE.sm }}>
        <label style={{ display: 'block', color: dimColor, marginBottom: 4 }}>{group.optionLabel ?? '指標'}</label>
        <select disabled={sourceState.loading || !sourceState.selection || switching} aria-busy={switching} aria-label={`${group.label} 類型`} value={selected} onChange={event => { void choose(event.target.value as keyof LayerVisibility); }} style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: RADIUS.md, border: '1px solid #64748b', background: '#182230', color: '#f3f4f6', font: 'inherit' }}>
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
