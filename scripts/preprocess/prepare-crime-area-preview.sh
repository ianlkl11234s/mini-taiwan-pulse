#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
source="${1:-$root/public/police_justice/crime_area_monthly/crime_area_monthly_20260626.geojson}"
output="$root/public/police_justice/crime_area_monthly/crime_area_monthly.pmtiles"

test -s "$source"
tippecanoe --minimum-zoom=5 --maximum-zoom=12 --layer=crime_area_monthly \
  --no-feature-limit --no-tile-size-limit --no-tiny-polygon-reduction \
  --no-line-simplification --detect-shared-borders --force \
  --output="$output" "$source"
pmtiles verify "$output"
