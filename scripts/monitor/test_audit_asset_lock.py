"""audit_asset_lock 純函式測試（不連網路）。執行：python3 scripts/monitor/test_audit_asset_lock.py"""
import datetime as dt
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_asset_lock as a  # noqa: E402

E = [{"path": f"public/geo/f{i:02d}.pmtiles", "bytes": 100 + i, "sha256": "x"} for i in range(10)]


def test_url_of_encodes_segments():
    assert a.url_of("https://d/site/", "public/geo/a b.pmtiles") == "https://d/site/geo/a%20b.pmtiles"


def test_classify_head():
    e = {"bytes": 10}
    assert a.classify_head(e, 200, 10) == "OK"
    assert a.classify_head(e, 200, 11).startswith("SIZE(11")
    assert a.classify_head(e, 404, None) == "HTTP 404"
    assert a.classify_head(e, 0, None) == "HTTP 0"
    assert a.classify_head(e, 200, None) == "沒有 Content-Length"


def test_sha_sample_rotates_and_covers_all():
    seen = set()
    for d in range(5):
        pick = a.sha_sample(E, 2, dt.date(2026, 11, 10) + dt.timedelta(days=d))
        assert len(pick) == 2
        seen.update(p["path"] for p in pick)
    assert len(seen) == 10
    assert a.sha_sample(E, 0, dt.date(2026, 11, 10)) == []
    assert len(a.sha_sample(E, 50, dt.date(2026, 11, 10))) == 10


def test_not_in_lock_and_judge_reverse():
    refs = {"/geo/a.pmtiles", "/world/jp_major_roads.pmtiles", "/geo/new.pmtiles"}
    cand = a.not_in_lock(refs, {"public/geo/a.pmtiles"})
    assert cand == ["/geo/new.pmtiles", "/world/jp_major_roads.pmtiles"]
    new, stale = a.judge_reverse(cand, {"/world/jp_major_roads.pmtiles", "/geo/gone.pmtiles"})
    assert new == ["/geo/new.pmtiles"]
    assert stale == ["/geo/gone.pmtiles"]


def test_read_baseline():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d, "b.txt")
        p.write_text("# 註解\npublic/world/jp_major_roads.pmtiles\n\n")
        assert a.read_baseline(p) == {"/world/jp_major_roads.pmtiles"}
        p.write_text("world/x.pmtiles\n")
        try:
            a.read_baseline(p)
        except SystemExit:
            pass
        else:
            raise AssertionError("沒有 public/ 開頭應拒絕")


def test_repo_baseline_is_sorted_and_unique():
    lines = [l for l in a.BASELINE.read_text().splitlines() if l and not l.startswith("#")]
    assert lines == sorted(set(lines))


def test_referenced_paths_skips_rotating_and_non_data():
    with tempfile.TemporaryDirectory() as d:
        src = Path(d, "src")
        src.mkdir()
        (src / "x.ts").write_text(
            'const a = "/geo/a.pmtiles"; const b = "/climate/frames/manifest.json"; const c = "/geo/readme.md"; '
            'const t = `/geo/${k}.pmtiles`;'
        )
        assert a.referenced_paths(Path(d)) == {"/geo/a.pmtiles"}


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
