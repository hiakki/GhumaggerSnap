@echo off
REM ──────────────────────────────────────────────────────────
REM GhumaggerSnap — Share with friends over the internet
REM Usage: share.bat [MEDIA_DIR] [USERNAME] [PASSWORD]
REM ──────────────────────────────────────────────────────────
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo =============================================
echo   GhumaggerSnap — Share with Friends
echo =============================================
echo.

REM ── Parse args: share.bat [MEDIA_DIR] [USERNAME] [PASSWORD]
if not "%~1"=="" set "MEDIA_DIR=%~1"
if not "%~2"=="" set "ADMIN_USER=%~2"
if not "%~3"=="" set "ADMIN_PASS=%~3"

REM ── MEDIA_DIR ─────────────────────────────────
if "%MEDIA_DIR%"=="" (
    echo   Step 1: Media Directory
    echo.
    echo   Examples: D:\TripPhotos, E:\DCIM\Camera
    echo.
    set /p "MEDIA_DIR=  Enter media directory path: "
)

if "%MEDIA_DIR:~-1%"=="\" set "MEDIA_DIR=%MEDIA_DIR:~0,-1%"
if "%MEDIA_DIR:~-1%"=="/" set "MEDIA_DIR=%MEDIA_DIR:~0,-1%"

if not exist "%MEDIA_DIR%\" (
    echo [ERR] Directory not found: %MEDIA_DIR%
    pause
    exit /b 1
)
echo [OK]   Media directory: %MEDIA_DIR%

REM ── Admin credentials ─────────────────────────
if "%ADMIN_USER%"=="" (
    echo.
    echo   Step 2: Admin Account
    echo.
    set /p "ADMIN_USER=  Enter admin username: "
    set /p "ADMIN_PASS=  Enter admin password: "
)
if "%ADMIN_USER%"=="" ( echo [ERR] Username cannot be empty. & pause & exit /b 1 )
if "%ADMIN_PASS%"=="" ( echo [ERR] Password cannot be empty. & pause & exit /b 1 )
echo [OK]   Admin user: %ADMIN_USER%

REM ── Tunnel method ─────────────────────────────
echo.
echo   Step 3: Choose tunnel method
echo.
echo   1) localtunnel   (default, uses npm, zero extra install)
echo   2) Cloudflare     (needs cloudflared - run setup-tunnel.bat)
echo   3) Serveo SSH     (needs ssh / Git Bash)
echo.
if "%TUNNEL%"=="" set /p "TUNNEL=  Enter choice (1/2/3) [1]: "
if "%TUNNEL%"=="" set "TUNNEL=1"

if "%TUNNEL%"=="1" (
    if "%SUBDOMAIN%"=="" (
        echo.
        echo   Choose a subdomain (optional, leave empty for random)
        set /p "SUBDOMAIN=  Enter subdomain: "
    )
)

REM ── Check Python + Node ───────────────────────
where python >nul 2>nul || ( echo [ERR] Python 3 required. & pause & exit /b 1 )
where node >nul 2>nul || ( echo [ERR] Node.js required. & pause & exit /b 1 )

if "%TUNNEL%"=="2" (
    where cloudflared >nul 2>nul || ( echo [ERR] cloudflared not found. Run setup-tunnel.bat & pause & exit /b 1 )
)
if "%TUNNEL%"=="3" (
    where ssh >nul 2>nul || ( echo [ERR] ssh not found. Install OpenSSH or Git Bash. & pause & exit /b 1 )
)

REM ── Backend setup ─────────────────────────────
echo [INFO] Setting up backend...
cd /d "%ROOT%backend"
if not exist "venv" ( python -m venv venv )
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo [OK]   Backend ready

REM ── Frontend build ────────────────────────────
echo [INFO] Building frontend...
cd /d "%ROOT%frontend"
if not exist "node_modules" ( call npm install --silent )
call npx vite build
echo [OK]   Frontend built

REM ── Start backend ─────────────────────────────
echo [INFO] Starting backend...
cd /d "%ROOT%backend"
start "GhumaggerSnap-Backend" /min cmd /c "set MEDIA_DIR=%MEDIA_DIR% && set ADMIN_USER=%ADMIN_USER% && set ADMIN_PASS=%ADMIN_PASS% && venv\Scripts\activate.bat && python main.py"
timeout /t 3 /nobreak >nul
echo [OK]   Backend running on http://localhost:8000

REM ── Start tunnel ──────────────────────────────
echo.
echo =============================================
echo   Starting tunnel...
echo =============================================
echo.
echo   Share the URL with your friends!
echo   Login: %ADMIN_USER% / [your password]
echo   Media: %MEDIA_DIR%
echo.
echo   Close this window to stop sharing.
echo =============================================
echo.

cd /d "%ROOT%frontend"

if "%TUNNEL%"=="1" (
    call npm install --save-dev localtunnel --silent
    if not "%SUBDOMAIN%"=="" (
        npx localtunnel --subdomain %SUBDOMAIN% --local-host 127.0.0.1 --port 8000
    ) else (
        npx localtunnel --local-host 127.0.0.1 --port 8000
    )
)

if "%TUNNEL%"=="2" (
    cloudflared tunnel --url http://localhost:8000
)

if "%TUNNEL%"=="3" (
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:8000 serveo.net
)

pause
