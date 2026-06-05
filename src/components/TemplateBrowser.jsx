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
                      onInsertTemplate(t.code);
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
