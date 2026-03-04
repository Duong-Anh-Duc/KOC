#!/bin/sh
# ── KOC Server Entrypoint ──
# Manages Xvfb lifecycle properly to prevent zombie processes on container restart.

set -e

# ── 1. Kill any leftover processes from previous crash ──
echo "Cleaning up stale processes..."
rm -f /tmp/.X*-lock /tmp/.X11-unix/X*
kill -9 $(pidof Xvfb) 2>/dev/null || true
kill -9 $(pidof chromium) 2>/dev/null || true
kill -9 $(pidof x11vnc) 2>/dev/null || true
kill -9 $(pidof websockify) 2>/dev/null || true
sleep 1

# ── 2. Run Prisma migrations + seed ──
echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database..."
node dist/prisma/seed.js

# ── 3. Start Xvfb on display :99 (single managed process) ──
echo "Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &
XVFB_PID=$!
export DISPLAY=:99

# Wait briefly for Xvfb to be ready
sleep 1

# Verify Xvfb is running
if ! kill -0 $XVFB_PID 2>/dev/null; then
  echo "ERROR: Xvfb failed to start"
  exit 1
fi
echo "Xvfb started (PID: $XVFB_PID)"

# ── 4. Trap signals to clean up when container stops ──
cleanup() {
  echo "Shutting down..."
  kill $NODE_PID 2>/dev/null || true
  kill $XVFB_PID 2>/dev/null || true
  kill -9 $(pidof chromium) 2>/dev/null || true
  wait $NODE_PID 2>/dev/null
  exit 0
}
trap cleanup 15 2 3

# ── 5. Start Node.js with limited heap (prevent V8 from eating all RAM) ──
echo "Starting Node.js server..."
node --max-old-space-size=512 dist/index.js &
NODE_PID=$!

# ── 6. Wait for Node to exit; if it crashes, cleanup Xvfb before Docker restarts us ──
wait $NODE_PID
NODE_EXIT=$?
echo "Node exited with code $NODE_EXIT - cleaning up before restart..."
kill $XVFB_PID 2>/dev/null || true
kill -9 $(pidof chromium) 2>/dev/null || true
kill -9 $(pidof Xvfb) 2>/dev/null || true
rm -f /tmp/.X*-lock /tmp/.X11-unix/X*
exit $NODE_EXIT
