#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ ! -d node_modules ]; then
  printf '%s\n' '請先在本目錄執行 npm ci 安裝前端相依套件。' >&2
  exit 1
fi
exec npm run dev
