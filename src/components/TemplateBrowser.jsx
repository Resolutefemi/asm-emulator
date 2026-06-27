// src/components/TemplateBrowser.jsx
import React, { useState } from 'react';

const TEMPLATES = [
  {
    id: 'hello-cpu',
    name: 'Hello, CPU!',
    description: 'Basic register manipulation and halt',
    category: 'Basics',
    code: `; Hello, CPU! - Basic 8086 Template
; Demonstrates register loading and halt

mov ax, 0x1234   ; Load AX with hex value
mov bx, 0x00FF   ; Load BX with mask
and ax, bx       ; AND operation
hlt              ; Halt execution
`,
  },
  {
    id: 'add-two-numbers',
    name: 'Add Two Numbers',
    description: 'Simple arithmetic: AX + BX → AX',
    category: 'Arithmetic',
    code: `; Add Two Numbers
; Adds BX to AX and stores result in AX

mov ax, 0x000A   ; AX = 10
mov bx, 0x0005   ; BX = 5
add ax, bx       ; AX = AX + BX = 15
hlt
`,
  },
  {
    id: 'subtraction',
    name: 'Subtraction',
    description: 'Subtract registers with flag check',
    category: 'Arithmetic',
    code: `; Subtraction with Flag Check
; Computes AX - BX and examines Zero/Sign flags

mov ax, 0x000A   ; AX = 10
mov bx, 0x000A   ; BX = 10
sub ax, bx       ; AX = 0, ZF set
jz equal         ; Jump if zero flag set

not_equal:
  mov cx, 0x0001 ; CX = 1 (not equal)
  hlt

equal:
  mov cx, 0x0000 ; CX = 0 (equal)
  hlt
`,
  },
  {
    id: 'bitwise-ops',
    name: 'Bitwise Operations',
    description: 'AND, OR, XOR, NOT examples',
    category: 'Bitwise',
    code: `; Bitwise Operations Demo
; Demonstrates AND / OR / XOR / NOT

mov ax, 0xFF00   ; AX = 1111 1111 0000 0000b
mov bx, 0x0FF0   ; BX = 0000 1111 1111 0000b

and ax, bx       ; AND  → 0000 1111 0000 0000b
mov cx, ax       ; Save result in CX

mov ax, 0xFF00
or  ax, bx       ; OR   → 1111 1111 1111 0000b

mov dx, ax
xor ax, bx       ; XOR  → 1111 0000 0000 0000b

not bx           ; NOT  → flip all bits of BX
hlt
`,
  },
  {
    id: 'loop-counter',
    name: 'Loop Counter',
    description: 'CX-based loop with decrement',
    category: 'Control Flow',
    code: `; Loop Counter
; Loops 5 times, incrementing AX each iteration

mov cx, 0x0005   ; Loop count = 5
mov ax, 0x0000   ; Accumulator = 0

loop_start:
  add ax, 0x0001 ; AX++
  dec cx         ; CX--
  jnz loop_start ; Repeat if CX != 0

hlt              ; AX should be 5
`,
  },
  {
    id: 'compare-jump',
    name: 'Compare & Jump',
    description: 'Conditional branching with CMP',
    category: 'Control Flow',
    code: `; Compare and Conditional Jump
; Checks if AX > BX and branches accordingly

mov ax, 0x0064   ; AX = 100
mov bx, 0x003C   ; BX = 60

cmp ax, bx       ; Set flags based on AX - BX
jnz ax_not_equal ; Jump if not equal

equal_branch:
  mov cx, 0xEEEE ; CX = equal sentinel
  hlt

ax_not_equal:
  mov cx, 0x1111 ; CX = not-equal sentinel
  hlt
`,
  },
  {
    id: 'stack-ops',
    name: 'Stack Operations',
    description: 'PUSH / POP register preservation',
    category: 'Stack',
    code: `; Stack Operations Demo
; Push registers onto stack and restore them

mov ax, 0xAAAA   ; AX = test value
mov bx, 0xBBBB   ; BX = test value
mov cx, 0xCCCC   ; CX = test value

push ax          ; Save AX
push bx          ; Save BX
push cx          ; Save CX

mov ax, 0x0000   ; Overwrite registers
mov bx, 0x0000
mov cx, 0x0000

pop cx           ; Restore CX (LIFO order)
pop bx           ; Restore BX
pop ax           ; Restore AX

hlt              ; Registers back to original
`,
  },
  {
    id: 'shift-rotate',
    name: 'Shift & Rotate',
    description: 'SHL, SHR, ROL, ROR demonstrations',
    category: 'Bitwise',
    code: `; Shift and Rotate Demo
; Multiply/divide by powers of 2 via bit shifts

mov ax, 0x0004   ; AX = 4
shl ax, 1        ; AX = 8  (multiply by 2)
shl ax, 1        ; AX = 16 (multiply by 2 again)

mov bx, ax       ; Save 16 in BX
shr bx, 2        ; BX = 4  (divide by 4)

mov cx, 0x8001   ; CX = 1000 0000 0000 0001b
rol cx, 1        ; CX = 0000 0000 0000 0011b (rotate left)
ror cx, 1        ; Back to original

hlt
`,
  },
  {
    id: 'dos-interrupt',
    name: 'DOS Print (INT 21h)',
    description: 'Print character via INT 21h AH=2',
    category: 'Interrupts',
    code: `; DOS Print Character via Interrupt
; Uses INT 21h service 02h to print 'H'

mov ah, 0x02     ; DOS service: print character
mov dl, 0x48     ; ASCII code for 'H'
int 0x21         ; Call DOS interrupt

mov dl, 0x69     ; 'i'
int 0x21

mov dl, 0x21     ; '!'
int 0x21

hlt
`,
  },
  {
    id: 'traffic-light',
    name: 'Traffic Light Controller',
    description: 'Cycles N-S and E-W traffic lights on Ports 12 & 13',
    category: 'Hardware I/O',
    code: `; Traffic Light Controller
; Controls N-S and E-W traffic lights via OUT instructions
; Port 12 (0Ch) controls N-S lights: 1=Red, 2=Yellow, 4=Green
; Port 13 (0Dh) controls E-W lights: 1=Red, 2=Yellow, 4=Green

mov cx, 5          ; Cycle 5 times
cycle_loop:
  ; State 1: N-S Green (4), E-W Red (1)
  mov al, 4
  out 12, al
  mov al, 1
  out 13, al
  call delay
  
  ; State 2: N-S Yellow (2), E-W Red (1)
  mov al, 2
  out 12, al
  call delay
  
  ; State 3: N-S Red (1), E-W Green (4)
  mov al, 1
  out 12, al
  mov al, 4
  out 13, al
  call delay
  
  ; State 4: N-S Red (1), E-W Yellow (2)
  mov al, 2
  out 13, al
  call delay
  
  dec cx
  jnz cycle_loop
  
; All Red and Halt
mov al, 1
out 12, al
out 13, al
hlt

delay:
  mov dx, 0x7FFF
delay_inner:
  dec dx
  jnz delay_inner
  ret
`,
  },
  {
    id: 'hardware-calc',
    name: 'Hardware Calculator',
    description: 'Arithmetic controller on Ports 14, 15, 16, and 18',
    category: 'Hardware I/O',
    code: `; Hardware Calculator Controller
; Port 14: Operand A
; Port 15: Operand B
; Port 16: Operator (1=+, 2=-, 3=*, 4=/)
; Port 18: Result Output

wait_op:
  in al, 16        ; Read operator
  cmp al, 0        ; Is it idle?
  jz wait_op       ; Loop if no operator
  
  mov cl, al       ; Save operator code
  in al, 14        ; Read Operand A
  mov ah, al       ; AH = Operand A
  in al, 15        ; AL = Operand B
  
  cmp cl, 1        ; Add?
  jz op_add
  cmp cl, 2        ; Sub?
  jz op_sub
  cmp cl, 3        ; Mul?
  jz op_mul
  cmp cl, 4        ; Div?
  jz op_div
  jmp done
  
op_add:
  add ah, al
  mov al, ah
  jmp write_res
  
op_sub:
  sub ah, al
  mov al, ah
  jmp write_res
  
op_mul:
  ; Multiply AH by AL via loop
  mov dl, al
  mov al, 0
mul_loop:
  cmp dl, 0
  jz write_res
  add al, ah
  dec dl
  jmp mul_loop
  
op_div:
  ; Divide AH by AL via loop
  cmp al, 0
  jz div_err
  mov dl, al
  mov al, 0
div_loop:
  cmp ah, dl
  jc write_res
  sub ah, dl
  inc al
  jmp div_loop
div_err:
  mov al, 0xFF     ; Error code
  jmp write_res
  
write_res:
  out 18, al       ; Output result to port 18
  
  ; Reset operator port to acknowledge calculation
  mov al, 0
  out 16, al
  jmp wait_op
  
done:
  hlt
`,
  },
  {
    id: 'robotic-machine',
    name: 'Robotic Machine Controller',
    description: 'Conveyor belt & robotic arm manufacturing loop (Ports 20-23)',
    category: 'Hardware I/O',
    code: `; Robotic Machine Controller
; Controls conveyor belts and robotic arms on ports 20-23
; Port 20: System Power (1=ON, 0=OFF)
; Port 21: Conveyor Speed (0-100)
; Port 22: Robot Arm Angle (0-180)
; Port 23: Robot Claw (1=Clamp, 0=Release)

start:
  mov al, 1        ; Turn machine ON
  out 20, al
  
  mov al, 60       ; Set conveyor speed to 60%
  out 21, al
  
  ; Perform a sequence of arm rotations and claws
  mov cx, 2        ; Loop twice
arm_seq:
  mov al, 45       ; Rotate arm left to pick-up point
  out 22, al
  call delay
  
  mov al, 1        ; Clamp claws (grab item)
  out 23, al
  call delay
  
  mov al, 135      ; Rotate arm right to drop-off point
  out 22, al
  call delay
  
  mov al, 0        ; Release claw (drop item)
  out 23, al
  call delay
  
  dec cx
  jnz arm_seq
  
  ; Stop conveyor and shutdown power
  mov al, 0
  out 21, al       ; Stop conveyor
  out 20, al       ; Power OFF
  hlt

delay:
  mov dx, 0x5FFF
delay_inner:
  dec dx
  jnz delay_inner
  ret
`,
  },
];

const CATEGORIES = [...new Set(TEMPLATES.map(t => t.category))];

const CodeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const CategoryIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
    <path d="M4 6h16M4 12h8M4 18h12"/>
  </svg>
);

export default function TemplateBrowser({ onInsertTemplate }) {
  const [selected, setSelected] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = TEMPLATES.filter(t => {
    const matchCat = activeCategory === 'All' || t.category === activeCategory;
    const matchSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="tmpl-browser">
      <div className="ws-section-title">SAMPLE CODE</div>

      {/* Search */}
      <div className="tmpl-search-wrap">
        <input
          type="text"
          className="tmpl-search"
          placeholder="Filter templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          id="tmpl-search-input"
          autoComplete="off"
          spellCheck="false"
        />
        {searchQuery && (
          <button className="tmpl-search-clear" onClick={() => setSearchQuery('')} title="Clear">
            ×
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="tmpl-categories">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            className={`tmpl-cat-pill${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template List */}
      <div className="tmpl-list">
        {filtered.length === 0 ? (
          <p className="tmpl-empty">No templates match your filter.</p>
        ) : (
          filtered.map(t => (
            <div
              key={t.id}
              id={`tmpl-item-${t.id}`}
              className={`tmpl-item${selected === t.id ? ' tmpl-item-selected' : ''}`}
              onClick={() => setSelected(t.id === selected ? null : t.id)}
            >
              <div className="tmpl-item-header">
                <span className="tmpl-item-icon"><CodeIcon /></span>
                <div className="tmpl-item-meta">
                  <span className="tmpl-item-name">{t.name}</span>
                  <span className="tmpl-item-desc">{t.description}</span>
                </div>
                <span className="tmpl-item-cat">{t.category}</span>
              </div>

              {selected === t.id && (
                <div className="tmpl-item-preview">
                  <pre className="tmpl-code-preview">{t.code}</pre>
                  <button
                    id={`tmpl-use-${t.id}`}
                    className="tmpl-use-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertTemplate(t.code, t.id);
                    }}
                  >
                    ↳ Use Template
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
