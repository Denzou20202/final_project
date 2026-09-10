#!/bin/sh
# Renews the Let's Encrypt certificate for veloxdesk.pp.ua and reloads
# nginx so it picks up the new files. `certbot renew` is a safe no-op
# unless the cert is within 30 days of expiry — scheduled twice daily via
# the launchd agent at ~/Library/LaunchAgents/com.veloxdesk.certbot-renew.plist
# (macOS's cron is TCC-gated and refused to run this reliably; launchd
# doesn't have that problem), though it's harmless to run by hand too.
#
# The scheduled copy launchd actually runs lives at
# ~/.local/bin/veloxdesk-certbot-renew.sh, NOT this repo path — launchd
# couldn't even read this file to execute it here, since ~/Documents is one
# of macOS's TCC-protected folders and the launchd process has no grant for
# it. Keep both copies in sync if this script ever changes.
#
# Uses the same named volumes docker-compose.prod.yml mounts into the web
# service (certbot_www for the ACME HTTP-01 challenge, certbot_certs for
# the certificate itself) — nginx reads certs from there read-only, this
# script (via a fresh certbot container) is the only writer.
set -e
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

docker run --rm \
  -v veloxdesk_certbot_www:/var/www/certbot \
  -v veloxdesk_certbot_certs:/etc/letsencrypt \
  certbot/certbot renew --quiet

# Reload (not restart) — re-reads config and certs with zero dropped
# connections. Cheap enough to run unconditionally, whether or not a
# renewal actually happened this time.
#
# Checked explicitly rather than just letting a missing container fail
# `docker exec` under `set -e` — the renewal above already committed by
# this point (a fresh cert may already be sitting in the volume), so a
# silent, unexplained non-zero exit here would be indistinguishable from
# the renewal itself failing. Twice-daily cadence and Let's Encrypt's own
# 30-day expiry buffer make this low-stakes either way, but worth a clear
# log line instead of guessing later why a run "failed".
if docker ps --format '{{.Names}}' | grep -qx 'veloxdesk-web-1'; then
  docker exec veloxdesk-web-1 nginx -s reload
else
  echo "certbot-renew: veloxdesk-web-1 is not running — renewal (if any) succeeded, but nginx was not reloaded" >&2
fi
