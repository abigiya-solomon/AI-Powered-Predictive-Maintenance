@echo off
title MetroPT-3 Frontend Service
echo ========================================================
echo Starting MetroPT-3 Predictive Maintenance Frontend
echo URL: http://localhost:5173
echo ========================================================
cd /d "%~dp0frontend"

npm run dev
pause
