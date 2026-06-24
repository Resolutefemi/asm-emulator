// src/emulator/Emulator8086.js
// Comprehensive 8086 emulator with DOS INT 21h services.
// Supports: full instruction set, all addressing modes, db/dw/dd/equ,
// labels, org, segment directives, INT 21h (AH=1/2/9/0Ah/4Ch/76),
// pre-provided input buffer for interactive programs.

const PAGE_SIZE = 0x10000; // 64KB default segment size for COM model

/* ============================================================
   Helpers
   ============================================================ */

function parseNumeric(str) {
  str = String(str).trim();
  if (!str) return NaN;
  // Hex: 0xNN or NNh
  if (/^0x[0-9a-f]+$/i.test(str)) return parseInt(str.substring(2), 16);
  if (/^[0-9][0-9a-f]*h$/i.test(str)) return parseInt(str.substring(0, str.length - 1), 16);
  // Binary: 0bNN or NNb
  if (/^0b[01]+$/i.test(str)) return parseInt(str.substring(2), 2);
  if (/^[01]+b$/i.test(str)) return parseInt(str.substring(0, str.length - 1), 2);
  // Octal: NNq or NNo
  if (/^[0-7]+[qo]$/i.test(str)) return parseInt(str.substring(0, str.length - 1), 8);
  // Char literal: 'A' or 'A'
  const charMatch = str.match(/^'(.+)'$/);
  if (charMatch) {
    // Take first char's code; multi-char gets packed (low byte = first char)
    const s = charMatch[1];
    if (s.length === 1) return s.charCodeAt(0);
    // Multi-char: pack as little-endian (emasm convention)
    let val = 0;
    for (let i = Math.min(s.length, 2) - 1; i >= 0; i--) {
      val = (val << 8) | s.charCodeAt(i);
    }
    return val;
  }
  // Decimal
  if (/^-?[0-9]+$/.test(str)) return parseInt(str, 10);
  // Constant identifier (e.g. EQU) — caller resolves
  return null;
}

function toU8(v)  { return v & 0xFF; }
function toU16(v) { return v & 0xFFFF; }
function toU32(v) { return v >>> 0; }

function sign8(v)  { v = toU8(v);  return v >= 0x80 ? v - 0x100 : v; }
function sign16(v) { v = toU16(v); return v >= 0x8000 ? v - 0x10000 : v; }

function parity(v) {
  v = toU8(v);
  let p = 0;
  for (let i = 0; i < 8; i++) if (v & (1 << i)) p++;
  return (p & 1) ? 0 : 1; // PF=1 if even number of bits set
}

/* ============================================================
   Tokenizer — splits each line into label, mnemonic, operands
   ============================================================ */

function tokenizeLine(rawLine) {
  // Strip comment (but not inside quotes)
  let inQuote = false;
  let quoteChar = '';
  let code = '';
  for (let i = 0; i < rawLine.length; i++) {
    const c = rawLine[i];
    if (inQuote) {
      code += c;
      if (c === quoteChar) inQuote = false;
    } else if (c === ';' || c === '\n') {
      break;
    } else if (c === "'" || c === '"') {
      inQuote = true;
      quoteChar = c;
      code += c;
    } else {
      code += c;
    }
  }
  code = code.trim();
  if (!code) return null;

  // Extract optional label prefix
  let label = null;
  // Label: identifier followed by ':' at start of line
  const labelMatch = code.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
  if (labelMatch) {
    label = labelMatch[1];
    code = labelMatch[2].trim();
  }

  // Also support "labelname instruction..." without colon? No — ambiguous with `proc`.
  // We require ':' for code labels.

  if (!code) return { label, mnemonic: null, operands: [] };

  // Extract mnemonic (first token) — may have a dot prefix (.model, .code, etc.)
  const mnemMatch = code.match(/^(\.?[a-zA-Z_][a-zA-Z0-9_]*)\s*(.*)$/);
  if (!mnemMatch) return { label, mnemonic: null, operands: [code] };
  const mnemonic = mnemMatch[1];
  const rest = mnemMatch[2].trim();

  // Split operands by comma, respecting quotes and brackets
  const operands = splitOperands(rest);
  return { label, mnemonic, operands };
}

function splitOperands(str) {
  if (!str) return [];
  const result = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let bracketDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inQuote) {
      current += c;
      if (c === quoteChar) inQuote = false;
    } else if (c === "'" || c === '"') {
      inQuote = true;
      quoteChar = c;
      current += c;
    } else if (c === '[') {
      bracketDepth++;
      current += c;
    } else if (c === ']') {
      bracketDepth--;
      current += c;
    } else if (c === ',' && bracketDepth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/* ============================================================
   Data value parser — handles 'strings', numbers, ?, DUP
   ============================================================ */

function parseDataValues(str) {
  const values = [];
  const items = splitOperands(str);
  for (let item of items) {
    item = item.trim();
    if (!item) continue;

    // DUP expression: N DUP(value)
    const dupMatch = item.match(/^(\d+)\s+DUP\s*\((.*)\)$/i);
    if (dupMatch) {
      const count = parseInt(dupMatch[1], 10);
      const inner = parseDataValues(dupMatch[2]);
      for (let i = 0; i < count; i++) {
        values.push(...inner);
      }
      continue;
    }

    // ? (uninitialized)
    if (item === '?') {
      values.push(0);
      continue;
    }

    // String literal
    const strMatch = item.match(/^'(.*)'$/);
    if (strMatch) {
      for (const ch of strMatch[1]) values.push(ch.charCodeAt(0));
      continue;
    }
    const strMatch2 = item.match(/^"(.*)"$/);
    if (strMatch2) {
      for (const ch of strMatch2[1]) values.push(ch.charCodeAt(0));
      continue;
    }

    // Numeric
    const num = parseNumeric(item);
    if (num !== null && !isNaN(num)) {
      values.push(num);
    } else {
      // Symbol reference — store as string for later resolution
      values.push({ symbol: item.toLowerCase() });
    }
  }
  return values;
}

/* ============================================================
   Operand parser — classifies an operand string
   ============================================================ */

const REG16 = new Set(['ax','bx','cx','dx','si','di','bp','sp','cs','ds','es','ss']);
const REG8  = new Set(['al','ah','bl','bh','cl','ch','dl','dh']);

class Operand {
  constructor(type, props = {}) {
    this.type = type; // 'reg8','reg16','imm','mem','label'
    Object.assign(this, props);
  }
}

function parseOperand(str, symbolTable) {
  if (!str) return null;
  const s = str.trim();
  const lower = s.toLowerCase();

  // Strip 'offset' / 'ptr' prefixes — handle them via context
  // offset X → load address of X (immediate)
  const offsetMatch = lower.match(/^offset\s+(.+)$/i);
  if (offsetMatch) {
    const sym = offsetMatch[1].trim().toLowerCase();
    if (symbolTable && symbolTable.hasOwnProperty(sym)) {
      return new Operand('imm', { value: symbolTable[sym], isOffset: true });
    }
    // Could be an expression like offset [bx+si] — unusual; treat as label
    return new Operand('imm', { value: 0, symbolRef: sym, isOffset: true });
  }

  // size prefix: byte ptr / word ptr / dword ptr
  let sizeOverride = null;
  const sizeMatch = lower.match(/^(byte|word|dword)\s+ptr\s+(.+)$/i);
  if (sizeMatch) {
    sizeOverride = sizeMatch[1].toLowerCase();
    return parseOperand(sizeMatch[2], symbolTable);
  }

  // Register 8-bit
  if (REG8.has(lower)) return new Operand('reg8', { name: lower });
  // Register 16-bit
  if (REG16.has(lower)) return new Operand('reg16', { name: lower });

  // Memory reference [expr]
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.substring(1, s.length - 1).trim();
    return new Operand('mem', { expr: inner, sizeHint: sizeOverride });
  }

  // Immediate: try numeric
  const num = parseNumeric(s);
  if (num !== null && !isNaN(num)) {
    return new Operand('imm', { value: num });
  }

  // Char literal
  const charM = s.match(/^'(.+)'$/);
  if (charM) {
    return new Operand('imm', { value: charM[1].charCodeAt(0) });
  }

  // Symbol (label)
  if (symbolTable && symbolTable.hasOwnProperty(lower)) {
    return new Operand('imm', { value: symbolTable[lower], symbolRef: lower });
  }

  // Forward reference — return as label, will be resolved later
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
    return new Operand('label', { name: lower });
  }

  // Expression like BX+SI+4 — try as memory
  return new Operand('mem', { expr: s, sizeHint: sizeOverride });
}

/* ============================================================
   Memory operand address parser
   Supports: [bx], [si], [di], [bp], [bx+si], [bx+di], [bp+si],
            [bp+di], [disp], [bx+disp], [bp+disp], [si+disp], [di+disp]
   ============================================================ */

function evalMemoryExpr(expr, cpu) {
  // Normalize
  expr = expr.trim().toLowerCase().replace(/\s+/g, '');

  // Replace register names with their values
  // Order matters: match 'bx' before 'b', 'si' before 's', etc.
  let sum = 0;
  let hasBase = false;
  let hasIndex = false;
  let rest = expr;

  // Extract registers
  const regPairs = [
    { name: 'bx', get: () => cpu.registers.bx },
    { name: 'bp', get: () => cpu.registers.bp },
    { name: 'si', get: () => cpu.registers.si },
    { name: 'di', get: () => cpu.registers.di },
  ];
  for (const rp of regPairs) {
    const re = new RegExp(`\\b${rp.name}\\b`, 'g');
    if (re.test(rest)) {
      sum = (sum + rp.get()) & 0xFFFF;
      rest = rest.replace(re, '');
      if (rp.name === 'bx' || rp.name === 'bp') hasBase = true;
      else hasIndex = true;
    }
  }

  // Now rest should be like "+4+5" or "-2" or ""
  rest = rest.replace(/^\+/, '').trim();
  if (rest) {
    // Could be multiple +N or -N parts
    const parts = rest.match(/[+-][^+-]+/g) || (rest ? ['+' + rest] : []);
    for (const p of parts) {
      const v = parseNumeric(p.replace(/^\+/, ''));
      if (v !== null && !isNaN(v)) sum = (sum + v) & 0xFFFF;
      else if (cpu.symbolTable && cpu.symbolTable.hasOwnProperty(p.replace(/^[+-]/,'').toLowerCase())) {
        const symVal = cpu.symbolTable[p.replace(/^[+-]/,'').toLowerCase()];
        // sign handling
        const sign = p.startsWith('-') ? -1 : 1;
        sum = (sum + sign * symVal) & 0xFFFF;
      }
    }
  }

  return sum;
}

/* ============================================================
   Main Emulator class
   ============================================================ */

export class Emulator8086 {
  constructor() {
    this.reset();
  }

  reset() {
    this.registers = {
      ax: 0, bx: 0, cx: 0, dx: 0,
      si: 0, di: 0, bp: 0, sp: 0xFFFE,
      cs: 0, ds: 0, es: 0, ss: 0,
      ip: 0,
    };

    this.flags = {
      cf: 0, pf: 0, af: 0, zf: 0, sf: 0, tf: 0, iflag: 1, df: 0, of: 0,
    };

    // 1MB linear memory (8086 has 20-bit address bus)
    this.memory = new Uint8Array(0x100000);

    this.symbolTable = {};      // label -> address
    this.symbolSizes = {};      // label -> byte size (1/2/4)
    this.instructions = [];     // [{ addr, mnemonic, operands, raw }]
    this.addrToInstrIdx = {};   // address -> instruction index
    this.entryPoint = 0x100;    // COM programs start at 0x100
    this.output = '';
    this.inputBuffer = '';
    this.inputPos = 0;
    this.halted = false;
    this.error = null;
    this.lastInstruction = null;
    this.stepCount = 0;
    this.maxSteps = 100000;
    this.codeStartAddr = 0x100;
    this.orgSet = false;

    // I/O ports — used by the DebuggerWidget (robot/traffic/calc/machine).
    // OUT <port>, <val> writes here; IN <dest>, <port> reads from here.
    this.ports = {};
    // Callback set by DebuggerWidget: onPortWrite(port, value)
    // NOTE: preserve across reset() — the DebuggerWidget sets this once
    // and expects it to survive load()/parse() calls. Only clear it in
    // the constructor (which already happens via field initialization).
    if (!this.onPortWrite) {
      this.onPortWrite = null;
    }
    this.segment = 0; // currently DS (and CS, ES, SS for COM model)
  }

  /* -------------------- Memory helpers -------------------- */
  // For COM programs, all segments are 0; address = offset.
  // We use linear addresses (segment * 16 + offset), but with seg=0 it's just offset.
  memAddr(offset) { return toU16(offset); }

  readByte(addr) { return this.memory[toU16(addr)]; }
  readWord(addr) {
    return (this.memory[toU16(addr)] | (this.memory[toU16(addr + 1)] << 8)) & 0xFFFF;
  }
  readDword(addr) {
    return (this.memory[toU16(addr)]
      | (this.memory[toU16(addr + 1)] << 8)
      | (this.memory[toU16(addr + 2)] << 16)
      | (this.memory[toU16(addr + 3)] << 24)) >>> 0;
  }
  writeByte(addr, val) { this.memory[toU16(addr)] = toU8(val); }
  writeWord(addr, val) {
    this.memory[toU16(addr)] = toU8(val);
    this.memory[toU16(addr + 1)] = toU8(val >> 8);
  }
  writeDword(addr, val) {
    this.memory[toU16(addr)]     = toU8(val);
    this.memory[toU16(addr + 1)] = toU8(val >> 8);
    this.memory[toU16(addr + 2)] = toU8(val >> 16);
    this.memory[toU16(addr + 3)] = toU8(val >> 24);
  }

  /* -------------------- Stack helpers -------------------- */
  push16(val) {
    this.registers.sp = toU16(this.registers.sp - 2);
    this.writeWord(this.registers.sp, val);
  }
  pop16() {
    const v = this.readWord(this.registers.sp);
    this.registers.sp = toU16(this.registers.sp + 2);
    return v;
  }

  /* -------------------- Register access -------------------- */
  getReg8(name) {
    switch (name) {
      case 'al': return this.registers.ax & 0xFF;
      case 'ah': return (this.registers.ax >> 8) & 0xFF;
      case 'bl': return this.registers.bx & 0xFF;
      case 'bh': return (this.registers.bx >> 8) & 0xFF;
      case 'cl': return this.registers.cx & 0xFF;
      case 'ch': return (this.registers.cx >> 8) & 0xFF;
      case 'dl': return this.registers.dx & 0xFF;
      case 'dh': return (this.registers.dx >> 8) & 0xFF;
    }
    throw new Error(`Unknown 8-bit register: ${name}`);
  }
  setReg8(name, val) {
    val = toU8(val);
    switch (name) {
      case 'al': this.registers.ax = (this.registers.ax & 0xFF00) | val; return;
      case 'ah': this.registers.ax = (this.registers.ax & 0x00FF) | (val << 8); return;
      case 'bl': this.registers.bx = (this.registers.bx & 0xFF00) | val; return;
      case 'bh': this.registers.bx = (this.registers.bx & 0x00FF) | (val << 8); return;
      case 'cl': this.registers.cx = (this.registers.cx & 0xFF00) | val; return;
      case 'ch': this.registers.cx = (this.registers.cx & 0x00FF) | (val << 8); return;
      case 'dl': this.registers.dx = (this.registers.dx & 0xFF00) | val; return;
      case 'dh': this.registers.dx = (this.registers.dx & 0x00FF) | (val << 8); return;
    }
    throw new Error(`Unknown 8-bit register: ${name}`);
  }
  getReg16(name) {
    if (REG16.has(name)) return this.registers[name];
    throw new Error(`Unknown 16-bit register: ${name}`);
  }
  setReg16(name, val) {
    if (REG16.has(name)) { this.registers[name] = toU16(val); return; }
    throw new Error(`Unknown 16-bit register: ${name}`);
  }

  /* -------------------- Operand evaluation -------------------- */
  // Returns { kind: 'reg8'|'reg16'|'mem'|'imm', value, size, name, addr }
  evalOperand(op) {
    if (!op) return { kind: 'imm', value: 0, size: 0 };

    switch (op.type) {
      case 'reg8':
        return { kind: 'reg8', value: this.getReg8(op.name), size: 1, name: op.name };
      case 'reg16':
        return { kind: 'reg16', value: this.getReg16(op.name), size: 2, name: op.name };
      case 'imm':
        return { kind: 'imm', value: toU16(op.value), size: op.value > 0xFF ? 2 : 2, raw: op.value };
      case 'label':
        // Resolve from symbol table
        if (this.symbolTable.hasOwnProperty(op.name)) {
          return { kind: 'imm', value: this.symbolTable[op.name], size: 2 };
        }
        throw new Error(`Undefined symbol: ${op.name}`);
      case 'mem': {
        const addr = evalMemoryExpr(op.expr, this);
        // Determine size from context (caller sets via operand.sizeHint or instruction context)
        return { kind: 'mem', addr, size: op.sizeHint === 'byte' ? 1 : (op.sizeHint === 'dword' ? 4 : 2), value: 0 };
      }
    }
    throw new Error(`Cannot evaluate operand: ${JSON.stringify(op)}`);
  }

  // Get value from operand (read source)
  getOperandValue(op, sizeHint = 0) {
    const e = this.evalOperand(op);
    if (e.kind === 'reg8') return e.value;
    if (e.kind === 'reg16') return e.value;
    if (e.kind === 'imm') return e.value;
    if (e.kind === 'mem') {
      const size = sizeHint || e.size;
      if (size === 1) return this.readByte(e.addr);
      if (size === 4) return this.readDword(e.addr);
      return this.readWord(e.addr);
    }
    return 0;
  }

  // Set value to operand (write dest)
  setOperandValue(op, val, sizeHint = 0) {
    const e = this.evalOperand(op);
    if (e.kind === 'reg8') { this.setReg8(e.name, val); return; }
    if (e.kind === 'reg16') { this.setReg16(e.name, val); return; }
    if (e.kind === 'mem') {
      const size = sizeHint || e.size;
      if (size === 1) this.writeByte(e.addr, val);
      else if (size === 4) this.writeDword(e.addr, val);
      else this.writeWord(e.addr, val);
      return;
    }
    throw new Error(`Cannot write to immediate operand`);
  }

  // Determine operand size based on the OTHER operand (for ambiguous [mem])
  operandSize(op, otherIsByte) {
    if (op.type === 'reg8') return 1;
    if (op.type === 'reg16') return 2;
    if (op.type === 'mem') {
      if (op.sizeHint === 'byte') return 1;
      if (op.sizeHint === 'dword') return 4;
      // Infer from other operand
      return otherIsByte ? 1 : 2;
    }
    if (op.type === 'imm') return otherIsByte ? 1 : 2;
    return 2;
  }

  /* ============================================================
     Loader / Assembler
     ============================================================ */

  // Alias for load() — kept for backward compatibility with the
  // terminal command handler in AppFinal.jsx which calls .parse().
  parse(asmCode) {
    return this.load(asmCode);
  }

  load(asmCode) {
    this.reset();
    const lines = asmCode.split('\n');
    const tokens = [];
    for (let i = 0; i < lines.length; i++) {
      const t = tokenizeLine(lines[i]);
      if (t) tokens.push({ ...t, lineNum: i + 1, raw: lines[i] });
    }

    // ----- PASS 1: collect labels, EQU constants, data, compute addresses -----
    let currentAddr = 0x100; // COM model default
    let pendingInstrs = []; // instructions to assemble in pass 2

    // First: scan for org directive (must come first logically, but we'll honor it wherever)
    for (const tok of tokens) {
      if (tok.mnemonic && tok.mnemonic.toLowerCase() === 'org') {
        const v = parseNumeric(tok.operands[0]);
        if (v !== null && !isNaN(v)) {
          currentAddr = toU16(v);
          this.codeStartAddr = currentAddr;
          this.entryPoint = currentAddr;
          this.orgSet = true;
        }
        continue;
      }
    }
    if (!this.orgSet) {
      currentAddr = 0x100;
      this.codeStartAddr = 0x100;
      this.entryPoint = 0x100;
    }

    // Reset currentAddr for actual pass
    currentAddr = this.codeStartAddr;

    // For .MODEL SMALL / EXE programs: data definitions go into a separate
    // data area (starting at 0x0000), code goes to 0x100 (the entry point).
    // This prevents data bytes from being executed as code.
    // In COM programs (org 100h), data and code share the same segment
    // because the user explicitly put data before `jmp start`.
    let dataAddr = 0x0000;        // data segment starts at offset 0
    let codeAddr = this.codeStartAddr; // code segment starts at 0x100
    let inDataSegment = false;
    let inCodeSegment = true;
    // Track which segment we're in so data defs vs code go to the right addr
    let activeAddr = codeAddr; // pointer that switches between dataAddr/codeAddr

    // @DATA and @data resolve to 0 (the data segment base in our flat model)
    this.symbolTable['@data'] = 0;
    this.symbolTable['@code'] = this.codeStartAddr;

    // Process tokens
    for (const tok of tokens) {
      const mnem = tok.mnemonic ? tok.mnemonic.toLowerCase() : null;

      // Skip segment directives and structural keywords
      if (mnem && (
        mnem === '.model' || mnem === '.stack' || mnem === '.data' ||
        mnem === '.code' || mnem === '.486' || mnem === '.8086' ||
        mnem === 'assume' || mnem === 'end' || mnem === 'ends' ||
        mnem === 'segment' || mnem === 'proc' || mnem === 'endp' ||
        mnem === 'org' || mnem === 'public' || mnem === 'extrn' ||
        mnem === 'extern' || mnem === 'global' || mnem === 'include' ||
        mnem === 'label'
      )) {
        // Track segment context — switch activeAddr between data and code areas
        if (mnem === '.data' || (mnem === 'segment' && /data/i.test(tok.operands[0] || ''))) {
          inDataSegment = true; inCodeSegment = false;
          activeAddr = dataAddr;  // data definitions go to the data area
        } else if (mnem === '.code' || (mnem === 'segment' && /code/i.test(tok.operands[0] || ''))) {
          inDataSegment = false; inCodeSegment = true;
          activeAddr = codeAddr;  // code goes to the code area (0x100)
        }
        // 'proc name' — the label was already extracted by tokenizer; register it
        if (tok.label) {
          this.symbolTable[tok.label.toLowerCase()] = activeAddr;
        }
        // For 'end' directive, check if it specifies an entry point label
        if (mnem === 'end' && tok.operands[0]) {
          const entryLabel = tok.operands[0].toLowerCase();
          if (this.symbolTable.hasOwnProperty(entryLabel)) {
            this.entryPoint = this.symbolTable[entryLabel];
          }
        }
        continue;
      }

      // Detect "NAME equ value" — tokenizer would put NAME as mnemonic, "equ value" as operands
      // So check: if mnem is not a known instruction and operands[0] starts with 'equ'
      if (tok.mnemonic && !isKnownInstruction(mnem) && tok.operands[0] && /^equ\b/i.test(tok.operands[0])) {
        const valStr = tok.operands[0].replace(/^equ\s+/i, '');
        const v = parseNumeric(valStr);
        if (v !== null && !isNaN(v)) {
          this.symbolTable[tok.mnemonic.toLowerCase()] = v;
        }
        continue;
      }

      // Detect "NAME PROC" / "NAME ENDP" / "NAME SEGMENT" / "NAME ENDS"
      // The tokenizer puts NAME as the mnemonic and PROC/ENDP/SEGMENT/ENDS
      // as the first operand. We need to treat NAME as a label pointing to
      // the current address, and skip the PROC/ENDP/SEGMENT/ENDS keyword.
      if (tok.mnemonic && !isKnownInstruction(mnem) && tok.operands[0] &&
          /^(proc|endp|segment|ends)\b/i.test(tok.operands[0])) {
        const directive = tok.operands[0].match(/^(proc|endp|segment|ends)/i)[1].toLowerCase();
        if (directive === 'proc' || directive === 'segment') {
          // NAME PROC or NAME SEGMENT — register NAME as a label at current addr
          this.symbolTable[mnem] = activeAddr;
          // For SEGMENT, track data vs code context
          if (/data/i.test(tok.operands[0])) {
            inDataSegment = true; inCodeSegment = false;
            activeAddr = dataAddr;
          } else if (/code/i.test(tok.operands[0])) {
            inDataSegment = false; inCodeSegment = true;
            activeAddr = codeAddr;
          }
        }
        // ENDP / ENDS — just skip, nothing to do
        continue;
      }

      // Data definitions: db, dw, dd
      if (mnem === 'db' || mnem === 'dw' || mnem === 'dd' || mnem === 'dup') {
        // If tok.label was set, it's "name db values" but tokenizer put 'name' as label only if there was a colon.
        // We need to handle "name db values" — here mnemonic is 'db' and label might be null.
        // But actually, "name db values" — tokenizer sees "name" as first token, "db values" as rest.
        // So mnemonic='name', operands=['db values']? No, splitOperands would give ['db','values'] if comma separated, or just ['db values'].
        // Hmm, this is tricky. Let me handle it differently.
      }

      // Handle "NAME db values" where NAME has no colon
      // We re-parse: if mnemonic is not a known instruction AND operands[0] is db/dw/dd
      // IMPORTANT: the tokenizer split values by comma, so we must rejoin them.
      if (tok.mnemonic && !isKnownInstruction(mnem) && tok.operands[0] && /^(db|dw|dd)\b/i.test(tok.operands[0])) {
        // Rejoin all operands (tokenizer split on commas in value list)
        const fullStr = tok.operands.join(',');
        const dataMatch = fullStr.match(/^(db|dw|dd)\s+(.+)$/i);
        if (dataMatch) {
          const directive = dataMatch[1].toLowerCase();
          const valuesStr = dataMatch[2];
          const labelName = tok.mnemonic.toLowerCase();
          this.symbolTable[labelName] = activeAddr;
          const elemSize = directive === 'db' ? 1 : directive === 'dw' ? 2 : 4;
          this.symbolSizes[labelName] = elemSize;
          const values = parseDataValues(valuesStr);
          for (const v of values) {
            if (typeof v === 'object' && v.symbol) {
              // Forward reference — write 0 now, patch later
              this._pendingPatches = this._pendingPatches || [];
              this._pendingPatches.push({ addr: activeAddr, symbol: v.symbol, size: elemSize });
              if (elemSize === 1) this.writeByte(activeAddr, 0);
              else if (elemSize === 2) this.writeWord(activeAddr, 0);
              else this.writeDword(activeAddr, 0);
            } else {
              if (elemSize === 1) this.writeByte(activeAddr, v);
              else if (elemSize === 2) this.writeWord(activeAddr, v);
              else this.writeDword(activeAddr, v);
            }
            activeAddr = toU16(activeAddr + elemSize);
          }
          continue;
        }
      }

      // Also handle: label was set + mnemonic is db/dw/dd
      // Again, rejoin operands.
      if (tok.label && (mnem === 'db' || mnem === 'dw' || mnem === 'dd')) {
        this.symbolTable[tok.label.toLowerCase()] = activeAddr;
        const elemSize = mnem === 'db' ? 1 : mnem === 'dw' ? 2 : 4;
        this.symbolSizes[tok.label.toLowerCase()] = elemSize;
        const values = parseDataValues(tok.operands.join(','));
        for (const v of values) {
          if (typeof v === 'object' && v.symbol) {
            this._pendingPatches = this._pendingPatches || [];
            this._pendingPatches.push({ addr: activeAddr, symbol: v.symbol, size: elemSize });
            if (elemSize === 1) this.writeByte(activeAddr, 0);
            else if (elemSize === 2) this.writeWord(activeAddr, 0);
            else this.writeDword(activeAddr, 0);
          } else {
            if (elemSize === 1) this.writeByte(activeAddr, v);
            else if (elemSize === 2) this.writeWord(activeAddr, v);
            else this.writeDword(activeAddr, v);
          }
          activeAddr = toU16(activeAddr + elemSize);
        }
        continue;
      }

      // Label-only line (no mnemonic)
      if (tok.label && !tok.mnemonic) {
        this.symbolTable[tok.label.toLowerCase()] = activeAddr;
        continue;
      }

      // Label + instruction
      if (tok.label) {
        this.symbolTable[tok.label.toLowerCase()] = activeAddr;
      }

      // Instruction — record with address, advance activeAddr (rough — real sizing happens in pass 2)
      if (tok.mnemonic) {
        pendingInstrs.push({
          addr: activeAddr,
          mnemonic: mnem,
          operands: tok.operands,
          raw: tok.raw,
          lineNum: tok.lineNum,
        });
        // We don't know exact byte size without encoding; use placeholder.
        // For our purposes (label resolution for jumps), each instruction = 1 "slot".
        // But jump targets need addresses... actually our jumps use label names,
        // which we resolve to addresses via symbolTable. So instruction byte size
        // doesn't matter for label resolution.
        // We DO need a mapping from address back to instruction index, but since
        // we execute by instruction index (not by IP byte offset), we just track
        // instruction index per address.
        this.addrToInstrIdx[activeAddr] = pendingInstrs.length - 1;
        // Advance address by a nominal 3 bytes (avg instruction size)
        // Actually, since we use instruction-index-based execution, address only
        // matters for `org 100h` (where data starts vs code starts).
        activeAddr = toU16(activeAddr + 1);
      }
    }

    // ----- PATCH: resolve forward references in data -----
    if (this._pendingPatches) {
      for (const p of this._pendingPatches) {
        if (this.symbolTable.hasOwnProperty(p.symbol)) {
          const val = this.symbolTable[p.symbol];
          if (p.size === 1) this.writeByte(p.addr, val);
          else if (p.size === 2) this.writeWord(p.addr, val);
          else this.writeDword(p.addr, val);
        } else {
          // Unresolved — leave as 0
        }
      }
    }

    // ----- PASS 2: parse operands into Operand objects -----
    this.instructions = pendingInstrs.map(ins => ({
      ...ins,
      parsedOperands: ins.operands.map(o => parseOperand(o, this.symbolTable)),
    }));

    // Set IP to entry point
    this.registers.ip = this.entryPoint;
    this.halted = false;
    this.output = '';
    this.inputBuffer = '';
    this.inputPos = 0;
    this.stepCount = 0;
    this.error = null;

    return this;
  }

  /* ============================================================
     Execution
     ============================================================ */

  // Run until halted, error, or max steps. Returns output string.
  run(input = '') {
    this.inputBuffer = input;
    this.inputPos = 0;
    this.output = '';
    while (!this.halted && !this.error) {
      if (this.stepCount >= this.maxSteps) {
        this.error = `Maximum step count reached (${this.maxSteps}). Possible infinite loop.`;
        break;
      }
      this.step();
    }
    return this.output;
  }

  // Returns output as an array of lines (for UI display).
  // Normalizes \r\n and \r to \n, then splits.
  getOutputLines() {
    return this.output
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line, i, arr) => !(i === arr.length - 1 && line === ''));
  }

  // Returns new output lines since the given character offset.
  // Useful for step mode: pass the previous output length.
  getNewOutputLines(prevLength) {
    const newStr = this.output.substring(prevLength);
    return newStr
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line !== '');
  }

  // Execute one instruction. Returns the executed instruction object (or null if halted).
  step() {
    if (this.halted) return null;
    if (this.error) return null;

    // IP is the address of the next instruction. Find instruction index.
    const instrIdx = this.addrToInstrIdx[this.registers.ip];
    if (instrIdx === undefined) {
      // No instruction at this address — likely fell off the end
      this.halted = true;
      return null;
    }

    const ins = this.instructions[instrIdx];
    if (!ins) {
      this.halted = true;
      return null;
    }

    this.lastInstruction = ins;
    this.stepCount++;

    try {
      this.execute(ins);
    } catch (e) {
      this.error = `Line ${ins.lineNum}: ${e.message}`;
      this.halted = true;
      return ins;
    }

    return ins;
  }

  // Set IP to a label/address (jump target)
  jumpTo(target) {
    // target may be a label name or address
    if (typeof target === 'string') {
      const lower = target.toLowerCase();
      if (this.symbolTable.hasOwnProperty(lower)) {
        this.registers.ip = toU16(this.symbolTable[lower]);
        return;
      }
      // Try as number
      const n = parseNumeric(target);
      if (n !== null && !isNaN(n)) {
        this.registers.ip = toU16(n);
        return;
      }
      throw new Error(`Undefined jump target: ${target}`);
    } else {
      this.registers.ip = toU16(target);
    }
  }

  execute(ins) {
    const op = ins.mnemonic;
    const a = ins.parsedOperands;

    switch (op) {
      /* ----- Data movement ----- */
      case 'mov':  this._mov(a[0], a[1]); break;
      case 'lea':  this._lea(a[0], a[1]); break;
      case 'xchg': this._xchg(a[0], a[1]); break;
      case 'push': this._push(a[0]); break;
      case 'pop':  this._pop(a[0]); break;
      case 'pushf': this.push16(this._packFlags()); break;
      case 'popf':  this._unpackFlags(this.pop16()); break;
      case 'lahf':  this.setReg8('ah', this._packFlagsLow()); break;
      case 'sahf':  this._unpackFlagsLow(this.getReg8('ah')); break;
      case 'lds': /* unsupported — would need segment regs */ break;
      case 'les': break;
      case 'xlat': this.setReg8('al', this.readByte(toU16(this.registers.bx + this.getReg8('al')))); break;
      case 'in':   this._in(a[0], a[1]); break;
      case 'out':  this._out(a[0], a[1]); break;

      /* ----- Arithmetic ----- */
      case 'add':  this._add(a[0], a[1]); break;
      case 'adc':  this._adc(a[0], a[1]); break;
      case 'sub':  this._sub(a[0], a[1]); break;
      case 'sbb':  this._sbb(a[0], a[1]); break;
      case 'inc':  this._inc(a[0]); break;
      case 'dec':  this._dec(a[0]); break;
      case 'neg':  this._neg(a[0]); break;
      case 'cmp':  this._cmp(a[0], a[1]); break;
      case 'mul':  this._mul(a[0]); break;
      case 'imul': this._imul(a[0], a[1], a[2]); break;
      case 'div':  this._div(a[0]); break;
      case 'idiv': this._idiv(a[0]); break;
      case 'aaa':  this._aaa(); break;
      case 'aas':  this._aas(); break;
      case 'aam':  this._aam(); break;
      case 'aad':  this._aad(); break;
      case 'daa':  this._daa(); break;
      case 'das':  this._das(); break;
      case 'cbw':  this.setReg8('ah', this.getReg8('al') & 0x80 ? 0xFF : 0x00); break;
      case 'cwd':  this.setReg8('dx', this.getReg8('ah') & 0x80 ? 0xFF : 0x00); this.setReg8('dl', this.getReg8('ah') & 0x80 ? 0xFF : 0x00); break;

      /* ----- Logic ----- */
      case 'and':  this._and(a[0], a[1]); break;
      case 'or':   this._or(a[0], a[1]); break;
      case 'xor':  this._xor(a[0], a[1]); break;
      case 'test': this._test(a[0], a[1]); break;
      case 'not':  this._not(a[0]); break;

      /* ----- Shift / rotate ----- */
      case 'shl': case 'sal': this._shift(a[0], a[1], 'shl'); break;
      case 'shr': this._shift(a[0], a[1], 'shr'); break;
      case 'sar': this._shift(a[0], a[1], 'sar'); break;
      case 'rol': this._shift(a[0], a[1], 'rol'); break;
      case 'ror': this._shift(a[0], a[1], 'ror'); break;
      case 'rcl': this._shift(a[0], a[1], 'rcl'); break;
      case 'rcr': this._shift(a[0], a[1], 'rcr'); break;

      /* ----- Jumps ----- */
      case 'jmp':  this.jumpTo(this._operandAsString(a[0])); break;
      case 'je': case 'jz':   if (this.flags.zf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jne': case 'jnz': if (!this.flags.zf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'js':  if (this.flags.sf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jns': if (!this.flags.sf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jo':  if (this.flags.of) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jno': if (!this.flags.of) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jc': case 'jb': case 'jnae': if (this.flags.cf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jnc': case 'jnb': case 'jae': if (!this.flags.cf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'ja': case 'jnbe': if (!this.flags.cf && !this.flags.zf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jbe': case 'jna': if (this.flags.cf || this.flags.zf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jg': case 'jnle': if (!this.flags.zf && (this.flags.sf === this.flags.of)) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jge': case 'jnl': if (this.flags.sf === this.flags.of) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jl': case 'jnge': if (this.flags.sf !== this.flags.of) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jle': case 'jng': if (this.flags.zf || (this.flags.sf !== this.flags.of)) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jp': case 'jpe': if (this.flags.pf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jnp': case 'jpo': if (!this.flags.pf) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;
      case 'jcxz': if (this.registers.cx === 0) this.jumpTo(this._operandAsString(a[0])); else this._advanceIp(ins); break;

      /* ----- Loops ----- */
      case 'loop': {
        this.registers.cx = toU16(this.registers.cx - 1);
        if (this.registers.cx !== 0) this.jumpTo(this._operandAsString(a[0]));
        else this._advanceIp(ins);
        break;
      }
      case 'loope': case 'loopz': {
        this.registers.cx = toU16(this.registers.cx - 1);
        if (this.registers.cx !== 0 && this.flags.zf) this.jumpTo(this._operandAsString(a[0]));
        else this._advanceIp(ins);
        break;
      }
      case 'loopne': case 'loopnz': {
        this.registers.cx = toU16(this.registers.cx - 1);
        if (this.registers.cx !== 0 && !this.flags.zf) this.jumpTo(this._operandAsString(a[0]));
        else this._advanceIp(ins);
        break;
      }

      /* ----- Subroutine ----- */
      case 'call': {
        this.push16(toU16(this.registers.ip + 1)); // return address (next instruction)
        this.jumpTo(this._operandAsString(a[0]));
        break;
      }
      case 'ret': case 'retn': {
        const ret = this.pop16();
        this.registers.ip = ret;
        // If immediate operand (RET N), pop N more bytes
        if (a[0]) {
          const n = this.getOperandValue(a[0]);
          this.registers.sp = toU16(this.registers.sp + n);
        }
        break;
      }

      /* ----- Interrupts ----- */
      case 'int': {
        const n = this.getOperandValue(a[0]);
        this._int(n);
        this._advanceIp(ins);
        break;
      }
      case 'into': if (this.flags.of) this._int(4); this._advanceIp(ins); break;
      case 'iret': {
        const ret = this.pop16();
        this._unpackFlags(this.pop16());
        this.registers.ip = ret;
        break;
      }

      /* ----- Flag manipulation ----- */
      case 'stc': this.flags.cf = 1; this._advanceIp(ins); break;
      case 'clc': this.flags.cf = 0; this._advanceIp(ins); break;
      case 'cmc': this.flags.cf ^= 1; this._advanceIp(ins); break;
      case 'std': this.flags.df = 1; this._advanceIp(ins); break;
      case 'cld': this.flags.df = 0; this._advanceIp(ins); break;
      case 'sti': this.flags.iflag = 1; this._advanceIp(ins); break;
      case 'cli': this.flags.iflag = 0; this._advanceIp(ins); break;

      /* ----- String ops ----- */
      case 'movsb': this._stringOp('movsb'); this._advanceIp(ins); break;
      case 'movsw': this._stringOp('movsw'); this._advanceIp(ins); break;
      case 'stosb': this._stringOp('stosb'); this._advanceIp(ins); break;
      case 'stosw': this._stringOp('stosw'); this._advanceIp(ins); break;
      case 'lodsb': this._stringOp('lodsb'); this._advanceIp(ins); break;
      case 'lodsw': this._stringOp('lodsw'); this._advanceIp(ins); break;
      case 'scasb': this._stringOp('scasb'); this._advanceIp(ins); break;
      case 'scasw': this._stringOp('scasw'); this._advanceIp(ins); break;
      case 'cmpsb': this._stringOp('cmpsb'); this._advanceIp(ins); break;
      case 'cmpsw': this._stringOp('cmpsw'); this._advanceIp(ins); break;
      case 'rep': case 'repe': case 'repz': case 'repne': case 'repnz': {
        // REP prefix followed by string op — we expect the next "instruction" to be the string op.
        // In our model, REP and the string op are on the same line; if not, fall through.
        if (a[0]) {
          const strOp = this._operandAsString(a[0]).toLowerCase();
          this._stringOp(strOp, true);
        }
        this._advanceIp(ins);
        break;
      }

      /* ----- Misc ----- */
      case 'nop': this._advanceIp(ins); break;
      case 'hlt': this.halted = true; break;
      case 'lock': case 'wait': case 'nop': this._advanceIp(ins); break;

      default:
        throw new Error(`Unknown instruction: ${op}`);
    }

    // If instruction didn't set IP (no jump), advance to next instruction.
    // We track this by comparing IP — if it's still pointing at this instruction, advance.
    if (this.registers.ip === ins.addr && !this.halted) {
      this._advanceIp(ins);
    }
  }

  _advanceIp(ins) {
    // Move to next instruction in pendingInstrs order
    const idx = this.addrToInstrIdx[ins.addr];
    if (idx !== undefined && idx + 1 < this.instructions.length) {
      this.registers.ip = this.instructions[idx + 1].addr;
    } else {
      // End of code
      this.halted = true;
    }
  }

  _operandAsString(op) {
    if (!op) return '';
    if (op.type === 'label' || (op.type === 'imm' && op.symbolRef)) {
      return op.name || op.symbolRef;
    }
    // For label operand, return its name; for imm, return as string of value
    if (op.type === 'imm') return String(op.value);
    if (op.type === 'label') return op.name;
    // Reconstruct operand string for memory/reg
    if (op.type === 'reg8' || op.type === 'reg16') return op.name;
    if (op.type === 'mem') return `[${op.expr}]`;
    return '';
  }

  /* ============================================================
     Instruction implementations
     ============================================================ */

  _mov(dest, src) {
    const destIsByte = dest.type === 'reg8';
    const srcIsByte = src.type === 'reg8';
    const size = this.operandSize(dest, srcIsByte) || this.operandSize(src, destIsByte);
    const val = this.getOperandValue(src, size);
    this.setOperandValue(dest, val, size);
  }

  _lea(dest, src) {
    // Load effective address of memory operand into dest (16-bit register)
    // Handles three forms:
    //   lea dx, [bx+si+4]    -> src.type === 'mem', compute address
    //   lea dx, m1           -> src.type === 'imm' with symbolRef, load symbol's address
    //   lea dx, offset m1    -> same as above (offset stripped by parser)
    if (src.type === 'mem') {
      const addr = evalMemoryExpr(src.expr, this);
      this.setOperandValue(dest, addr, 2);
    } else if (src.type === 'imm' && src.symbolRef) {
      // Bare label reference — load its address
      this.setOperandValue(dest, src.value, 2);
    } else if (src.type === 'imm') {
      // Pure immediate (unusual for LEA, but treat as address)
      this.setOperandValue(dest, src.value, 2);
    } else {
      throw new Error('LEA requires memory operand');
    }
  }

  _xchg(a, b) {
    const size = this.operandSize(a, b.type === 'reg8') || 2;
    const va = this.getOperandValue(a, size);
    const vb = this.getOperandValue(b, size);
    this.setOperandValue(a, vb, size);
    this.setOperandValue(b, va, size);
  }

  _push(op) {
    const val = this.getOperandValue(op, 2);
    this.push16(val);
  }
  _pop(op) {
    const val = this.pop16();
    this.setOperandValue(op, val, 2);
  }

  _add(dest, src) { this._arith(dest, src, 'add'); }
  _adc(dest, src) { this._arith(dest, src, 'adc'); }
  _sub(dest, src) { this._arith(dest, src, 'sub'); }
  _sbb(dest, src) { this._arith(dest, src, 'sbb'); }

  _arith(dest, src, op) {
    const destIsByte = dest.type === 'reg8';
    const size = this.operandSize(dest, src.type === 'reg8');
    const a = this.getOperandValue(dest, size);
    const b = this.getOperandValue(src, size);
    let result, cf = 0, of = 0, af = 0;
    const mask = size === 1 ? 0xFF : 0xFFFF;
    const signBit = size === 1 ? 0x80 : 0x8000;

    if (op === 'add') {
      result = (a + b) & mask;
      cf = (a + b) > mask ? 1 : 0;
      af = ((a & 0xF) + (b & 0xF)) > 0xF ? 1 : 0;
      const sa = a & signBit, sb = b & signBit, sr = result & signBit;
      of = (sa && sb && !sr) || (!sa && !sb && sr) ? 1 : 0;
    } else if (op === 'adc') {
      const c = this.flags.cf;
      result = (a + b + c) & mask;
      cf = (a + b + c) > mask ? 1 : 0;
      af = ((a & 0xF) + (b & 0xF) + c) > 0xF ? 1 : 0;
      const sa = a & signBit, sb = b & signBit, sr = result & signBit;
      of = (sa && sb && !sr) || (!sa && !sb && sr) ? 1 : 0;
    } else if (op === 'sub') {
      result = (a - b) & mask;
      cf = a < b ? 1 : 0;
      af = (a & 0xF) < (b & 0xF) ? 1 : 0;
      const sa = a & signBit, sb = b & signBit, sr = result & signBit;
      of = (sa && !sb && !sr) || (!sa && sb && sr) ? 1 : 0;
    } else if (op === 'sbb') {
      const c = this.flags.cf;
      result = (a - b - c) & mask;
      cf = (a < b + c) ? 1 : 0;
      af = (a & 0xF) < ((b & 0xF) + c) ? 1 : 0;
      const sa = a & signBit, sb = b & signBit, sr = result & signBit;
      of = (sa && !sb && !sr) || (!sa && sb && sr) ? 1 : 0;
    }

    this.setOperandValue(dest, result, size);
    this.flags.cf = cf; this.flags.af = af; this.flags.of = of;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & signBit) ? 1 : 0;
    this.flags.pf = parity(result);
  }

  _inc(op) {
    const size = this.operandSize(op, false);
    const a = this.getOperandValue(op, size);
    const result = (a + 1) & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(op, result, size);
    const signBit = size === 1 ? 0x80 : 0x8000;
    this.flags.af = (a & 0xF) === 0xF ? 1 : 0;
    this.flags.of = (a === (signBit - 1)) ? 1 : 0; // overflow if was 0x7F/0x7FFF
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & signBit) ? 1 : 0;
    this.flags.pf = parity(result);
    // CF unchanged
  }
  _dec(op) {
    const size = this.operandSize(op, false);
    const a = this.getOperandValue(op, size);
    const result = (a - 1) & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(op, result, size);
    const signBit = size === 1 ? 0x80 : 0x8000;
    this.flags.af = (a & 0xF) === 0 ? 1 : 0;
    this.flags.of = (a === signBit) ? 1 : 0; // overflow if was 0x80/0x8000
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & signBit) ? 1 : 0;
    this.flags.pf = parity(result);
  }
  _neg(op) {
    const size = this.operandSize(op, false);
    const a = this.getOperandValue(op, size);
    const result = (-a) & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(op, result, size);
    const signBit = size === 1 ? 0x80 : 0x8000;
    this.flags.cf = a === 0 ? 0 : 1;
    this.flags.af = (a & 0xF) === 0 ? 0 : 1;
    this.flags.of = (a === signBit) ? 1 : 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & signBit) ? 1 : 0;
    this.flags.pf = parity(result);
  }

  _cmp(a, b) {
    // Same as SUB but don't store result
    const size = this.operandSize(a, b.type === 'reg8');
    const va = this.getOperandValue(a, size);
    const vb = this.getOperandValue(b, size);
    const mask = size === 1 ? 0xFF : 0xFFFF;
    const signBit = size === 1 ? 0x80 : 0x8000;
    const result = (va - vb) & mask;
    this.flags.cf = va < vb ? 1 : 0;
    this.flags.af = (va & 0xF) < (vb & 0xF) ? 1 : 0;
    const sa = va & signBit, sb = vb & signBit, sr = result & signBit;
    this.flags.of = (sa && !sb && !sr) || (!sa && sb && sr) ? 1 : 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & signBit) ? 1 : 0;
    this.flags.pf = parity(result);
  }

  _mul(op) {
    // Unsigned multiply
    if (op.type === 'reg8' || (op.type === 'mem' && op.sizeHint === 'byte')) {
      const al = this.getReg8('al');
      const m = this.getOperandValue(op, 1);
      const result = (al * m) & 0xFFFF;
      this.setReg8('al', result & 0xFF);
      this.setReg8('ah', (result >> 8) & 0xFF);
      this.flags.cf = this.flags.of = (result & 0xFF00) ? 1 : 0;
      // SF/ZF/PF undefined; leave them
    } else {
      const ax = this.registers.ax;
      const m = this.getOperandValue(op, 2);
      const result = (ax * m) >>> 0;
      this.registers.ax = result & 0xFFFF;
      this.registers.dx = (result >> 16) & 0xFFFF;
      this.flags.cf = this.flags.of = (this.registers.dx !== 0) ? 1 : 0;
    }
  }

  _imul(op1, op2, op3) {
    // Forms: IMUL src | IMUL dest, src | IMUL dest, src, imm
    if (op2 === undefined) {
      // 1-operand form
      if (op1.type === 'reg8' || (op1.type === 'mem' && op1.sizeHint === 'byte')) {
        const al = sign8(this.getReg8('al'));
        const m = sign8(this.getOperandValue(op1, 1));
        const result = (al * m) & 0xFFFF;
        this.setReg8('al', result & 0xFF);
        this.setReg8('ah', (result >> 8) & 0xFF);
        const significant = sign8(result & 0xFF) !== (al * m);
        this.flags.cf = this.flags.of = significant ? 1 : 0;
      } else {
        const ax = sign16(this.registers.ax);
        const m = sign16(this.getOperandValue(op1, 2));
        const result = (ax * m) & 0xFFFFFFFF;
        this.registers.ax = result & 0xFFFF;
        this.registers.dx = (result >> 16) & 0xFFFF;
        const significant = sign16(result & 0xFFFF) !== (ax * m);
        this.flags.cf = this.flags.of = significant ? 1 : 0;
      }
    } else if (op3 === undefined) {
      // 2-operand: dest = dest * src
      const size = this.operandSize(op1, op2.type === 'reg8');
      const d = sign16(this.getOperandValue(op1, size));
      const s = sign16(this.getOperandValue(op2, size));
      const result = (d * s) & (size === 1 ? 0xFFFF : 0xFFFFFFFF);
      this.setOperandValue(op1, result, size);
      const mask = size === 1 ? 0xFF : 0xFFFF;
      const significant = sign16(result & mask) !== (d * s);
      this.flags.cf = this.flags.of = significant ? 1 : 0;
    } else {
      // 3-operand: dest = src * imm
      const size = this.operandSize(op1, op2.type === 'reg8');
      const s = sign16(this.getOperandValue(op2, size));
      const imm = sign16(this.getOperandValue(op3, size));
      const result = (s * imm) & (size === 1 ? 0xFFFF : 0xFFFFFFFF);
      this.setOperandValue(op1, result, size);
      const mask = size === 1 ? 0xFF : 0xFFFF;
      const significant = sign16(result & mask) !== (s * imm);
      this.flags.cf = this.flags.of = significant ? 1 : 0;
    }
  }

  _div(op) {
    if (op.type === 'reg8' || (op.type === 'mem' && op.sizeHint === 'byte')) {
      const ax = this.registers.ax;
      const d = this.getOperandValue(op, 1);
      if (d === 0) throw new Error('Divide by zero');
      const q = Math.floor(ax / d);
      const r = ax % d;
      if (q > 0xFF) throw new Error('Divide overflow');
      this.setReg8('al', q);
      this.setReg8('ah', r);
    } else {
      const dxax = (this.registers.dx << 16) | this.registers.ax;
      const d = this.getOperandValue(op, 2);
      if (d === 0) throw new Error('Divide by zero');
      const q = Math.floor(dxax / d);
      const r = dxax % d;
      if (q > 0xFFFF) throw new Error('Divide overflow');
      this.registers.ax = q & 0xFFFF;
      this.registers.dx = r & 0xFFFF;
    }
  }

  _idiv(op) {
    if (op.type === 'reg8' || (op.type === 'mem' && op.sizeHint === 'byte')) {
      const ax = sign16(this.registers.ax);
      const d = sign8(this.getOperandValue(op, 1));
      if (d === 0) throw new Error('Divide by zero');
      const q = Math.trunc(ax / d);
      const r = ax - (q * d);
      if (q > 127 || q < -128) throw new Error('Divide overflow');
      this.setReg8('al', q & 0xFF);
      this.setReg8('ah', r & 0xFF);
    } else {
      const dxax = sign32((this.registers.dx << 16) | this.registers.ax);
      const d = sign16(this.getOperandValue(op, 2));
      if (d === 0) throw new Error('Divide by zero');
      const q = Math.trunc(dxax / d);
      const r = dxax - (q * d);
      if (q > 32767 || q < -32768) throw new Error('Divide overflow');
      this.registers.ax = q & 0xFFFF;
      this.registers.dx = r & 0xFFFF;
    }
  }

  /* ----- BCD adjust (simplified) ----- */
  _aaa() {
    const al = this.getReg8('al');
    if ((al & 0xF) > 9 || this.flags.af) {
      this.setReg8('al', (al + 6) & 0xF);
      this.setReg8('ah', (this.getReg8('ah') + 1) & 0xFF);
      this.flags.af = this.flags.cf = 1;
    } else {
      this.flags.af = this.flags.cf = 0;
    }
  }
  _aas() {
    const al = this.getReg8('al');
    if ((al & 0xF) > 9 || this.flags.af) {
      this.setReg8('al', (al - 6) & 0xF);
      this.setReg8('ah', (this.getReg8('ah') - 1) & 0xFF);
      this.flags.af = this.flags.cf = 1;
    } else {
      this.flags.af = this.flags.cf = 0;
    }
  }
  _aam() {
    const al = this.getReg8('al');
    const base = (a && a[0]) ? this.getOperandValue(a[0], 1) : 10;
    this.setReg8('ah', Math.floor(al / base));
    this.setReg8('al', al % base);
    this.flags.zf = (al === 0) ? 1 : 0;
  }
  _aad() {
    const ah = this.getReg8('ah');
    const al = this.getReg8('al');
    const base = (a && a[0]) ? this.getOperandValue(a[0], 1) : 10;
    const result = (al + ah * base) & 0xFF;
    this.setReg8('al', result);
    this.setReg8('ah', 0);
    this.flags.zf = (result === 0) ? 1 : 0;
  }
  _daa() {
    const al = this.getReg8('al');
    let oldAl = al;
    let oldCf = this.flags.cf;
    this.flags.cf = 0;
    if ((al & 0xF) > 9 || this.flags.af) {
      const newAl = (al + 6) & 0xFF;
      this.setReg8('al', newAl);
      this.flags.cf = oldCf || (newAl < oldAl) ? 1 : 0;
      this.flags.af = 1;
    } else this.flags.af = 0;
  }
  _das() {
    const al = this.getReg8('al');
    let oldAl = al;
    let oldCf = this.flags.cf;
    this.flags.cf = 0;
    if ((al & 0xF) > 9 || this.flags.af) {
      const newAl = (al - 6) & 0xFF;
      this.setReg8('al', newAl);
      this.flags.cf = oldCf || (newAl > oldAl) ? 1 : 0;
      this.flags.af = 1;
    } else this.flags.af = 0;
  }

  /* ----- Logic ----- */
  _and(dest, src) {
    const size = this.operandSize(dest, src.type === 'reg8');
    const a = this.getOperandValue(dest, size);
    const b = this.getOperandValue(src, size);
    const result = a & b & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(dest, result, size);
    this.flags.cf = 0; this.flags.of = 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & (size === 1 ? 0x80 : 0x8000)) ? 1 : 0;
    this.flags.pf = parity(result);
  }
  _or(dest, src) {
    const size = this.operandSize(dest, src.type === 'reg8');
    const a = this.getOperandValue(dest, size);
    const b = this.getOperandValue(src, size);
    const result = (a | b) & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(dest, result, size);
    this.flags.cf = 0; this.flags.of = 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & (size === 1 ? 0x80 : 0x8000)) ? 1 : 0;
    this.flags.pf = parity(result);
  }
  _xor(dest, src) {
    const size = this.operandSize(dest, src.type === 'reg8');
    const a = this.getOperandValue(dest, size);
    const b = this.getOperandValue(src, size);
    const result = (a ^ b) & (size === 1 ? 0xFF : 0xFFFF);
    this.setOperandValue(dest, result, size);
    this.flags.cf = 0; this.flags.of = 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & (size === 1 ? 0x80 : 0x8000)) ? 1 : 0;
    this.flags.pf = parity(result);
  }
  _test(a, b) {
    const size = this.operandSize(a, b.type === 'reg8');
    const va = this.getOperandValue(a, size);
    const vb = this.getOperandValue(b, size);
    const result = (va & vb) & (size === 1 ? 0xFF : 0xFFFF);
    this.flags.cf = 0; this.flags.of = 0;
    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & (size === 1 ? 0x80 : 0x8000)) ? 1 : 0;
    this.flags.pf = parity(result);
  }
  _not(op) {
    const size = this.operandSize(op, false);
    const v = this.getOperandValue(op, size);
    this.setOperandValue(op, (~v) & (size === 1 ? 0xFF : 0xFFFF), size);
    // NOT does not affect flags
  }

  /* ----- Shifts / rotates ----- */
  _shift(op, countOp, kind) {
    const size = this.operandSize(op, false);
    let count = this.getOperandValue(countOp, 1) & 0x1F; // 8086 uses 5-bit count
    if (count === 0) return;
    let v = this.getOperandValue(op, size);
    const mask = size === 1 ? 0xFF : 0xFFFF;
    const signBit = size === 1 ? 0x80 : 0x8000;
    let result, cf = 0;

    for (let i = 0; i < count; i++) {
      switch (kind) {
        case 'shl':
          cf = (v & signBit) ? 1 : 0;
          v = (v << 1) & mask;
          break;
        case 'shr':
          cf = v & 1;
          v = v >> 1;
          break;
        case 'sar':
          cf = v & 1;
          v = ((v >> 1) | (v & signBit)) & mask;
          break;
        case 'rol':
          cf = (v & signBit) ? 1 : 0;
          v = ((v << 1) | cf) & mask;
          break;
        case 'ror':
          cf = v & 1;
          v = ((v >> 1) | (cf << (size === 1 ? 7 : 15))) & mask;
          break;
        case 'rcl':
          {
            const newCf = (v & signBit) ? 1 : 0;
            v = ((v << 1) | this.flags.cf) & mask;
            cf = newCf;
          }
          break;
        case 'rcr':
          {
            const newCf = v & 1;
            v = ((v >> 1) | (this.flags.cf << (size === 1 ? 7 : 15))) & mask;
            cf = newCf;
          }
          break;
      }
    }
    this.setOperandValue(op, v, size);
    this.flags.cf = cf;
    if (kind === 'shl' || kind === 'shr' || kind === 'sar') {
      this.flags.zf = v === 0 ? 1 : 0;
      this.flags.sf = (v & signBit) ? 1 : 0;
      this.flags.pf = parity(v);
      if (count === 1) {
        const signNow = (v & signBit) ? 1 : 0;
        this.flags.of = (signNow !== cf) ? 1 : 0;
      }
    }
  }

  /* ----- I/O ports ----- */
  // The ports object holds values written by OUT instructions and read
  // by IN instructions. The DebuggerWidget (robot simulator, traffic
  // lights, calculator, machine controls) watches this via onPortWrite.
  // Format: { portNumber: value }
  _in(dest, port) {
    const portNum = this.getOperandValue(port, 1);
    const val = this.ports[portNum] !== undefined ? this.ports[portNum] : 0xFF;
    this.setOperandValue(dest, val);
  }

  _out(port, src) {
    const portNum = this.getOperandValue(port, 1);
    const val = this.getOperandValue(src, 1);
    this.ports[portNum] = val;
    // Notify the DebuggerWidget (robot/traffic/calc/machine) that a port
    // was written, so it can update its visual state.
    if (typeof this.onPortWrite === 'function') {
      try { this.onPortWrite(portNum, val); } catch { /* ignore listener errors */ }
    }
  }

  /* ----- String operations ----- */
  _stringOp(op, isRep) {
    const delta = this.flags.df ? -1 : 1;
    const doOnce = () => {
      switch (op) {
        case 'movsb': {
          const b = this.readByte(this.registers.si);
          this.writeByte(this.registers.di, b);
          this.registers.si = toU16(this.registers.si + delta);
          this.registers.di = toU16(this.registers.di + delta);
          break;
        }
        case 'movsw': {
          const w = this.readWord(this.registers.si);
          this.writeWord(this.registers.di, w);
          this.registers.si = toU16(this.registers.si + delta * 2);
          this.registers.di = toU16(this.registers.di + delta * 2);
          break;
        }
        case 'stosb': {
          this.writeByte(this.registers.di, this.getReg8('al'));
          this.registers.di = toU16(this.registers.di + delta);
          break;
        }
        case 'stosw': {
          this.writeWord(this.registers.di, this.registers.ax);
          this.registers.di = toU16(this.registers.di + delta * 2);
          break;
        }
        case 'lodsb': {
          this.setReg8('al', this.readByte(this.registers.si));
          this.registers.si = toU16(this.registers.si + delta);
          break;
        }
        case 'lodsw': {
          this.registers.ax = this.readWord(this.registers.si);
          this.registers.si = toU16(this.registers.si + delta * 2);
          break;
        }
        case 'scasb': {
          const a = this.getReg8('al');
          const b = this.readByte(this.registers.di);
          const r = (a - b) & 0xFF;
          this.flags.zf = r === 0 ? 1 : 0;
          this.flags.sf = (r & 0x80) ? 1 : 0;
          this.flags.cf = a < b ? 1 : 0;
          this.registers.di = toU16(this.registers.di + delta);
          break;
        }
        case 'cmpsb': {
          const a = this.readByte(this.registers.si);
          const b = this.readByte(this.registers.di);
          const r = (a - b) & 0xFF;
          this.flags.zf = r === 0 ? 1 : 0;
          this.flags.sf = (r & 0x80) ? 1 : 0;
          this.flags.cf = a < b ? 1 : 0;
          this.registers.si = toU16(this.registers.si + delta);
          this.registers.di = toU16(this.registers.di + delta);
          break;
        }
        default: throw new Error(`Unknown string op: ${op}`);
      }
    };

    if (isRep) {
      while (this.registers.cx !== 0) {
        doOnce();
        this.registers.cx = toU16(this.registers.cx - 1);
        if ((op === 'scasb' || op === 'cmpsb' || op === 'scasw' || op === 'cmpsw')
            && (this.flags.zf !== (op === 'scasb' ? 1 : 1))) {
          // For REPE/REPNE — simplified: stop when ZF mismatches expectation
          break;
        }
      }
    } else {
      doOnce();
    }
  }

  /* ============================================================
     INT 21h (DOS) and other interrupts
     ============================================================ */
  _int(n) {
    if (n === 0x21) {
      this._dosInt21();
    } else if (n === 0x20) {
      // DOS terminate
      this.halted = true;
    } else if (n === 0x10) {
      // Video services — minimal
      const ah = (this.registers.ax >> 8) & 0xFF;
      if (ah === 0x02) {
        // Set cursor position — ignore
      } else if (ah === 0x0E) {
        // TTY output: print AL
        this.output += String.fromCharCode(this.getReg8('al'));
      }
    } else if (n === 0x16) {
      // Keyboard services
      const ah = (this.registers.ax >> 8) & 0xFF;
      if (ah === 0x00 || ah === 0x10) {
        // Read key — pull from input buffer
        if (this.inputPos < this.inputBuffer.length) {
          const ch = this.inputBuffer.charCodeAt(this.inputPos++);
          this.setReg8('al', ch);
          this.setReg8('ah', 0);
        } else {
          // No input — return 0
          this.setReg8('al', 0);
          this.setReg8('ah', 0);
        }
      }
    } else if (n === 0x19) {
      // Get system drive — return C:
      this.setReg8('al', 2);
    } else {
      // Unknown interrupt — ignore
    }
  }

  _dosInt21() {
    const ah = (this.registers.ax >> 8) & 0xFF;
    switch (ah) {
      case 0x01: {
        // Read char with echo
        if (this.inputPos < this.inputBuffer.length) {
          const ch = this.inputBuffer.charCodeAt(this.inputPos++);
          this.setReg8('al', ch);
          this.output += String.fromCharCode(ch);
        } else {
          // No input available — return CR (or wait forever in real DOS)
          this.setReg8('al', 13);
          this.output += '\r';
        }
        break;
      }
      case 0x02: {
        // Print char in DL
        const ch = this.getReg8('dl');
        this.output += String.fromCharCode(ch);
        break;
      }
      case 0x05: {
        // Printer output — ignore
        break;
      }
      case 0x06: {
        // Direct console I/O
        const dl = this.getReg8('dl');
        if (dl === 0xFF) {
          // Input
          if (this.inputPos < this.inputBuffer.length) {
            const ch = this.inputBuffer.charCodeAt(this.inputPos++);
            this.setReg8('al', ch);
            this.flags.zf = 0;
          } else {
            this.flags.zf = 1;
            this.setReg8('al', 0);
          }
        } else {
          this.output += String.fromCharCode(dl);
        }
        break;
      }
      case 0x07: case 0x08: {
        // Read char without echo (07) / without echo (08, handles Ctrl-Break)
        if (this.inputPos < this.inputBuffer.length) {
          const ch = this.inputBuffer.charCodeAt(this.inputPos++);
          this.setReg8('al', ch);
        } else {
          this.setReg8('al', 13);
        }
        break;
      }
      case 0x09: {
        // Print '$'-terminated string at DS:DX
        let addr = this.registers.dx;
        let s = '';
        let limit = 4096;
        while (limit-- > 0) {
          const b = this.readByte(addr);
          if (b === 0x24 || b === 0) break; // '$' or null
          s += String.fromCharCode(b);
          addr = toU16(addr + 1);
        }
        this.output += s;
        break;
      }
      case 0x0A: {
        // Buffered input at DS:DX
        // First byte = max chars, second byte = actual chars read, then chars + CR
        const bufAddr = this.registers.dx;
        const maxChars = this.readByte(bufAddr);
        let n = 0;
        while (n < maxChars && this.inputPos < this.inputBuffer.length) {
          const ch = this.inputBuffer.charCodeAt(this.inputPos++);
          if (ch === 13 || ch === 10) break;
          this.writeByte(bufAddr + 2 + n, ch);
          n++;
        }
        this.writeByte(bufAddr + 1, n);
        this.writeByte(bufAddr + 2 + n, 13);
        // Echo input + CR/LF
        let echo = '';
        for (let i = 0; i < n; i++) echo += String.fromCharCode(this.readByte(bufAddr + 2 + i));
        this.output += echo + '\r\n';
        break;
      }
      case 0x0B: {
        // Check stdin status
        this.setReg8('al', this.inputPos < this.inputBuffer.length ? 0xFF : 0x00);
        break;
      }
      case 0x0C: {
        // Flush stdin and call function in AL
        this.inputPos = this.inputBuffer.length; // flush
        const fn = this.getReg8('al');
        if (fn !== 0) {
          this.registers.ax = (this.registers.ax & 0xFF00) | (fn & 0xFF);
          this._dosInt21();
        }
        break;
      }
      case 0x2C: {
        // Get system time
        const d = new Date();
        this.setReg8('ch', d.getHours());
        this.setReg8('cl', d.getMinutes());
        this.setReg8('dh', d.getSeconds());
        this.setReg8('dl', Math.floor(d.getMilliseconds() / 10));
        break;
      }
      case 0x2A: {
        // Get system date
        const d = new Date();
        this.setReg8('al', d.getDay() === 0 ? 0 : d.getDay());
        this.setReg8('cx', d.getFullYear());
        this.setReg8('dh', d.getMonth() + 1);
        this.setReg8('dl', d.getDate());
        break;
      }
      case 0x4C: case 76: {
        // Terminate with return code in AL
        this.halted = true;
        break;
      }
      default:
        // Unknown DOS function — silently ignore
        break;
    }
  }

  /* -------------------- Flags packing -------------------- */
  _packFlags() {
    let f = 0x0002; // bit 1 always 1
    if (this.flags.cf) f |= 0x0001;
    if (this.flags.pf) f |= 0x0004;
    if (this.flags.af) f |= 0x0010;
    if (this.flags.zf) f |= 0x0040;
    if (this.flags.sf) f |= 0x0080;
    if (this.flags.tf) f |= 0x0100;
    if (this.flags.iflag) f |= 0x0200;
    if (this.flags.df) f |= 0x0400;
    if (this.flags.of) f |= 0x0800;
    return f & 0xFFFF;
  }
  _unpackFlags(f) {
    this.flags.cf  = (f & 0x0001) ? 1 : 0;
    this.flags.pf  = (f & 0x0004) ? 1 : 0;
    this.flags.af  = (f & 0x0010) ? 1 : 0;
    this.flags.zf  = (f & 0x0040) ? 1 : 0;
    this.flags.sf  = (f & 0x0080) ? 1 : 0;
    this.flags.tf  = (f & 0x0100) ? 1 : 0;
    this.flags.iflag = (f & 0x0200) ? 1 : 0;
    this.flags.df  = (f & 0x0400) ? 1 : 0;
    this.flags.of  = (f & 0x0800) ? 1 : 0;
  }
  _packFlagsLow() { return this._packFlags() & 0xFF; }
  _unpackFlagsLow(f) { this._unpackFlags(f); }
}

/* ============================================================
   Instruction set registry
   ============================================================ */

const KNOWN_INSTRUCTIONS = new Set([
  'mov','lea','xchg','push','pop','pushf','popf','lahf','sahf','xlat','in','out',
  'add','adc','sub','sbb','inc','dec','neg','cmp','mul','imul','div','idiv',
  'aaa','aas','aam','aad','daa','das','cbw','cwd',
  'and','or','xor','test','not',
  'shl','sal','shr','sar','rol','ror','rcl','rcr',
  'jmp','je','jz','jne','jnz','js','jns','jo','jno','jc','jb','jnae','jnc','jnb','jae',
  'ja','jnbe','jbe','jna','jg','jnle','jge','jnl','jl','jnge','jle','jng','jp','jpe','jnp','jpo','jcxz',
  'loop','loope','loopz','loopne','loopnz','call','ret','retn','int','into','iret',
  'stc','clc','cmc','std','cld','sti','cli',
  'movsb','movsw','stosb','stosw','lodsb','lodsw','scasb','scasw','cmpsb','cmpsw',
  'rep','repe','repz','repne','repnz',
  'nop','hlt','lock','wait',
  // Directives (handled in load, but listed so they're recognized as non-data)
  'org','db','dw','dd','equ','proc','endp','segment','ends','end','assume',
  '.model','.stack','.data','.code','.486','.8086',
  'public','extrn','extern','global','include','label',
]);

function isKnownInstruction(mnem) {
  return KNOWN_INSTRUCTIONS.has(mnem);
}

function sign32(v) {
  v = v >>> 0;
  return v >= 0x80000000 ? v - 0x100000000 : v;
}
