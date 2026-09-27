@echo off
setlocal EnableDelayedExpansion
for /f "tokens=2 delims=:" %%c in ('chcp') do set "OLDCP=%%c"
set "OLDCP=%OLDCP: =%"
chcp 936 >nul 2>nul
cd /d "%~dp0.."
title 清除部署凭据

echo.
echo ============================================================
echo   清除部署凭据
echo ============================================================
echo.
echo   会删掉这两处保存的 Token：
echo     %USERPROFILE%\.dqq-deploy-config.bat
echo     .git\config 里的 remote 地址
echo.
echo   删掉之后下次部署要重新填一次 Token。
echo   公用机房电脑用完建议跑一下这个。
echo.

set "YN="
set /p "YN=确定要清除吗？(y/N): "
if /i not "!YN!"=="y" (
  echo 已取消。
  echo.
  pause
  exit /b 0
)

if exist "%USERPROFILE%\.dqq-deploy-config.bat" (
  del /q "%USERPROFILE%\.dqq-deploy-config.bat"
  echo   [OK] 已删除 %USERPROFILE%\.dqq-deploy-config.bat
) else (
  echo   [-] 没有找到配置文件
)

if exist ".git" (
  git remote remove origin >nul 2>nul
  if errorlevel 1 (
    echo   [-] .git\config 里没有 origin
  ) else (
    echo   [√] 已移除 .git\config 里的 origin
  )
) else (
  echo   [-] 这里还不是 git 仓库
)

echo.
echo   顺带提醒：如果这个 Token 是临时申请的，建议顺手去 GitHub 上撤销掉：
echo     Settings - Developer settings - Personal access tokens
echo.
pause
