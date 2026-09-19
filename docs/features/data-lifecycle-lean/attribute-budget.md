# Japan medical display-point attribute budget (sample only)

Read-only sample: first 1,000 newline-delimited features from the upstream worktree on 2026-09-18. Navii sample was 438,340 bytes; H17 sample was 486,566 bytes. Source files were 74 MiB (Navii) and 99 MiB (H17). These are not whole-file estimates.

| stream | sampled property keys | Pulse consumer keys |
| --- | --- | --- |
| Navii | `address`, `detail_bucket`, `municipality_code`, `name`, `prefecture_code`, `record_kind`, `snapshot_date`, `source`, `source_id`, `website` | popup: `name`, `record_kind`, `address`, `snapshot_date`, `source_id`; map filter: `record_kind` |
| H17 | `address`, `establishment_id`, `geometry_status`, `municipality_name`, `name`, `prefecture_code`, `prefecture_name`, `service_type`, `source_id`, `source_snapshot_day` | popup: `name`, `service_type`, `address`, `source_snapshot_day`; map filter: `service_type`; `source_id` retains provenance/dedup identity |

`source` (Navii) and H17 administrative/geometry descriptive fields have no direct Pulse popup or map-style consumer in this audit, but no deletion candidate is approved: they may preserve lineage, diagnostic geometry status, or downstream identity context. `detail_bucket` and `website` were not found in the popup but require an explicit provenance/detail contract review before removal. Geometry, null values, source IDs, and provenance fields remain untouched. No new detail API is proposed.
