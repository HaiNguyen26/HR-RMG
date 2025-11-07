#!/bin/bash

echo "========================================"
echo "HR Management System - Development Mode"
echo "========================================"
echo ""

echo "[Step 1] Fixing ports if needed..."
./fix_port.sh >/dev/null 2>&1
sleep 1

echo ""
echo "[Step 2] Starting Backend and Frontend together..."
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "========================================"
echo ""

npm run dev
