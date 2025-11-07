#!/bin/bash

echo "========================================"
echo "HR Management System - Starting..."
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit

# Navigate to backend directory
cd backend || exit

echo -e "${GREEN}[1/2] Starting Backend Server...${NC}"
# Start backend in background
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!

echo "Backend starting... (PID: $BACKEND_PID)"
echo "Waiting for backend to initialize..."
sleep 6

# Check if backend process is still running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Backend server started successfully!${NC}"
else
    echo -e "${YELLOW}✗ Backend may have failed to start. Check backend.log for details.${NC}"
    echo "Continuing anyway..."
fi

# Navigate to frontend directory
cd ../frontend || exit

echo ""
echo -e "${GREEN}[2/2] Starting Frontend Server...${NC}"
# Start frontend in background
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Frontend starting... (PID: $FRONTEND_PID)"
echo "Waiting for frontend to initialize..."
sleep 10

# Check if frontend process is still running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Frontend server started successfully!${NC}"
else
    echo -e "${YELLOW}✗ Frontend may have failed to start. Check frontend.log for details.${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}Both servers are running!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}Backend:${NC}  http://localhost:3000"
echo -e "${BLUE}Frontend:${NC} http://localhost:3001"
echo ""
echo "Server PIDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "Log files:"
echo "  - Backend:  backend.log"
echo "  - Frontend: frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers...${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null
        echo "✓ Backend stopped"
    fi
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID 2>/dev/null
        echo "✓ Frontend stopped"
    fi
    echo "All servers stopped."
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup INT TERM

# Keep script running and wait for interrupt
echo "Servers are running in the background..."
echo "You can check the logs for any errors."
echo ""
# Wait for interrupt
while true; do
    sleep 1
done
