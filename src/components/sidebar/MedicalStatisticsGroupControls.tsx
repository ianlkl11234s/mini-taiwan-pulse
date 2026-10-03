import { getStatisticsVisual } from "../../data/statisticsVisuals";
import { ListRow } from "./LayerRow";
import { useRailTheme } from "./railTheme";
import { useEffect, type ReactNode } from 'react';
import type { LayerVisibility } from '../../types';
import { getMedicalStatisticsGroup, resolveMedicalStatisticsGroupKey } from '../../data/medicalStatisticsGroups';
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
}

/**
 * 統計群組列（群組變體，圖層面板統一 C 段）：一列對應多個 key（醫療、住宅、土地…）。
 *
 * - 列本身是共用 `ListRow`（P8）；整組開關。
 * - 展開區就是「目前成員」的 `ExpandedControls`：第一列是共用的「指標／口徑」連動選單
 *   （`${key}Variant`），接著期別與細項、透明度、說明・來源——與其他統計層同一套順序。
 * - 切換成員由 provider 完成（同期別切換、必要時先預載）；這裡只在切換後把 App 的展開層
 *   同步成新成員（`statistics-variant-switch`：清掉舊層的 popup）。
 */
export function MedicalStatisticsGroupControls({ groupKey, visibility, expandedLayer, onLayerClick, renderControls, textColor = '#e5e7eb', dimColor = '#9ca3af' }: Props) {
  const group = getMedicalStatisticsGroup(groupKey);
  const { DIM } = useRailTheme();
  const members = group?.options.map(option => option.key) ?? [];
  const expanded = members.some(key => key === expandedLayer);
  const selected = (group && resolveMedicalStatisticsGroupKey(group, visibility, expandedLayer ?? undefined)) ?? (expanded ? expandedLayer as keyof LayerVisibility : undefined) ?? group?.options[0]?.key;
  // 指標選單換了可見成員 → 展開層跟著換（舊展開層已不可見時才換，重疊模式不動）
  useEffect(() => {
    if (!expanded || !selected || selected === expandedLayer) return;
    if (visibility[selected] && !visibility[expandedLayer as keyof LayerVisibility]) onLayerClick(selected, 'statistics-variant-switch');
  }, [expanded, selected, expandedLayer, visibility, onLayerClick]);
  if (!group || !selected) return null;
  const visual = getStatisticsVisual(group.options[0]!.key, group.label);
  const Icon = visual.icon;
  const active = members.filter(key => visibility[key]);
  const toggle = () => {
    if (!active.length) {
      onLayerClick(selected);
      return;
    }
    let next = layerVisibilityStore.getAll();
    for (const key of members) if (isStatisticsChoropleth(key)) next = statisticsDisplayModeStore.setVisible(key, false, next);
    layerVisibilityStore.setAll(next);
  };
  return <div style={{ color: textColor }}>
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
      {active.length > 1 && <p style={{ margin: '2px 12px 0 22px', color: dimColor, fontSize: FONT_SIZE.sm }}>目前重疊顯示 {active.length} 種；選擇{group.optionLabel ?? '指標'}後，此主題改為單一類型。</p>}
      {renderControls(selected)}
    </>}
  </div>;
}
