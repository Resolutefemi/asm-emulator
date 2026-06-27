#!/bin/bash

# Renance Playground - Quick Install Script for Linux/macOS

echo ""
echo "============================================"
echo " Renance Playground - 8086 ASM Emulator"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please download from: https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js found:"
node --version
echo ""

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo "[ERROR] Rust is not installed!"
    echo "Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "[OK] Rust found:"
rustc --version
echo ""

# Install dependencies
echo "[INSTALLING] npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "[ERROR] npm install failed!"
    exit 1
fi

echo ""
echo "[SUCCESS] Installation complete!"
echo ""
echo "[NEXT] To start development, run:"
echo "  npm run tauri:dev"
echo ""
echo "[BUILD] To create production build, run:"
echo "  npm run tauri:build"
echo ""
