#!/bin/sh
# Frontend packaging only. Accommodation PMTiles are immutable handoff artifacts built by
# taipei-gis-analytics; this script must not silently recreate the former sampled z3 product.
set -eu

WORLD_DIR="${1:-public/world}"
MODE="${2:-production}"

require_file() {
  if [ ! -f "$1" ]; then
    echo "Missing input: $1" >&2
    exit 1
  fi
}

build_production() {
  require_file "$WORLD_DIR/jp_accommodation_canonical_allzoom_20260910.pmtiles"
  require_file "$WORLD_DIR/jp_accommodation_osm_allzoom_20260910.pmtiles"
  require_file "$WORLD_DIR/jp_accommodation_density_450m_20260910.pmtiles"
  require_file "$WORLD_DIR/jp_accommodation_density_1500m_20260910.pmtiles"
  require_file "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.pmtiles" \
    -l jp_marine_ebsa_coastal -Z4 -z12 -pf -pk --no-tiny-polygon-reduction-at-maximum-zoom \
    -A 'Ministry of the Environment, Japan; modified display; no government endorsement implied' \
    -y area_detail_url -y area_id -y area_name_en -y feature_id -y filter_layer_id -y freshness_status \
    -y geometry_repaired -y legal_status -y license -y license_status -y municipalities_en \
    -y source_area_value -y source_as_of -y source_url -y usage_status \
    "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.geojson"

  pmtiles verify "$WORLD_DIR/jp_accommodation_canonical_allzoom_20260910.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_accommodation_osm_allzoom_20260910.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_accommodation_density_450m_20260910.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_accommodation_density_1500m_20260910.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.pmtiles"
}

build_research() {
  require_file "$WORLD_DIR/jp_natural_parks_ksj_2010.geojson"
  require_file "$WORLD_DIR/jp_nature_conservation_ksj_2015.geojson"
  require_file "$WORLD_DIR/jp_wildlife_protection_moe_202504.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_natural_parks_ksj_2010.pmtiles" \
    -l jp_natural_parks_ksj_2010 -Z4 -z12 -pf -pk --no-tiny-polygon-reduction-at-maximum-zoom \
    -A 'KSJ A10; non-commercial; historical reference' \
    -y element_code -y element_type -y feature_id -y filter_layer_id -y filter_layer_label_zh \
    -y freshness_status -y geometry_repaired -y license -y license_status -y park_class_code \
    -y park_class_name -y park_code -y park_name -y prefecture_code -y regional_office_code \
    -y source_as_of -y source_url -y usage_status -y zoning_code -y zoning_name \
    "$WORLD_DIR/jp_natural_parks_ksj_2010.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_nature_conservation_ksj_2015.pmtiles" \
    -l jp_nature_conservation_ksj_2015 -Z4 -z12 -pf -pk --no-tiny-polygon-reduction-at-maximum-zoom \
    -A 'KSJ A11; HOLD_LICENSE; local research only' \
    -y area_code -y area_name -y designation_name -y feature_id -y filter_layer_id -y geometry_repaired \
    -y land_sea_code -y legal_class_code -y legal_class_label -y license_note -y precision_warning \
    -y prefecture_code -y source_fiscal_year -y source_remark -y source_status -y source_url -y source_year \
    "$WORLD_DIR/jp_nature_conservation_ksj_2015.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_wildlife_protection_moe_202504.pmtiles" \
    -l jp_wildlife_protection_moe_202504 -Z4 -z12 -pf -pk --no-tiny-polygon-reduction-at-maximum-zoom \
    -A 'Ministry of the Environment, Japan; LICENSE_UNVERIFIED; local research only' \
    -y area_name -y designated_text -y duration_parse_status -y duration_text -y feature_id \
    -y filter_layer_id -y filter_layer_label_zh -y freshness_status -y geometry_repaired \
    -y habitat_category -y license -y license_status -y protection_class -y source_as_of \
    -y source_url -y usage_status "$WORLD_DIR/jp_wildlife_protection_moe_202504.geojson"

  pmtiles verify "$WORLD_DIR/jp_natural_parks_ksj_2010.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_nature_conservation_ksj_2015.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_wildlife_protection_moe_202504.pmtiles"
}

build_production
if [ "$MODE" = "--include-research" ]; then
  build_research
elif [ "$MODE" != "production" ]; then
  echo "Usage: $0 [world_dir] [--include-research]" >&2
  exit 2
fi
