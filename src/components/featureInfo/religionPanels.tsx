import { Row, SourceFooter } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  deityFamilyColor, deityFamilyLabel, ancestralHallTypeLabel,
  ANCESTRAL_HALL_TYPES, ANCESTRAL_HALL_MISSING_COLOR, RELIGION_LAYER_COLORS,
} from "../../data/religionTypes";

// 本檔 Title 為極簡本地版（同 urbanPanels / fisheryPanels 慣例）。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/** in_moi_registry → 中文（三層共用；ancestral_halls 的 false 語意是文資祠堂另外處理） */
function registryLabel(v: unknown): string {
  if (v === true) return "官方登記";
  if (v === false) return "登記制度外（OSM 群眾標註）";
  return "";
}

/** OSM 來源才顯示的 ODbL 標示（source / source_tier 判斷） */
function OdblNote({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  if (String(props.source ?? "") !== "osm_overpass") return null;
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      ⓘ OpenStreetMap 群眾標註，© OpenStreetMap contributors（ODbL）
    </div>
  );
}

/** geocode_precision 誠實標記 → 中文（original 原生座標最可信） */
const GEOCODE_LABEL: Record<string, string> = {
  original: "原始座標",
  offline: "離線地址比對",
  osm_match: "OSM 名稱比對",
  google: "Google Geocoding",
};

/**
 * 寺廟（19,201）：主祀神祇族分色標題 + 原始 main_deity + 教別 / 登記別 / 登記狀態。
 * ⚠️ name 可為 null（443 筆，多為 OSM 無名宮壇）→ 顯示「無名宮廟」不憑空造名。
 */
export function TemplePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const family = str(props.deity_family) || "unknown";
  const color = deityFamilyColor(family);
  const deity = str(props.main_deity);
  const precision = GEOCODE_LABEL[str(props.geocode_precision)] ?? str(props.geocode_precision);
  return (
    <>
      <Title color={color}>{str(props.name) || "無名宮廟"}</Title>
      <Row label="主祀神祇" value={deity || deityFamilyLabel(family)} color={color} />
      {deity ? <Row label="神祇分族" value={deityFamilyLabel(family)} /> : null}
      <Row label="教別" value={str(props.religion_type)} />
      <Row label="登記別" value={str(props.registration_type)} />
      <Row label="登記狀態" value={registryLabel(props.in_moi_registry)} />
      {props.heritage_flag === true ? <Row label="文化資產" value="是" color="#d4a017" /> : null}
      {props.is_top100 === true ? <Row label="宗教百景" value="是" color={RELIGION_LAYER_COLORS.religionTop100} /> : null}
      <Row label="縣市" value={str(props.county)} />
      <Row label="地址" value={str(props.address)} />
      <Row label="電話" value={str(props.phone)} />
      {precision && precision !== "原始座標" ? (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          座標來源：{precision}（非原始座標，位置為推估）
        </div>
      ) : null}
      <OdblNote props={props} />
    </>
  );
}

/** 教會（2,116；OSM 補 1,066 聚會點）：name 可為 null 46 筆 */
export function ChurchPanel({ props }: { props: Record<string, unknown> }) {
  const color = RELIGION_LAYER_COLORS.religionChurches;
  return (
    <>
      <Title color={color}>{str(props.name) || "無名教會"}</Title>
      {str(props.name_en) ? <Row label="英文名" value={str(props.name_en)} /> : null}
      <Row label="登記狀態" value={registryLabel(props.in_moi_registry)} />
      {props.heritage_flag === true ? <Row label="文化資產" value="是" color="#d4a017" /> : null}
      <Row label="縣市" value={str(props.county)} />
      <Row label="地址" value={str(props.address)} />
      <Row label="電話" value={str(props.phone)} />
      <OdblNote props={props} />
      <SourceFooter props={props} />
    </>
  );
}

/** 宗祠（173）：facility_type 3 類（登記宗祠 69 / 宗祠基金會 8 / 文資祠堂 96） */
export function AncestralHallPanel({ props }: { props: Record<string, unknown> }) {
  const type = str(props.facility_type);
  const color = ANCESTRAL_HALL_TYPES.find((x) => x.value === type)?.color ?? ANCESTRAL_HALL_MISSING_COLOR;
  return (
    <>
      <Title color={color}>{str(props.name) || "宗祠"}</Title>
      <Row label="類型" value={ancestralHallTypeLabel(type)} color={color} />
      {str(props.heritage_grade) ? <Row label="文資級別" value={str(props.heritage_grade)} /> : null}
      <Row label="縣市" value={str(props.county)} />
      <Row label="地址" value={str(props.address)} />
      <Row label="負責人" value={str(props.principal)} />
      <SourceFooter props={props} />
    </>
  );
}

/** 宗教基金會（165；單一源，無 trust chain 欄） */
export function FoundationPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionFoundations}>{str(props.name) || "宗教基金會"}</Title>
      <Row label="縣市" value={str(props.county)} />
      <Row label="地址" value={str(props.address)} />
      <Row label="電話" value={str(props.phone)} />
      <Row label="負責人" value={str(props.principal)} />
      <SourceFooter props={props} />
    </>
  );
}

/**
 * 其他宗教場所（1,319；全 OSM）：清真寺 / 印度教 / 神社遺構 / 風獅爺 / 原民祭場…
 * ⚠️ name 為 null 859 筆（65%）—— 這是 OSM 標了場所但沒標名，誠實顯示「未命名場所」。
 */
export function OtherWorshipPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionOtherWorship}>{str(props.name) || "未命名宗教場所"}</Title>
      {str(props.name_en) ? <Row label="英文名" value={str(props.name_en)} /> : null}
      <Row label="宗教" value={str(props.religion_type)} />
      <Row label="教派" value={str(props.denomination)} />
      <Row label="縣市" value={str(props.county)} />
      <Row label="鄉鎮" value={str(props.town)} />
      <Row label="地址" value={str(props.address)} />
      <OdblNote props={props} />
    </>
  );
}

/**
 * 宗教百景（100）：2026-08-02 自觀光群搬來（原 tourReligion / ReligionPanel）。
 * 上游同步自 tourism.religion 搬移歸位為 religion.top100，欄位不變。
 */
export function ReligionTop100Panel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={RELIGION_LAYER_COLORS.religionTop100}>{str(props.name) || "宗教景點"}</Title>
      {str(props.name_en) ? <Row label="英文名" value={str(props.name_en)} /> : null}
      <Row label="縣市" value={str(props.county)} />
      <Row label="鄉鎮" value={str(props.town)} />
      <Row label="地址" value={str(props.address)} />
    </>
  );
}
