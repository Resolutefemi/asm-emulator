# ⚙️ Renance Playground - 8086 ASM Emulator

A beautiful, offline-first **8086 assembly language emulator** with an integrated code editor. Built with **Tauri** (22MB) for desktop and mobile web.

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blueviolet)

---

## ✨ Features

### 🖥️ Code Editor
- **CodeMirror 6** syntax highlighting
- **Dark VS Code theme** for comfortable coding
- Line numbers, code folding, indentation guides
- **Auto-save** to IndexedDB (resumes where you left off)

### 🎮 8086 Emulator
- Full **16-bit register support** (AX, BX, CX, DX, SI, DI, BP, SP)
- **CPU Flags** visualization (CF, ZF, SF, OF, PF, AF)
- **Memory dump** viewer
- **Instruction pointer** tracking
- **Real-time execution** output

### 📱 Mobile-First Design
- **Responsive layout** (desktop, tablet, mobile)
- **Symbol navbar** with common ASM instructions
- Touch-friendly interface
- Stacked panels on mobile devices

### 🔌 Offline-First
- **Works 100% offline** - no internet required
- **Auto-save code** locally
- Fast desktop app (not Electron)

### ⚡ Performance
- **Only 22MB** app size (vs Electron's 150MB+)
- Built with Rust backend
- Instant startup

---

## 🚀 Quick Start

### 1. Prerequisites

**Windows/macOS/Linux:**
- [Node.js](https://nodejs.org/) 16+ 
- [Rust](https://rustup.rs/)

**Windows specific:**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/downloads/)

**Linux specific:**
```bash
sudo apt-get install libssl-dev libgtk-3-dev libwebkit2gtk-4.0-dev
```

### 2. Setup

```bash
# Clone repo
git clone https://github.com/yourusername/renance-playground.git
cd renance-playground

# Install dependencies
npm install

# Run development server
npm run tauri:dev
```

### 3. Start Coding!

```asm
; Example: Add two numbers
mov ax, 0x1234
mov bx, 0x5678
add ax, bx
hlt
```

Click **▶ Run** and watch the emulator execute your code in real-time.

---

## 📚 Supported Instructions

### Data Movement
- `mov` - Move data between registers/memory
- `push` - Push value onto stack
- `pop` - Pop value from stack

### Arithmetic
- `add` - Addition
- `sub` - Subtraction
- `inc` - Increment by 1
- `dec` - Decrement by 1
- `cmp` - Compare (sets flags)

### Logic
- `and` - Bitwise AND
- `or` - Bitwise OR
- `xor` - Bitwise XOR

### Control Flow
- `jmp` - Unconditional jump
- `jz` - Jump if zero
- `jnz` - Jump if not zero
- `int` - Software interrupt
- `hlt` - Halt execution
- `nop` - No operation

---

## 🎯 Project Structure

```
renance-playground/
├── src/
│   ├── App.jsx                    # Main React component
│   ├── main.jsx                   # React entry point
│   ├── index.css                  # Global styles
│   ├── styles/
│   │   └── App.css               # Component styles
│   └── emulator/
│       └── Emulator8086.js       # CPU emulator core
├── src-tauri/
│   ├── src/
│   │   └── main.rs               # Tauri backend
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # App config
├── public/
│   ├── index.html                # HTML entry
│   └── manifest.json             # PWA config
├── package.json                  # Node dependencies
├── vite.config.js                # Vite config
├── tauri.conf.json               # Tauri config
└── README.md                      # This file
```

---

## 🔧 Development

### Start Development Server
```bash
npm run tauri:dev
```
- Hot-reload on file changes
- Opens Tauri window automatically

### Build for Production
```bash
npm run tauri:build
```

Creates installers for:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` installer  
- **Linux**: `.AppImage` executable

### Build Size: **~22MB** (uncompressed)

---

## 📖 Usage Guide

### Writing Assembly Code

1. **Editor** (left side) - Write your 8086 assembly code
2. **CPU State** tab - View register values and flags
3. **Memory** tab - Inspect memory contents
4. **Output** tab - See execution trace

### Running Code

```bash
# Click "▶ Run" button or press Ctrl+Enter
# Emulator executes your code line-by-line
# Results appear in CPU State and Output tabs
```

### Example Programs

**Addition:**
```asm
mov ax, 100
mov bx, 200
add ax, bx      ; AX = 300
hlt
```

**Loops:**
```asm
mov cx, 5       ; Counter = 5
loop_start:
dec cx
cmp cx, 0
jnz loop_start
hlt
```

**Bit Operations:**
```asm
mov ax, 0xFF00
xor ax, 0x00FF  ; AX = 0xFFFF
hlt
```

---

## 🎨 Customization

### Add More Instructions

Edit `src/emulator/Emulator8086.js`:

```javascript
case 'mul':
  this.mul(args[0], args[1]);
  break;

mul(dest, src) {
  const result = this.getValue(dest) * this.getValue(src);
  this.setValue(dest, result & 0xFFFF);
  this.output.push(`mul ${dest}, ${src}`);
}
```

### Change Theme

Edit `src/styles/App.css`:

```css
:root {
  --bg-dark: #0d1117;
  --accent-primary: #58a6ff;
  --accent-success: #3fb950;
  --accent-danger: #f85149;
}
```

### Add Assembly Syntax Highlighting

```bash
npm install @codemirror/lang-asm
```

Update `src/App.jsx`:
```javascript
import { asm } from '@codemirror/lang-asm';

<CodeMirror
  extensions={[asm()]}
  // ...
/>
```

---

## 🌐 Deploy as Web App

Want to deploy to the web too?

```bash
# Build React app only
npm run build

# Deploy dist/ folder to Vercel/Netlify
```

Users can install as PWA (like native app) on mobile!

---

## 🐛 Troubleshooting

### "Module not found" error
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tauri compilation error
```bash
rustup update
cargo clean
npm run tauri:build
```

### DevTools not appearing
Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)

---

## 📦 Tech Stack

- **Frontend**: React 18, CodeMirror 6, Vite
- **Desktop**: Tauri (Rust)
- **Styling**: CSS3 with CSS Variables
- **Storage**: IndexedDB (offline persistence)
- **Package Manager**: npm/yarn

---

## 🚀 Roadmap

- [ ] Add more 8086 instructions (MUL, DIV, SHL, SHR)
- [ ] Segmented memory model (CS, DS, ES, SS)
- [ ] Breakpoints & step-through debugging
- [ ] Import/export assembly files
- [ ] Code templates library
- [ ] Documentation panel
- [ ] Test suite runner
- [ ] Assembly-to-machine-code converter

---

## 📝 License

MIT License - feel free to use, modify, and distribute

---

## 💬 Contributing

Found a bug? Have a feature idea?

1. Fork the repo
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 👨‍💻 Author

**Resolute Femi** - [@ResoIute](https://twitter.com)

Tutorial creator & developer | FUTA Software Engineering

---

## 🙏 Acknowledgments

- [Tauri Team](https://tauri.app/) - Amazing framework
- [CodeMirror](https://codemirror.net/) - Editor library
- [8086 CPU Reference](https://en.wikipedia.org/wiki/Intel_8086)

---

## 📞 Support

Need help?

- 📖 Check the [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- 🐛 [Open an issue](https://github.com/yourusername/renance-playground/issues)
- 💬 Reach out on Twitter

---

**Made with ❤️ for learning 8086 assembly**
