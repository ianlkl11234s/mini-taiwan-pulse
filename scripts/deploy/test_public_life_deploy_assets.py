from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_public_life_asset_transport_contract() -> None:
    upload = (ROOT / "scripts/deploy/upload-deploy-assets.sh").read_text()
    pull = (ROOT / "scripts/deploy/pull-deploy-assets.sh").read_text()
    nginx = (ROOT / "nginx.conf").read_text()

    assert "public/public_life/*.geojson" in upload
    assert "public/public_life/*.pmtiles" in upload
    assert 'deploy-assets/public_life/' not in upload  # prefix is composed from variables
    assert '$PREFIX/public_life/$name' in upload
    assert 'aws s3 sync "$S3/public_life/" "$DATA_DIR/public_life/"' in pull
    assert 'location /public_life/' in nginx
    assert "try_files $uri @dist;" in nginx
