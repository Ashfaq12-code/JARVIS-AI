@echo off
title JARVIS AI CORE - Apex Operating System
color 0B
echo ===================================================
echo     STARTING JARVIS AI - OPERATING HUD & 3D AVATAR
echo ===================================================
echo.
cd /d "%~dp0"

echo [1/2] Launching JARVIS FastAPI backend on http://127.0.0.1:8001 ...
start "JARVIS Backend" /D "%~dp0" "%~dp0.venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8001

echo [2/2] Launching JARVIS Next.js interface on http://127.0.0.1:3000 ...
start "JARVIS Frontend" /D "%~dp0frontend" cmd /k npm run dev
start http://127.0.0.1:3000

pause
