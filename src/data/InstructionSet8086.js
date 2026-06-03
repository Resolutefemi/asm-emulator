// src/data/InstructionSet8086.js
/**
 * Complete 8086 Instruction Set Database
 * Includes all opcodes, operands, and descriptions
 */

export const INSTRUCTION_SET = {
  // DATA TRANSFER INSTRUCTIONS
  'mov': {
    opcode: ['8A/r', '8B/r', 'C6/0', 'C7/0', 'A0', 'A2', 'A1', 'A3'],
    operands: ['dest, src'],
    description: 'Move data between registers/memory',
    examples: ['mov ax, bx', 'mov ax, 100', 'mov [si], ax'],
    flags: 'none'
  },
  'movsx': {
    opcode: ['0F BE /r', '0F BF /r'],
    operands: ['dest, src'],
    description: 'Move with sign extension',
    examples: ['movsx ax, bl'],
    flags: 'none'
  },
  'movzx': {
    opcode: ['0F B6 /r', '0F B7 /r'],
    operands: ['dest, src'],
    description: 'Move with zero extension',
    examples: ['movzx ax, bl'],
    flags: 'none'
  },
  'push': {
    opcode: ['FF /6', '50 +rw'],
    operands: ['src'],
    description: 'Push value onto stack',
    examples: ['push ax', 'push 100'],
    flags: 'none'
  },
  'pop': {
    opcode: ['8F /0', '58 +rw'],
    operands: ['dest'],
    description: 'Pop value from stack',
    examples: ['pop ax', 'pop bx'],
    flags: 'none'
  },
  'xchg': {
    opcode: ['86 /r', '87 /r', '90 +rw'],
    operands: ['dest, src'],
    description: 'Exchange operands',
    examples: ['xchg ax, bx'],
    flags: 'none'
  },
  'lea': {
    opcode: ['8D /r'],
    operands: ['dest, src'],
    description: 'Load effective address',
    examples: ['lea si, [bx+1]'],
    flags: 'none'
  },
  'lds': {
    opcode: ['C5 /r'],
    operands: ['dest, src'],
    description: 'Load pointer using DS',
    examples: ['lds si, [bx]'],
    flags: 'none'
  },
  'les': {
    opcode: ['C4 /r'],
    operands: ['dest, src'],
    description: 'Load pointer using ES',
    examples: ['les si, [bx]'],
    flags: 'none'
  },

  // ARITHMETIC INSTRUCTIONS
  'add': {
    opcode: ['04 ib', '05 iw', '80 /0 ib', '81 /0 iw', '83 /0 ib', '00 /r', '01 /r', '02 /r', '03 /r'],
    operands: ['dest, src'],
    description: 'Add operands',
    examples: ['add ax, 100', 'add ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'adc': {
    opcode: ['14 ib', '15 iw', '80 /2 ib', '81 /2 iw', '83 /2 ib', '10 /r', '11 /r', '12 /r', '13 /r'],
    operands: ['dest, src'],
    description: 'Add with carry',
    examples: ['adc ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'sub': {
    opcode: ['2C ib', '2D iw', '80 /5 ib', '81 /5 iw', '83 /5 ib', '28 /r', '29 /r', '2A /r', '2B /r'],
    operands: ['dest, src'],
    description: 'Subtract operands',
    examples: ['sub ax, 100', 'sub ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'sbb': {
    opcode: ['1C ib', '1D iw', '80 /3 ib', '81 /3 iw', '83 /3 ib', '18 /r', '19 /r', '1A /r', '1B /r'],
    operands: ['dest, src'],
    description: 'Subtract with borrow',
    examples: ['sbb ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'mul': {
    opcode: ['F6 /4', 'F7 /4'],
    operands: ['src'],
    description: 'Multiply (unsigned)',
    examples: ['mul bx'],
    flags: 'O C'
  },
  'imul': {
    opcode: ['F6 /5', 'F7 /5', '6B /r ib', '69 /r iw'],
    operands: ['dest, src, imm'],
    description: 'Multiply (signed)',
    examples: ['imul ax, bx', 'imul ax, 100'],
    flags: 'O C'
  },
  'div': {
    opcode: ['F6 /6', 'F7 /6'],
    operands: ['src'],
    description: 'Divide (unsigned)',
    examples: ['div bx'],
    flags: 'undefined'
  },
  'idiv': {
    opcode: ['F6 /7', 'F7 /7'],
    operands: ['src'],
    description: 'Divide (signed)',
    examples: ['idiv bx'],
    flags: 'undefined'
  },
  'inc': {
    opcode: ['FE /0', 'FF /0', '40 +rw'],
    operands: ['dest'],
    description: 'Increment by 1',
    examples: ['inc ax', 'inc [si]'],
    flags: 'O D I T S Z A P'
  },
  'dec': {
    opcode: ['FE /1', 'FF /1', '48 +rw'],
    operands: ['dest'],
    description: 'Decrement by 1',
    examples: ['dec ax', 'dec [si]'],
    flags: 'O D I T S Z A P'
  },
  'neg': {
    opcode: ['F6 /3', 'F7 /3'],
    operands: ['dest'],
    description: 'Negate (two\'s complement)',
    examples: ['neg ax'],
    flags: 'O D I T S Z A P C'
  },
  'cmp': {
    opcode: ['3C ib', '3D iw', '80 /7 ib', '81 /7 iw', '83 /7 ib', '38 /r', '39 /r', '3A /r', '3B /r'],
    operands: ['dest, src'],
    description: 'Compare operands',
    examples: ['cmp ax, bx'],
    flags: 'O D I T S Z A P C'
  },

  // LOGIC INSTRUCTIONS
  'and': {
    opcode: ['24 ib', '25 iw', '80 /4 ib', '81 /4 iw', '83 /4 ib', '20 /r', '21 /r', '22 /r', '23 /r'],
    operands: ['dest, src'],
    description: 'Logical AND',
    examples: ['and ax, 0xFF', 'and ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'or': {
    opcode: ['0C ib', '0D iw', '80 /1 ib', '81 /1 iw', '83 /1 ib', '08 /r', '09 /r', '0A /r', '0B /r'],
    operands: ['dest, src'],
    description: 'Logical OR',
    examples: ['or ax, 0xFF', 'or ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'xor': {
    opcode: ['34 ib', '35 iw', '80 /6 ib', '81 /6 iw', '83 /6 ib', '30 /r', '31 /r', '32 /r', '33 /r'],
    operands: ['dest, src'],
    description: 'Logical XOR',
    examples: ['xor ax, ax', 'xor ax, bx'],
    flags: 'O D I T S Z A P C'
  },
  'not': {
    opcode: ['F6 /2', 'F7 /2'],
    operands: ['dest'],
    description: 'Logical NOT (one\'s complement)',
    examples: ['not ax'],
    flags: 'none'
  },
  'shl': {
    opcode: ['D0 /4', 'D1 /4', 'D2 /4', 'C0 /4 ib'],
    operands: ['dest, count'],
    description: 'Shift left',
    examples: ['shl ax, 1', 'shl ax, cl'],
    flags: 'O S Z A P C'
  },
  'shr': {
    opcode: ['D0 /5', 'D1 /5', 'D2 /5', 'C0 /5 ib'],
    operands: ['dest, count'],
    description: 'Shift right (logical)',
    examples: ['shr ax, 1', 'shr ax, cl'],
    flags: 'O S Z A P C'
  },
  'sar': {
    opcode: ['D0 /7', 'D1 /7', 'D2 /7', 'C0 /7 ib'],
    operands: ['dest, count'],
    description: 'Shift right (arithmetic)',
    examples: ['sar ax, 1'],
    flags: 'O S Z A P C'
  },
  'rol': {
    opcode: ['D0 /0', 'D1 /0', 'D2 /0', 'C0 /0 ib'],
    operands: ['dest, count'],
    description: 'Rotate left',
    examples: ['rol ax, 1'],
    flags: 'C O'
  },
  'ror': {
    opcode: ['D0 /1', 'D1 /1', 'D2 /1', 'C0 /1 ib'],
    operands: ['dest, count'],
    description: 'Rotate right',
    examples: ['ror ax, 1'],
    flags: 'C O'
  },
  'rcl': {
    opcode: ['D0 /2', 'D1 /2', 'D2 /2', 'C0 /2 ib'],
    operands: ['dest, count'],
    description: 'Rotate left through carry',
    examples: ['rcl ax, 1'],
    flags: 'C O'
  },
  'rcr': {
    opcode: ['D0 /3', 'D1 /3', 'D2 /3', 'C0 /3 ib'],
    operands: ['dest, count'],
    description: 'Rotate right through carry',
    examples: ['rcr ax, 1'],
    flags: 'C O'
  },

  // CONTROL TRANSFER INSTRUCTIONS
  'jmp': {
    opcode: ['E9 cw', 'EB cb', 'FF /4'],
    operands: ['destination'],
    description: 'Unconditional jump',
    examples: ['jmp start', 'jmp 0x1000'],
    flags: 'none'
  },
  'je': {
    opcode: ['74 cb', '0F 84 cw'],
    operands: ['destination'],
    description: 'Jump if equal (ZF=1)',
    examples: ['je label'],
    flags: 'none'
  },
  'jz': {
    opcode: ['74 cb', '0F 84 cw'],
    operands: ['destination'],
    description: 'Jump if zero (ZF=1)',
    examples: ['jz label'],
    flags: 'none'
  },
  'jne': {
    opcode: ['75 cb', '0F 85 cw'],
    operands: ['destination'],
    description: 'Jump if not equal (ZF=0)',
    examples: ['jne label'],
    flags: 'none'
  },
  'jnz': {
    opcode: ['75 cb', '0F 85 cw'],
    operands: ['destination'],
    description: 'Jump if not zero (ZF=0)',
    examples: ['jnz label'],
    flags: 'none'
  },
  'jo': {
    opcode: ['70 cb', '0F 80 cw'],
    operands: ['destination'],
    description: 'Jump if overflow (OF=1)',
    examples: ['jo label'],
    flags: 'none'
  },
  'jno': {
    opcode: ['71 cb', '0F 81 cw'],
    operands: ['destination'],
    description: 'Jump if no overflow (OF=0)',
    examples: ['jno label'],
    flags: 'none'
  },
  'js': {
    opcode: ['78 cb', '0F 88 cw'],
    operands: ['destination'],
    description: 'Jump if sign (SF=1)',
    examples: ['js label'],
    flags: 'none'
  },
  'jns': {
    opcode: ['79 cb', '0F 89 cw'],
    operands: ['destination'],
    description: 'Jump if no sign (SF=0)',
    examples: ['jns label'],
    flags: 'none'
  },
  'jp': {
    opcode: ['7A cb', '0F 8A cw'],
    operands: ['destination'],
    description: 'Jump if parity (PF=1)',
    examples: ['jp label'],
    flags: 'none'
  },
  'jpe': {
    opcode: ['7A cb', '0F 8A cw'],
    operands: ['destination'],
    description: 'Jump if parity even (PF=1)',
    examples: ['jpe label'],
    flags: 'none'
  },
  'jnp': {
    opcode: ['7B cb', '0F 8B cw'],
    operands: ['destination'],
    description: 'Jump if no parity (PF=0)',
    examples: ['jnp label'],
    flags: 'none'
  },
  'jpo': {
    opcode: ['7B cb', '0F 8B cw'],
    operands: ['destination'],
    description: 'Jump if parity odd (PF=0)',
    examples: ['jpo label'],
    flags: 'none'
  },
  'jc': {
    opcode: ['72 cb', '0F 82 cw'],
    operands: ['destination'],
    description: 'Jump if carry (CF=1)',
    examples: ['jc label'],
    flags: 'none'
  },
  'jnc': {
    opcode: ['73 cb', '0F 83 cw'],
    operands: ['destination'],
    description: 'Jump if no carry (CF=0)',
    examples: ['jnc label'],
    flags: 'none'
  },
  'jl': {
    opcode: ['7C cb', '0F 8C cw'],
    operands: ['destination'],
    description: 'Jump if less (SF≠OF)',
    examples: ['jl label'],
    flags: 'none'
  },
  'jge': {
    opcode: ['7D cb', '0F 8D cw'],
    operands: ['destination'],
    description: 'Jump if greater or equal (SF=OF)',
    examples: ['jge label'],
    flags: 'none'
  },
  'jle': {
    opcode: ['7E cb', '0F 8E cw'],
    operands: ['destination'],
    description: 'Jump if less or equal (ZF=1 or SF≠OF)',
    examples: ['jle label'],
    flags: 'none'
  },
  'jg': {
    opcode: ['7F cb', '0F 8F cw'],
    operands: ['destination'],
    description: 'Jump if greater (ZF=0 and SF=OF)',
    examples: ['jg label'],
    flags: 'none'
  },
  'jb': {
    opcode: ['72 cb', '0F 82 cw'],
    operands: ['destination'],
    description: 'Jump if below (CF=1)',
    examples: ['jb label'],
    flags: 'none'
  },
  'jae': {
    opcode: ['73 cb', '0F 83 cw'],
    operands: ['destination'],
    description: 'Jump if above or equal (CF=0)',
    examples: ['jae label'],
    flags: 'none'
  },
  'jbe': {
    opcode: ['76 cb', '0F 86 cw'],
    operands: ['destination'],
    description: 'Jump if below or equal (CF=1 or ZF=1)',
    examples: ['jbe label'],
    flags: 'none'
  },
  'ja': {
    opcode: ['77 cb', '0F 87 cw'],
    operands: ['destination'],
    description: 'Jump if above (CF=0 and ZF=0)',
    examples: ['ja label'],
    flags: 'none'
  },
  'loop': {
    opcode: ['E2 cb'],
    operands: ['destination'],
    description: 'Loop (CX≠0 after dec)',
    examples: ['loop start'],
    flags: 'none'
  },
  'loope': {
    opcode: ['E1 cb'],
    operands: ['destination'],
    description: 'Loop if equal (ZF=1, CX≠0)',
    examples: ['loope label'],
    flags: 'none'
  },
  'loopz': {
    opcode: ['E1 cb'],
    operands: ['destination'],
    description: 'Loop if zero (ZF=1, CX≠0)',
    examples: ['loopz label'],
    flags: 'none'
  },
  'loopne': {
    opcode: ['E0 cb'],
    operands: ['destination'],
    description: 'Loop if not equal (ZF=0, CX≠0)',
    examples: ['loopne label'],
    flags: 'none'
  },
  'loopnz': {
    opcode: ['E0 cb'],
    operands: ['destination'],
    description: 'Loop if not zero (ZF=0, CX≠0)',
    examples: ['loopnz label'],
    flags: 'none'
  },
  'call': {
    opcode: ['E8 cw', 'FF /2'],
    operands: ['destination'],
    description: 'Call subroutine',
    examples: ['call func', 'call 0x1000'],
    flags: 'none'
  },
  'ret': {
    opcode: ['C3', 'C2 iw'],
    operands: [],
    description: 'Return from subroutine',
    examples: ['ret'],
    flags: 'none'
  },

  // STRING INSTRUCTIONS
  'movsb': {
    opcode: ['A4'],
    operands: [],
    description: 'Move byte string',
    examples: ['movsb'],
    flags: 'none'
  },
  'movsw': {
    opcode: ['A5'],
    operands: [],
    description: 'Move word string',
    examples: ['movsw'],
    flags: 'none'
  },
  'stosb': {
    opcode: ['AA'],
    operands: [],
    description: 'Store byte string',
    examples: ['stosb'],
    flags: 'none'
  },
  'stosw': {
    opcode: ['AB'],
    operands: [],
    description: 'Store word string',
    examples: ['stosw'],
    flags: 'none'
  },
  'lodsb': {
    opcode: ['AC'],
    operands: [],
    description: 'Load byte string',
    examples: ['lodsb'],
    flags: 'none'
  },
  'lodsw': {
    opcode: ['AD'],
    operands: [],
    description: 'Load word string',
    examples: ['lodsw'],
    flags: 'none'
  },
  'cmpsb': {
    opcode: ['A6'],
    operands: [],
    description: 'Compare byte string',
    examples: ['cmpsb'],
    flags: 'O D I T S Z A P C'
  },
  'cmpsw': {
    opcode: ['A7'],
    operands: [],
    description: 'Compare word string',
    examples: ['cmpsw'],
    flags: 'O D I T S Z A P C'
  },

  // FLAG INSTRUCTIONS
  'stc': {
    opcode: ['F9'],
    operands: [],
    description: 'Set carry flag',
    examples: ['stc'],
    flags: 'C'
  },
  'clc': {
    opcode: ['F8'],
    operands: [],
    description: 'Clear carry flag',
    examples: ['clc'],
    flags: 'C'
  },
  'cmc': {
    opcode: ['F5'],
    operands: [],
    description: 'Complement carry flag',
    examples: ['cmc'],
    flags: 'C'
  },
  'std': {
    opcode: ['FD'],
    operands: [],
    description: 'Set direction flag',
    examples: ['std'],
    flags: 'D'
  },
  'cld': {
    opcode: ['FC'],
    operands: [],
    description: 'Clear direction flag',
    examples: ['cld'],
    flags: 'D'
  },
  'sti': {
    opcode: ['FB'],
    operands: [],
    description: 'Set interrupt flag',
    examples: ['sti'],
    flags: 'I'
  },
  'cli': {
    opcode: ['FA'],
    operands: [],
    description: 'Clear interrupt flag',
    examples: ['cli'],
    flags: 'I'
  },

  // MISC INSTRUCTIONS
  'nop': {
    opcode: ['90'],
    operands: [],
    description: 'No operation',
    examples: ['nop'],
    flags: 'none'
  },
  'hlt': {
    opcode: ['F4'],
    operands: [],
    description: 'Halt CPU',
    examples: ['hlt'],
    flags: 'none'
  },
  'int': {
    opcode: ['CC', 'CD ib'],
    operands: ['number'],
    description: 'Software interrupt',
    examples: ['int 3', 'int 0x21'],
    flags: 'all'
  },
  'iret': {
    opcode: ['CF'],
    operands: [],
    description: 'Return from interrupt',
    examples: ['iret'],
    flags: 'all'
  },
};

export const REGISTERS = [
  'ax', 'bx', 'cx', 'dx',  // 16-bit general
  'ah', 'al', 'bh', 'bl', 'ch', 'cl', 'dh', 'dl',  // 8-bit
  'si', 'di', 'bp', 'sp',  // Index/pointer
  'cs', 'ds', 'es', 'ss',  // Segment
  'ip', 'flags'  // Special
];

export const FLAG_BITS = {
  'O': { bit: 11, name: 'Overflow Flag', description: 'Set on signed overflow' },
  'D': { bit: 10, name: 'Direction Flag', description: 'String operation direction' },
  'I': { bit: 9, name: 'Interrupt Flag', description: 'Enable interrupts' },
  'T': { bit: 8, name: 'Trap Flag', description: 'Single-step debugging' },
  'S': { bit: 7, name: 'Sign Flag', description: 'Set if result is negative' },
  'Z': { bit: 6, name: 'Zero Flag', description: 'Set if result is zero' },
  'A': { bit: 4, name: 'Auxiliary Carry Flag', description: 'BCD arithmetic carry' },
  'P': { bit: 2, name: 'Parity Flag', description: 'Even parity of result' },
  'C': { bit: 0, name: 'Carry Flag', description: 'Set if carry/borrow occurred' }
};

export const OPERAND_TYPES = {
  'r': 'Register (8/16-bit)',
  'rm': 'Register or Memory',
  'imm': 'Immediate (constant)',
  'rel': 'Relative offset',
  'm': 'Memory address',
  'sreg': 'Segment register',
  'ib': 'Immediate byte',
  'iw': 'Immediate word',
  'cb': 'Code offset (byte)',
  'cw': 'Code offset (word)'
};

export function getInstruction(name) {
  return INSTRUCTION_SET[name.toLowerCase()];
}

export function searchInstructions(query) {
  query = query.toLowerCase();
  return Object.entries(INSTRUCTION_SET)
    .filter(([name, data]) => 
      name.includes(query) || 
      data.description.toLowerCase().includes(query) ||
      data.examples.some(e => e.toLowerCase().includes(query))
    )
    .map(([name, data]) => ({ name, ...data }));
}
