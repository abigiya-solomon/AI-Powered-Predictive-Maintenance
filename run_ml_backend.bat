@echo off
title MetroPT-3 ML Backend Service
echo ========================================================
echo Starting MetroPT-3 Compressor ML Service (Flask)
echo URL: http://localhost:5000
echo Health Check: http://localhost:5000/api/health
echo ========================================================
cd /d "%~dp0ml_service"

if not exist ".venv\Scripts\python.exe" (
    echo Error: Python virtual environment not found in ml_service\.venv
    echo Run: python -m venv .venv ^&^& pip install -r requirements.txt
    pause
    exit /b 1
)

.venv\Scripts\python.exe app.py
pause
