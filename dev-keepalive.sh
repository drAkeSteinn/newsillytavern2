#!/bin/bash
while true; do
  node ./node_modules/.bin/next dev -p 3000 --hostname 0.0.0.0
  echo "Server crashed, restarting in 3 seconds..."
  sleep 3
done
