@echo off
chcp 65001 >nul
color 0B
title YuArchive 极速云端同步引擎

echo ========================================================
echo.
echo    YuArchive - 一键同步 OneDrive 源数据并发布至云端
echo.
echo ========================================================
echo.
echo [1/3] 正在启动核心转换引擎 (自动跳过已处理的图像)...
python build_archive.py

if %errorlevel% neq 0 (
    echo.
    echo ❌ [致命错误] 数据构建失败！请检查 Python 脚本输出。
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] 数据已全部脱水注水完毕，准备推送到 GitHub...
git add -A
git restore --staged ".vite-dev.log" 2>nul
git commit -m "Auto-sync from OneDrive: %date% %time%"

echo.
echo [3/3] 正在发射至 GitHub 远端仓库...
git push

if %errorlevel% neq 0 (
    echo.
    echo ❌ [温馨提示] 似乎推送遇到了网络问题请检查连接，或者你还没有初始化 Git 仓库。
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   🎉 发布大成功！GitHub 已收到最新版本。
echo   如果你后续切换到 Vercel，这一步同样可作为前置同步流程继续使用。
echo ========================================================
echo.
pause
