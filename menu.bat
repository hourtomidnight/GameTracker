@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   HTM Escape Room Tracker - Launcher
echo ============================================
echo.

REM --- Check for git and that this is a repo ---
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git is not installed or not on PATH. Cannot check for updates.
    goto :launch
)

if not exist ".git" (
    echo [WARN] This folder is not a git repository. Skipping update check.
    goto :launch
)

echo Checking for local changes...
git diff --quiet
if errorlevel 1 (
    echo [WARN] You have uncommitted local changes.
    echo        Skipping auto-update to avoid overwriting them.
    goto :launch
)
git diff --cached --quiet
if errorlevel 1 (
    echo [WARN] You have staged, uncommitted local changes.
    echo        Skipping auto-update to avoid overwriting them.
    goto :launch
)

echo Fetching latest from GitHub...
git fetch origin
if errorlevel 1 (
    echo [WARN] Could not reach GitHub. Running with the current local version.
    goto :launch
)

for /f %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f %%i in ('git rev-parse @{u}') do set REMOTE=%%i

if "!LOCAL!"=="!REMOTE!" (
    echo Already up to date.
) else (
    echo Update available - pulling latest changes...
    git pull --ff-only
    if errorlevel 1 (
        echo [ERROR] git pull failed - a manual fix may be needed. Continuing with current version.
        goto :launch
    )
    echo Update complete. Installing dependencies...
    call npm install
)

:launch
echo.
if not exist "node_modules" (
    echo node_modules not found - installing dependencies...
    call npm install
)

echo.
echo Starting HTM Escape Room Tracker...
echo (Press Ctrl+C to stop the server)
echo.
call npm start

endlocal
pause
