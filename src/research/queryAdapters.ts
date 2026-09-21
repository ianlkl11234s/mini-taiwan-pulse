import type { DatasetDescriptor, Scalar, SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

export interface AdapterSnapshot {
  rows: readonly Record<string, unknown>[];
  source: SourceReceipt;
  /**
   * Additional immutable inputs used to materialize the rows (for example an
   * administrative-boundary artifact joined to a statistics release).  Keep
   * `source` for backwards compatibility with existing adapter families.
   */
  sourceRefs?: readonly SourceReceipt[];
  coverage: string;
  freshness?: "current" | "stale" | "unknown";
  exclusions?: Record<string, number>;
  rowsScanned?: number;
  bytesScanned?: number | null;
  downloadedBytes?: number | null;
  requests?: number | null;
  cacheHit?: boolean | null;
  expiresAt?: string | null;
}

export type SnapshotReader = (parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal) => Promise<AdapterSnapshot>;

function adapter(descriptor: DatasetDescriptor, allowedParameters: QueryAdapter["allowedParameters"], reader: SnapshotReader): QueryAdapter {
  return {
    descriptor,
    allowedParameters,
    async read(parameters, signal): Promise<AdapterReadResult> {
      const snapshot = await reader(parameters, signal);
      return {
        rows: snapshot.rows,
        sourceRefs: [snapshot.source, ...(snapshot.sourceRefs ?? [])].filter((source, index, sources) =>
          sources.findIndex(candidate => candidate.sourceId === source.sourceId
            && candidate.version === source.version
            && candidate.checksumSha256 === source.checksumSha256
            && candidate.reference === source.reference) === index,
        ),
        coverage: snapshot.coverage,
        freshness: snapshot.freshness ?? "unknown", exclusions: { ...(snapshot.exclusions ?? {}) },
        rowsScanned: snapshot.rowsScanned ?? snapshot.rows.length, bytesScanned: snapshot.bytesScanned ?? null, downloadedBytes: snapshot.downloadedBytes ?? null,
        requests: snapshot.requests ?? null, cacheHit: snapshot.cacheHit ?? null, expiresAt: snapshot.expiresAt ?? null,
      };
    },
  };
}

export function createPointDatasetAdapter(descriptor: DatasetDescriptor, reader: SnapshotReader): QueryAdapter {
  if (descriptor.kind !== "point" || descriptor.recordGrain !== "place" || descriptor.geometry.type !== "Point" || descriptor.geometry.role !== "actual") throw new Error("INVALID_POINT_ADAPTER");
  return adapter(descriptor, {}, reader);
}

export function createNewsEventAdapter(descriptor: DatasetDescriptor, reader: SnapshotReader): QueryAdapter {
  if (descriptor.kind !== "event" || descriptor.recordGrain !== "event") throw new Error("INVALID_EVENT_ADAPTER");
  return adapter(descriptor, { date: "string", minRelevance: "number", eventsOnly: "boolean", minSeverity: "number" }, reader);
}

export function createAdminStatisticsAdapter(descriptor: DatasetDescriptor, reader: SnapshotReader): QueryAdapter {
  if (descriptor.kind !== "admin_statistic" || descriptor.recordGrain !== "admin_statistic" || !descriptor.primaryKey.includes("release_id") || !descriptor.primaryKey.includes("area_code")) throw new Error("INVALID_STATISTICS_ADAPTER");
  return adapter(descriptor, { releaseId: "string" }, async (parameters, signal) => {
    const snapshot = await reader(parameters, signal);
    for (const row of snapshot.rows) {
      if (row.status === "observed") {
        if (typeof row.value !== "number" || !Number.isFinite(row.value)) throw new Error("INVALID_STATISTICS_VALUE");
      } else if (typeof row.status !== "string" || row.value !== null) throw new Error("INVALID_STATISTICS_VALUE");
    }
    return snapshot;
  });
}
