#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# GhumaggerSnap — Share with friends over the internet
# Usage: ./share.sh [MEDIA_DIR] [USERNAME] [PASSWORD] [TUNNEL_TYPE]
#   TUNNEL_TYPE: 1=localtunnel, 2=cloudflare, 3=serveo
#
# Builds the frontend, runs in production mode (single port),
# and opens a public tunnel. Three methods available:
#   1) localtunnel (npm, zero install)
#   2) Cloudflare Quick Tunnel (needs cloudflared)
#   3) SSH tunnel via serveo.net (needs ssh)
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

# ── Parse args: ./share.sh [MEDIA_DIR] [USERNAME] [PASSWORD] [TUNNEL_TYPE]
MEDIA_DIR="${1:-$MEDIA_DIR}"
ADMIN_USER="${2:-$ADMIN_USER}"
ADMIN_PASS="${3:-$ADMIN_PASS}"
TUNNEL="${4:-$TUNNEL}"

# ── MEDIA_DIR ─────────────────────────────────
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
# Resolve to absolute path
MEDIA_DIR="$(cd "$MEDIA_DIR" && pwd -P)"
export MEDIA_DIR
ok "Media directory: $MEDIA_DIR"

# ── Admin credentials ─────────────────────────
if [ -z "$ADMIN_USER" ] || [ -z "$ADMIN_PASS" ]; then
  echo ""
  echo -e "  ${BOLD}Step 2: Admin Account${NC}"
  echo ""
  [ -z "$ADMIN_USER" ] && read -p "  Enter admin username: " ADMIN_USER
  [ -z "$ADMIN_PASS" ] && read -s -p "  Enter admin password: " ADMIN_PASS
  echo ""
fi

if [ -z "$ADMIN_USER" ] || [ -z "$ADMIN_PASS" ]; then
  err "Username and password cannot be empty."
  exit 1
fi
export ADMIN_USER
export ADMIN_PASS
ok "Admin user: $ADMIN_USER"

# ── Tunnel method selection ───────────────────
if [ -z "$TUNNEL" ]; then
  echo ""
  echo -e "  ${BOLD}Step 3: Choose tunnel method${NC}"
  echo ""
  echo "  1) localtunnel  (default — uses npm, zero extra install)"
  echo "     URL: https://<name>.loca.lt"
  echo ""
  echo "  2) Cloudflare Quick Tunnel  (fast, reliable, no signup)"
  echo "     URL: https://<random>.trycloudflare.com"
  echo "     Requires: cloudflared  (run ./setup-tunnel.sh to install)"
  echo ""
  echo "  3) Serveo SSH Tunnel  (simplest, uses ssh)"
  echo "     URL: https://<assigned>.serveo.net"
  echo "     Requires: ssh (pre-installed on macOS/Linux)"
  echo ""
  read -p "  Enter choice (1/2/3) [1]: " TUNNEL
  TUNNEL="${TUNNEL:-1}"
  echo ""
fi

# For localtunnel, ask for subdomain
if [ "$TUNNEL" = "1" ]; then
  if [ -z "$SUBDOMAIN" ]; then
    echo -e "  ${BOLD}Choose a subdomain (optional)${NC}"
    echo "  Your friends will access: https://<name>.loca.lt"
    echo "  Leave empty for a random URL."
    echo ""
    read -p "  Enter subdomain: " SUBDOMAIN
    echo ""
  fi
fi

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

# ── Validate tunnel tool ─────────────────────
case "$TUNNEL" in
  2)
    if ! command -v cloudflared &>/dev/null; then
      err "'cloudflared' not found. Run: ./setup-tunnel.sh"
      exit 1
    fi
    ok "cloudflared found: $(cloudflared --version 2>&1 | head -1)"
    ;;
  3)
    if ! command -v ssh &>/dev/null; then
      err "'ssh' not found. Install OpenSSH."
      exit 1
    fi
    ok "ssh found"
    ;;
esac

# ── Backend setup ─────────────────────────────
info "Setting up backend..."
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
  info "Creating Python virtual environment..."
  $PYTHON -m venv venv
fi
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

# ── Start backend (production mode) ───────────
echo ""
info "Starting backend in production mode..."
cd "$ROOT/backend"
$VENV_PYTHON main.py &
BACKEND_PID=$!
sleep 2

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  err "Backend failed to start."
  exit 1
fi
ok "Backend running on http://localhost:8000 (PID: $BACKEND_PID)"

# ── Start tunnel ──────────────────────────────
echo ""
info "Starting tunnel..."
echo ""

case "$TUNNEL" in
  # ── Option 1: localtunnel ──────────────────
  1)
    cd "$ROOT/frontend"
    npm install --save-dev localtunnel --silent 2>/dev/null || npm install --save-dev localtunnel

    LT_ARGS="--local-host 127.0.0.1 --port 8000"
    if [ -n "$SUBDOMAIN" ]; then
      LT_ARGS="--subdomain $SUBDOMAIN $LT_ARGS"
    fi

    LT_LOG="/tmp/ghumaggersnap-tunnel-$$.log"
    npx localtunnel $LT_ARGS 2>&1 | tee "$LT_LOG" &
    TUNNEL_PID=$!

    ACTUAL_URL=""
    for i in $(seq 1 15); do
      sleep 1
      ACTUAL_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$LT_LOG" 2>/dev/null | head -1)
      [ -n "$ACTUAL_URL" ] && break
    done

    echo ""
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  GhumaggerSnap is live!${NC}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""
    if [ -n "$ACTUAL_URL" ]; then
      echo -e "  Public URL:  ${BOLD}$ACTUAL_URL${NC}"
      if [ -n "$SUBDOMAIN" ] && ! echo "$ACTUAL_URL" | grep -q "$SUBDOMAIN"; then
        warn "Requested subdomain '$SUBDOMAIN' was not available."
        warn "Got a random URL instead. Try a more unique name next time."
      fi
    else
      echo -e "  ${BOLD}Check above for your public URL (https://xxxxx.loca.lt)${NC}"
    fi
    echo ""
    echo -e "  Note: Friends may see a localtunnel landing page on first visit."
    echo -e "  They just click ${BOLD}\"Click to Continue\"${NC}."
    ;;

  # ── Option 2: Cloudflare Quick Tunnel ──────
  2)
    CF_LOG="/tmp/ghumaggersnap-cf-$$.log"
    cloudflared tunnel --url http://localhost:8000 2>&1 | tee "$CF_LOG" &
    TUNNEL_PID=$!

    ACTUAL_URL=""
    for i in $(seq 1 20); do
      sleep 1
      ACTUAL_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1)
      [ -n "$ACTUAL_URL" ] && break
    done

    echo ""
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  GhumaggerSnap is live!${NC}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""
    if [ -n "$ACTUAL_URL" ]; then
      echo -e "  Public URL:  ${BOLD}$ACTUAL_URL${NC}"
    else
      echo -e "  ${BOLD}Check above for the Cloudflare URL${NC}"
    fi
    ;;

  # ── Option 3: Serveo SSH Tunnel ────────────
  3)
    echo -e "  ${BOLD}Connecting to serveo.net via SSH...${NC}"
    echo ""
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:8000 serveo.net 2>&1 &
    TUNNEL_PID=$!
    sleep 4

    echo ""
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  GhumaggerSnap is live!${NC}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}Check above for your serveo.net URL${NC}"
    ;;

  *)
    err "Invalid tunnel choice: $TUNNEL"
    exit 1
    ;;
esac

echo ""
echo -e "  Share the URL with your friends!"
echo -e "  They log in with: ${BOLD}$ADMIN_USER${NC} / your password"
echo -e "  Media: $MEDIA_DIR"
echo ""
echo -e "  Press Ctrl+C to stop sharing"
echo ""

wait
