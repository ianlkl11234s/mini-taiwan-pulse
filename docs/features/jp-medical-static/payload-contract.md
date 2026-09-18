# Japan medical static payload contract

`/jp-medical/current.json` is the short-TTL pointer. It has `contract_version`,
`status`, `version`, `catalog`, and `publication_manifest`. Resolve both paths
relative to the pointer URL. `status: LOCAL_READY_NOT_DEPLOYED` is not release
evidence.

The immutable catalog has this shape (paths are relative to its URL):

```json
{
  "contract_version": 1,
  "version": "content-sha256",
  "status": "LOCAL_READY_NOT_DEPLOYED",
  "layers": [{
    "key": "navii_facilities",
    "kind_codes": ["hospital", "clinic", "dental", "maternity", "pharmacy"],
    "pmtiles_path": "points/navii_facilities.pmtiles",
    "source_layer": "navii_facilities",
    "minimum_point_zoom": 0,
    "point_sampling": "none",
    "z0_feature_count": 189800,
    "aggregate_path": "aggregates/navii-z6.geojson",
    "detail_reference": null
  }],
  "files": {"relative/path": {"sha256": "...", "bytes": 1}}
}
```

`files` is the complete payload allowlist. Each key is a relative POSIX path
with no `..`, `_private`, `raw`, `private_rows`, or `representative` segment;
its value has exactly `{sha256: string, bytes: nonnegative integer}`. The loader
must reject a catalog path that fails this allowlist before fetching it, then
verify SHA-256 and byte length after fetching JSON assets. PMTiles uses bounded HTTP Range in the browser; full-file SHA/bytes belongs to local/publication acceptance, not a whole-archive browser fetch. A fetch, digest, or byte mismatch is
an explicit asset error; it must not render as an empty result.

`datasets` contains exactly `navii`, `h17`, and `a38`. Every dataset has
`source_date`, `source`, `status` when applicable, `grain`, and a
`national_totals` object when it has points. Navii totals are keyed by five
`record_kind` codes and each has `mapped_point_count`, `source_record_count`,
`excluded_no_coordinate_count`, and `unique_source_id_count`. H17 totals have
`source_record_count`, `mapped_service_registration_count`,
`excluded_no_coordinate_count`, `duplicate_quarantine_count`, and
`service_type_count`. A38 has `source_date: "2020"` and `status: "STALE"`.
`source_date` is a source snapshot/release date, never a real-time freshness
claim.

The all-zoom point layer remains visible at zoom 0–14. The listed z6 aggregate
GeoJSON remains available for counts; it does not replace visible points. Each Navii cell/category
has `grid_id`, `grid_zoom`, `record_kind`, `mapped_point_count`,
`source_record_count`, and `excluded_no_coordinate_count`. H17 rows additionally
have `service_type`, `mapped_service_registration_count`, and
`duplicate_quarantine_count`. Grid counts are calculated from all mapped source
rows, before PMTiles generation. They are not a count of currently rendered or
sampled points.

Navii point properties in newly built releases are restricted to `source_id`,
`name`, `address`, `prefecture_code`, `municipality_code`, `record_kind`,
`snapshot_date`, and `source`. As of the 2026-09-18 local change, website and
consultation-hour UI/loading are retired. New releases have `detail_buckets: {}`,
`detail_reference: null`, and exactly seven payload files (two point PMTiles,
three A38 PMTiles, two aggregate GeoJSON). They do not copy the 768 hour shards
or three hour schemas. Existing immutable releases are unchanged and remain
readable. Do not interpret the removal as a claim that the source has no hours.

H17 point properties are restricted to `establishment_id`, `name`, `address`,
`prefecture_code`, `prefecture_name`, `municipality_name`, `service_type`,
`source_id`, `source_snapshot_day`, and `geometry_status`. H17 is a service
registration dataset: multiple services may belong to one establishment.
The care popup hides IDs, grain, and geometry-status rows; properties remain
available for internal identity/provenance, and co-located service entries remain separate.

The A38 entries have `pmtiles_path`, matching `source_layer`, `status: STALE`,
and `source_date: 2020`. Their feature grain is a source polygon part; do not
derive medical-area totals from PMTiles feature count or summed attached values.

`publication-manifest.json` supplies exact SHA-256 and bytes for each immutable
payload asset and the catalog. It records only a local review plan; CDN headers,
public URL readback, and deployment are not run.

[`payload-publication-plan.json`](payload-publication-plan.json) expands that
manifest into the complete deployment order: immutable payload assets, catalog,
publication manifest, then `current.json` last. It includes each destination key,
content type, cache control, SHA-256, bytes, and `total_all_publication_bytes`.
It is a local plan only and does not authorize upload.

## Reproduce locally

Run from the isolated frontend worktree. These commands use acquired local assets only; they do not download sources or publish anything.

```sh
python3 scripts/preprocess/build_jp_medical_static_payload.py --source-root /private/tmp/jp-medical-ready-20260913/analytics/data/processed/world/jp_medical_frontend --output-root public/jp-medical
python3 scripts/preprocess/build_jp_medical_static_payload.py --output-root public/jp-medical --write-publication-plan
npm run dev -- --host 127.0.0.1 --port 3737
```

In a second terminal with the preview running:

```sh
python3 scripts/preprocess/verify_jp_medical_local.py --root public/jp-medical --url http://127.0.0.1:3737/jp-medical/
```

The output is ignored by Git and delivered separately. Retain the upstream worktree until these acquired assets have an authorized preservation destination. An older local release directory is not automatically part of the active publication plan.
