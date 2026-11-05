"""sync_site_assets 守門測試（不連網路）。執行：python3 deploy/cloudflare/test_sync_site_assets.py（或 pytest）。"""
import io
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sync_site_assets as sync  # noqa: E402


def expect_exit(fn, *a):
    try:
        fn(*a)
    except SystemExit:
        return
    raise AssertionError(f"{fn.__name__}{a} 應拒絕")


def test_dest_key_only_site_prefix():
    assert sync.dest_key("/geo/a.pmtiles") == "site/geo/a.pmtiles"
    assert sync.dest_key("/ship_data.json") == "site/ship_data.json"
    expect_exit(sync.assert_site_key, "layers/v1/x.pmtiles")
    expect_exit(sync.assert_site_key, "site/../layers/x")
    expect_exit(sync.dest_key, "/geo/../../etc")
    expect_exit(sync.assert_site_key, "site//x")


def test_env_only_migration_keys():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / ".env"
        p.write_text("R2_ACCESS_KEY_ID=nope\nexport R2_MIGRATION_ACCESS_KEY_ID='yes'\nOTHER=1\n")
        saved = {k: os.environ.pop(k, None) for k in ("R2_ACCESS_KEY_ID", "R2_MIGRATION_ACCESS_KEY_ID", "OTHER")}
        try:
            sync.load_env(p)
            assert os.environ.get("R2_MIGRATION_ACCESS_KEY_ID") == "yes"
            assert "R2_ACCESS_KEY_ID" not in os.environ and "OTHER" not in os.environ
        finally:
            for k, v in saved.items():
                os.environ.pop(k, None)
                if v is not None:
                    os.environ[k] = v


class FakePaginator:
    def __init__(self, pages_fn):
        self.pages_fn = pages_fn

    def paginate(self, **kw):
        return self.pages_fn(**kw)


class FakeS3:
    def __init__(self, keys):
        self.keys, self.listed, self.gets = keys, [], []

    def get_paginator(self, _):
        def pages(Bucket, Prefix, Delimiter=None):
            self.listed.append((Prefix, Delimiter))
            rest = [k for k in self.keys if k.startswith(Prefix)]
            if Delimiter:
                files = [k for k in rest if "/" not in k[len(Prefix):]]
                cps = sorted({Prefix + k[len(Prefix):].split("/")[0] + "/" for k in rest if "/" in k[len(Prefix):]})
                return [{"Contents": [{"Key": k, "Size": 1, "ETag": '"e"'} for k in files],
                         "CommonPrefixes": [{"Prefix": c} for c in cps]}]
            return [{"Contents": [{"Key": k, "Size": 1, "ETag": '"e"'} for k in rest]}]
        return FakePaginator(pages)

    def get_object(self, Bucket, Key):
        self.gets.append(Key)
        return {"Body": io.BytesIO(b"data")}


def test_rotating_excluded():
    s3 = FakeS3(["deploy-assets/ship_data.json", "deploy-assets/geo/a.pmtiles",
                 "deploy-assets/climate/frames/x.png", "deploy-assets/global-maritime/gfw-hourly/m.json"])
    objs = sync.list_s3(s3, "b")
    assert set(objs) == {"deploy-assets/ship_data.json", "deploy-assets/geo/a.pmtiles"}
    assert not any(p.startswith("deploy-assets/climate") or p.startswith("deploy-assets/global-maritime")
                   for p, _ in s3.listed)
    rows = [{"served_path": "/climate/frames/x.png", "s3_key": "deploy-assets/climate/frames/x.png", "size": "1", "etag": "e"},
            {"served_path": "/global-maritime/a", "s3_key": "deploy-assets/global-maritime/a", "size": "1", "etag": "e"},
            {"served_path": "/geo/a.pmtiles", "s3_key": "deploy-assets/geo/a.pmtiles", "size": "1", "etag": "e"}]
    plain, bus, rail, no_key = sync.plan_rows(rows)
    assert [r["served_path"] for r in plain] == ["/geo/a.pmtiles"] and not bus and not rail and not no_key


class FakeR2:
    def __init__(self, heads):
        self.heads, self.puts = heads, []

    def head_object(self, Bucket, Key):
        from botocore.exceptions import ClientError
        if Key not in self.heads:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        size, src = self.heads[Key]
        return {"ContentLength": size, "Metadata": {"src-etag": src}, "ETag": '"x"'}

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None, Config=None):
        self.puts.append((key, ExtraArgs["Metadata"]["src-etag"]))


def test_etag_skip_and_copy():
    rows = [{"served_path": "/geo/same.pmtiles", "s3_key": "deploy-assets/geo/same.pmtiles", "size": "4", "etag": "aaa"},
            {"served_path": "/geo/changed.pmtiles", "s3_key": "deploy-assets/geo/changed.pmtiles", "size": "4", "etag": "new"},
            {"served_path": "/geo/missing.pmtiles", "s3_key": "deploy-assets/geo/missing.pmtiles", "size": "4", "etag": "m"}]
    objs = {r["s3_key"]: {} for r in rows}
    r2 = FakeR2({"site/geo/same.pmtiles": (4, "aaa"), "site/geo/changed.pmtiles": (4, "old")})
    # dry-run：不寫入
    log = sync.sync(rows, FakeS3([]), "b", sync.Writer(r2, "r", False), objs)
    acts = {x[0]: x[2] for x in log}
    assert acts == {"/geo/same.pmtiles": "skip", "/geo/changed.pmtiles": "would-copy", "/geo/missing.pmtiles": "would-copy"}
    assert r2.puts == []
    # execute：只寫兩個不同的檔，且都在 site/ 底下
    log = sync.sync(rows, FakeS3([]), "b", sync.Writer(r2, "r", True), objs)
    assert sorted(r2.puts) == [("site/geo/changed.pmtiles", "new"), ("site/geo/missing.pmtiles", "m")]
    assert {x[0]: x[2] for x in log}["/geo/same.pmtiles"] == "skip"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
