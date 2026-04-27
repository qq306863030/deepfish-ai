@echo off
rem Force UTF-8 output
chcp 65001 >nul 2>&1

echo ========================================
echo   DeepFish AI Offline Package Builder
echo ========================================
echo.

:: Enable error catching
if not defined DEBUG (
    set DEBUG=1
    cmd /c "%~f0"
    exit /b
)

:: Check Environment
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js first to run this builder.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo Please install Node.js ^(which includes npm^) first.
    echo.
    pause
    exit /b 1
)

rem Check Project Directory
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
if not exist "%PROJECT_DIR%" (
    echo [ERROR] Project directory not found: %PROJECT_DIR%
    echo Please check if the path exists or edit this script.
    echo.
    pause
    exit /b 1
)

set "OUTPUT_DIR=%~dp0offline-package"
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "ZIP_NAME=deepfish-offline-%TIMESTAMP%.zip"

echo [1/4] Cleaning old output directory...
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%" 2>nul

echo [2/4] Copying project source files...
robocopy "%PROJECT_DIR%\src" "%OUTPUT_DIR%\src" /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NP >nul
copy "%PROJECT_DIR%\package.json" "%OUTPUT_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%\README.md" "%OUTPUT_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%\README_CN.md" "%OUTPUT_DIR%\" >nul 2>&1
copy "%PROJECT_DIR%\LICENSE" "%OUTPUT_DIR%\" >nul 2>&1

echo [3/4] Installing dependencies (this may take a few minutes)...
echo Setting npm registry to npmmirror.com...
call npm config set registry https://registry.npmmirror.com >nul 2>&1

cd /d "%PROJECT_DIR%"
echo Running npm install --production...
set PUPPETEER_SKIP_DOWNLOAD=true
set npm_config_puppeteer_skip_download=true
call npm install --production --loglevel=error

if errorlevel 1 (
    echo [WARNING] npm install failed. Trying default registry...
    call npm config set registry https://registry.npmjs.org >nul
    call npm install --production --loglevel=error
    if errorlevel 1 (
        echo [ERROR] npm install failed again. Please check your network connection.
        echo.
        pause
        exit /b 1
    )
)

echo Copying node_modules...
robocopy "%PROJECT_DIR%\node_modules" "%OUTPUT_DIR%\node_modules" /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NP >nul

echo [4/4] Creating startup script...

rem Create start.bat (run after npm link)
(
echo @echo off
echo chcp 65001 ^>nul 2^>^&1
echo echo ========================================
echo echo   DeepFish AI - Install ^& Start
echo echo ========================================
echo.
echo cd /d "%%~dp0"
echo npm link
echo if errorlevel 1 ^(
echo     echo [ERROR] npm link failed.
echo     pause
echo     exit /b 1
echo ^)
echo echo.
echo deepfish-cli %%*
) > "%OUTPUT_DIR%\start.bat"

rem Create README for offline package
(
echo # DeepFish AI Offline Package
echo.
echo This is a portable offline package of DeepFish AI.
echo.
echo ## How to Use
echo.
echo Install as Global Command:
echo 1. Double-click "start.bat" to install
echo 2. After installation, you can use "deepfish-cli" command anywhere
) > "%OUTPUT_DIR%\README-OFFLINE.md"

rem Packaging to ZIP
echo.
echo ========================================
echo   Packaging to ZIP...
echo ========================================
echo.

cd /d "%~dp0"
powershell -Command "Compress-Archive -Path '%OUTPUT_DIR%' -DestinationPath '%ZIP_NAME%' -Force"

if exist "%ZIP_NAME%" (
    echo ========================================
    echo   Offline Package Created Successfully!
    echo ========================================
    echo Output ZIP: %~dp0%ZIP_NAME%
    if exist "%OUTPUT_DIR%" (
        echo Cleaning temporary package directory...
        rmdir /s /q "%OUTPUT_DIR%"
    )
    echo.
    echo You can distribute this ZIP file to others.
) else (
    echo [ERROR] Failed to create ZIP file.
    echo.
    pause
    exit /b 1
)

echo.
pause
