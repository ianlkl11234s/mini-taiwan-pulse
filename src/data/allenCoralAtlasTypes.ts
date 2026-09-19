/** Allen Coral Atlas local snapshot; upstream dd444fff. No geometry or public URLs. */
import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";
export type AllenCoralAtlasView = "coralAlgae" | "benthic" | "geomorphic";
export type AllenCoralAtlasRegion = "all" | "taiwan" | "okinawa";
export const ALLEN_CORAL_ACQUIRED_AT = "2026-09-15T12:25:53.151117+00:00";
export const ALLEN_CORAL_ATTRIBUTION = "© Allen Coral Atlas Partnership / Arizona State University · CC BY 4.0 · 本人私人非商業研究";
export const ALLEN_CORAL_WARNING = "珊瑚／藻類為合併分類，不代表活珊瑚覆蓋率、健康或物種。金門與馬祖無製圖要素，不代表沒有珊瑚。取得日期不是觀測日期；名目 5m 解析度不是定位精度。";
export const ALLEN_CORAL_SOURCES = {
  "benthic": {
    "sourceId": "allen-coral-atlas-benthic",
    "sourceLayer": "allen_coral_atlas_benthic",
    "url": "/api/private-research/allen-coral-atlas/benthic",
    "legend": [
      {
        "value": "Coral/Algae",
        "label_zh": "珊瑚／藻類",
        "color": "#ee6c83"
      },
      {
        "value": "Microalgal Mats",
        "label_zh": "微藻毯",
        "color": "#9162bd"
      },
      {
        "value": "Rock",
        "label_zh": "岩石",
        "color": "#858e9a"
      },
      {
        "value": "Rubble",
        "label_zh": "碎屑",
        "color": "#c49b76"
      },
      {
        "value": "Sand",
        "label_zh": "沙地",
        "color": "#f2d88a"
      },
      {
        "value": "Seagrass",
        "label_zh": "海草",
        "color": "#45a875"
      }
    ]
  },
  "geomorphic": {
    "sourceId": "allen-coral-atlas-geomorphic",
    "sourceLayer": "allen_coral_atlas_geomorphic",
    "url": "/api/private-research/allen-coral-atlas/geomorphic",
    "legend": [
      {
        "value": "Back Reef Slope",
        "label_zh": "後礁坡",
        "color": "#7773bc"
      },
      {
        "value": "Deep Lagoon",
        "label_zh": "深潟湖",
        "color": "#345e9e"
      },
      {
        "value": "Inner Reef Flat",
        "label_zh": "內礁坪",
        "color": "#b7dc8b"
      },
      {
        "value": "Outer Reef Flat",
        "label_zh": "外礁坪",
        "color": "#66bd9e"
      },
      {
        "value": "Plateau",
        "label_zh": "平台",
        "color": "#cfaa70"
      },
      {
        "value": "Reef Crest",
        "label_zh": "礁脊",
        "color": "#e7b649"
      },
      {
        "value": "Reef Slope",
        "label_zh": "礁坡",
        "color": "#518dc0"
      },
      {
        "value": "Shallow Lagoon",
        "label_zh": "淺潟湖",
        "color": "#8cced5"
      },
      {
        "value": "Sheltered Reef Slope",
        "label_zh": "遮蔽礁坡",
        "color": "#85a6cb"
      },
      {
        "value": "Terrestrial Reef Flat",
        "label_zh": "近陸礁坪",
        "color": "#cbca82"
      }
    ]
  }
} as const;
export function allenCoralSource(view: AllenCoralAtlasView) {
  return ALLEN_CORAL_SOURCES[view === "geomorphic" ? "geomorphic" : "benthic"];
}
export function allenCoralFilter(view: AllenCoralAtlasView, region: AllenCoralAtlasRegion): FilterSpecification {
  const conditions: unknown[] = [];
  if (view === "coralAlgae") conditions.push(["==", ["get", "class_name"], "Coral/Algae"]);
  if (region !== "all") conditions.push(["==", ["get", "region"], region]);
  return ["all", ...conditions] as FilterSpecification;
}
export function allenCoralColor(view: AllenCoralAtlasView): ExpressionSpecification {
  return ["match", ["get", "class_name"], ...allenCoralSource(view).legend.flatMap(item => [item.value, item.color]), "#a0a0a0"] as ExpressionSpecification;
}
