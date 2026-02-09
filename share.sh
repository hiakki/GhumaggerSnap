#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# GhumaggerSnap — Share with friends over the internet
# Usage: ./share.sh [MEDIA_DIR_PATH]
#
# Builds the frontend, runs in production mode (single port),
# and opens a public tunnel via localtunnel (npm).
# No extra installs needed — uses npx (bundled with Node.js).
# ──────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
err()   { echo -e "${RED}[ERR]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }

TUNNEL_PID=""
BACKEND_PID=""

cleanup() {
  echo ""
  info "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$TUNNEL_PID" ]  && kill "$TUNNEL_PID"  2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     GhumaggerSnap — Share with Friends    ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── MEDIA_DIR ─────────────────────────────────
MEDIA_DIR="${1:-$MEDIA_DIR}"
if [ -z "$MEDIA_DIR" ]; then
  echo -e "  ${BOLD}Step 1: Media Directory${NC}"
  echo ""
  echo "  Point this to the folder containing your trip photos/videos."
  echo "  Examples: /Volumes/SanDisk/TripPhotos, ~/Pictures/Trips"
  echo ""
  read -p "  Enter media directory path: " MEDIA_DIR
  echo ""
fi

MEDIA_DIR="${MEDIA_DIR/#\~/$HOME}"

if [ ! -d "$MEDIA_DIR" ]; then
  err "Directory not found: $MEDIA_DIR"
  exit 1
fi
export MEDIA_DIR
ok "Media directory: $MEDIA_DIR"

# ── Admin credentials ─────────────────────────
if [ -z "$ADMIN_USER" ]; then
  echo ""
  echo -e "  ${BOLD}Step 2: Admin Account${NC}"
  echo ""
  read -p "  Enter admin username: " ADMIN_USER
  read -s -p "  Enter admin password: " ADMIN_PASS
  echo ""
fi

if [ -z "$ADMIN_USER" ] || [ -z "$ADMIN_PASS" ]; then
  err "Username and password cannot be empty."
  exit 1
fi
export ADMIN_USER
export ADMIN_PASS
ok "Admin user: $ADMIN_USER"

# ── Subdomain (for stable URL) ────────────────
echo ""
echo -e "  ${BOLD}Step 3: Choose a subdomain (for a stable URL)${NC}"
echo ""
echo "  Pick a unique name so your URL stays the same each time."
echo "  Your friends will access:  https://<name>.loca.lt"
echo ""
echo "  Leave empty for a random URL."
echo ""
read -p "  Enter subdomain (e.g. ghumaggersnap): " SUBDOMAIN
echo ""

# ── Check Python ──────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then PYTHON="$cmd"; break; fi
done
if [ -z "$PYTHON" ]; then err "Python 3 is required."; exit 1; fi
info "Using Python: $($PYTHON --version)"

# ── Check Node ────────────────────────────────
if ! command -v node &>/dev/null; then err "Node.js is required."; exit 1; fi
if ! command -v npx &>/dev/null; then err "npx is required (comes with Node.js)."; exit 1; fi
info "Using Node:   $(node --version)"

# ── Backend setup ─────────────────────────────
info "Setting up backend..."
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
  info "Creating Python virtual environment..."
  $PYTHON -m venv venv
fi
# Use venv pip/python directly (avoids activate issues across shells)
VENV_PIP="$ROOT/backend/venv/bin/pip"
VENV_PYTHON="$ROOT/backend/venv/bin/python3"
[ ! -f "$VENV_PIP" ] && VENV_PIP="$ROOT/backend/venv/Scripts/pip"
[ ! -f "$VENV_PYTHON" ] && VENV_PYTHON="$ROOT/backend/venv/Scripts/python"
$VENV_PIP install -q -r requirements.txt
ok "Backend ready"

# ── Frontend build ────────────────────────────
info "Building frontend for production..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  info "Installing frontend dependencies..."
  npm install --silent
fi
npx vite build
ok "Frontend built → frontend/dist/"

# ── Install localtunnel ───────────────────────
info "Installing localtunnel..."
cd "$ROOT/frontend"
npm install --save-dev localtunnel --silent 2>/dev/null || npm install --save-dev localtunnel
ok "localtunnel ready"

# ── Start backend (production mode) ───────────
echo ""
info "Starting backend in production mode..."
cd "$ROOT/backend"
$VENV_PYTHON main.py &
BACKEND_PID=$!
sleep 2

# Quick health check
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  err "Backend failed to start."
  exit 1
fi
ok "Backend running on http://localhost:8000 (PID: $BACKEND_PID)"

# ── Start tunnel ──────────────────────────────
echo ""
info "Starting public tunnel..."

LT_ARGS="--local-host 127.0.0.1 --port 8000"
if [ -n "$SUBDOMAIN" ]; then
  LT_ARGS="--subdomain $SUBDOMAIN $LT_ARGS"
fi

cd "$ROOT/frontend"

# Start localtunnel, capture output to extract the actual URL
LT_LOG="/tmp/ghumaggersnap-tunnel-$$.log"
npx localtunnel $LT_ARGS 2>&1 | tee "$LT_LOG" &
TUNNEL_PID=$!

# Wait and extract the actual URL localtunnel gave us
ACTUAL_URL=""
for i in $(seq 1 15); do
  sleep 1
  ACTUAL_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$LT_LOG" 2>/dev/null | head -1)
  [ -n "$ACTUAL_URL" ] && break
done

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  GhumaggerSnap is live and shared!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
if [ -n "$ACTUAL_URL" ]; then
  echo -e "  Public URL:  ${BOLD}$ACTUAL_URL${NC}"
  if [ -n "$SUBDOMAIN" ] && ! echo "$ACTUAL_URL" | grep -q "$SUBDOMAIN"; then
    warn "Requested subdomain '$SUBDOMAIN' was not available."
    warn "You got a random URL instead. Try a more unique subdomain next time."
  fi
else
  echo -e "  ${BOLD}Check above for your public URL${NC}"
  warn "Could not detect tunnel URL. It may still be connecting..."
fi
echo ""
echo -e "  Share this URL with your friends!"
echo -e "  They log in with: ${BOLD}$ADMIN_USER${NC} / your password"
echo ""
echo -e "  Note: On first visit, friends may see a localtunnel"
echo -e "  reminder page — they just click ${BOLD}\"Click to Continue\"${NC}."
echo ""
echo -e "  Media: $MEDIA_DIR"
echo -e "  Press Ctrl+C to stop sharing"
echo ""

wait
