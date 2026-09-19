/** 日本 PLATEAU 建物高度與 Meta/WRI 樹冠高度的呈現契約。 */
export const JP_BUILDING_HEIGHT_BANDS = [
  { max: 10, color: "#4575b4", label: "< 10 m" },
  { max: 25, color: "#91bfdb", label: "10–25 m" },
  { max: 50, color: "#fee090", label: "25–50 m" },
  { max: 100, color: "#fc8d59", label: "50–100 m" },
  { max: null, color: "#d73027", label: "≥ 100 m" },
] as const;

export const JP_BUILDING_MISSING_HEIGHT_COLOR = "#9e9e9e";

/** 原始契約是 number|null；0 是合法的平面高度，null／缺欄／負 sentinel 都不可外推。 */
export function jpBuildingHasHeightExpr(field = "height"): unknown[] {
  return ["all",
    ["has", field],
    ["!=", ["get", field], null],
    ["==", ["typeof", ["get", field]], "number"],
    [">=", ["get", field], 0],
  ];
}

/** height 缺值維持中性平面，不把它猜成任一建物高度。 */
export function jpBuildingHeightColorExpr(field = "height"): unknown[] {
  const height: unknown[] = ["get", field];
  const step: unknown[] = ["step", height, JP_BUILDING_HEIGHT_BANDS[0].color];
  for (let i = 1; i < JP_BUILDING_HEIGHT_BANDS.length; i++) {
    const previous = JP_BUILDING_HEIGHT_BANDS[i - 1];
    const current = JP_BUILDING_HEIGHT_BANDS[i];
    if (previous && current && previous.max !== null) step.push(previous.max, current.color);
  }
  return ["case", jpBuildingHasHeightExpr(field), step, JP_BUILDING_MISSING_HEIGHT_COLOR];
}

export function jpBuildingHeightBandColor(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return JP_BUILDING_MISSING_HEIGHT_COLOR;
  const height = value;
  return JP_BUILDING_HEIGHT_BANDS.find((band) => band.max === null || height < band.max)?.color
    ?? JP_BUILDING_MISSING_HEIGHT_COLOR;
}

export const JP_BUILDING_HEIGHT_MODES = [
  { value: "0", label: "2D 高度" },
  { value: "1", label: "3D 立體" },
] as const;

export const JP_CANOPY_HEIGHT_RAMP = ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"] as const;
