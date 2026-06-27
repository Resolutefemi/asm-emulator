# 🚀 Renance Playground - 8086 ASM Emulator

Build, run, and debug 8086 assembly code in a beautiful, offline-first desktop/mobile app.

---

## 📋 Prerequisites

### Windows
- [Node.js](https://nodejs.org/) 16+ (includes npm)
- [Rust](https://rustup.rs/) (required for Tauri)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/downloads/)

### macOS
- [Node.js](https://nodejs.org/) 16+
- [Xcode Command Line Tools](https://developer.apple.com/download/all/)
- [Rust](https://rustup.rs/)

### Linux
```bash
sudo apt-get install libssl-dev libgtk-3-dev libwebkit2gtk-4.0-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## 🛠️ Installation & Setup

### 1. Clone or Create Project

```bash
# Create project directory
mkdir renance-playground
cd renance-playground

# Create folder structure
mkdir -p src src-tauri/src public src/styles src/emulator

# Copy files from this scaffold into respective directories
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- **React** - UI framework
- **Vite** - Fast build tool
- **CodeMirror** - Code editor with syntax highlighting
- **Tauri** - Desktop app framework

### 3. Install Tauri CLI

```bash
npm install --save-dev @tauri-apps/cli@latest
```

---

## 📁 Project Structure

```
renance-playground/
├── src/
│   ├── App.jsx                 # Main React component
│   ├── main.jsx                # React entry point
│   ├── styles/
│   │   └── App.css            # Dark theme styling
│   ├── emulator/
│   │   └── Emulator8086.js    # 8086 CPU emulator core
│   └── index.css              # Global styles
├── src-tauri/
│   ├── src/
│   │   └── main.rs            # Tauri backend
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
├── public/
│   └── index.html             # HTML entry point
├── package.json               # NPM dependencies
├── vite.config.js             # Vite configuration
└── README.md
```

---

## ⚡ Running the App

### Development Mode (Hot Reload)

```bash
npm run tauri:dev
```

This will:
1. Start Vite dev server on `http://localhost:5173`
2. Open Tauri desktop window
3. Auto-reload on file changes

### Production Build

```bash
npm run tauri:build
```

Creates optimized binaries:
- **Windows**: `.msi` installer in `src-tauri/target/release/bundle/msi/`
- **macOS**: `.dmg` in `src-tauri/target/release/bundle/macos/`
- **Linux**: `.AppImage` in `src-tauri/target/release/bundle/appimage/`

### Build Size

Expected app size: **~22-25MB** (much smaller than Electron's 150MB+)

---

## 🎨 Features Implemented

### ✅ Code Editor
- CodeMirror 6 with syntax highlighting
- Dark VS Code theme
- Line numbers & code folding
- Indentation guides

### ✅ 8086 Emulator
Supported instructions:
- **Data Movement**: `mov`, `push`, `pop`
- **Arithmetic**: `add`, `sub`, `inc`, `dec`, `cmp`
- **Logic**: `and`, `or`, `xor`
- **Jumps**: `jmp`, `jz`, `jnz`
- **Interrupts**: `int`, `hlt`

### ✅ CPU Visualization
- Register values (AX, BX, CX, DX, SI, DI, BP, SP)
- CPU flags (CF, ZF, SF, OF, PF, AF)
- Instruction Pointer (IP)
- Memory dump (first 256 bytes)
- Execution output log

### ✅ Mobile-First Design
- Responsive layout (mobile, tablet, desktop)
- Symbol navbar with common ASM instructions
- Touch-friendly buttons
- Stacked panels on mobile

### ✅ Auto-Save
- Saves code to IndexedDB every keystroke
- Resumes where you left off
- Works 100% offline

---

## 📝 Usage Example

1. **Write Code**
```asm
; Initialize registers
mov ax, 0x1234
mov bx, 0x5678

; Perform arithmetic
add ax, bx

; Done
hlt
```

2. **Click "▶ Run"**
   - Emulator executes instructions
   - Registers update in real-time
   - Output log shows each step

3. **View Results**
   - CPU State tab: See register values
   - Memory tab: Inspect memory contents
   - Output tab: See execution trace

---

## 🔧 Customization

### Add More Instructions

Edit `src/emulator/Emulator8086.js`:

```javascript
case 'mul':
  this.mul(args[0], args[1]);
  break;

// Add implementation:
mul(dest, src) {
  const result = this.getValue(dest) * this.getValue(src);
  this.setValue(dest, result & 0xFFFF);
  this.output.push(`mul ${dest}, ${src}`);
}
```

### Change Theme Colors

Edit `src/styles/App.css`:

```css
:root {
  --bg-dark: #0d1117;
  --accent-primary: #58a6ff;
  /* ... customize */
}
```

### Add Assembly Syntax Highlighting

Install language mode:
```bash
npm install @codemirror/lang-asm
```

Then in `App.jsx`:
```javascript
import { asm } from '@codemirror/lang-asm';

<CodeMirror
  extensions={[asm()]}
  // ...
/>
```

---

## 🐛 Debugging

### Desktop Window Issues
Edit `tauri.conf.json`:
```json
"windows": [{
  "devUrl": "http://localhost:5173",  // Change if port differs
  "theme": "Dark"
}]
```

### IndexedDB Issues
Open DevTools (`F12`) → Application tab → Storage → IndexedDB

### Build Failures

**Rust compilation error?**
```bash
rustup update
rustup target add x86_64-pc-windows-gnu  # Windows
```

**Node module issues?**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📱 Deploy as PWA (Mobile Web)

Want to deploy as a progressive web app too?

1. Add `public/manifest.json`:
```json
{
  "name": "Renance Playground",
  "short_name": "Renance",
  "icons": [{
    "src": "/icon-192.png",
    "sizes": "192x192",
    "type": "image/png"
  }],
  "theme_color": "#0d1117",
  "background_color": "#0d1117",
  "display": "standalone"
}
```

2. Deploy to Vercel/Netlify for free
3. Install as app on mobile!

---

## 🚀 Next Steps

1. ✅ Test the emulator with sample code
2. 🎯 Add more 8086 instructions
3. 🖼️ Create project templates
4. 📚 Add documentation panel
5. 🧪 Build test suite
6. 🎮 Add register breakpoints

---

## 📚 Resources

- [Tauri Docs](https://tauri.app/v1/guides/)
- [CodeMirror Docs](https://codemirror.net/)
- [8086 Instruction Set](https://en.wikipedia.org/wiki/X86_assembly_language)
- [React Docs](https://react.dev/)

---

## 💬 Questions?

Having issues? Check:
1. Node.js version: `node --version` (should be 16+)
2. Rust installed: `rustc --version`
3. Dependencies: `npm list`

---

**Made with ❤️ by Resolute Femi**
