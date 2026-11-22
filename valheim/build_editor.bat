@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════
echo   Сборка: Валера - Редактор дорожной карты
echo ═══════════════════════════════════════════
echo.

:: Проверяем Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден! Установите Python 3.8+ с python.org
    pause
    exit /b 1
)

:: Устанавливаем PyInstaller если нет
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Устанавливаем PyInstaller...
    pip install pyinstaller
)

echo.
echo Собираем EXE...
echo.

pyinstaller --onefile --windowed --name "ValheimEditor" --icon=NONE editor.py

if errorlevel 1 (
    echo.
    echo [ОШИБКА] Сборка не удалась!
    pause
    exit /b 1
)

echo.
echo ✅ Готово! EXE файл: dist\ValheimEditor.exe
echo.
echo Скопируйте ValheimEditor.exe в папку E:\WebSite\Valheim\
echo (рядом с index.html и папкой data\)
echo.
pause
