@echo off
REM ──────────────────────────────────────────────
REM GhumaggerSnap — start script (Windows)
REM ──────────────────────────────────────────────
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo =============================================
echo   GhumaggerSnap — Starting...
echo =============================================
echo.

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
start "GhumaggerSnap-Backend" cmd /c "venv\Scripts\activate.bat && python main.py"
echo [INFO] Backend  → http://localhost:8000

timeout /t 2 /nobreak >nul

cd /d "%ROOT%frontend"
start "GhumaggerSnap-Frontend" cmd /c "npx vite --host"
echo [INFO] Frontend → http://localhost:3000

echo.
echo =============================================
echo   GhumaggerSnap is running!
echo   Open http://localhost:3000
echo   Login: admin / admin
echo   Close terminal windows to stop
echo =============================================
echo.
pause
