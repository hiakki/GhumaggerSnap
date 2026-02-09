#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# GhumaggerSnap — Install tunnel tools
# Run this once before using share.sh with Cloudflare option.
#
# localtunnel: auto-installed via npm (no setup needed)
# serveo:      uses ssh (pre-installed on macOS/Linux)
# cloudflared: needs manual install (this script handles it)
# ──────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
err()   { echo -e "${RED}[ERR]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   GhumaggerSnap — Tunnel Tools Setup          ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Check what's already available ────────────
echo -e "${BOLD}Current status:${NC}"
echo ""

# localtunnel
if command -v npx &>/dev/null; then
  ok "localtunnel — available via npx (no install needed)"
else
  warn "localtunnel — needs Node.js/npx (install Node.js from https://nodejs.org)"
fi

# ssh / serveo
if command -v ssh &>/dev/null; then
  ok "serveo (SSH) — ssh is available"
else
  warn "serveo (SSH) — ssh not found"
fi

# cloudflared
if command -v cloudflared &>/dev/null; then
  ok "cloudflared — already installed ($(cloudflared --version 2>&1 | head -1))"
  echo ""
  echo -e "${GREEN}All tools ready! Run ./share.sh to start sharing.${NC}"
  echo ""
  exit 0
fi

warn "cloudflared — NOT installed"
echo ""

# ── Install cloudflared ───────────────────────
echo -e "${BOLD}Installing cloudflared...${NC}"
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    # macOS
    if command -v brew &>/dev/null; then
      info "Installing via Homebrew..."
      brew install cloudflared
    else
      # Direct download
      if [ "$ARCH" = "arm64" ]; then
        DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
      else
        DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
      fi
      info "Downloading cloudflared for macOS ($ARCH)..."
      curl -fsSL "$DL_URL" -o /tmp/cloudflared.tgz
      tar -xzf /tmp/cloudflared.tgz -C /tmp
      sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
      sudo chmod +x /usr/local/bin/cloudflared
      rm -f /tmp/cloudflared.tgz
    fi
    ;;

  Linux)
    if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
      DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    elif echo "$ARCH" | grep -q "arm"; then
      DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
    else
      err "Unsupported architecture: $ARCH"
      echo "  Download manually from: https://github.com/cloudflare/cloudflared/releases"
      exit 1
    fi
    info "Downloading cloudflared for Linux ($ARCH)..."
    curl -fsSL "$DL_URL" -o /tmp/cloudflared
    chmod +x /tmp/cloudflared
    sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
    ;;

  *)
    err "Unsupported OS: $OS"
    echo "  Download manually from: https://github.com/cloudflare/cloudflared/releases"
    exit 1
    ;;
esac

# Verify
if command -v cloudflared &>/dev/null; then
  echo ""
  ok "cloudflared installed! ($(cloudflared --version 2>&1 | head -1))"
else
  err "Installation failed. Download manually from:"
  echo "  https://github.com/cloudflare/cloudflared/releases"
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}All tunnel tools ready!${NC}"
echo ""
echo "  You can now run:"
echo "    ./share.sh          (and pick option 2 for Cloudflare)"
echo ""
echo -e "${BOLD}Summary of tunnel options:${NC}"
echo ""
echo "  1) localtunnel  — npx, no install, custom subdomain (not guaranteed)"
echo "  2) Cloudflare   — cloudflared, no signup, random but reliable URL"
echo "  3) Serveo       — ssh, no install, assigned subdomain"
echo ""
