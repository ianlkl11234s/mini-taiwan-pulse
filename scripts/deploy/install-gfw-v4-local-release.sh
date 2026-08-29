#!/bin/sh
# 將已驗證的 v4 release 安裝到 repo 內可持久的 public root；不接受 /private/tmp
# 的 POC，且不覆寫 immutable release。manifest 僅在全部 bytes/SHA-256 通過後 tmp+mv。

set -eu

SOURCE_DIR=${1:?"usage: $0 <verified-v4-release-dir> [public-v4-root]"}
TARGET_DIR=${2:-public/global-maritime/gfw-hourly/v4}

case "$SOURCE_DIR" in
  /private/tmp/*)
    echo "refusing ephemeral /private/tmp input; place the verified release in a durable directory first" >&2
    exit 2
    ;;
esac

MANIFEST="$SOURCE_DIR/manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "missing v4 manifest: $MANIFEST" >&2
  exit 2
fi

RELEASE_ID=$(node - "$MANIFEST" "$SOURCE_DIR" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const [manifestPath, root] = process.argv.slice(2);
const fail = (message) => { console.error(`invalid formal GFW v4 release: ${message}`); process.exit(2); };
const readJson = (file, label) => {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
    return value;
  } catch { fail(`${label} is not JSON`); }
};
const rootManifest = readJson(manifestPath, "root manifest");
if (rootManifest.schema_version !== 4 || rootManifest.poc === true || rootManifest.shadow_only === true || rootManifest.production_cutover === false) {
  fail("root requires formal schema_version=4, never a POC/shadow manifest");
}
const releaseId = rootManifest.release_id;
if (typeof releaseId !== "string" || !/^\d{4}-\d{2}-\d{2}__[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(releaseId)) fail("invalid release_id");
if (rootManifest.selected_utc_date !== releaseId.slice(0, 10)) fail("root selected_utc_date/release_id mismatch");
const pointer = rootManifest.release_manifest;
const releaseManifestPath = `releases/${releaseId}/manifest.json`;
if (!pointer || typeof pointer !== "object" || Array.isArray(pointer) || pointer.path !== releaseManifestPath ||
    !Number.isInteger(pointer.bytes) || pointer.bytes < 0 || typeof pointer.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(pointer.sha256)) {
  fail("root must only point to immutable releases/<id>/manifest.json with bytes/SHA-256");
}
const releaseManifestLocal = path.resolve(root, pointer.path);
if (!releaseManifestLocal.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(releaseManifestLocal)) fail("missing immutable release manifest");
const releaseManifestBytes = fs.readFileSync(releaseManifestLocal);
if (releaseManifestBytes.byteLength !== pointer.bytes || crypto.createHash("sha256").update(releaseManifestBytes).digest("hex") !== pointer.sha256.toLowerCase()) {
  fail("release manifest bytes/SHA-256 mismatch root pointer");
}
const manifest = readJson(releaseManifestLocal, "release manifest");
if (manifest.schema_version !== 4 || manifest.release_id !== releaseId || manifest.selected_utc_date !== releaseId.slice(0, 10)) {
  fail("release manifest schema/release identity mismatch");
}
const requiredTopLevel = ["schema_version", "release_id", "selected_utc_date", "bbox", "source_dataset_id", "resolved_dataset_version", "days", "grid", "tracks", "fishing_effort", "layer_separation", "artifacts", "release_truth"];
if (!requiredTopLevel.every((key) => Object.prototype.hasOwnProperty.call(manifest, key)) ||
    !Array.isArray(manifest.bbox) || manifest.bbox.length !== 4 || manifest.bbox.some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    typeof manifest.source_dataset_id !== "string" || manifest.source_dataset_id.length === 0 ||
    typeof manifest.resolved_dataset_version !== "string" || manifest.resolved_dataset_version.length === 0 ||
    !Array.isArray(manifest.days) || !manifest.grid || !manifest.tracks || !manifest.fishing_effort || !manifest.layer_separation || !manifest.release_truth) {
  fail("release manifest required top-level contract");
}
const same = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, i) => value === expected[i]);
if (!same(manifest.tracks.buckets, ["FISHING", "CARGO", "PASSENGER", "CARRIER", "OTHER", "UNKNOWN"]) ||
    !same(manifest.tracks.default_buckets, ["FISHING", "CARGO", "PASSENGER"]) ||
    manifest.taxonomy?.tanker !== "quarantine" || manifest.taxonomy?.carrier !== "independent_default_off" ||
    manifest.taxonomy?.gear_fad !== "independent_non_vessel_observation") {
  fail("tracks taxonomy must preserve six buckets, quarantine TANKER, and exclude GEAR/FAD from vessels");
}
if (manifest.layer_separation.grid !== "gfwHourlyGrid" || manifest.layer_separation.tracks !== "gfwHourlyTracks" ||
    manifest.layer_separation.fishing_effort !== "gfwFishingEffort" || manifest.layer_separation.dark_vessels !== "gfwDarkVessels" ||
    manifest.release_truth.tier1_status !== "passed" || manifest.release_truth.tier2_status !== "passed" || manifest.release_truth.readback_status !== "passed") {
  fail("release layer separation or gate truth is incomplete");
}
const assets = manifest.artifacts;
if (!Array.isArray(assets) || assets.length === 0) fail("no immutable artifacts");
const allowedTypes = new Set(["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket", "grid_hour_pmtiles", "grid_detail_bucket", "fishing_effort_day", "gear_observations"]);
const requiredTypes = ["tracks_day_pmtiles", "track_frame_pmtiles", "track_detail_bucket", "grid_hour_pmtiles", "grid_detail_bucket", "fishing_effort_day"];
if (!requiredTypes.every((type) => assets.some((asset) => asset?.type === type))) fail("missing required v4 artifact type");
for (const asset of assets) {
  if (!asset || typeof asset !== "object" || !allowedTypes.has(asset.type) || typeof asset.path !== "string" || !asset.path.startsWith(`releases/${releaseId}/`) ||
      asset.path.includes("..") || !Number.isInteger(asset.bytes) || asset.bytes < 0 ||
      !Number.isInteger(asset.content_length) || asset.content_length !== asset.bytes || typeof asset.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/i.test(asset.sha256) || asset.etag !== `"${asset.sha256}"` ||
      typeof asset.content_type !== "string" || asset.content_type.length === 0 ||
      !asset.semantic_counts || typeof asset.semantic_counts !== "object" || Array.isArray(asset.semantic_counts)) fail("artifact path/type/bytes/SHA-256/headers/semantic-counts contract");
  const local = path.resolve(root, asset.path);
  if (!local.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(local)) fail(`missing ${asset.path}`);
  const bytes = fs.readFileSync(local);
  if (bytes.byteLength !== asset.bytes) fail(`byte mismatch ${asset.path}`);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256.toLowerCase()) fail(`SHA-256 mismatch ${asset.path}`);
  if (asset.type === "track_frame_pmtiles") {
    const counts = asset.semantic_counts;
    const spatial = asset.spatial_contract;
    if (asset.content_type !== "application/octet-stream" || asset.content_encoding !== "identity" ||
        !counts || typeof counts !== "object" || Array.isArray(counts) ||
        typeof counts.observed_at !== "string" || counts.observed_at.length === 0 ||
        typeof counts.bucket !== "string" || counts.bucket.length === 0 ||
        !Number.isInteger(counts.feature_count) || counts.feature_count < 0 ||
        !spatial || typeof spatial !== "object" || Array.isArray(spatial) ||
        spatial.fixed_zoom !== 6 || !Number.isInteger(spatial.source_feature_count) ||
        spatial.source_feature_count < 0 || spatial.decoded_feature_count !== spatial.source_feature_count ||
        counts.feature_count !== spatial.source_feature_count || spatial.identity_duplicate_count !== 0 ||
        spatial.identity_missing_count !== 0) {
      fail(`track_frame_pmtiles must be identity/no-drop fixed-z6 PMTiles: ${asset.path}`);
    }
  }
}
process.stdout.write(releaseId);
NODE
)

SOURCE_RELEASE="$SOURCE_DIR/releases/$RELEASE_ID"
TARGET_RELEASES="$TARGET_DIR/releases"
TARGET_RELEASE="$TARGET_RELEASES/$RELEASE_ID"
if [ ! -d "$SOURCE_RELEASE" ] || [ -e "$TARGET_RELEASE" ]; then
  echo "source release missing or immutable target already exists: $RELEASE_ID" >&2
  exit 2
fi

mkdir -p "$TARGET_RELEASES"
TEMP_RELEASE="$TARGET_RELEASES/$RELEASE_ID.tmp.$$"
cp -R "$SOURCE_RELEASE" "$TEMP_RELEASE"
mv "$TEMP_RELEASE" "$TARGET_RELEASE"
cp "$MANIFEST" "$TARGET_DIR/manifest.json.tmp"
mv "$TARGET_DIR/manifest.json.tmp" "$TARGET_DIR/manifest.json"
echo "installed verified GFW v4 release $RELEASE_ID → $TARGET_DIR"
