# Public Life & Resilience assets

`manifest.json` is the tracked contract. The GeoJSON and PMTiles payloads are
ignored by Git, copied into this directory for local/browser acceptance, and
mirrored to `deploy-assets/public_life/` by the existing deploy asset scripts.

Run `python3 scripts/preprocess/verify-public-life-assets.py` before upload.
Production publication, deploy, and production browser acceptance remain
separate evidence gates; the manifest status must not be changed to published
without an S3 readback receipt.

The drinking-water, bicycle-support, accessibility, and planned-shelter
PMTiles use a full-density z0-z14 contract: no feature clustering or density
dropping, and every drawable `entity_id` is retained at every zoom. Waste
baskets, recycling points, playgrounds, and visitor centres use complete
point-display GeoJSON with the same one-source-entity/one-display-point rule.
Canonical OSM lines and areas remain unchanged in `taipei-gis-analytics`; the
frontend assets use an interior representative point and record both
`source_geometry_type` and `display_geometry_method` in each rendered feature.

The H3 layer is an OpenStreetMap mapping-density view. It is deliberately not
named or presented as service coverage or accessibility, because it does not
use population or a routable network.
