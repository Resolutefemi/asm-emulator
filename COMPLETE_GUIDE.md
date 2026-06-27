# 🚀 FINAL COMPLETE GUIDE - Renance Playground v2.0

**Your 8086 Emulator is Now COMPLETE** ✨

With:
- ✅ **80+ Instruction Set**
- ✅ **Draggable Terminal**
- ✅ **Perfect Mobile UI**
- ✅ **Offline-First**

---

## 📦 SETUP (5 Minutes)

### Step 1: Extract
```bash
unzip renance-playground.zip
cd renance-playground
```

### Step 2: Install
**Windows:**
```bash
INSTALL.bat
```

**Linux/macOS:**
```bash
./INSTALL.sh
```

### Step 3: Run
```bash
npm run tauri:dev
```

**Done!** App opens in 10 seconds.

---

## 🎮 USING THE APP

### Desktop (PC/Laptop)

#### Write Code
```asm
mov ax, 100
add ax, 50
cmp ax, 150
je success

mov bx, 0
jmp done

success:
  mov bx, 1

done:
  hlt
```

#### Run Your Code
1. Click **▶ Run** button
2. Terminal automatically opens
3. See output in terminal
4. CPU state updates on right side

#### Resize Terminal
1. Hover over terminal **handle** (⋮⋮)
2. Cursor changes to **resize** (↕)
3. **Drag up/down** to resize
4. **Min: 100px, Max: 600px**

#### Use Reference
1. Click **📚 Reference** button
2. Type to search: `add`, `jump`, `loop`
3. Click any instruction to insert
4. Shows opcode, flags, examples

#### CPU Visualization
- **💻 CPU State** - See register values & flags
- **💾 Memory** - See memory contents (hex)
- **📊 Output** - See execution log

### Mobile (Phone/Tablet)

#### Bottom Navbar (5 Tabs)
1. **💻** - CPU State
2. **💾** - Memory Inspector
3. **📊** - Output Log
4. **📚** - Instruction Reference
5. **💻** - Terminal

#### Write Code
- Full editor, auto-saves every keystroke
- Resize editor by dragging bottom

#### Insert Instructions
- Tap symbol keyboard buttons
- 16 common instructions at bottom
- Or search reference and click

#### Run Code
1. Click **▶ Run**
2. Terminal opens automatically
3. **Drag handle** to see full output
4. Switch between tabs to view CPU/Memory

#### Resize Terminal
1. **Tap & hold** the handle (⋮⋮)
2. **Drag up** to expand
3. **Drag down** to collapse
4. **Full width, max 50% screen**

#### Mobile Symbol Keyboard
```
mov   add   sub   cmp
and   or    xor   jmp
je    jne   loop  call
push  pop   ret   hlt
```

Click any to insert into editor!

---

## 🎯 COMPLETE EXAMPLE PROGRAM

```asm
; 8086 Assembly - Complete Example
; This program demonstrates multiple features

mov ax, 100         ; Load 100 into AX
mov bx, 50          ; Load 50 into BX
add ax, bx          ; AX = 150

cmp ax, 150         ; Compare with 150
je success          ; Jump if equal

mov cx, 0           ; Failed case
jmp done            ; Skip to done

success:
  mov cx, 1         ; Success case
  mov dx, 0xFF      ; Set DX

done:
  ; Show result
  ; CPU State will display all registers
  hlt               ; Halt execution
```

**Run this and see:**
- AX = 0x0096 (150 decimal)
- CX = 0x0001 (success)
- DX = 0x00FF
- All flags updated

---

## 🖥️ DESKTOP BUTTONS

| Button | Action | Result |
|--------|--------|--------|
| **▶ Run** | Execute code | Output shows, terminal opens |
| **🔄 Reset** | Clear CPU | Registers/flags reset to 0 |
| **🗑 Clear** | Delete code | Editor cleared, CPU reset |
| **📚 Reference** | Toggle panel | Show/hide instruction ref |
| **💻 Terminal** | Toggle terminal | Show/hide terminal output |

---

## 📱 MOBILE NAVIGATION

### Bottom 5-Button Bar
```
💻 CPU   💾 Memory   📊 Output   📚 Reference   💻 Terminal
```

**Tap to switch between views**

### Symbol Keyboard
```
4 rows × 4 columns = 16 buttons
Most used instructions
Auto-appears below editor
```

---

## 🔍 INSTRUCTION REFERENCE

### Search for Instructions
1. Open **📚 Reference** (desktop) or tab (mobile)
2. Type in search box:
   - `add` → shows ADD, ADC
   - `jump` → shows all JMP variants
   - `loop` → shows LOOP, LOOPE, LOOPNE
   - `shift` → shows SHL, SHR, SAR, ROL, ROR

### Click to Insert
- Click any instruction
- Auto-inserts into editor
- Shows full syntax

### Each Instruction Shows
- **Name**: MOV, ADD, JMP, etc.
- **Description**: What it does
- **Example**: How to use it
- **Opcode**: Machine code representation
- **Flags**: Which flags it affects

---

## 📊 CPU STATE DISPLAY

### Registers (16-bit)
```
AX = 0x1234  (decimal: 4660)
BX = 0x5678
CX = 0x0000
DX = 0xFFFF
SI = 0x0000
DI = 0x0000
BP = 0x0000
SP = 0xFFFF
```

### Flags
- **C** = Carry (0 or 1)
- **P** = Parity (even bits)
- **A** = Auxiliary Carry
- **Z** = Zero Flag (result is 0)
- **S** = Sign Flag (result is negative)
- **O** = Overflow Flag

### Memory Inspector
- Shows first 256 bytes
- Hex format with addresses
- 16 rows × 16 bytes

### Output/Terminal
- Line-by-line execution log
- Shows each instruction result
- Line numbers for reference

---

## 💡 HELPFUL TIPS

### 1. Auto-Save
- **Every keystroke saves**
- **IndexedDB storage** (device)
- **Reload page** - code is still there

### 2. Terminal
- **Auto-opens on Run**
- **Drag handle to resize**
- **Clear button** to empty
- **Close button** (✕) to hide

### 3. Mobile
- **Rotate to landscape** for more space
- **Tap navbar** to switch views
- **Drag terminal handle** to see more
- **Keyboard** closes if you scroll up

### 4. Reference
- **Search as you type**
- **Click to insert** - no typing needed
- **Works on both** desktop & mobile

### 5. CPU State
- **Updates in real-time**
- **Shows all** registers & flags
- **Hex & decimal** for numbers
- **Green = Set, Gray = Clear** (flags)

---

## 🎓 LEARNING PROGRESSION

### Level 1: Basics
```asm
mov ax, 100
hlt
```

### Level 2: Arithmetic
```asm
mov ax, 100
add ax, 50
hlt
```

### Level 3: Flags & Jumps
```asm
mov ax, 100
cmp ax, 100
je success
hlt
success:
  mov bx, 1
  hlt
```

### Level 4: Loops
```asm
mov cx, 10
loop_start:
  dec cx
  jnz loop_start
hlt
```

### Level 5: Stack
```asm
mov ax, 100
push ax
pop bx
hlt
```

### Level 6: Complex
- Combine multiple techniques
- Use all registers
- Multiple jumps & loops
- Bit manipulation

---

## 🔧 SWITCHING VERSIONS

### Use Complete Version (Recommended)
Edit `src/main.jsx`:
```javascript
import AppFinal from './AppFinal.jsx'
```

### Use Original Version
Edit `src/main.jsx`:
```javascript
import App from './App.jsx'
```

### Use Enhanced Version
Edit `src/main.jsx`:
```javascript
import AppEnhanced from './AppEnhanced.jsx'
```

---

## 📁 KEY FILES

```
src/
├── AppFinal.jsx              ← Latest complete version ⭐
├── AppEnhanced.jsx           ← Enhanced version
├── App.jsx                   ← Original version
├── styles/
│   ├── AppFinal.css         ← Complete styling ⭐
│   ├── AppMobile.css        ← Mobile styling
│   └── App.css              ← Original styling
├── emulator/
│   ├── Emulator8086Enhanced.js  ← Full ISA (80+ instructions) ⭐
│   └── Emulator8086.js          ← Basic emulator
└── data/
    └── InstructionSet8086.js   ← 80+ instructions database ⭐
```

**⭐ = Recommended/Latest**

---

## 🚀 DEPLOYMENT

### Desktop App
```bash
npm run tauri:build
# Creates Windows .msi, macOS .dmg, Linux .AppImage
```

### Web App
```bash
npm run build
# Deploy dist/ folder to Vercel/Netlify
```

### Mobile PWA
```bash
npm run build
# Open in mobile browser
# Tap menu → "Install" or "Add to Home Screen"
```

---

## ❓ FAQs

**Q: How do I save my code?**
A: Auto-saves every keystroke to device storage!

**Q: How do I use the terminal?**
A: Click Run - it opens automatically. Drag handle to resize.

**Q: How do I resize panels?**
A: On desktop drag the handle (⋮⋮). On mobile, similar.

**Q: Can I use on phone?**
A: YES! Fully mobile-optimized with bottom navbar & keyboard.

**Q: Does it work offline?**
A: YES! 100% offline - no internet needed.

**Q: How many instructions?**
A: **80+ complete 8086 instructions** with all details.

**Q: Can I search instructions?**
A: YES! Searchable reference with click-to-insert.

**Q: What about mobile keyboard?**
A: 16 common instructions, plus full search.

---

## 🎯 WHAT YOU CAN DO

✅ Write 8086 assembly code
✅ Execute and see results instantly
✅ View CPU state (all registers & flags)
✅ Inspect memory contents
✅ View execution output
✅ Search & insert instructions
✅ Resize terminal/panels
✅ Save code automatically
✅ Work offline completely
✅ Use on any device

---

## 📞 SUPPORT

### If Terminal Won't Open
- Click **▶ Run** button again
- Or click **💻 Terminal** button

### If Code Doesn't Run
- Check syntax (see examples)
- Look at error in output
- Try simpler code first

### If Mobile Keyboard Missing
- Make sure **📚 Reference** is closed
- Tap **📚** then back to **📊**

### If Terminal Won't Resize
- Make sure grabbing the **handle** (⋮⋮)
- Not the title bar

---

## ✅ QUICK CHECKLIST

- [ ] Extract ZIP file
- [ ] Run installer (INSTALL.sh or .bat)
- [ ] Run `npm run tauri:dev`
- [ ] Write assembly code
- [ ] Click ▶ Run
- [ ] See output in terminal
- [ ] Try dragging terminal handle
- [ ] Search for instruction
- [ ] Click to insert
- [ ] Try on mobile (or browser DevTools)
- [ ] Celebrate! 🎉

---

## 🎉 YOU'RE ALL SET!

Everything is installed and ready. Just:

```bash
npm run tauri:dev
```

**Your complete 8086 emulator opens in 10 seconds!**

Then:
1. Write code
2. Click Run
3. See output in terminal
4. Explore CPU state
5. Try different instructions
6. Build amazing programs!

---

**Made with ❤️ by Resolute Femi**

**Happy Emulating! ⚙️📱💻**
