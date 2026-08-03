#!/bin/sh
set -eu

# The maintenance container runs migrations as root, while the web image runs
# as uid 1001. Private assets must remain unreadable to other users yet be
# readable by both of these JANVIER processes.
asset_root="/var/lib/janvier/proposal-assets"
mkdir -p "$asset_root"
chown -R janvier:janvier "$asset_root"

exec su-exec janvier "$@"
