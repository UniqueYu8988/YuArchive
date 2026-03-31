@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
color 0B
title YuArchive Sync Engine

echo ========================================================
echo.
echo    YuArchive - One-click sync from OneDrive to GitHub
echo.
echo ========================================================
echo.
echo [1/3] Building site data...
python -X utf8 build_archive.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check the Python output above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Staging local changes...
git add -A
git restore --staged ".vite-dev.log" 2>nul
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo.
    echo [INFO] No new local changes were detected.
    echo ========================================================
    echo   Build finished. Repository is already up to date.
    echo ========================================================
    echo.
    pause
    exit /b 0
)

git commit -m "Auto-sync from OneDrive: %date% %time%"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Git commit failed. Please check repository status.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Pushing to GitHub...
git push

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. Please check network or GitHub authentication.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   Sync complete. GitHub now has the latest version.
echo ========================================================
echo.
pause
