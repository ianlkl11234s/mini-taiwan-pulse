# GFW v4 local browser alias setup

The alias script connects an already-built local immutable manifest to the
Mini Taiwan Pulse dev server. It creates only local symlinks and a browser
manifest; upload and deploy remain out of scope.

```sh
python3 scripts/poc/setup_gfw_v4_browser_aliases.py \
  --manifest <release-root>/manifest.json \
  --public-root public
```

The manifest and artifact paths are supplied by arguments so no checkout,
temporary-directory, or credential path is embedded in the script.
