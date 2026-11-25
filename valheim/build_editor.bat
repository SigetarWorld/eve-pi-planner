@echo off
chcp 65001 >nul
echo ==========================================
echo   Sborka: Valera - Redaktor dorozhnoy karty
echo ==========================================
echo.

python --version
if errorlevel 1 (
    echo [OSHIBKA] Python ne nayden! Ustanovite Python 3.8+ s python.org
    pause
    exit /b 1
)

pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Ustanavlivaem PyInstaller...
    pip install pyinstaller
)

echo.
echo Sobiraem EXE...
echo.

pyinstaller --onefile --windowed --name "ValheimEditor" editor.py

if errorlevel 1 (
    echo.
    echo [OSHIBKA] Sborka ne udalas!
    pause
    exit /b 1
)

echo.
echo Gotovo! EXE fayl: dist\ValheimEditor.exe
echo.
pause
