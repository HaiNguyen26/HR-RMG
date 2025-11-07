@echo off
echo ========================================
echo HR Management System - Starting...
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm run dev"
timeout /t 5 /nobreak > nul

echo [2/2] Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting...
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:3001
echo ========================================
echo.
echo Press any key to exit this window...
echo (The servers will continue running in their own windows)
pause > nul
