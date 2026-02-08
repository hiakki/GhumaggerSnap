@echo off
REM ──────────────────────────────────────────────
REM GhumaggerSnap — start script (Windows)
REM Usage: start.bat [MEDIA_DIR_PATH]
REM ──────────────────────────────────────────────
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo =============================================
echo   GhumaggerSnap — Starting...
echo =============================================
echo.

REM ── MEDIA_DIR ─────────────────────────────────
if not "%~1"=="" (
    set "MEDIA_DIR=%~1"
) else if "%MEDIA_DIR%"=="" (
    echo   Point this to the folder containing your trip photos/videos.
    echo   This can be a local directory, USB drive, or external hard drive.
    echo.
    echo   Examples:
    echo     D:\TripPhotos
    echo     E:\DCIM\Camera
    echo     C:\Users\you\Pictures\Trips
    echo.
    set /p "MEDIA_DIR=  Enter media directory path: "
)

if not exist "%MEDIA_DIR%" (
    echo [ERR] Directory not found: %MEDIA_DIR%
    pause
    exit /b 1
)

echo [OK]   Media directory: %MEDIA_DIR%

REM ── Admin credentials ─────────────────────────
if "%ADMIN_USER%"=="" (
    echo.
    echo   Admin Account Setup
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

REM ── Check Python ──────────────────────────────
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERR] Python 3 is required but not found.
    echo       Download from https://python.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [INFO] Using %%i

REM ── Check Node ────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERR] Node.js is required but not found.
    echo       Download from https://nodejs.org
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
echo [OK]   Backend dependencies installed

REM ── Frontend setup ────────────────────────────
echo [INFO] Setting up frontend...
cd /d "%ROOT%frontend"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install --silent
)
echo [OK]   Frontend dependencies installed

REM ── Start servers ─────────────────────────────
echo.
echo =============================================
echo   Starting servers...
echo =============================================
echo.

cd /d "%ROOT%backend"
start "GhumaggerSnap-Backend" cmd /c "set MEDIA_DIR=%MEDIA_DIR% && set ADMIN_USER=%ADMIN_USER% && set ADMIN_PASS=%ADMIN_PASS% && venv\Scripts\activate.bat && python main.py"
echo [INFO] Backend  → http://localhost:8000

timeout /t 2 /nobreak >nul

cd /d "%ROOT%frontend"
start "GhumaggerSnap-Frontend" cmd /c "npx vite --host"
echo [INFO] Frontend → http://localhost:3000

echo.
echo =============================================
echo   GhumaggerSnap is running!
echo   Open http://localhost:3000
echo   Login: %ADMIN_USER% / [your password]
echo   Media: %MEDIA_DIR%
echo   Close terminal windows to stop
echo =============================================
echo.
pause
