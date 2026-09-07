import { useEffect } from "react";
import { useMonitorResource } from "./useMonitorResource";
import { fetchSourceHealth, fetchNewsTrending, fetchPublicHealthWeekly,
  type SourceHealthSummary, type TrendingRow, type PublicHealthWeek } from "../data/intelLoaders";
import { fetchAlertSeries24h, type AlertSeriesPoint } from "../data/alertsLoader";
import { fetchPowerDashboard, fetchPowerGeneration24h, invalidatePowerGeneration24h, fetchPowerDailyTrend,
  type PowerDashboard, type PowerGenerationDay, type PowerDailyTrendRow } from "../data/energyLoader";
import { fetchPrisonPopulation, type PrisonDay } from "../data/prisonLoader";

const EMPTY_SOURCE_HEALTH: SourceHealthSummary = { total: 0, ok: 0, lagging: 0, degraded: 0, unknown: 0, rows: [] };
const EMPTY_TRENDING: TrendingRow[] = [];
const EMPTY_ALERT_SERIES: AlertSeriesPoint[] = [];
const EMPTY_POWER_TREND: PowerDailyTrendRow[] = [];
const EMPTY_PRISON: PrisonDay[] = [];
const EMPTY_HEALTH: PublicHealthWeek = { week: 0, diseases: [] };
const loadTrending = () => fetchNewsTrending(1, 50);

/** Independent resources retain independent failure, cache and source-time semantics. */
export function useMonitorDashboardData(open: boolean, privateDataScope: string | null) {
  useEffect(() => { invalidatePowerGeneration24h(); }, [privateDataScope]);
  const sourceHealth = useMonitorResource({ open, queryKey: "source-health", intervalMs: 60_000, emptyData: EMPTY_SOURCE_HEALTH, load: fetchSourceHealth });
  const trending = useMonitorResource({ open, queryKey: "trending:1:50", intervalMs: 60_000, emptyData: EMPTY_TRENDING, load: loadTrending });
  const alertSeries = useMonitorResource({ open, queryKey: "alert-series:24h", intervalMs: 60_000, emptyData: EMPTY_ALERT_SERIES, load: fetchAlertSeries24h });
  const powerDashboard = useMonitorResource<PowerDashboard | null>({ open, queryKey: "power-dashboard", intervalMs: 5 * 60_000, emptyData: null, load: fetchPowerDashboard });
  const powerDayQuery = useMonitorResource<PowerGenerationDay | null>({ open: open && privateDataScope !== null, queryKey: `power-generation:24h:${privateDataScope ?? "denied"}`, intervalMs: 10 * 60_000, emptyData: null, load: fetchPowerGeneration24h });
  const powerDay = privateDataScope === null ? { ...powerDayQuery, status: "denied" as const, data: null, lastSuccessAt: null } : powerDayQuery;
  const powerTrend = useMonitorResource({ open, queryKey: "power-trend", intervalMs: 30 * 60_000, emptyData: EMPTY_POWER_TREND, load: fetchPowerDailyTrend });
  const prison = useMonitorResource({ open, queryKey: "prison:365", intervalMs: 30 * 60_000, emptyData: EMPTY_PRISON, load: fetchPrisonPopulation });
  const health = useMonitorResource({ open, queryKey: "health:weekly", intervalMs: 30 * 60_000, emptyData: EMPTY_HEALTH, load: fetchPublicHealthWeekly });
  return { sourceHealth, trending, alertSeries, powerDashboard, powerDay, powerTrend, prison, health };
}
