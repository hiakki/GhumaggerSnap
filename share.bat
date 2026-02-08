@echo off
REM ──────────────────────────────────────────────────────────
REM GhumaggerSnap — Share with friends over the internet
REM Usage: share.bat [MEDIA_DIR_PATH]
REM
REM Uses localtunnel (npm) — no extra installs needed.
REM ──────────────────────────────────────────────────────────
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo =============================================
echo   GhumaggerSnap — Share with Friends
echo =============================================
echo.

REM ── MEDIA_DIR ─────────────────────────────────
if not "%~1"=="" (
    set "MEDIA_DIR=%~1"
) else if "%MEDIA_DIR%"=="" (
    echo   Step 1: Media Directory
    echo.
    echo   Point this to the folder containing your trip photos/videos.
    echo   Examples: D:\TripPhotos, E:\DCIM\Camera
    echo.
    set /p "MEDIA_DIR=  Enter media directory path: "
)

REM Strip trailing backslashes/slashes (causes WinError 3 on some drives)
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

if "%ADMIN_USER%"=="" (
    echo [ERR] Username cannot be empty.
    pause
    exit /b 1
)
if "%ADMIN_PASS%"=="" (
    echo [ERR] Password cannot be empty.
    pause
    exit /b 1
)
echo [OK]   Admin user: %ADMIN_USER%

REM ── Subdomain ─────────────────────────────────
echo.
echo   Step 3: Choose a subdomain (for a stable URL)
echo.
echo   Pick a unique name so your URL stays the same each time.
echo   Your friends will access: https://NAME.loca.lt
echo   Leave empty for a random URL.
echo.
set /p "SUBDOMAIN=  Enter subdomain (e.g. ghumaggersnap): "

REM ── Check Python ──────────────────────────────
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERR] Python 3 is required. Download from https://python.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [INFO] Using %%i

REM ── Check Node ────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERR] Node.js is required. Download from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [INFO] Using Node %%i

REM ── Backend setup ─────────────────────────────
echo [INFO] Setting up backend...
cd /d "%ROOT%backend"
if not exist "venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
echo [OK]   Backend ready

REM ── Frontend build ────────────────────────────
echo [INFO] Building frontend for production...
cd /d "%ROOT%frontend"
if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install --silent
)
call npx vite build
echo [OK]   Frontend built

REM ── Install localtunnel ───────────────────────
echo [INFO] Installing localtunnel...
call npm install --save-dev localtunnel --silent
echo [OK]   localtunnel ready

REM ── Start backend (production mode) ───────────
echo.
echo [INFO] Starting backend in production mode...
cd /d "%ROOT%backend"
start "GhumaggerSnap-Backend" /min cmd /c "set MEDIA_DIR=%MEDIA_DIR% && set ADMIN_USER=%ADMIN_USER% && set ADMIN_PASS=%ADMIN_PASS% && venv\Scripts\activate.bat && python main.py"

timeout /t 3 /nobreak >nul
echo [OK]   Backend running on http://localhost:8000

REM ── Start tunnel ──────────────────────────────
echo.
echo =============================================
echo   Starting public tunnel...
echo =============================================
echo.

if not "%SUBDOMAIN%"=="" (
    echo   Your public URL: https://%SUBDOMAIN%.loca.lt
) else (
    echo   Your public URL will appear below.
)
echo.
echo   Share this URL with your friends!
echo   Login: %ADMIN_USER% / [your password]
echo   Media: %MEDIA_DIR%
echo.
echo   Note: On first visit, friends may see a localtunnel
echo   reminder page -- they just click "Click to Continue".
echo.
echo   Close this window to stop sharing.
echo =============================================
echo.

cd /d "%ROOT%frontend"
if not "%SUBDOMAIN%"=="" (
    npx localtunnel --port 8000 --subdomain %SUBDOMAIN%
) else (
    npx localtunnel --port 8000
)

pause
