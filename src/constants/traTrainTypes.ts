/**
 * 台鐵車種定義
 * 從 mini-taipei-v3 移植，用於區分不同車種的顏色
 */

export interface TrainTypeInfo {
  name: string;
  color: string;
  priority: number;
}

export const TRA_TRAIN_TYPES: Record<string, TrainTypeInfo> = {
  PP: { name: '普悠瑪', color: '#E53935', priority: 1 },
  TZ: { name: '太魯閣', color: '#E53935', priority: 1 },
  TC: { name: '自強(3000)', color: '#FF6B00', priority: 2 },
  'TC-PP': { name: '自強(推拉式)', color: '#E65100', priority: 3 },
  'TC-DMU': { name: '自強(柴聯)', color: '#FF8F00', priority: 3 },
  CG: { name: '莒光', color: '#7B1FA2', priority: 4 },
  CK: { name: '區間快', color: '#1976D2', priority: 5 },
  LC: { name: '區間', color: '#42A5F5', priority: 6 },
  OTHER: { name: '其他', color: '#9E9E9E', priority: 99 },
};

export function getTrainColor(typeCode: string | undefined): string {
  if (!typeCode) return TRA_TRAIN_TYPES['OTHER']!.color;
  return TRA_TRAIN_TYPES[typeCode]?.color ?? TRA_TRAIN_TYPES['OTHER']!.color;
}
