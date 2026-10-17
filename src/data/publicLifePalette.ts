/** 公共生活圖層共用色票。保持零 import，供 manifest / overlay / legend / popup 共用。 */
export const PUBLIC_LIFE_COLORS = {
  drinkingWaterPoints: "#06b6d4",
  publicWasteBaskets: "#d97706",
  materialRecyclingPoints: "#22c55e",
  disasterShelters: "#f97316",
  playgrounds: "#ec4899",
  accessibleParkFacilities: "#0ea5e9",
  bicycleSupport: "#84cc16",
  visitorCentres: "#6366f1",
} as const;

export const ACCESSIBILITY_STATUS_COLORS = {
  yes: "#22c55e",
  limited: "#f59e0b",
  no: "#ef4444",
  unknown: "#94a3b8",
} as const;

export const BICYCLE_SUPPORT_COLORS = {
  repair: "#f97316",
  air: "#06b6d4",
  parking: "#3b82f6",
  water: "#14b8a6",
  toilet: "#8b5cf6",
  other: "#84cc16",
} as const;
