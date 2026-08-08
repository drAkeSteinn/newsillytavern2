#!/bin/bash
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
exec 3>&1 4>&2
trap '' SIGHUP
trap '' SIGTERM
exec node ./node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0
