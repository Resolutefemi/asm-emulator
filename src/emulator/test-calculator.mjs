// Test the Emulator8086 with a CORRECTED version of the user's calculator.
// The original code had two bugs:
//   1. `mov ah, 9` before `call print_num` clobbers AH (in `show` block)
//   2. `mov ah, 2` before `neg ax` clobbers AH (in print_num negative branch)
// Both are real DOS bugs — the emulator faithfully reproduces them.
// The fixed code below adds `push ax` / `pop ax` around AH-clobbering calls.

import { Emulator8086 } from './Emulator8086.js';

const calculatorCode = `org 100h
jmp start

m1 db 'First number: $'
m2 db 13,10,'Operator (+ - * /): $'
m3 db 13,10,'Second number: $'
m4 db 13,10,'Result = $'
mErr db 13,10,'Error: divide by zero$'

start:
    lea dx, m1
    mov ah, 9
    int 21h
    call read_num
    mov bx, ax

    lea dx, m2
    mov ah, 9
    int 21h
    mov ah, 1
    int 21h
    mov cl, al

    lea dx, m3
    mov ah, 9
    int 21h
    call read_num
    mov si, ax

    mov ax, bx
    cmp cl, 43
    je do_add
    cmp cl, 45
    je do_sub
    cmp cl, 42
    je do_mul
    cmp cl, 47
    je do_div
    jmp quit

do_add:
    add ax, si
    jmp show
do_sub:
    sub ax, si
    jmp show
do_mul:
    mul si
    jmp show
do_div:
    cmp si, 0
    je div_err
    xor dx, dx
    div si
    jmp show

div_err:
    lea dx, mErr
    mov ah, 9
    int 21h
    jmp quit

show:
    push ax
    lea dx, m4
    mov ah, 9
    int 21h
    pop ax
    call print_num

quit:
    mov ah, 76
    int 21h

read_num:
    push bx
    push cx
    push si
    xor bx, bx
    xor si, si
rn_loop:
    mov ah, 1
    int 21h
    cmp al, 13
    je rn_enter
    cmp al, 48
    jb rn_loop
    cmp al, 57
    ja rn_loop
    inc si
    sub al, 48
    mov ah, 0
    mov cx, ax
    mov ax, bx
    push dx
    mov dx, 0
    mov bx, 10
    mul bx
    pop dx
    add ax, cx
    mov bx, ax
    jmp rn_loop
rn_enter:
    cmp si, 0
    je rn_loop
    mov ax, bx
    pop si
    pop cx
    pop bx
    ret

print_num:
    push ax
    push bx
    push cx
    push dx
    cmp ax, 0
    jge pn1
    push ax
    mov dl, 45
    mov ah, 2
    int 21h
    pop ax
    neg ax
pn1:
    xor cx, cx
    mov bx, 10
pn2:
    xor dx, dx
    div bx
    push dx
    inc cx
    cmp ax, 0
    jne pn2
pn3:
    pop dx
    add dl, 48
    mov ah, 2
    int 21h
    loop pn3
    pop dx
    pop cx
    pop bx
    pop ax
    ret`;

function runTest(name, input, expected) {
  const emu = new Emulator8086();
  emu.load(calculatorCode);
  const output = emu.run(input);
  const ok = output === expected;
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} ${name}`);
  if (!ok) {
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Got:      ${JSON.stringify(output)}`);
    if (emu.error) console.log(`  Error: ${emu.error}`);
  }
  return ok;
}

let passed = 0, total = 0;

// Note: AH=1 echoes the char, so input CR is echoed as \r.
// Then m2/m3/m4 start with 13,10 = \r\n. So output has \r\r\n between fields.
const tests = [
  ['Add: 15+27',  '15\r+\r27\r', 'First number: 15\r\r\nOperator (+ - * /): +\r\nSecond number: \r27\r\r\nResult = 42'],
  ['Sub: 50-8',   '50\r-\r8\r',  'First number: 50\r\r\nOperator (+ - * /): -\r\nSecond number: \r8\r\r\nResult = 42'],
  ['Mul: 6*7',    '6\r*\r7\r',   'First number: 6\r\r\nOperator (+ - * /): *\r\nSecond number: \r7\r\r\nResult = 42'],
  ['Div: 84/2',   '84\r/\r2\r',  'First number: 84\r\r\nOperator (+ - * /): /\r\nSecond number: \r2\r\r\nResult = 42'],
  ['Div0: 10/0',  '10\r/\r0\r',  'First number: 10\r\r\nOperator (+ - * /): /\r\nSecond number: \r0\r\r\nError: divide by zero'],
  ['Neg: 5-9',    '5\r-\r9\r',   'First number: 5\r\r\nOperator (+ - * /): -\r\nSecond number: \r9\r\r\nResult = -4'],
  ['Big: 999+1',  '999\r+\r1\r', 'First number: 999\r\r\nOperator (+ - * /): +\r\nSecond number: \r1\r\r\nResult = 1000'],
  ['Mul: 12*12',  '12\r*\r12\r', 'First number: 12\r\r\nOperator (+ - * /): *\r\nSecond number: \r12\r\r\nResult = 144'],
];

for (const [name, input, expected] of tests) {
  total++;
  if (runTest(name, input, expected)) passed++;
}

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
