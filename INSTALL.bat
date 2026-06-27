@echo off
REM Renance Playground - Quick Install Script for Windows
echo.
echo ============================================
echo  Renance Playground - 8086 ASM Emulator
echo ============================================
echo.

REM Check if Node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

REM Check if Rust is installed
rustc --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust is not installed!
    echo Please download from: https://rustup.rs/
    pause
    exit /b 1
)

echo [OK] Rust found:
rustc --version
echo.

REM Install dependencies
echo [INSTALLING] npm dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Installation complete!
echo.
echo [NEXT] To start development, run:
echo   npm run tauri:dev
echo.
echo [BUILD] To create production build, run:
echo   npm run tauri:build
echo.
pause
