#!/bin/bash

echo "========================================"
echo "Fixing Port 3000 and 3001 Issues"
echo "========================================"
echo ""

echo "[1/3] Stopping all Node.js processes..."
pkill -f node 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ All Node.js processes stopped"
else
    echo "No Node.js processes found"
fi
sleep 2

echo ""
echo "[2/3] Checking ports..."

# Check and kill process on port 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠ Port 3000 is still in use"
    echo "Attempting to find and kill process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "✓ Port 3000 cleared"
else
    echo "✓ Port 3000 is free"
fi

# Check and kill process on port 3001
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "⚠ Port 3001 is still in use"
    echo "Attempting to find and kill process..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo "✓ Port 3001 cleared"
else
    echo "✓ Port 3001 is free"
fi

echo ""
echo "[3/3] Ports cleaned!"
echo ""
echo "You can now run start.bat or start.sh to start the servers."
echo ""

