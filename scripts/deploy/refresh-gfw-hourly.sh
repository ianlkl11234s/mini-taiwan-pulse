#!/bin/sh
# Mirror only the fixed candidate's seven-day assets, verify, then switch root.
export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"
# OS advisory lock is released automatically on crash/container termination.
GFW_DIR="${GFW_SERVING_DIR:-/data/global-maritime/gfw-hourly}"
mkdir -p "$GFW_DIR" || exit 1
exec flock -n "$GFW_DIR/.refresh.lock" node "$(dirname "$0")/refresh-gfw-hourly.mjs"
