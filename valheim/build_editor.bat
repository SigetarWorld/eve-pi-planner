@echo off
echo ==========================================
echo   Build ValheimEditor.exe
echo ==========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found in PATH!
    echo Install Python 3.8+ from https://python.org
    echo Check "Add Python to PATH" during install!
    echo.
    pause
    exit /b 1
)

echo Python found:
python --version
echo.

echo Installing PyInstaller...
pip install pyinstaller
echo.

echo Building EXE...
echo.
python -m PyInstaller --onefile --windowed --name "ValheimEditor" editor.py

echo.
if exist "dist\ValheimEditor.exe" (
    echo SUCCESS! File: %cd%\dist\ValheimEditor.exe
) else (
    echo BUILD FAILED - check errors above
)
echo.
pause
