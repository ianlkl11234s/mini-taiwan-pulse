> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# V03 local geometry spike — 2026-09-24

## Scope and reproducibility

The first sections record the offline selection spike; the final section records the subsequently implemented browser kernel. Neither invokes an external provider or adds a backend. Browser/MCP acceptance is tracked separately in [V02/V03 acceptance](./acceptance-V02-V03-20260924.md). The executable scratch artifact is [`../runtime/v03-geometry-spike.py`](../../../../../../runtime/v03-geometry-spike.py); its captured result is [`../runtime/v03-geometry-spike-results.json`](../../../../../../runtime/v03-geometry-spike-results.json).

Input: `public/bus/chiayi_bus_routes.json`, 530,765 bytes, SHA-256 `ea6ccd99b9e6a181654323f7d7a800569f1c2a86891fea245bbbed007b79f2a7`, 31 route-direction lines. Engine: Shapely 2.1.2 and pyproj 3.7.2. All metric operations use EPSG:3826; output geometry is transformed back to EPSG:4326.

## Measured route pair

`CYI0128_樂活5路_0` (route UID `CYI0128`, direction 0, 712 vertices) and `CYI0139_樂活9路A_0` (UID `CYI0139`, direction 0, 703 vertices) are distinct route records. Both source LineStrings are valid. Their raw lines do not intersect and are 268.808 m apart. Buffering both with a 200 m round cap and round join produces a valid, non-empty intersection:

| Measure | Result |
| --- | ---: |
| intersection area in EPSG:3826 | 50,163.648 m² |
| intersection boundary length | 1,447.360 m |
| intersection vertices | 68 |
| transformed EPSG:4326 geometry valid | yes |
| transformed vertices | 68 |
| median project-two-lines | 1.588 ms |
| median buffer-two-lines | 33.277 ms |
| median intersection | 0.400 ms |
| median transform-back | 0.372 ms |

This is an algorithm positive only: both inputs describe bus-route corridors from the same source. A buffer derived from one line can also self-overlap, but neither result establishes overlap between two independent thematic polygons or any service-coverage claim.

## Empty-result boundary

The same source contains 34 raw-line empty pairs. For example, `CYI0123_樂活1路_0` and `CYI0128_樂活5路_0` have no direct line intersection and are 254.004 m apart. Under the requested 200 m buffer, however, every one of the 465 route pairs has a non-empty buffer intersection: distance below 400 m is sufficient for two 200 m corridors to meet. There is therefore no truthful `buffered200mEmptyPair` from this artifact; manufacturing one would be incorrect.

## Independent oracle gates

The scratch oracle asserts four topology rules outside the route result:

| Fixture | Required result |
| --- | --- |
| polygon with hole and polygon wholly in that hole | empty intersection |
| two-part MultiPolygon | two parts and area 2 preserved |
| edge-touching polygons | intersects, but area is zero; it is not a positive-area overlap |
| bow-tie polygon | invalid and rejected before overlay; no automatic repair |

All four passed. This keeps topology validity, emptiness, and positive-area eligibility separate.

## Precision and proposed bounded envelope

Rounding this route's WGS84 output to five decimals has a local grid of 1.022 m east by 1.108 m north. Nearest-grid rounding can move a point by up to about 0.753 m diagonally. It is meter-class display precision, unsuitable for parcel boundaries, legal boundaries, or sub-metre overlap claims.

The measured evidence supports only this candidate envelope for a later architecture decision:

1. Accept at most two declared, valid LineString route geometries per operation; reject invalid coordinates before projection. If multipart inputs are later admitted, preserve all parts and cap total vertices explicitly rather than silently selecting one part.
2. Start with at most 800 input vertices per line (the source maximum is 785), a 1–500 m buffer, one projected overlay, and a fixed time/output budget. This spike does not establish a production-wide limit.
3. Return metrics, validity, empty status, CRS, input/source identifiers, and quantization statement. Treat zero area from touching separately from an empty result, and retain source/period/coverage semantics outside the geometry engine.
4. Do not expose the result as an independent-theme or accessibility analysis until the required source contracts and product semantics are separately accepted.

## Browser-kernel bounded evidence

The local browser kernel uses Turf 7.2.0 only. Its buffer method states local azimuthal-equidistant buffering with fixed `steps: 16`; intersection states planar EPSG:4326 coordinate clipping; `area` and `length` state Turf's spherical-geodesic measurement model. It does not claim EPSG:3826 or GEOS metre precision.

Before invoking topology work, it rejects non-Taiwan input, span over 0.5 degrees, more than 1,600 source vertices, or an intersection pair whose combined derived input exceeds 1,600 vertices. It then validates output topology, 8,000 output vertices, and 1 MiB serialized geometry. No source geometry is simplified, truncated, or auto-repaired. Repeated adjacent input vertices are retained and counted.

The original measured pair is an intentional negative gate: Turf's two 200 m buffers have 767 and 1,324 vertices, or 2,091 combined, so intersection fails closed with `SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED`.

A bounded local scan buffered the 31 routes once and considered at most the first route against 30 candidates. It selected a real distinct-UID positive pair: `CYI0119_樂活3路_0` (source 660 vertices; derived 1,046) and `CYI0714_中山快捷(綠B線)B_0` (source 296; derived 552). Their combined derived input is 1,598, so it is accepted. Turf returns a valid Polygon intersection with 207 vertices, 845,865.838 m² area, and 5,051.767 m boundary length.

The independent local EPSG:3826/GEOS oracle in [`../runtime/v03-browser-kernel-oracle.py`](../../../../../../runtime/v03-browser-kernel-oracle.py) returns 845,938.627 m² and 5,051.475 m for the same source pair. Area differs by 0.0086% and boundary length by 0.0058%, both below the 1% guard. This is a model-comparison tolerance only; it does not transfer the projected GEOS precision claim to Turf output.
