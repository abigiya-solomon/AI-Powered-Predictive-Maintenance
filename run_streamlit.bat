@echo off
title MetroPT-3 Streamlit Workbench
echo ========================================================
echo Starting MetroPT-3 Standalone ML Workbench (Streamlit)
echo URL: http://localhost:8501
echo ========================================================
cd /d "%~dp0ml_service"

.venv\Scripts\streamlit.exe run streamlit_app.py
pause
