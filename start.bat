@echo off
echo ========================================================
echo     ApexStore eCommerce Platform - Launcher
echo     2,000 Products, Next.js, React, SQLite REST API
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking SQLite Database and Seeding 2,000 Products...
node backend/src/db/seed.js

echo.
echo [2/3] Starting Backend REST API on http://localhost:5000 ...
start "ApexStore Backend API (Port 5000)" cmd /k "cd backend && node src/server.js"

echo.
echo [3/3] Starting Next.js Frontend on http://localhost:3000 ...
cd frontend
npm run dev

pause
