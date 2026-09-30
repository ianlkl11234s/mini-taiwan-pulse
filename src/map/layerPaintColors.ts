
/** Registry fossil-fuel primary colors; legend and paint share exact values. */
export const FOSSIL_PAINT_COLORS = {
  "gasStationCpc": "#41AEF2",
  "gasStationFpcc": "#22C55E",
  "gasStationTaisugar": "#F2522E",
  "gasStationOther": "#D1D5DB",
  "gasStationCanonical": "#0FBFBF",
  "lpgSubpackaging": "#F2622E",
  "lpgRetailers": "#D9863D",
  "lngTerminal": "#F2B84B",
  "pipelineGas": "#F2D64B",
  "pipelineOilGas": "#EDF249",
  "industrialRefinery": "#F97316",
  "industrialStorageTank": "#06B6D4",
  "industrialPowerPlant": "#D946EF",
  "coalTerminal": "#3B82F6"
} as const;

export const GOV_SERVICE_PAINT_COLORS = {
  "district_office": "#8d6e63",
  "household_registration": "#7986cb",
  "land_office": "#9ccc65"
} as const;

export const ROAD_DRIVE_PAINT_COLORS = {
  "motorway": "#fb923c",
  "trunk": "#f87171",
  "primary": "#fcd34d",
  "secondary": "#9ca3af",
  "tertiary": "#d4d4d4",
  "other": "#e5e7eb"
} as const;

/** Existing map colors, including theme-dependent outline and halo colors. */
export const THEMED_PAINT_COLORS = {
  "jpAccommodationOutline": {
    "dark": "rgba(255,255,255,0.18)",
    "light": "rgba(124,45,18,0.28)"
  },
  "companyGridOutline": {
    "dark": "rgba(255,255,255,0.16)",
    "light": "rgba(15,23,42,0.18)"
  },
  "realEstateOutline": {
    "dark": "rgba(255,255,255,0.12)",
    "light": "rgba(0,0,0,0.15)"
  },
  "ecoNetworkOutline": {
    "dark": "rgba(255,255,255,0.28)",
    "light": "rgba(0,0,0,0.2)"
  },
  "forestReserveOutline": {
    "dark": "rgba(255,255,255,0.3)",
    "light": "rgba(0,0,0,0.25)"
  },
  "forestCompartmentsOutline": {
    "dark": "#22c55e",
    "light": "#166534"
  },
  "forestRecreationOutline": {
    "dark": "#a3e635",
    "light": "#4d7c0f"
  },
  "industrialParkOutline": {
    "dark": "#86efac",
    "light": "#15803d"
  },
  "industrialComparisonOutline": {
    "dark": "#ddd6fe",
    "light": "#6d28d9"
  },
  "ooklaGlobalOutline": {
    "dark": "rgba(255,255,255,0.55)",
    "light": "rgba(15,23,42,0.55)"
  },
  "ooklaTaiwanOutline": {
    "dark": "rgba(255,255,255,0.45)",
    "light": "rgba(15,23,42,0.45)"
  },
  "school": {
    "dark": "#42a5f5",
    "light": "#1565c0"
  },
  "newsGlow": {
    "dark": "#ff9800",
    "light": "#e65100"
  },
  "newsCriticalHalo": {
    "dark": "#ffffff",
    "light": "#fffbeb"
  },
  "canalIrrigation": {
    "dark": "#2dd4bf",
    "light": "#0d9488"
  },
  "canalDownstream": {
    "dark": "#a78bfa",
    "light": "#7c3aed"
  },
  "canalOther": {
    "dark": "#94a3b8",
    "light": "#64748b"
  }
} as const;

export const FACILITY_STATUS_PAINT_COLORS = {
  "fallback": "#9ca3af",
  "construction": "#fff500",
  "preConstruction": "#00d4ff",
  "announced": "#a5b4fc",
  "historical": "#525252",
  "historicalStroke": "#737373"
} as const;

export const FORESTRY_PAINT_COLORS = {
  "forestCompartments": "#15803D",
  "forestReserve": "#0F766E",
  "forestRecreation": "#65A30D",
  "forestRoads": "#A16207",
  "forestTreatmentWorks": "#F59E0B",
  "forestTrailSigns": "#84CC16",
  "forestSignalPoints": "#22C55E",
  "forestEducationCenters": "#0EA5E9",
  "forestWildlife": "#A855F7",
  "forestDamLakes": "#06B6D4",
  "forestFlatParks": "#A3E635",
  "forestAlishanRail": "#92400E"
} as const;

export const HIKING_TRAIL_PAINT_COLORS = {
  "A_forest": "#d62728",
  "B_osm": "#1f77b4",
  "C_np_sheipa": "#2ca02c",
  "C_np_kinmen": "#9467bd",
  "D_taipei_grand": "#ff7f0e",
  "D_newtaipei": "#e377c2"
} as const;
