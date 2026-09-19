#!/usr/bin/env bash
set -euo pipefail

# Publish only the production-approved Japan tourism/protection/heritage assets.
# Default mode is read-only preflight. Pass --upload to create missing objects.

UPLOAD=0
if [ "${1:-}" = "--upload" ]; then
  UPLOAD=1
elif [ -n "${1:-}" ]; then
  echo "Usage: $0 [--upload]" >&2
  exit 2
fi

ENV_FILE="${S3_ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

read_env() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(read_env S3_ACCESS_KEY)}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(read_env S3_SECRET_KEY)}"
AWS_REGION="${AWS_DEFAULT_REGION:-$(read_env S3_REGION)}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"
BUCKET="${S3_BUCKET:-$(read_env S3_BUCKET)}"

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$BUCKET" ]; then
  echo "ERROR: S3 credentials or bucket are missing" >&2
  exit 1
fi

FILES=(
  "public/world/jp_accommodation_canonical_allzoom_20260910.pmtiles"
  "public/world/jp_accommodation_density_450m_20260910.pmtiles"
  "public/world/jp_accommodation_density_1500m_20260910.pmtiles"
  "public/world/jp_accommodation_jta_20260331.geojson"
  "public/world/jp_accommodation_local_20260910.geojson"
  "public/world/jp_accommodation_osm_allzoom_20260910.pmtiles"
  "public/world/jp_world_heritage_unesco_current.geojson"
  "public/world/jp_marine_ebsa_moe_coastal_20150101.pmtiles"
)

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: production asset missing: $file" >&2
    exit 1
  fi
done

for file in "${FILES[@]}"; do
  name=$(basename "$file")
  key="deploy-assets/world/$name"
  local_sha256=$(openssl dgst -sha256 "$file" | awk '{print $2}')
  local_bytes=$(wc -c < "$file" | tr -d ' ')
  head_json=$(mktemp)

  if aws s3api head-object --bucket "$BUCKET" --key "$key" --region "$AWS_REGION" >"$head_json" 2>/dev/null; then
    remote_sha256=$(sed -n 's/.*"sha256": "\([^"]*\)".*/\1/p' "$head_json")
    remote_bytes=$(sed -n 's/.*"ContentLength": \([0-9]*\).*/\1/p' "$head_json")
    if [ "$remote_sha256" != "$local_sha256" ] || [ "$remote_bytes" != "$local_bytes" ]; then
      rm -f "$head_json"
      echo "ERROR: refusing to replace immutable world/$name (checksum or size differs)" >&2
      exit 1
    fi
    rm -f "$head_json"
    echo "OK existing world/$name bytes=$local_bytes sha256=$local_sha256"
    continue
  fi
  rm -f "$head_json"

  if [ "$UPLOAD" -ne 1 ]; then
    echo "MISSING world/$name bytes=$local_bytes sha256=$local_sha256"
    continue
  fi

  case "$name" in
    *.pmtiles) content_type="application/vnd.pmtiles" ;;
    *.geojson) content_type="application/geo+json" ;;
    *) echo "ERROR: unsupported asset type: $name" >&2; exit 1 ;;
  esac

  echo "Uploading immutable world/$name..."
  aws s3api put-object \
    --bucket "$BUCKET" \
    --key "$key" \
    --body "$file" \
    --if-none-match '*' \
    --content-type "$content_type" \
    --cache-control "public,max-age=31536000,immutable" \
    --metadata "sha256=$local_sha256" \
    --region "$AWS_REGION" >/dev/null

  remote_sha256=$(aws s3api head-object --bucket "$BUCKET" --key "$key" --region "$AWS_REGION" --query 'Metadata.sha256' --output text)
  remote_bytes=$(aws s3api head-object --bucket "$BUCKET" --key "$key" --region "$AWS_REGION" --query 'ContentLength' --output text)
  if [ "$remote_sha256" != "$local_sha256" ] || [ "$remote_bytes" != "$local_bytes" ]; then
    echo "ERROR: readback failed for world/$name" >&2
    exit 1
  fi
  echo "OK uploaded world/$name bytes=$remote_bytes sha256=$remote_sha256"
done

if [ "$UPLOAD" -eq 0 ]; then
  echo "Preflight only; pass --upload to create missing objects."
fi
