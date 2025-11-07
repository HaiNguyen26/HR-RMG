@echo off
echo ========================================
echo HR Management System - Development Mode
echo ========================================
echo.

echo [Step 1] Fixing ports if needed...
call fix_port.bat >nul 2>&1
timeout /t 1 /nobreak > nul

echo.
echo [Step 2] Starting Backend and Frontend together...
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:3001
echo.
echo Press Ctrl+C to stop both servers
echo ========================================
echo.

npm run dev
