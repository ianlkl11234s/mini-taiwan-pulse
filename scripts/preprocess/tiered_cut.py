"""點圖層分段切圖（低縮放只帶熱區用到的欄位、出點層級起全欄位；點數與座標不變）。

實作在 analytics 的共用工具 `pipelines/shared/tiered_points.py`（單檔、只靠標準函式庫與 tippecanoe／tile-join）；
這裡只負責找到它並用命令列呼叫。找法：環境變數 TIERED_POINTS_PY，否則往上層找同層的 taipei-gis-analytics。
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def find_tool() -> Path:
    given = os.getenv("TIERED_POINTS_PY")
    if given:
        return Path(given)
    for base in Path(__file__).resolve().parents:
        cand = base / "taipei-gis-analytics" / "pipelines" / "shared" / "tiered_points.py"
        if cand.exists():
            return cand
    raise SystemExit("找不到 taipei-gis-analytics/pipelines/shared/tiered_points.py；用 TIERED_POINTS_PY 指定路徑")


def cut(src: Path, out: Path, layer: str, zmin: int, zmax: int, tier: dict, flags: list[str]) -> None:
    """tier={"switch_zoom": 10, "low_fields": [...]}；flags 是原本的 tippecanoe 參數（例 -r1 -pf -pk）。"""
    cmd = [sys.executable, str(find_tool()), "--src", str(src), "--out", str(out), "--layer", layer,
           "--minzoom", str(zmin), "--maxzoom", str(zmax), "--switch-zoom", str(tier["switch_zoom"]),
           "--low-fields", ",".join(tier["low_fields"])]
    cmd += [f"--extra={f}" for f in flags]
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(cmd, check=True)
