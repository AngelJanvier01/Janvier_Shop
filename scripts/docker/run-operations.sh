#!/bin/sh
set -eu

# The maintenance container runs migrations as root, while the web image runs
# as uid 1001. Private assets must remain unreadable to other users yet be
# readable by both of these JANVIER processes.
proposal_asset_root="/var/lib/janvier/proposal-assets"
product_image_root="/var/lib/janvier/product-images"

case "${JANVIER_OPERATIONS_STORAGE_SCOPE:-all}" in
  product-images)
    mkdir -p "$product_image_root"
    chown janvier:janvier "$product_image_root"
    ;;
  database-only|sicodd-sync)
    # These workers only need PostgreSQL (and, for sync, SICODD); do not grant
    # them an asset volume.
    ;;
  all)
    mkdir -p "$proposal_asset_root" "$product_image_root"
    chown -R janvier:janvier "$proposal_asset_root"
    chown janvier:janvier "$product_image_root"
    ;;
  *)
    echo "Invalid JANVIER_OPERATIONS_STORAGE_SCOPE" >&2
    exit 64
    ;;
esac

exec su-exec janvier "$@"
