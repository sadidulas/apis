@echo off
title Free API Server
cd /d "%~dp0"

echo ╔═══════════════════════════════════════╗
echo ║        Free API - Server              ║
echo ╚═══════════════════════════════════════╝
echo.

:: Kill any process on port 3001
echo [*] Checking port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo [+] Port 3001 is free
echo.

echo Starting backend server...
echo.
echo Admin Login:
echo   Username: admin
echo   Email:    admin@admin.com
echo   Password: sadidulmehal
echo.
echo Public Registration:
echo   http://localhost:3001/register
echo   http://localhost:3001/login
echo.
echo URLs:
echo   Site:       http://localhost:3001
echo   Admin:      http://localhost:3001/admin/login
echo   Models:     http://localhost:3001/models
echo   Playground: http://localhost:3001/playground
echo   Docs:       http://localhost:3001/docs
echo.
echo Production:  https://free-apis-b1hi.onrender.com
echo Storage:     Supabase (persistent)
echo ========================================
echo.

set ADMIN_PASSWORD=sadidulmehal
set SUPABASE_URL=https://kqroiwwpmglqxodunyse.supabase.co
set SUPABASE_ANON_KEY=sb_publishable_m3FQBS_YuFyYqOlDZCs56A_uscpxlIb
set SUPABASE_SERVICE_KEY=%SUPABASE_ANON_KEY%

cd backend
node server.js

pause
