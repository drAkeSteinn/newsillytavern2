#!/bin/bash
while true; do
  bunx --bun next dev -p 3000 -H 0.0.0.0
  echo "Server died, restarting in 2 seconds..."
  sleep 2
done
