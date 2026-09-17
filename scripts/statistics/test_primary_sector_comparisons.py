from pathlib import Path
import importlib.util
p=Path(__file__).with_name('build_primary_sector_comparisons.py');s=importlib.util.spec_from_file_location('p',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def test_latest_uses_newest_selector():
 assert m.latest([{'dimensions':{'quarter':'2025-Q4'},'release_id':'a'},{'dimensions':{'quarter':'2026-Q1'},'release_id':'b'}])['release_id']=='b'
