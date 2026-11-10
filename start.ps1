Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "    ApexStore eCommerce Platform - PowerShell Launcher" -ForegroundColor Cyan
Write-Host "    2,000 Products, Next.js, React, SQLite REST API" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "`n[1/3] Checking SQLite Database and Seeding 2,000 Products..." -ForegroundColor Yellow
node backend/src/db/seed.js

Write-Host "`n[2/3] Launching Backend REST API on http://localhost:5000 ..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "cd backend && node src/server.js"

Write-Host "`n[3/3] Starting Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Green
Set-Location "$scriptDir\frontend"
npm.cmd run dev
