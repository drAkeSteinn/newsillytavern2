#!/bin/bash
# Keep the dev server alive - restart if it dies
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000 "; then
    echo "[$(date)] Dev server not running, starting..." >> /home/z/my-project/dev-alive.log
    cd /home/z/my-project
    npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
    disown
    sleep 10
  else
    sleep 5
  fi
done
