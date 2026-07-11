import { useEffect, useState } from "react";
import { RADIUS, FONT_SIZE, COLORS } from "../../styles/designTokens";
import { medIsochroneColor, medIsochroneLabel, MEDICAL_ISOCHRONE_NOTE } from "../../data/medicalIsochroneTypes";
import { medicalColorByCat } from "../../data/medicalPOITypes";
import {
  classifyErCongestion, ER_LEVEL_COLORS, ER_LEVEL_LABELS, ER_CONGESTION_THRESHOLDS,
} from "../../data/erCongestionTypes";
import { fetchErHospital24h } from "../../data/erHospitalLoader";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const LTC_ABC_LABEL: Record<string, string> = {
  A: "A 社區整合型",
  B: "B 複合型",
  C: "C 巷弄長照站",
};

export function MedicalPOIPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const medCat = String(props.med_cat ?? "");
  const color = medicalColorByCat(medCat);
  const title = String(props.name ?? "醫療據點");
  const county = String(props.county ?? "");
  const address = String(props.address ?? "");
  const phone = String(props.phone ?? "");
  const specialties = String(props.specialties ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{title}</div>
      </div>
      {medCat === "hospital" || medCat === "clinic" || medCat === "other_medical" ? (
        <>
          <Row label="類型" value={String(props.category_label ?? "")} color={color} />
          <Row label="縣市" value={county} />
          <Row label="地址" value={address} />
          <Row label="電話" value={phone} />
          {specialties ? (
            <Row label="科別" value={specialties.length > 80 ? specialties.slice(0, 80) + "…" : specialties} />
          ) : null}
        </>
      ) : null}
      {medCat === "pharmacy" ? (
        <>
          <Row label="類型" value="健保特約藥局" color={color} />
          <Row label="縣市" value={county} />
          <Row label="地址" value={address} />
          <Row label="電話" value={phone} />
        </>
      ) : null}
      {medCat === "aed" ? (
        <>
          <Row label="場所類型" value={String(props.place_type ?? "")} color={color} />
          <Row label="縣市" value={county} />
          <Row label="行政區" value={String(props.district ?? "")} />
          <Row label="地址" value={address} />
          <Row label="AED 位置" value={String(props.aed_location ?? "")} />
          <Row label="緊急電話" value={phone} />
        </>
      ) : null}
      {medCat === "ltc" ? (
        <>
          <Row
            label="類型"
            value={LTC_ABC_LABEL[String(props.abc_type ?? "")] ?? String(props.abc_type ?? "")}
            color={color}
          />
          {typeof props.open_beds === "number" ? <Row label="開放床位" value={`${props.open_beds}`} /> : null}
          <Row label="縣市" value={county} />
          <Row label="地址" value={address} />
          <Row label="電話" value={phone} />
          {props.service_items ? (
            <Row
              label="服務項目"
              value={String(props.service_items).length > 60 ? String(props.service_items).slice(0, 60) + "…" : String(props.service_items)}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function MedicalIsochronePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const level = String(props.level ?? "");
  const minutes = props.min_minutes != null ? Number(props.min_minutes) : null;
  const accentColor = medIsochroneColor(level);
  const nearest = String(props.nearest_name ?? "");
  const nearestCat = String(props.nearest_category ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {medIsochroneLabel(level)}
        </div>
      </div>
      {minutes != null && <Row label="最近大醫院車程" value={`${minutes.toFixed(1)} 分鐘`} color={accentColor} />}
      {nearest && <Row label="最近醫院" value={nearest} />}
      {nearestCat && <Row label="醫院層級" value={nearestCat.replace("hospital_", "").replace("_", " ")} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 6, lineHeight: 1.4 }}>
        ⚠️ {MEDICAL_ISOCHRONE_NOTE}
      </div>
    </>
  );
}

/** 急診壅塞 popup — 醫院量能 + 24h「等一般病床」折線（async 骨架比照 GroundwaterPanel） */
export function EmergencyHospitalPanel({ props }: { props: Record<string, unknown> }) {
  const hospId = String(props.hosp_id ?? "");
  const title = String(props.hosp_name ?? "急診醫院");
  const area = String(props.area_name ?? "");
  const levelName = String(props.level_name ?? "");
  const inform = String(props.inform ?? "");
  const waitGeneral = props.wait_general_cnt == null ? null : Number(props.wait_general_cnt);
  const waitSee = props.wait_see_cnt == null ? null : Number(props.wait_see_cnt);
  const waitBed = props.wait_bed_cnt == null ? null : Number(props.wait_bed_cnt);
  const waitIcu = props.wait_icu_cnt == null ? null : Number(props.wait_icu_cnt);
  const obsTs = props.observed_ts == null ? null : Number(props.observed_ts);

  const level = classifyErCongestion(waitGeneral);
  const levelColor = ER_LEVEL_COLORS[level];

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (!hospId) { setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchErHospital24h(hospId)
      .then((rows) => {
        if (cancelled) return;
        setSeries(rows
          .filter((r) => r.wait_general_cnt != null)
          .map((r) => ({ t: Number(r.observed_ts), v: Number(r.wait_general_cnt) })));
      })
      .catch((e) => console.warn("[EmergencyHospital] 24h fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [hospId]);

  const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString("zh-TW"));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: levelColor, flexShrink: 0, boxShadow: `0 0 6px ${levelColor}` }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{title}</div>
      </div>
      <Row label="縣市" value={area} />
      <Row label="層級" value={levelName} />
      <Row label="急診壅塞" value={`${ER_LEVEL_LABELS[level]}（等一般病床 ${fmt(waitGeneral)}）`} color={levelColor} />
      <Row label="等待看診" value={fmt(waitSee)} />
      <Row label="等待住院" value={fmt(waitBed)} />
      <Row label="等待加護病房 (ICU)" value={fmt(waitIcu)} color={waitIcu != null && waitIcu > 0 ? "#ffffff" : undefined} />
      {inform ? <Row label="通報旗標 (inform)" value={inform} /> : null}
      {obsTs != null && (
        <Row label="觀測時間" value={new Date(obsTs * 1000).toLocaleString("zh-TW", { hour12: false }).slice(5, 16)} color="rgba(255,255,255,0.35)" />
      )}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, letterSpacing: 0.5 }}>
        24h 等一般病床趨勢
      </div>
      {loadingTs ? (
        <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, padding: "8px 4px", textAlign: "center" }}>
          載入中…
        </div>
      ) : (
        <TimeseriesSparkline
          data={series}
          unit="床位缺口"
          lineColor={levelColor}
          warningValue={ER_CONGESTION_THRESHOLDS.congested}
          warningLabel="嚴重"
          height={120}
        />
      )}
    </>
  );
}
