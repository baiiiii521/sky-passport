#!/usr/bin/env bash
# Local self-healing check, run every 2 minutes by sky-watch.timer: restarts a service that stopped answering
# (systemd already restarts crashed ones; this catches hung ones). Results go to the journal: journalctl -t sky-watch
# The outside check (and the e-mail when the site is down) is the GitHub workflow .github/workflows/monitor.yml.
log() { logger -t sky-watch "$*"; }
ok() { curl -fsS -m 10 -o /dev/null "$1"; }
if ! ok http://127.0.0.1:3100/api/health; then log "api not answering, restarting sky-passport"; systemctl restart sky-passport; fi
code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3102/api/video/000000000000000000000000)
if [ "$code" != "404" ]; then
  # a long render keeps the event loop free, so a missing answer means the process is stuck
  log "render service answered '$code', restarting sky-passport-render"; systemctl restart sky-passport-render
fi
if ! ok http://127.0.0.1:8088/index.html; then log "nginx not answering, restarting nginx"; nginx -t -q && systemctl restart nginx; fi
use=$(df --output=pcent / | tail -1 | tr -dc 0-9); [ "${use:-0}" -ge 90 ] && log "disk ${use}% full"
avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo); [ "${avail:-9999}" -lt 300 ] && log "low memory: ${avail} MB available"
exit 0
