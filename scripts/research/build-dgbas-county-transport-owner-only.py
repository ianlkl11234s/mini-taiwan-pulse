#!/usr/bin/env python3
"""Materialize the twelve manifest-whitelisted DGBAS county transport releases locally."""

import argparse
import hashlib
import json
from pathlib import Path


ANALYTICS_ROOT = Path("/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics")
RELATIVE_ROOT = Path("data/processed/transportation/dgbas_county_transport_supply")
EXPECTED = {
    "2023-automobile_license_holders_count-0c793677c581": (6849, "7c54c4949270aa4c40789832320ee8052a4db4247b7de5df7bfd802e0f7ae518"),
    "2023-automobile_registered_count-9424c364db39": (6760, "25eaafb6329702d36e47ae5c1c24ab023dee7a349f02046edecc3848f04677ca"),
    "2023-motorcycle_license_holders_count-9cb31eb37a44": (6849, "c4a023e2e715632cc49b6d4028fc49d43ae2f0d740df932cdad34d3f630246f1"),
    "2023-motorcycle_registered_count-bad4618a5ea4": (6766, "57f3537e59881558323573f44e8f739ac449b5021c4a30b5c7a8a1ef95dbc0f6"),
    "2023-offstreet_small_car_parking_spaces_count-9776007d1222": (6924, "47e26126dc4688e11062719c8e6e3ea6cb8efe1ad98079d6c3f4e6c5542e7733"),
    "2023-onstreet_small_car_parking_spaces_count-ed49f8d5232e": (6792, "b8d39057692d72ce0c682579d70d12839c7f496d24d73c7513bcd7230cb8c148"),
    "2024-automobile_license_holders_count-086aa2d30e2e": (6849, "e9dfd57e1b00b86e6943e63599edbc5e46f85ba60f4e725588f1c1237129abc1"),
    "2024-automobile_registered_count-7e0f2b27211e": (6760, "fbfb6b7e6e1e771cf5b7431067fa3b03e83b160987f8af8a6af8b4ffd20b9600"),
    "2024-motorcycle_license_holders_count-232ed00ada32": (6849, "7d48b81efb4699c92dcf1fbf0b4e09b5002407fc835bdd660843dedd13b41a21"),
    "2024-motorcycle_registered_count-1c4533c06350": (6766, "94cd08408138b3eabc141925252ffd75649cf4f3c7776b6c7cb7019d17dd03a9"),
    "2024-offstreet_small_car_parking_spaces_count-530cb5ca2fe3": (6924, "b658d9d3eadbe36237322194ee59bda1c64f5752bec8bc7548e403fde5e20053"),
    "2024-onstreet_small_car_parking_spaces_count-eb02ac90e651": (6793, "589a28c689b07f2083873ab3ba49aa82c1f1153e48a4ae6c9a59d8f9a15b37e5"),
}
BOUNDARY_PATH = Path("public/statistics/county-reference-2025.geojson")
BOUNDARY_SHA256 = "3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fail(code: str) -> None:
    raise ValueError(code)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analytics-root", type=Path, default=ANALYTICS_ROOT)
    parser.add_argument("--output", type=Path, default=Path("../runtime/owner-only/dgbas-county-transport/dgbas-county-transport-owner-only.json"))
    args = parser.parse_args()
    root = args.analytics_root / RELATIVE_ROOT
    manifest = json.loads((root / "_manifest.json").read_text(encoding="utf-8"))
    files = manifest.get("files") if isinstance(manifest, dict) else None
    if manifest.get("dataset_id") != "dgbas_county_transport_supply_10935" or not isinstance(files, list):
        fail("DGBAS_TRANSPORT_MANIFEST_INVALID")
    manifest_by_release = {}
    for entry in files:
        name = entry.get("name") if isinstance(entry, dict) else None
        if not isinstance(name, str) or not name.startswith("releases/") or not name.endswith(".json"):
            fail("DGBAS_TRANSPORT_MANIFEST_INVALID")
        release_id = name.removeprefix("releases/").removesuffix(".json")
        if release_id in manifest_by_release or not isinstance(entry.get("size_bytes"), int) or not isinstance(entry.get("sha256"), str):
            fail("DGBAS_TRANSPORT_MANIFEST_INVALID")
        manifest_by_release[release_id] = entry
    if set(manifest_by_release) != set(EXPECTED):
        fail("DGBAS_TRANSPORT_MANIFEST_RELEASE_DRIFT")

    releases = []
    for release_id in sorted(EXPECTED):
        expected_bytes, expected_sha = EXPECTED[release_id]
        entry = manifest_by_release[release_id]
        if entry["size_bytes"] != expected_bytes or entry["sha256"] != expected_sha:
            fail("DGBAS_TRANSPORT_MANIFEST_RECEIPT_MISMATCH")
        source_path = root / entry["name"]
        data = source_path.read_bytes()
        if len(data) != expected_bytes or digest(data) != expected_sha:
            fail("DGBAS_TRANSPORT_RELEASE_RECEIPT_MISMATCH")
        source = json.loads(data)
        dataset, indicator, release, observations = (source.get(key) for key in ("dataset", "indicator", "release", "observations"))
        if not all(isinstance(value, dict) for value in (dataset, indicator, release)) or not isinstance(observations, list):
            fail("DGBAS_TRANSPORT_RELEASE_INVALID")
        if dataset.get("id") != "dgbas_county_transport_supply_10935" or release.get("id") != release_id or release.get("boundary_version") != "COUNTY_MOI_1140318":
            fail("DGBAS_TRANSPORT_RELEASE_CONTRACT_MISMATCH")
        if len(observations) != 22 or len({item.get("area_code") for item in observations if isinstance(item, dict)}) != 22:
            fail("DGBAS_TRANSPORT_COUNTY_COVERAGE_MISMATCH")
        safe_observations = []
        for item in observations:
            if not isinstance(item, dict) or item.get("area_level") != "county" or not isinstance(item.get("area_code"), str) or not isinstance(item.get("dimensions"), dict) or not isinstance(item["dimensions"].get("roc_year"), str) or not isinstance(item.get("status"), str):
                fail("DGBAS_TRANSPORT_OBSERVATION_INVALID")
            value = item.get("value")
            if item["status"] == "observed":
                if not isinstance(value, (int, float)) or isinstance(value, bool):
                    fail("DGBAS_TRANSPORT_OBSERVATION_INVALID")
            elif value is not None:
                fail("DGBAS_TRANSPORT_OBSERVATION_INVALID")
            safe_observations.append({"area_code": item["area_code"], "dimensions": {"roc_year": item["dimensions"]["roc_year"]}, "value": value, "status": item["status"]})
        releases.append({
            "release_id": release_id, "file_sha256": expected_sha, "file_bytes": expected_bytes,
            "dataset_id": dataset["id"], "indicator_id": indicator.get("id"), "indicator_name": indicator.get("name"), "unit": indicator.get("unit"),
            "period_start": release.get("period_start"), "period_end": release.get("period_end"), "boundary_version": release.get("boundary_version"),
            "raw_sha256": release.get("raw_sha256"), "publisher": release.get("publisher"), "license": release.get("license"),
            "source_landing_url": release.get("source_landing_url"), "source_download_url": release.get("source_download_url"),
            "health": release.get("provenance", {}).get("processing", {}).get("parameters", {}).get("health"), "observations": safe_observations,
        })
    boundary_bytes = BOUNDARY_PATH.read_bytes()
    if digest(boundary_bytes) != BOUNDARY_SHA256:
        fail("DGBAS_TRANSPORT_BOUNDARY_SHA_MISMATCH")
    boundary = json.loads(boundary_bytes)
    features = boundary.get("features") if isinstance(boundary, dict) else None
    if boundary.get("type") != "FeatureCollection" or not isinstance(features, list) or len(features) != 22:
        fail("DGBAS_TRANSPORT_BOUNDARY_INVALID")
    boundaries = {}
    for feature in features:
        properties, geometry = feature.get("properties"), feature.get("geometry")
        code = properties.get("area_code") if isinstance(properties, dict) else None
        if not isinstance(code, str) or code in boundaries or not isinstance(properties.get("area_name"), str) or not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
            fail("DGBAS_TRANSPORT_BOUNDARY_INVALID")
        full_geometry = {"type": "MultiPolygon", "coordinates": [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]}
        boundaries[code] = {"area_name": properties["area_name"], "geometry": full_geometry}
    if any(set(item["area_code"] for item in release["observations"]) != set(boundaries) for release in releases):
        fail("DGBAS_TRANSPORT_BOUNDARY_COUNTY_MISMATCH")
    document = {"schema_version": "pulse-dgbas-county-transport-owner-only/1", "source_manifest": {"dataset_id": manifest["dataset_id"], "manifest_version": manifest.get("manifest_version"), "last_updated": manifest.get("last_updated")}, "releases": releases, "boundary": {"version": "COUNTY_MOI_1140318", "sha256": BOUNDARY_SHA256, "role": "generalized_display_reference", "features_by_code": boundaries}}
    output = args.output.resolve(); output.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")
    output.write_bytes(encoded)
    print(json.dumps({"output": str(output), "sha256": digest(encoded), "bytes": len(encoded), "releases": len(releases), "rows": sum(len(item["observations"]) for item in releases), "geometry": "generalized_reference"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
