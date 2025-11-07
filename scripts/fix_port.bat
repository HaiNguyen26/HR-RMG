@echo off
echo ========================================
echo Fixing Port 3000 and 3001 Issues
echo ========================================
echo.

echo [1/3] Stopping all Node.js processes...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo ✓ All Node.js processes stopped
) else (
    echo No Node.js processes found
)
timeout /t 2 /nobreak > nul

echo.
echo [2/3] Checking ports...
netstat -ano | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo ⚠ Port 3000 is still in use
    echo Attempting to find and kill process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo Killing process %%a...
        taskkill /F /PID %%a 2>nul
    )
) else (
    echo ✓ Port 3000 is free
)

netstat -ano | findstr ":3001" >nul
if %errorlevel% equ 0 (
    echo ⚠ Port 3001 is still in use
    echo Attempting to find and kill process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        echo Killing process %%a...
        taskkill /F /PID %%a 2>nul
    )
) else (
    echo ✓ Port 3001 is free
)

echo.
echo [3/3] Ports cleaned!
echo.
echo You can now run start.bat or start.sh to start the servers.
echo.
pause
