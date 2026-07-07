import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { medIsochroneColor, medIsochroneLabel, MEDICAL_ISOCHRONE_NOTE } from "../../data/medicalIsochroneTypes";
import { medicalColorByCat } from "../../data/medicalPOITypes";
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
