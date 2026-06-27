# 🚀 Quick Start Guide - Renance Playground

Get up and running in **5 minutes**! ⚡

---

## 📋 Prerequisites Check

Before starting, make sure you have:

- ✅ **Node.js 16+** → Download from [nodejs.org](https://nodejs.org/)
- ✅ **Rust** → Install from [rustup.rs](https://rustup.rs/)

### Verify Installation

```bash
# Check Node.js
node --version     # Should be v16+
npm --version

# Check Rust
rustc --version
cargo --version
```

---

## 🎯 Installation (Choose Your OS)

### Windows
1. Open Command Prompt or PowerShell in this folder
2. Double-click **`INSTALL.bat`**
3. Wait for installation to complete
4. You'll see the next steps

### macOS / Linux
1. Open Terminal in this folder
2. Run: `./INSTALL.sh`
3. Follow the prompts
4. You're done!

---

## ▶️ Running the App

### Development Mode (Recommended)
```bash
npm run tauri:dev
```

This will:
- Start Vite dev server
- Open Tauri window
- Enable hot-reload (auto-refresh on code changes)

**Takes ~10 seconds to start**

### Production Build
```bash
npm run tauri:build
```

Creates an installer:
- **Windows**: `.msi` file in `src-tauri/target/release/bundle/msi/`
- **macOS**: `.dmg` file in `src-tauri/target/release/bundle/macos/`
- **Linux**: `.AppImage` in `src-tauri/target/release/bundle/appimage/`

---

## 💻 Write Your First Program

1. **The app opens** with sample code
2. **Edit the code** in the left panel:

```asm
; Add two numbers
mov ax, 100
mov bx, 200
add ax, bx
hlt
```

3. **Click ▶ Run** (green button)
4. **See results** in the right panel:
   - **📊 CPU State**: Shows AX = 300
   - **📡 Output**: Shows execution trace
   - **💾 Memory**: Shows memory contents

---

## 🎮 Try These Examples

### Arithmetic
```asm
mov ax, 50
add ax, 25
sub ax, 10
hlt
```

### Bitwise Operations
```asm
mov ax, 0xFF00
xor ax, 0x00FF
hlt
```

### Flags
```asm
mov ax, 0
mov bx, 5
cmp ax, bx      ; Sets flags (ZF=0, SF=1)
hlt
```

---

## 📁 File Structure

```
renance-playground/
├── src/
│   ├── App.jsx              # Main UI component
│   ├── main.jsx             # React entry point
│   ├── styles/
│   │   └── App.css         # All styling
│   └── emulator/
│       └── Emulator8086.js # CPU emulator
├── public/
│   └── index.html          # HTML template
├── package.json            # NPM dependencies
├── README.md               # Full documentation
├── SETUP_GUIDE.md          # Detailed setup
└── QUICK_START.md          # This file!
```

---

## ⚡ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run code |
| `Ctrl+L` | Clear output |
| `F12` | Open DevTools |
| `Ctrl+/` | Comment line |

---

## 🐛 Common Issues

### "npm: command not found"
→ Node.js not installed. Download from [nodejs.org](https://nodejs.org/)

### "rustc: command not found"
→ Rust not installed. Run: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### "Module not found"
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### App won't start
```bash
# Restart Tauri
npm run tauri:dev
```

If still stuck, try:
```bash
cargo clean
npm run tauri:build
```

---

## 📚 Next Steps

1. ✅ Run the app with `npm run tauri:dev`
2. 📖 Read [README.md](./README.md) for full features
3. 🔧 Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) for advanced setup
4. 💡 Customize the emulator in `src/emulator/Emulator8086.js`
5. 🎨 Change theme in `src/styles/App.css`

---

## 🚀 Deploy

### As Website
```bash
npm run build
# Deploy the 'dist' folder to Vercel/Netlify (free!)
```

### As Desktop App
```bash
npm run tauri:build
# Share the `.msi` / `.dmg` / `.AppImage` with others
```

---

## 💬 Need Help?

- 🔍 Check [README.md](./README.md) for detailed docs
- 🤔 See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for troubleshooting
- 📺 Watch Tauri tutorials at [tauri.app](https://tauri.app/)

---

## 🎉 You're Ready!

```bash
npm run tauri:dev
```

Your 8086 emulator is about to launch! 🚀⚙️

---

**Made with ❤️ by Resolute Femi**
