#!/bin/sh
# Frontend packaging only: convert handoff GeoJSON already copied into public/world.
# This does not fetch or modify the upstream analytics pipeline.
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
  require_file "$WORLD_DIR/jp_accommodation_canonical_20260910.geojson"
  require_file "$WORLD_DIR/jp_accommodation_osm_20260910.geojson"
  require_file "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_accommodation_canonical_20260910.pmtiles" \
    -l jp_accommodation_canonical -Z3 -z14 --drop-densest-as-needed \
    -A 'JTA/local government sources; © OpenStreetMap contributors, ODbL 1.0' \
    -y _provenance -y aliases -y coord_source -y coverage_scope -y dedup_status -y dedup_version \
    -y entity_id -y facility_type -y geom_precision -y license_set -y match_confidence -y name \
    -y review_candidate_count -y source -y source_count -y source_record_count -y source_tier -y sources \
    "$WORLD_DIR/jp_accommodation_canonical_20260910.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_accommodation_osm_20260910.pmtiles" \
    -l jp_accommodation_osm -Z3 -z14 --drop-densest-as-needed \
    -A '© OpenStreetMap contributors, ODbL 1.0' \
    -y accommodation_type -y address -y brand -y coverage_scope -y geom_precision -y geom_status \
    -y geometry_source -y license -y name -y name_en -y operator -y osm_id -y osm_type -y phone \
    -y source_as_of -y source_id -y source_name -y source_url -y website \
    "$WORLD_DIR/jp_accommodation_osm_20260910.geojson"

  tippecanoe --force -o "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.pmtiles" \
    -l jp_marine_ebsa_coastal -Z4 -z12 -pf -pk --no-tiny-polygon-reduction-at-maximum-zoom \
    -A 'Ministry of the Environment, Japan; modified display; no government endorsement implied' \
    -y area_detail_url -y area_id -y area_name_en -y feature_id -y filter_layer_id -y freshness_status \
    -y geometry_repaired -y legal_status -y license -y license_status -y municipalities_en \
    -y source_area_value -y source_as_of -y source_url -y usage_status \
    "$WORLD_DIR/jp_marine_ebsa_moe_coastal_20150101.geojson"

  pmtiles verify "$WORLD_DIR/jp_accommodation_canonical_20260910.pmtiles"
  pmtiles verify "$WORLD_DIR/jp_accommodation_osm_20260910.pmtiles"
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
