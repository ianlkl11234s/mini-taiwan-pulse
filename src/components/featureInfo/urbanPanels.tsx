import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  STREET_TREE_3EPOCH_TRAJ,
  STREET_TREE_NATIONAL_SPECIES, STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES,
} from "../../data/urbanOpenSpaceTypes";

// 本檔 Title 為極簡本地版（同 fisheryPanels 慣例）：shared.tsx 未 export Title，故不去改動它。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

/** 數值 + 單位；非有限值回空字串（Row 對空值自動隱藏） */
function numUnit(v: unknown, unit: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}` : "";
}

/** 學名斜體副標（Title 下方一行；空值不渲染） */
function ScientificName({ children }: { children: string }) {
  const t = useFeatureTheme();
  if (!children) return null;
  return (
    <div style={{ fontSize: FONT_SIZE.sm, fontStyle: "italic", color: t.textMuted, marginTop: -4, marginBottom: 6 }}>
      {children}
    </div>
  );
}

/** status 三值 → 中文標籤 + 代表色（存續 綠 / 消失 紅 / 新增 淺綠） */
const STATUS_TIER: Record<string, { label: string; color: string }> = {
  persisted: { label: "存續（2024→現在）", color: "#2e7d32" },
  disappeared: { label: "消失（2024 有、現在無）", color: "#e53935" },
  appeared: { label: "新增（2024 無、現在有）", color: "#9ccc65" },
};

export function StreetTreesTaipeiDiffPanel({ props }: { props: Record<string, unknown> }) {
  const status = typeof props.status === "string" ? props.status : "";
  const tier = STATUS_TIER[status] ?? { label: status || "未知", color: "#9e9e9e" };
  const renumberSuspect = props.renumber_suspect === true;
  // 路名（附行政區）：Region 為主，Dist 括號附註
  const region = String(props.Region ?? "");
  const dist = String(props.Dist ?? "");
  const roadValue = region && dist ? `${region}（${dist}）` : region || dist;
  return (
    <>
      <Title color={tier.color}>{String(props.TreeType ?? "行道樹")}</Title>
      <Row label="狀態" value={tier.label} color={tier.color} />
      <Row label="路名" value={roadValue} />
      <Row label="TreeID" value={String(props.TreeID ?? "")} />
      <Row label="胸徑" value={numUnit(props.Diameter, "cm")} />
      <Row label="樹高" value={numUnit(props.TreeHeight, "m")} />
      <Row label="調查日" value={String(props.SurveyDate ?? "")} />
      {renumberSuspect && (
        <Row label="提示" value="⚠️ 疑似重編號（同路名同樹種 10m 內配對，可能非真消失/新增）" color="#fbbf24" />
      )}
      <div style={{ fontSize: FONT_SIZE.sm, color: "rgba(150,200,255,0.6)", lineHeight: 1.5, marginTop: 6 }}>
        ⓘ TreeID 消失≠砍除；2024 基準取自 Wayback，含颱風後清運滯後
      </div>
      <SourceFooter props={props} />
    </>
  );
}

/** 受保護樹木（全國 6,544 點）：樹種 + 學名斜體 + 城市/地址 + 尺寸 + 推估樹齡 + 管理單位 */
export function ProtectedTreesNationalPanel({ props }: { props: Record<string, unknown> }) {
  const sci = typeof props.species_scientific === "string" ? props.species_scientific : "";
  const city = String(props.city ?? "");
  const district = String(props.district ?? "");
  const cityValue = city && district ? `${city}（${district}）` : city || district;
  return (
    <>
      <Title color="#00695c">{String(props.species ?? "受保護樹木")}</Title>
      <ScientificName>{sci}</ScientificName>
      <Row label="城市" value={cityValue} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="胸徑" value={numUnit(props.dbh_m, "m")} />
      <Row label="胸圍" value={numUnit(props.girth_m, "m")} />
      <Row label="樹高" value={numUnit(props.height_m, "m")} />
      <Row label="樹冠面積" value={numUnit(props.crown_area_m2, "m²")} />
      <Row label="推估樹齡" value={numUnit(props.estimated_age_years, "年")} />
      <Row label="管理單位" value={String(props.manager ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** 台北河濱喬木（10,917 點）：樹種 + 學名/科別 + 河濱公園 + 尺寸 + 推估樹齡 + 調查日期 */
export function RiversideTreesTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const sci = typeof props.species_scientific === "string" ? props.species_scientific : "";
  const family = String(props.family ?? "");
  return (
    <>
      <Title color="#0288d1">{String(props.species ?? "河濱喬木")}</Title>
      <ScientificName>{family ? (sci ? `${sci}（${family}）` : family) : sci}</ScientificName>
      <Row label="河濱公園" value={String(props.park_name ?? "")} />
      <Row label="樹高" value={numUnit(props.height_m, "m")} />
      <Row label="胸徑" value={numUnit(props.dbh_cm, "cm")} />
      <Row label="樹冠面積" value={numUnit(props.crown_area_m2, "m²")} />
      <Row label="推估樹齡" value={numUnit(props.estimated_age_years, "年")} />
      <Row label="調查日" value={String(props.survey_date ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** 台北公園（2,917 點）：公園名 + 行政區 + 分類 + 面積（千分位）+ 兒童遊具有無 */
export function ParksTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const playground = props.has_playground === true ? "有" : props.has_playground === false ? "無" : "";
  return (
    <>
      <Title color="#7cb342">{String(props.name ?? "公園")}</Title>
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="分類" value={String(props.category ?? "")} />
      <Row label="面積" value={numUnit(props.area_sqm, "m²")} />
      <Row label="兒童遊具" value={playground} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 行道樹三時點（105,675 點）──

/** traj badge：2022→2024→2026 三格存在/消失視覺（1=存在 綠框、0=無 灰框） */
function TrajBadge({ traj }: { traj: string }) {
  if (traj.length !== 3) return null;
  const years = ["2022", "2024", "2026"];
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
      {years.map((y, i) => {
        const present = traj[i] === "1";
        return (
          <div
            key={y}
            style={{
              padding: "2px 6px", borderRadius: 4, fontSize: FONT_SIZE.xs,
              background: present ? "rgba(46,125,50,0.22)" : "rgba(158,158,158,0.10)",
              border: `1px solid ${present ? "#2e7d32" : "rgba(158,158,158,0.5)"}`,
              color: present ? "#7cc47f" : "#9e9e9e",
            }}
          >
            {y} {present ? "存在" : "消失"}
          </div>
        );
      })}
    </div>
  );
}

/** status_2224 / status_2426 期間變化 → 中文標籤 */
const EPOCH_STATUS_LABEL: Record<string, string> = {
  persisted: "存續",
  disappeared: "消失",
  appeared: "新增",
  absent: "不存在",
};

/**
 * 行道樹三時點：樹種 + traj badge + 兩期間狀態 + 路段 + 尺寸 + 公園樹 + renumber 警示。
 * traj 7 類標籤/色票 SSOT = urbanOpenSpaceTypes.ts（與 overlayRegistry / Legend 同源）。
 */
export function StreetTrees3epochPanel({ props }: { props: Record<string, unknown> }) {
  const traj = typeof props.traj === "string" ? props.traj : "";
  const cat = STREET_TREE_3EPOCH_TRAJ.find((c) => c.code === traj);
  // 路段（附行政區）：region 為主，dist 括號附註（同 diff 層 Region/Dist 寫法）
  const region = String(props.region ?? "");
  const dist = String(props.dist ?? "");
  const roadValue = region && dist ? `${region}（${dist}）` : region || dist;
  const isPark = props.is_park === 1 ? "是" : props.is_park === 0 ? "否" : "";
  // renumber_2224 / renumber_2426 為 0/1（PMTiles 屬性），任一為 1 → 疑似重編號警示
  const renumberEpochs = [
    props.renumber_2224 === 1 ? "2022→2024" : null,
    props.renumber_2426 === 1 ? "2024→2026" : null,
  ].filter((s): s is string => s !== null);
  return (
    <>
      <Title color={cat?.color ?? "#558b2f"}>{String(props.species ?? "行道樹")}</Title>
      <TrajBadge traj={traj} />
      <Row label="軌跡" value={cat ? `${cat.label}（${traj}）` : traj} color={cat?.color} />
      <Row label="2022→2024" value={EPOCH_STATUS_LABEL[String(props.status_2224 ?? "")] ?? String(props.status_2224 ?? "")} />
      <Row label="2024→2026" value={EPOCH_STATUS_LABEL[String(props.status_2426 ?? "")] ?? String(props.status_2426 ?? "")} />
      <Row label="路段" value={roadValue} />
      <Row label="TreeID" value={String(props.tree_id ?? "")} />
      <Row label="胸徑" value={numUnit(props.dbh_cm, "cm")} />
      <Row label="樹高" value={numUnit(props.height_m, "m")} />
      <Row label="公園樹" value={isPark} />
      <Row label="調查日" value={String(props.survey_date ?? "")} />
      {renumberEpochs.length > 0 && (
        <Row label="提示" value={`⚠️ 疑似重編號（${renumberEpochs.join("、")}），可能非真消失/新增`} color="#fbbf24" />
      )}
      <SourceFooter props={props} />
    </>
  );
}

// ── 行道樹全國分佈（210,436 點：台北 + 台中）──

/**
 * 行道樹全國：樹種（Title 帶樹種色，色票 SSOT = urbanOpenSpaceTypes.ts）+ 城市中文 + 行政區
 * + 地址 + 位置類型 + 尺寸 + 調查日 + 資料來源。city 欄位值 taipei/taichung → 中文顯示。
 */
export function StreetTreesNationalPanel({ props }: { props: Record<string, unknown> }) {
  const species = String(props.species ?? "");
  const speciesColor = STREET_TREE_NATIONAL_SPECIES.find((s) => s.names.includes(species))?.color ?? "#43a047";
  const cityLabel = STREET_TREE_NATIONAL_CITIES.find((c) => c.value === props.city)?.label ?? String(props.city ?? "");
  const district = String(props.district ?? "");
  const cityValue = cityLabel && district ? `${cityLabel}（${district}）` : cityLabel || district;
  return (
    <>
      <Title color={speciesColor}>{species || "行道樹"}</Title>
      <Row label="城市" value={cityValue} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="位置類型" value={String(props.location_type ?? "")} />
      <Row label="胸徑" value={numUnit(props.dbh_cm, "cm")} />
      <Row label="樹高" value={numUnit(props.height_m, "m")} />
      <Row label="調查日" value={String(props.survey_date ?? "")} />
      <Row label="資料來源" value={String(props.source ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

// ── 台北人行道樹穴（56,720 面）──

/** 人行道樹穴：類型帶色（樹穴綠 / 花圃黃，色票 SSOT = urbanOpenSpaceTypes.ts）+ 行政區 + 面積（兩位小數）+ 編號 */
export function TreePitsTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const pitType = String(props.pit_type ?? "");
  const typeColor = TREE_PIT_TYPES.find((t) => t.name === pitType)?.color ?? "#8d6e63";
  const area = Number(props.area_m2);
  return (
    <>
      <Title color={typeColor}>{pitType || "人行道樹穴"}</Title>
      <Row label="類型" value={pitType} color={typeColor} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="面積" value={Number.isFinite(area) ? `${area.toFixed(2)} m²` : ""} />
      <Row label="編號" value={String(props.pit_id ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}
