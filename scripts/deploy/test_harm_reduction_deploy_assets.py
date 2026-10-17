"""減害服務 public 資產的交付契約（2026-10-06 第二批起含 PMTiles）。

全部檔案 git 管理、由 dist 供檔；nginx 先讀 /data/harm_reduction/ 再 fallback @dist，
pull 端整夾 sync 保留同構。upload 腳本刻意不上傳（S3 前綴空），避免 /data 舊檔蓋過 dist 新版。
"""
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PMTILES = "public/harm_reduction/dui_crash_points.pmtiles"


def test_harm_reduction_asset_transport_contract() -> None:
    pull = (ROOT / "scripts/deploy/pull-deploy-assets.sh").read_text()
    upload = (ROOT / "scripts/deploy/upload-deploy-assets.sh").read_text()
    nginx = (ROOT / "nginx.conf").read_text()

    block = nginx[nginx.index("location /harm_reduction/"):]
    block = block[: block.index("}")]
    assert "root /data;" in block
    assert "try_files $uri @dist;" in block
    assert 'aws s3 sync "$S3/harm_reduction/" "$DATA_DIR/harm_reduction/"' in pull
    assert "public/harm_reduction/" not in upload


def test_harm_reduction_pmtiles_is_git_tracked() -> None:
    ignored = subprocess.run(["git", "check-ignore", "-q", PMTILES], cwd=ROOT)
    assert ignored.returncode == 1, f"{PMTILES} 被 .gitignore 擋住，dist 會缺檔"
    assert (ROOT / PMTILES).stat().st_size < 20 * 1024 * 1024
