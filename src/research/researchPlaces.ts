import type { PresentableResult } from "./researchAnalysisSession";

export type ResearchPlace = { resultId: string; recordId: string; label: string; center: [number, number]; detail?: string; radiusM?: number };

/** Links refer to real records in the complete stored result, never inferred map locations. */
export function researchPlaces(results: readonly PresentableResult[], limit = 3): ResearchPlace[] {
  const places: ResearchPlace[] = [];
  for (const result of results) {
    if (result.geometry.type !== "Point" || result.geometry.role !== "actual") continue;
    for (const row of result.rows) {
      const geometry = row.geometry as { type?: string; coordinates?: unknown[] } | undefined;
      const [lng, lat] = geometry?.coordinates ?? [];
      if (geometry?.type !== "Point" || typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90 || typeof row.record_id !== "string") continue;
      const label = [row.school_name, row.name, row.facility_name].find(value => typeof value === "string" && value.trim()) as string | undefined;
      if (!label) continue;
      const counts = result.presentation?.sourceLabels.map(source => `${source.label} ${typeof row[source.field] === "number" ? row[source.field] : "未知"} 筆`).join(" · ");
      const radiusM = result.presentation?.radiusM;
      places.push({ resultId: result.resultId, recordId: row.record_id, label, center: [lng, lat], radiusM, detail: counts ? `直線 ${radiusM} 公尺內：${counts}` : undefined });
      if (places.length >= limit) return places;
    }
  }
  return places;
}
