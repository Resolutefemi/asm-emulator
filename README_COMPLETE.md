# ⚙️ Renance Playground - COMPLETE Edition

**The Ultimate 8086 Assembly Emulator**
- Full 8086 instruction set (80+ opcodes)
- Draggable/resizable terminal output
- Perfect mobile responsiveness
- Cross-platform (PC, Tablet, Mobile)
- Offline-first (PWA capable)

---

## 🚀 What's New (v2.0)

### ✨ Draggable Terminal
- **Click & Drag** the handle to resize
- **Auto-open** when code runs
- **Manual close** button
- **Clear output** button
- **Responsive** on all devices
- **Touch-friendly** on mobile

### 📱 Mobile Optimization
- **Bottom navbar** for quick access
- **Swappable panels** (tap to switch)
- **4x4 symbol keyboard** with common instructions
- **Full responsiveness** (all screen sizes)
- **Touch-optimized** buttons and spacing
- **Orientation-aware** layout

### 💻 Desktop Features
- **Draggable terminal** (mouse drag)
- **Resizable panels** and layout
- **Keyboard shortcuts** (coming soon)
- **Reference panel** toggle
- **Full screen mode** compatible

### 📚 Complete Instruction Set
- **80+ instructions** with full details
- **Searchable reference** database
- **Opcode information** for each instruction
- **Click to insert** directly into editor
- **Flag effects** documentation
- **Example code** for each instruction

---

## 🎯 Quick Start

### 1. Extract & Install
```bash
unzip renance-playground.zip
cd renance-playground
./INSTALL.sh  # or INSTALL.bat on Windows
```

### 2. Run Development Server
```bash
npm run tauri:dev
```

### 3. Write & Execute
```asm
mov ax, 100
add ax, 50
hlt
```

### 4. See Results
- Terminal auto-opens with output
- CPU state updates in real-time
- Click terminal handle to resize
- Close when done

---

## 🖥️ Desktop Usage

### Toolbar Buttons
- **▶ Run** - Execute code, open terminal
- **🔄 Reset** - Clear CPU state
- **🗑 Clear** - Clear code editor
- **📚 Reference** - Toggle instruction panel
- **💻 Terminal** - Toggle terminal visibility

### Terminal
- Drag the handle (`⋮⋮`) to resize
- Click Clear to empty output
- Click ✕ to close
- Auto-opens on Run

### Instruction Reference
- Type in search box to find instructions
- Click any result to insert into editor
- Shows opcode, operands, flags, examples
- Toggle on/off with 📚 button

---

## 📱 Mobile Usage

### Bottom Navbar (5 tabs)
1. **💻** - CPU State (registers, flags, IP)
2. **💾** - Memory Inspector (hex dump)
3. **📊** - Output (execution log)
4. **📚** - Instruction Reference (searchable)
5. **💻** - Terminal Output (draggable)

### Symbol Keyboard
- **4x3 grid** of common instructions
- Tap to insert: `mov`, `add`, `sub`, `cmp`, `and`, `or`, `xor`, etc.
- Auto-shows below editor on mobile
- Auto-hides when reference is open

### Touch Controls
- Tap buttons to switch tabs
- Tap symbol to insert instruction
- Drag terminal handle to resize
- Swipe up/down in terminal to scroll

---

## 🎮 Example Programs

### Simple Math
```asm
mov ax, 100
mov bx, 50
add ax, bx      ; AX = 150
hlt
```

### Conditional Jump
```asm
mov ax, 10
cmp ax, 10
je equal

mov bx, 0
jmp end

equal:
  mov bx, 1

end:
  hlt
```

### Loop Counter
```asm
mov cx, 5       ; Loop 5 times

start:
  dec cx
  jnz start

hlt
```

### Bit Manipulation
```asm
mov ax, 0xABCD
and ax, 0x00FF  ; Keep low byte
or ax, 0xFF00   ; Set high bits
xor ax, 0x1111  ; Toggle bits
hlt
```

### Stack Operations
```asm
mov ax, 100
push ax

mov bx, 200
push bx

pop cx          ; CX = 200
pop dx          ; DX = 100

hlt
```

---

## 📊 Supported Instructions (80+)

### Categories
- **Data Transfer**: MOV, PUSH, POP, LEA, XCHG, etc.
- **Arithmetic**: ADD, SUB, MUL, DIV, INC, DEC, NEG, CMP
- **Bitwise**: AND, OR, XOR, NOT, SHL, SHR, SAR, ROL, ROR
- **Control Flow**: JMP, JE, JNZ, JL, JG, LOOP, CALL, RET
- **String Ops**: MOVSB, MOVSW, STOSB, LODSB, CMPSB
- **Flag Control**: STC, CLC, STD, CLD, STI, CLI
- **Misc**: NOP, HLT, INT

All with **full opcode details** and **flag effects documentation**.

---

## 🖱️ Draggable Terminal Features

### Desktop
- **Drag Handle** - Click and drag up/down to resize
- **Auto-open** - Opens automatically when you run code
- **Manual Control** - Toggle with button or close with ✕
- **Smooth Resizing** - Works with mouse movement
- **Min/Max Heights** - 100px minimum, 600px maximum

### Mobile
- **Touch Drag** - Tap and drag the handle
- **Swipe Support** - Scroll within terminal
- **Full Width** - Uses entire screen width
- **Max 50% Height** - Respects screen space
- **Easy Close** - Tap ✕ button to close

### Features
- **Line Numbers** - Each output line numbered
- **Color Output** - Success/error visual distinction
- **Auto Scroll** - Scrolls to newest output
- **Clear Button** - Empty terminal anytime
- **Responsive** - Works perfectly on all devices

---

## 🎨 Dark Theme Design

### Color Palette
- **Dark Backgrounds**: #0d1117, #161b22
- **Text Colors**: #c9d1d9 (primary), #8b949e (secondary)
- **Accent Colors**:
  - Blue (#58a6ff) - Primary actions
  - Green (#3fb950) - Success
  - Red (#f85149) - Danger
  - Orange (#d29922) - Warning

### Styling
- **Modern UI** - Clean, minimal design
- **Smooth Transitions** - 0.2s cubic-bezier easing
- **Hover Effects** - Interactive feedback
- **Focus States** - Keyboard navigation support

---

## 📱 Responsive Breakpoints

| Screen Size | Layout | Features |
|-----------|--------|----------|
| **> 1024px** | Desktop | Full reference, all buttons |
| **768-1024px** | Tablet | Adjusted spacing, narrower panels |
| **< 768px** | Mobile | Bottom navbar, swappable tabs |
| **< 480px** | Small Mobile | Compact layout, 3-column keyboard |
| **< 360px** | Ultra Small | Minimal spacing, optimized touch |

---

## 🔧 File Structure

```
src/
├── AppFinal.jsx              ← Main component (complete)
├── main.jsx                  ← React entry point
├── index.css                 ← Global styles
├── styles/
│   ├── AppFinal.css         ← Complete styling
│   ├── AppMobile.css        ← Alternative mobile style
│   └── App.css              ← Original styling
├── emulator/
│   ├── Emulator8086Enhanced.js  ← Full ISA support
│   └── Emulator8086.js          ← Basic version
├── data/
│   └── InstructionSet8086.js   ← Complete database
└── sw.js                    ← Service worker (PWA)
```

---

## 💾 Auto-Save & Storage

### IndexedDB
- **Saves every keystroke** (with 1s debounce)
- **Stores in device** (completely offline)
- **Resumes on reload** - Your code is never lost
- **Per-project storage** - Each tab has separate storage

### Service Worker
- **Offline support** - Works without internet
- **Cache first** - Uses cached assets
- **Background sync** - (Coming soon)
- **PWA installable** - Works like native app

---

## 🚀 Deployment

### Desktop App
```bash
npm run tauri:build
# Creates: .msi (Windows), .dmg (macOS), .AppImage (Linux)
```

### Web Version
```bash
npm run build
# Deploy dist/ to Vercel, Netlify, or your server
# Works as PWA on mobile browsers
```

### Installers
- **Windows**: Double-click .msi to install
- **macOS**: Drag to Applications folder
- **Linux**: Run .AppImage file
- **Web**: Install from browser (mobile)

---

## ⌨️ Keyboard Shortcuts (Future)
- `Ctrl+Enter` - Run code
- `Ctrl+S` - Save (auto-saves anyway!)
- `Ctrl+/` - Comment line
- `F5` - Run code
- `F12` - Developer tools

---

## 📖 Learning Resources

- **8086 Reference**: See inline documentation
- **Instruction Database**: In `src/data/InstructionSet8086.js`
- **Examples**: In code comments and this README
- **Mobile Design**: See `src/styles/AppFinal.css`

---

## 🐛 Troubleshooting

### Terminal Won't Open
- Click **▶ Run** to auto-open
- Or click **💻 Terminal** button

### Terminal Won't Resize
- Make sure you're dragging the **handle** (⋮⋮)
- Not the title bar

### Code Not Saving
- Check DevTools (F12) for IndexedDB
- Refresh page if needed

### Mobile Layout Issues
- Rotate device to landscape for more space
- Close unnecessary panels

---

## 🎓 What You'll Learn

✅ 8086 assembly language
✅ CPU emulation concepts
✅ React hooks & state management
✅ Responsive UI design
✅ Offline-first development
✅ Draggable UI components
✅ Terminal/console interfaces
✅ Cross-platform development

---

## 🏆 Features Summary

| Feature | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Code Editor | ✅ Full | ✅ Full | ✅ Full |
| CPU State | ✅ Always | ✅ Yes | ✅ Tab |
| Memory Inspector | ✅ Tab | ✅ Tab | ✅ Tab |
| Terminal | ✅ Draggable | ✅ Yes | ✅ Draggable |
| Reference | ✅ Toggle | ✅ Toggle | ✅ Tab |
| Symbol Keyboard | ❌ No | ❌ No | ✅ Yes |
| Bottom Navbar | ❌ No | ❌ No | ✅ Yes |
| Responsive | ✅ Perfect | ✅ Perfect | ✅ Perfect |

---

## 📝 Version History

### v2.0 (COMPLETE EDITION)
- ✅ Full 8086 instruction set (80+ opcodes)
- ✅ Draggable/resizable terminal
- ✅ Perfect mobile responsiveness
- ✅ Complete documentation
- ✅ Production-ready code

### v1.0 (ORIGINAL)
- Basic 8086 emulator
- Simple UI
- Core functionality

---

## 🎉 You Now Have

✅ **Complete 8086 emulator** with full instruction set
✅ **Draggable terminal** on all platforms
✅ **Perfect mobile** responsiveness
✅ **Auto-save** to device storage
✅ **Offline capability** (PWA)
✅ **Beautiful dark theme**
✅ **Smooth animations** and transitions
✅ **Touch-optimized** interface
✅ **Production-ready** code
✅ **Fully documented** project

---

## 💬 Quick Tips

1. **Mobile First** - Design works perfectly on phones
2. **Drag Terminal** - Resize by grabbing the handle
3. **Click Instructions** - Insert code with one click
4. **Search Reference** - Type to find any instruction
5. **Touch Keyboard** - 16 quick-access buttons on mobile
6. **Terminal Auto-Open** - Automatically opens on run
7. **Auto-Save** - Every keystroke is saved locally
8. **Offline Mode** - Works without internet

---

Made with ❤️ by **Resolute Femi**

**Your complete 8086 emulator is ready to use!** 🚀⚙️
