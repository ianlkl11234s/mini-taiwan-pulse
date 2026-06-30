import type { PanelProps } from "./registry";

const GenericPanel = ({ props }: PanelProps) => (
  <div style={{ display: "grid", gap: 4 }}>
    {Object.entries(props).slice(0, 8).map(([key, value]) => (
      <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>{key}</span>
        <span>{String(value ?? "—")}</span>
      </div>
    ))}
  </div>
);

export const PoliceStationPanel = GenericPanel;
export const WomenChildWarningPanel = GenericPanel;
export const SpeedCameraPanel = GenericPanel;
export const SpeedZoneSegmentPanel = GenericPanel;
export const CourtPanel = GenericPanel;
export const ProsecutorsOfficePanel = GenericPanel;
export const CorrectionalFacilityPanel = GenericPanel;
export const CourtJurisdictionPanel = GenericPanel;
export const CrimeAreaMonthlyPanel = GenericPanel;
export const TheftTaoyuanPanel = GenericPanel;
export const TrafficAccidentYearlyPanel = GenericPanel;
export const AccidentTaipeiPanel = GenericPanel;
export const A1AccidentRealtimePanel = GenericPanel;
export const InvestigationBureauPanel = GenericPanel;
export const AntiCorruptionOfficePanel = GenericPanel;
export const ImmigrationOfficePanel = GenericPanel;
export const CoastGuardStationPanel = GenericPanel;
export const CivilDefenseShelterPanel = GenericPanel;
export const AviationAirspacePanel = GenericPanel;
export const DroneZonesPanel = GenericPanel;
export const PoliceIsoSubstationPanel = GenericPanel;
export const PoliceIsoPrecinctPanel = GenericPanel;
export const PoliceIsoCityDeptPanel = GenericPanel;
