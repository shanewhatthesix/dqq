@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."
title 附中 - 电子斗蛐蛐 一键部署

REM ============================================================
REM  附中 电子斗蛐蛐  一键部署脚本
REM
REM  适用 Windows 7 / 8 / 10 / 11
REM  Win7 需要 Git for Windows 2.46.2 或更早（2.47 起官方不再支持）
REM
REM  做四件事：本地提交 - 建远端仓库 - 推送 - 开 Pages
REM  重复运行是安全的，会直接推送新改动。
REM
REM  支持建到个人账号，也支持建到 GitHub 组织下。
REM
REM  [重要] 本文件必须存成 GBK/ANSI，否则中文在 cmd 里是乱码。
REM  [重要] 批处理里别在圆括号块内写裸的右括号和单个感叹号，会被当成语法。
REM ============================================================

REM 本文件是 GBK 编码。中文版系统的代码页本来就是 936，不用切；
REM 如果系统被改成了 65001 (UTF-8)，不切回来中文会显示成乱码。
for /f "tokens=2 delims=:" %%c in ('chcp') do set "OLDCP=%%c"
set "OLDCP=%OLDCP: =%"
chcp 936 >nul 2>nul

REM 配置存到用户目录，不放仓库里 —— 放仓库里有被误提交的风险，
REM GitHub 的密钥扫描会直接拒绝推送，得不偿失。
set "CFGFILE=%USERPROFILE%\.dqq-deploy-config.bat"
set "WORKDIR=%TEMP%\dqq-deploy"
if not exist "%WORKDIR%" mkdir "%WORKDIR%" >nul 2>nul

echo.
echo ============================================================
echo            附中 - 电子斗蛐蛐   一键部署
echo ============================================================
echo.

if not exist "index.html" (
  echo [X] 当前目录里没有 index.html
  echo     请把整个项目文件夹拷过来，deploy 子目录要在项目根目录下。
  echo     当前目录: %CD%
  goto :fail
)

set "GHUSER="
set "GHORG="
set "REPO="
set "TOKEN="
set "VISIBILITY="
if exist "%CFGFILE%" call "%CFGFILE%"

REM ---------------------------------------------------------- 环境检查
where git >nul 2>nul
if errorlevel 1 goto :no_git
for /f "delims=" %%v in ('git --version') do echo [i] %%v

set "CURL="
where curl >nul 2>nul
if not errorlevel 1 set "CURL=curl"
if not defined CURL if exist "%ProgramFiles%\Git\mingw64\bin\curl.exe" set "CURL=%ProgramFiles%\Git\mingw64\bin\curl.exe"
if not defined CURL if exist "%ProgramFiles%\Git\usr\bin\curl.exe" set "CURL=%ProgramFiles%\Git\usr\bin\curl.exe"
if not defined CURL if exist "%ProgramFiles(x86)%\Git\mingw32\bin\curl.exe" set "CURL=%ProgramFiles(x86)%\Git\mingw32\bin\curl.exe"
if defined CURL goto :have_curl
echo [注意] 没找到 curl，最后两步要你手动去网页操作
goto :after_curl
:have_curl
echo [i] 找到 curl，可以自动建仓库和开 Pages
:after_curl

REM ---------------------------------------------------------- 填写信息
echo.
echo ------------------------------------------------------------
echo  下面填五项。Token 免费，一分钟生成：
echo.
echo    GitHub 网页 - 右上角头像 - Settings - Developer settings
echo    - Personal access tokens - Tokens (classic) - Generate new token
echo    勾选 repo 一项即可。有效期随便选，过期了重新生成。
echo.
echo  Token 只显示一次，生成后立刻复制。
echo ------------------------------------------------------------
echo.

if "!REPO!"=="" set "REPO=dqq"
if "!VISIBILITY!"=="" set "VISIBILITY=public"

set "IN="
set /p "IN=1. GitHub 用户名  [!GHUSER!]: "
if not "!IN!"=="" set "GHUSER=!IN!"
if "!GHUSER!"=="" goto :need_user

echo 2. 组织名  [!GHORG!]  [留空 = 建在你个人账号下]
echo    建到社团组织里就填组织名，比如 jxsdfz-club
set "IN="
set /p "IN=   输入后回车: "
if not "!IN!"=="" set "GHORG=!IN!"
if /i "!IN!"=="-" set "GHORG="

if "!GHORG!"=="" (set "OWNER=!GHUSER!") else (set "OWNER=!GHORG!")

set "IN="
set /p "IN=3. 仓库名  [!REPO!]: "
if not "!IN!"=="" set "REPO=!IN!"

if defined TOKEN goto :ask_token_saved
set "IN="
set /p "IN=4. Token [粘贴后回车，屏幕不显示]: "
if not "!IN!"=="" set "TOKEN=!IN!"
goto :after_token
:ask_token_saved
echo 4. Token  [已保存，直接回车沿用；输入 new 重新填]
set "IN="
set /p "IN=   输入后回车: "
if /i "!IN!"=="new" set "TOKEN="
if not defined TOKEN set /p "IN=   新 Token: "
if not "!IN!"=="" set "TOKEN=!IN!"
:after_token
if "!TOKEN!"=="" goto :need_token

echo 5. 仓库可见性  [!VISIBILITY!]  [回车保持；private 改私有，public 改公开]
set "IN="
set /p "IN=   输入后回车: "
if /i "!IN!"=="private" set "VISIBILITY=private"
if /i "!IN!"=="public" set "VISIBILITY=public"
if /i "!VISIBILITY!"=="private" set "ISPRIV=true"
if /i not "!VISIBILITY!"=="private" set "ISPRIV=false"

echo.
echo   目标: https://github.com/!OWNER!/!REPO!

> "%CFGFILE%" echo @echo off
>>"%CFGFILE%" echo set "GHUSER=!GHUSER!"
>>"%CFGFILE%" echo set "GHORG=!GHORG!"
>>"%CFGFILE%" echo set "REPO=!REPO!"
>>"%CFGFILE%" echo set "TOKEN=!TOKEN!"
>>"%CFGFILE%" echo set "VISIBILITY=!VISIBILITY!"

REM ---------------------------------------------------------- 1 本地提交
echo.
echo [1/4] 提交本地改动 ...
if not exist ".git" (
  git init -q
  git branch -M main >nul 2>nul
  echo       已初始化仓库
)
git config user.name  "!GHUSER!"
git config user.email "!GHUSER!@users.noreply.github.com"
git add -A
git commit -q -m "部署到 !OWNER!/!REPO!" >nul 2>nul
if errorlevel 1 echo       没有新改动需要提交
if not errorlevel 1 echo       已提交

REM ---------------------------------------------------------- 2 远端仓库
echo.
echo [2/4] 创建远端仓库 ...
if not defined CURL goto :manual_repo

REM 请求体里不能有非 ASCII：batch 写出去是 GBK，而 GitHub 要 UTF-8，
REM 中文会导致 400 Problems parsing JSON。所以描述用 JSON 的 Unicode 转义。
> "%WORKDIR%\body.json" echo {"name":"!REPO!","private":!ISPRIV!,"description":"\u9644\u4e2d\u7535\u5b50\u6597\u86d0\u86d0 \u6821\u56ed\u56de\u5408\u5236\u5bf9\u6218\u6e38\u620f"}

if not defined GHORG goto :create_personal
set "APIURL=https://api.github.com/orgs/!GHORG!/repos"
goto :do_create
:create_personal
set "APIURL=https://api.github.com/user/repos"
:do_create

"%CURL%" -s -o "%WORKDIR%\resp.json" -w "%%{http_code}" -X POST -H "Authorization: Bearer !TOKEN!" -H "Accept: application/vnd.github+json" -H "User-Agent: dqq-deploy" -H "Content-Type: application/json" -d @"%WORKDIR%\body.json" "!APIURL!" > "%WORKDIR%\code.txt" 2>nul
set /p HTTPCODE=<"%WORKDIR%\code.txt"

if "!HTTPCODE!"=="201" echo       仓库已创建
if "!HTTPCODE!"=="422" echo       仓库已存在，继续推送
if "!HTTPCODE!"=="401" goto :bad_token
if "!HTTPCODE!"=="403" goto :no_perm
if "!HTTPCODE!"=="404" goto :no_perm
goto :after_repo

:manual_repo
echo       [注意] 没有 curl 跳过这步。请先去网页手动建一个空仓库：
if defined GHORG echo              组织页面 - Repositories - New repository - 名字填 !REPO!
if not defined GHORG echo              https://github.com/new    名字填 !REPO!
echo              不要勾 README / gitignore / license
goto :after_repo

:bad_token
echo.
echo       [X] 认证失败 HTTP !HTTPCODE!
echo           Token 无效、过期，或者没勾 repo 权限。
echo           去 GitHub 重新生成一个再跑本脚本。
goto :fail

:no_perm
echo.
echo       [X] 建仓库失败 HTTP !HTTPCODE!
if defined GHORG (
  echo           大多是这几种情况：
  echo           - 组织名拼错了，或者这个组织不存在
  echo           - 你不在这个组织里，或者角色权限不够（需要能建仓库）
  echo           - 组织限制了第三方应用访问。去组织页面手动建一个空仓库，
  echo             名字填 !REPO!，不勾 README，然后重跑本脚本即可
) else (
  echo           用户名拼错了，或者 Token 没勾 repo 权限
)
goto :fail

:after_repo

REM ---------------------------------------------------------- 3 推送
echo.
echo [3/4] 推送代码 ...
git remote remove origin >nul 2>nul
git remote add origin "https://!GHUSER!:!TOKEN!@github.com/!OWNER!/!REPO!.git"
git push -u origin main
if errorlevel 1 goto :push_fail
echo       推送完成

REM ---------------------------------------------------------- 4 Pages
echo.
echo [4/4] 开启 GitHub Pages ...
if not defined CURL goto :pages_manual

> "%WORKDIR%\pages.json" echo {"source":{"branch":"main","path":"/"}}
"%CURL%" -s -o "%WORKDIR%\presp.json" -w "%%{http_code}" -X POST -H "Authorization: Bearer !TOKEN!" -H "Accept: application/vnd.github+json" -H "User-Agent: dqq-deploy" -H "Content-Type: application/json" -d @"%WORKDIR%\pages.json" "https://api.github.com/repos/!OWNER!/!REPO!/pages" > "%WORKDIR%\pcode.txt" 2>nul
set /p PCODE=<"%WORKDIR%\pcode.txt"
if "!PCODE!"=="201" echo       Pages 已开启
if "!PCODE!"=="409" echo       Pages 之前已经开过
if "!PCODE!"=="404" goto :pages_manual
goto :done

:pages_manual
echo       [注意] 请去网页手动开一下：
echo              仓库 - Settings - Pages
echo              Source 选 Deploy from a branch
echo              分支 main，目录 / (root)，点 Save
goto :done

REM ---------------------------------------------------------- 完成
:done
echo.
echo ============================================================
echo   部署完成
echo ============================================================
echo.
echo   代码仓库: https://github.com/!OWNER!/!REPO!
echo   在线试玩: https://!OWNER!.github.io/!REPO!/
echo.
echo   Pages 首次要构建 1-2 分钟，现在打开是 404 就等会儿再刷。
if defined GHORG echo   组织仓库的 Pages 可能是私有的，去 Settings - Pages 看看可见性。
echo.
echo   --------------------------------------------------------
echo    安全提醒
echo    Token 明文存在这两个地方：
echo      %USERPROFILE%\.dqq-deploy-config.bat
echo        ^(在仓库外面，不会被 git 提交，可以放心^)
echo      .git\config  的 origin 地址里
echo    公用机房电脑用完请运行 deploy\清除凭据.bat
echo   --------------------------------------------------------
echo.
chcp %OLDCP% >nul 2>nul
pause
exit /b 0

REM ---------------------------------------------------------- 各种失败
:no_git
echo.
echo [X] 没找到 git，请先安装。
echo.
echo     Windows 7 必须装 2.46.2 或更早（2.47 起官方已不支持 Win7）：
echo       64 位:
echo       https://github.com/git-for-windows/git/releases/download/v2.46.2.windows.1/Git-2.46.2-64-bit.exe
echo       32 位:
echo       https://github.com/git-for-windows/git/releases/download/v2.46.2.windows.1/Git-2.46.2-32-bit.exe
echo.
echo     安装一路默认即可。装完重新运行本脚本。
goto :fail

:need_user
echo.
echo       [X] 用户名必须填
goto :fail

:need_token
echo.
echo       [X] Token 必须填
goto :fail

:push_fail
echo.
echo       [X] 推送失败。常见原因：
echo           - 仓库名被占用，或者组织名 / 用户名写错
echo           - Token 没有 repo 权限
echo           - 组织限制了第三方应用访问
echo           - 机房网络访问不了 github.com
echo           - 网页上建仓库时勾了 README，导致远端有本地没有的提交
goto :fail

:fail
echo.
echo ------------------------------------------------------------
echo   没有完成。把上面的报错截图发群里，好排查。
echo ------------------------------------------------------------
echo.
chcp %OLDCP% >nul 2>nul
pause
exit /b 1
