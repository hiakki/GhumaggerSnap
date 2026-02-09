@echo off
REM ──────────────────────────────────────────────────────────
REM GhumaggerSnap — Install tunnel tools (Windows)
REM Run this once before using share.bat with Cloudflare option.
REM ──────────────────────────────────────────────────────────
setlocal EnableDelayedExpansion

echo.
echo =============================================
echo   GhumaggerSnap — Tunnel Tools Setup
echo =============================================
echo.

echo Current status:
echo.

REM ── Check npx (localtunnel) ──────────────────
where npx >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK]   localtunnel — available via npx
) else (
    echo [WARN] localtunnel — needs Node.js (https://nodejs.org)
)

REM ── Check ssh (serveo) ───────────────────────
where ssh >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK]   serveo SSH — ssh available
) else (
    echo [WARN] serveo SSH — ssh not found (install Git Bash or enable OpenSSH)
)

REM ── Check cloudflared ────────────────────────
where cloudflared >nul 2>nul
if %ERRORLEVEL%==0 (
    echo [OK]   cloudflared — already installed
    echo.
    echo All tools ready! Run share.bat to start sharing.
    echo.
    pause
    exit /b 0
)

echo [WARN] cloudflared — NOT installed
echo.

REM ── Install cloudflared ──────────────────────
echo Installing cloudflared...
echo.
echo   Option A: Install via winget (recommended)
echo     Open PowerShell and run:
echo       winget install Cloudflare.cloudflared
echo.
echo   Option B: Download manually
echo     https://github.com/cloudflare/cloudflared/releases/latest
echo     Download: cloudflared-windows-amd64.exe
echo     Rename to cloudflared.exe
echo     Move to a folder in your PATH (e.g., C:\Windows\)
echo.

REM Try winget automatically
where winget >nul 2>nul
if %ERRORLEVEL%==0 (
    echo Attempting install via winget...
    winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
    echo.
    where cloudflared >nul 2>nul
    if !ERRORLEVEL!==0 (
        echo [OK]   cloudflared installed successfully!
    ) else (
        echo [WARN] You may need to restart your terminal for cloudflared to be found.
    )
) else (
    echo [INFO] winget not available. Please install cloudflared manually using the links above.
)

echo.
echo =============================================
echo   Tunnel Options Summary
echo =============================================
echo.
echo   1) localtunnel  — uses npm, no install needed
echo   2) Cloudflare   — uses cloudflared, reliable, no signup
echo   3) Serveo       — uses ssh, simplest
echo.
echo   Run share.bat to start sharing!
echo.
pause
