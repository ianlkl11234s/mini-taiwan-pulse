"""Static checks for the local-only browser alias helper."""

from pathlib import Path


SCRIPT = Path(__file__).with_name("setup_gfw_v4_browser_aliases.py")


def test_alias_setup_has_no_machine_or_secret_literals() -> None:
    source = SCRIPT.read_text(encoding="utf-8")
    assert "/Users/" not in source
    assert "/private/tmp/" not in source
    assert "Bearer ey" not in source
