#!/usr/bin/env bash
# ──────────────────────────────────────────────
# GhumaggerSnap — start script (Linux / macOS)
# Usage: ./start.sh [MEDIA_DIR_PATH]
# ──────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
err()   { echo -e "${RED}[ERR]${NC}   $1"; }

cleanup() {
  info "Shutting down..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── MEDIA_DIR ─────────────────────────────────
# Accept from: 1) command-line arg  2) env var  3) prompt
MEDIA_DIR="${1:-$MEDIA_DIR}"
if [ -z "$MEDIA_DIR" ]; then
  echo ""
  echo -e "${BOLD}GhumaggerSnap — Media Directory Setup${NC}"
  echo ""
  echo "  Point this to the folder containing your trip photos/videos."
  echo "  This can be a local directory, USB drive, or external hard drive."
  echo ""
  echo "  Examples:"
  echo "    /Volumes/SanDisk/TripPhotos"
  echo "    /media/usb/Photos"
  echo "    ~/Pictures/Trips"
  echo ""
  read -p "  Enter media directory path: " MEDIA_DIR
fi

# Expand ~ if present
MEDIA_DIR="${MEDIA_DIR/#\~/$HOME}"

if [ ! -d "$MEDIA_DIR" ]; then
  err "Directory not found: $MEDIA_DIR"
  exit 1
fi

export MEDIA_DIR
ok "Media directory: $MEDIA_DIR"

# ── Check Python ──────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then PYTHON="$cmd"; break; fi
done
if [ -z "$PYTHON" ]; then err "Python 3 is required but not found."; exit 1; fi
info "Using Python: $($PYTHON --version)"

# ── Check Node ────────────────────────────────
if ! command -v node &>/dev/null; then err "Node.js is required but not found."; exit 1; fi
info "Using Node:   $(node --version)"

# ── Backend setup ─────────────────────────────
info "Setting up backend..."
cd "$ROOT/backend"

if [ ! -d "venv" ]; then
  info "Creating Python virtual environment..."
  $PYTHON -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -q -r requirements.txt
ok "Backend dependencies installed"

# ── Frontend setup ────────────────────────────
info "Setting up frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  info "Installing frontend dependencies..."
  npm install --silent
fi
ok "Frontend dependencies installed"

# ── Start servers ─────────────────────────────
echo ""
echo -e "${BOLD}Starting GhumaggerSnap...${NC}"
echo ""

cd "$ROOT/backend"
$PYTHON main.py &
BACKEND_PID=$!
info "Backend  → http://localhost:8000  (PID: $BACKEND_PID)"

sleep 1

cd "$ROOT/frontend"
npx vite --host &
FRONTEND_PID=$!
info "Frontend → http://localhost:3000  (PID: $FRONTEND_PID)"

echo ""
echo -e "${GREEN}${BOLD}✓ GhumaggerSnap is running!${NC}"
echo -e "  Open ${BOLD}http://localhost:3000${NC} in your browser"
echo -e "  Login: ${BOLD}admin / admin${NC}"
echo -e "  Media: ${BOLD}$MEDIA_DIR${NC}"
echo -e "  Press Ctrl+C to stop"
echo ""

wait
