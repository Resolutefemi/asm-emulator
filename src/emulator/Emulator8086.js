// src/emulator/Emulator8086.js
export class Emulator8086 {
  constructor() {
    this.reset();
  }

  reset() {
    this.registers = {
      ax: 0,
      bx: 0,
      cx: 0,
      dx: 0,
      si: 0,
      di: 0,
      bp: 0,
      sp: 0xFFFF,
    };

    this.flags = {
      cf: 0, // Carry Flag
      pf: 0, // Parity Flag
      af: 0, // Auxiliary Flag
      zf: 0, // Zero Flag
      sf: 0, // Sign Flag
      of: 0, // Overflow Flag
    };

    this.ip = 0; // Instruction Pointer
    this.memory = new Array(65536).fill(0); // 64KB memory
    this.code = [];
    this.output = [];
    this.symbolTable = { '@data': 0 };
  }

  load(asmCode) {
    this.code = this.parse(asmCode);
    this.output = [];
    this.ip = 0;
  }

  parse(asmCode) {
    // 1. Preprocess: Split into lines, strip inline comments, and trim
    const lines = asmCode
      .split('\n')
      .map((line) => {
        const commentIdx = line.indexOf(';');
        const codeWithoutComment = commentIdx > -1 ? line.substring(0, commentIdx) : line;
        return codeWithoutComment.trim();
      })
      .filter((line) => line);

    this.symbolTable = { '@data': 0 };
    let currentOffset = 0;
    let instructionIndex = 0;
    const patchOffsets = [];

    // Helper functions for memory writing
    const writeByte = (addr, val) => {
      this.memory[addr & 0xFFFF] = val & 0xFF;
    };
    const writeWord = (addr, val) => {
      this.memory[addr & 0xFFFF] = val & 0xFF;
      this.memory[(addr + 1) & 0xFFFF] = (val >> 8) & 0xFF;
    };
    const writeDouble = (addr, val) => {
      this.memory[addr & 0xFFFF] = val & 0xFF;
      this.memory[(addr + 1) & 0xFFFF] = (val >> 8) & 0xFF;
      this.memory[(addr + 2) & 0xFFFF] = (val >> 16) & 0xFF;
      this.memory[(addr + 3) & 0xFFFF] = (val >> 24) & 0xFF;
    };

    // --- PASS 1: Scan for org, data definitions, and labels ---
    for (let line of lines) {
      // Ignore segment declarations
      if (/^\s*\.(model|stack|data|code)\b/i.test(line)) {
        continue;
      }

      // 1. Handle ORG directive
      const orgMatch = line.match(/^\s*org\s+(.+)$/i);
      if (orgMatch) {
        const orgVal = parseNumeric(orgMatch[1]);
        if (!isNaN(orgVal)) {
          currentOffset = orgVal;
        }
        continue;
      }

      // 2. Handle Data Definitions (db, dw, dd)
      const dataMatch = line.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s+)?(db|dw|dd)\s+(.+)$/i);
      if (dataMatch) {
        const labelName = dataMatch[1] ? dataMatch[1].toLowerCase() : null;
        const directive = dataMatch[2].toLowerCase();
        const valueStr = dataMatch[3];

        if (labelName) {
          this.symbolTable[labelName] = currentOffset;
        }

        const values = parseDataValues(valueStr);
        const elementSize = directive === 'db' ? 1 : directive === 'dw' ? 2 : 4;

        for (const val of values) {
          if (typeof val === 'string') {
            // Reference to a label (forward reference), record for patching
            patchOffsets.push({
              offset: currentOffset,
              label: val.toLowerCase(),
              size: elementSize
            });
            // Write temporary zero
            if (elementSize === 1) writeByte(currentOffset, 0);
            else if (elementSize === 2) writeWord(currentOffset, 0);
            else writeDouble(currentOffset, 0);
          } else {
            // Numeric value
            if (elementSize === 1) writeByte(currentOffset, val);
            else if (elementSize === 2) writeWord(currentOffset, val);
            else writeDouble(currentOffset, val);
          }
          currentOffset += elementSize;
        }
        continue;
      }

      // 3. Handle Code Labels (e.g. start: mov ax, bx or start:)
      if (line.includes(':')) {
        const parts = line.split(':');
        const labelName = parts[0].trim().toLowerCase();
        this.symbolTable[labelName] = instructionIndex;

        const remaining = parts.slice(1).join(':').trim();
        if (remaining) {
          instructionIndex++;
        }
        continue;
      }

      // Regular instruction
      instructionIndex++;
    }

    // --- PATCH PASS: Resolve forward-referenced variables/labels in data blocks ---
    for (const patch of patchOffsets) {
      if (this.symbolTable.hasOwnProperty(patch.label)) {
        const resolvedVal = this.symbolTable[patch.label];
        if (patch.size === 1) writeByte(patch.offset, resolvedVal);
        else if (patch.size === 2) writeWord(patch.offset, resolvedVal);
        else writeDouble(patch.offset, resolvedVal);
      } else {
        throw new Error(`Undefined symbol in data definition: ${patch.label}`);
      }
    }

    // --- PASS 2: Compile instructions and substitute labels ---
    const instructions = [];
    for (let line of lines) {
      // Skip declarations and directives
      if (/^\s*\.(model|stack|data|code)\b/i.test(line) || /^\s*org\b/i.test(line)) {
        continue;
      }
      if (line.match(/^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s+)?(db|dw|dd)\s+(.+)$/i)) {
        continue;
      }

      // Strip label prefix if present
      if (line.includes(':')) {
        const parts = line.split(':');
        line = parts.slice(1).join(':').trim();
        if (!line) continue; // Label-only line
      }

      const [instr, ...argsPart] = line.split(/\s+/);
      if (instr) {
        const argsStr = argsPart.join(' ');
        const rawArgs = argsStr.split(',').map((s) => s.trim()).filter((s) => s);
        
        const resolvedArgs = rawArgs.map((arg) => {
          // 1. Strip 'offset' keyword if present
          let resolved = arg.replace(/\boffset\s+/gi, '').trim();

          // 2. Replace label occurrences with their values from the symbol table
          for (const [symbol, val] of Object.entries(this.symbolTable)) {
            const regex = new RegExp(`\\b${symbol}\\b`, 'gi');
            resolved = resolved.replace(regex, val);
          }
          return resolved;
        });

        instructions.push({
          instr: instr.toLowerCase(),
          args: resolvedArgs,
        });
      }
    }

    return instructions;
  }

  run() {
    this.output = [];
    let steps = 0;
    const maxSteps = 10000; // Prevent infinite loops

    while (this.ip < this.code.length && steps < maxSteps) {
      const instruction = this.code[this.ip];
      this.execute(instruction);
      if (this.ip >= this.code.length) {
        steps++;
        break;
      }
      this.ip++;
      steps++;

      if (instruction.instr === 'hlt') break;
    }

    if (steps === maxSteps) {
      this.output.push('⚠️ Max execution steps reached (infinite loop?)');
    }

    return this.output;
  }

  execute(instruction) {
    const { instr, args } = instruction;

    switch (instr) {
      case 'mov':
        this.mov(args[0], args[1]);
        break;
      case 'add':
        this.add(args[0], args[1]);
        break;
      case 'sub':
        this.sub(args[0], args[1]);
        break;
      case 'cmp':
        this.cmp(args[0], args[1]);
        break;
      case 'jmp':
        this.jmp(args[0]);
        break;
      case 'jz':
        if (this.flags.zf) this.jmp(args[0]);
        break;
      case 'jnz':
        if (!this.flags.zf) this.jmp(args[0]);
        break;
      case 'xor':
        this.xor(args[0], args[1]);
        break;
      case 'and':
        this.and(args[0], args[1]);
        break;
      case 'or':
        this.or(args[0], args[1]);
        break;
      case 'inc':
        this.inc(args[0]);
        break;
      case 'dec':
        this.dec(args[0]);
        break;
      case 'push':
        this.push(args[0]);
        break;
      case 'pop':
        this.pop(args[0]);
        break;
      case 'int':
        this.interrupt(this.getValue(args[0]));
        break;
      case 'hlt':
        this.output.push('✓ CPU halted');
        break;
      case 'nop':
        // No operation
        break;
      default:
        throw new Error(`Unknown instruction: ${instr}`);
    }
  }

  // Instruction implementations
  mov(dest, src) {
    const value = this.getValue(src, dest);
    this.setValue(dest, value, src);
    this.output.push(`mov ${dest}, ${src} → ${dest} = 0x${value.toString(16).toUpperCase()}`);
  }

  add(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal + srcVal) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result);
    this.output.push(`add ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  sub(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal - srcVal) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result);
    this.output.push(`sub ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  cmp(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal - srcVal) & 0xFFFF;
    this.updateFlags(result);
    this.output.push(`cmp ${dest}, ${src} → flags updated`);
  }

  xor(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal ^ srcVal;
    this.setValue(dest, result, src);
    this.updateFlags(result);
    this.output.push(`xor ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  and(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal & srcVal;
    this.setValue(dest, result, src);
    this.updateFlags(result);
    this.output.push(`and ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  or(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal | srcVal;
    this.setValue(dest, result, src);
    this.updateFlags(result);
    this.output.push(`or ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  inc(dest) {
    const val = this.getValue(dest);
    const result = (val + 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result);
    this.output.push(`inc ${dest} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  dec(dest) {
    const val = this.getValue(dest);
    const result = (val - 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result);
    this.output.push(`dec ${dest} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  push(src) {
    const value = this.getValue(src);
    this.registers.sp = (this.registers.sp - 2) & 0xFFFF;
    this.memory[this.registers.sp] = value & 0xFF;
    this.memory[(this.registers.sp + 1) & 0xFFFF] = (value >> 8) & 0xFF;
    this.output.push(`push ${src} → SP = 0x${this.registers.sp.toString(16).toUpperCase()}`);
  }

  pop(dest) {
    const value = this.memory[this.registers.sp] | (this.memory[(this.registers.sp + 1) & 0xFFFF] << 8);
    this.registers.sp = (this.registers.sp + 2) & 0xFFFF;
    this.setValue(dest, value);
    this.output.push(`pop ${dest} → ${dest} = 0x${value.toString(16).toUpperCase()}`);
  }

  jmp(label) {
    const target = label.toLowerCase().trim();
    if (this.symbolTable && this.symbolTable.hasOwnProperty(target)) {
      this.ip = this.symbolTable[target] - 1; // -1 because it increments after execute
      this.output.push(`jmp ${label} → IP = ${this.symbolTable[target]}`);
    } else {
      const numVal = parseNumeric(target);
      if (!isNaN(numVal)) {
        this.ip = numVal - 1;
        this.output.push(`jmp ${label} → IP = ${numVal}`);
      } else {
        throw new Error(`Label not found: ${label}`);
      }
    }
  }

  interrupt(intNum) {
    if (intNum === 0x21) {
      const ah = (this.registers.ax >> 8) & 0xFF;
      if (ah === 0x09) {
        let dx = this.registers.dx;
        let str = "";
        let limit = 1000; // prevent infinite loops
        while (limit-- > 0) {
          const byte = this.memory[dx & 0xFFFF];
          if (byte === 36 || byte === 0) break; // '$' is ASCII 36, or null terminator
          str += String.fromCharCode(byte);
          dx++;
        }
        this.output.push(str);
      } else if (ah === 0x4C) {
        this.ip = this.code.length; // Halt execution
        this.output.push('✓ CPU halted (DOS exit)');
      } else {
        this.output.push(`🔔 Interrupt 0x21 called (DOS) with AH = 0x${ah.toString(16).toUpperCase()}`);
      }
    } else {
      this.output.push(`🔔 Interrupt 0x${intNum.toString(16).toUpperCase()} called`);
    }
  }

  getValue(operand, context = '') {
    operand = operand.trim().toLowerCase();
    context = context.trim().toLowerCase();

    // 1. Strip 'offset' keyword
    operand = operand.replace(/\boffset\s+/gi, '').trim();

    // 2. Handle registers
    if (this.registers.hasOwnProperty(operand)) {
      return this.registers[operand];
    }
    if (operand === 'al') return this.registers.ax & 0xFF;
    if (operand === 'ah') return (this.registers.ax >> 8) & 0xFF;
    if (operand === 'bl') return this.registers.bx & 0xFF;
    if (operand === 'bh') return (this.registers.bx >> 8) & 0xFF;
    if (operand === 'cl') return this.registers.cx & 0xFF;
    if (operand === 'ch') return (this.registers.cx >> 8) & 0xFF;
    if (operand === 'dl') return this.registers.dx & 0xFF;
    if (operand === 'dh') return (this.registers.dx >> 8) & 0xFF;

    // 3. Handle memory reference: [address]
    if (operand.includes('[') && operand.endsWith(']')) {
      const isByte = operand.includes('byte') || 
                     ['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(context);
      
      const bracketMatch = operand.match(/\[.+\]/);
      if (!bracketMatch) throw new Error(`Invalid memory operand: ${operand}`);
      const addr = this.parseAddress(bracketMatch[0]);

      if (isByte) {
        return this.memory[addr];
      } else {
        return (this.memory[addr] | (this.memory[(addr + 1) & 0xFFFF] << 8)) & 0xFFFF;
      }
    }

    // 4. Handle hex literals (e.g. 0x10 or 10h)
    if (operand.startsWith('0x')) {
      return parseInt(operand.substring(2), 16);
    }
    if (operand.endsWith('h')) {
      return parseNumeric(operand);
    }

    // 5. Handle decimal literal
    if (/^-?\d+$/.test(operand)) {
      return parseInt(operand, 10);
    }

    // 6. Handle lookup from symbolTable
    if (this.symbolTable && this.symbolTable.hasOwnProperty(operand)) {
      return this.symbolTable[operand];
    }

    throw new Error(`Invalid operand: ${operand}`);
  }

  setValue(operand, value, context = '') {
    operand = operand.trim().toLowerCase();
    context = context.trim().toLowerCase();
    value = value & 0xFFFF;

    // 1. Handle registers
    if (this.registers.hasOwnProperty(operand)) {
      this.registers[operand] = value;
      return;
    }
    if (operand === 'al') {
      this.registers.ax = (this.registers.ax & 0xFF00) | (value & 0xFF);
      return;
    }
    if (operand === 'ah') {
      this.registers.ax = (this.registers.ax & 0x00FF) | ((value & 0xFF) << 8);
      return;
    }
    if (operand === 'bl') {
      this.registers.bx = (this.registers.bx & 0xFF00) | (value & 0xFF);
      return;
    }
    if (operand === 'bh') {
      this.registers.bx = (this.registers.bx & 0x00FF) | ((value & 0xFF) << 8);
      return;
    }
    if (operand === 'cl') {
      this.registers.cx = (this.registers.cx & 0xFF00) | (value & 0xFF);
      return;
    }
    if (operand === 'ch') {
      this.registers.cx = (this.registers.cx & 0x00FF) | ((value & 0xFF) << 8);
      return;
    }
    if (operand === 'dl') {
      this.registers.dx = (this.registers.dx & 0xFF00) | (value & 0xFF);
      return;
    }
    if (operand === 'dh') {
      this.registers.dx = (this.registers.dx & 0x00FF) | ((value & 0xFF) << 8);
      return;
    }

    // 2. Handle memory reference: [address]
    if (operand.includes('[') && operand.endsWith(']')) {
      const isByte = operand.includes('byte') || 
                     ['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(context) ||
                     (typeof context === 'number' && context <= 0xFF);
      
      const bracketMatch = operand.match(/\[.+\]/);
      if (!bracketMatch) throw new Error(`Invalid memory operand: ${operand}`);
      const addr = this.parseAddress(bracketMatch[0]);

      if (isByte) {
        this.memory[addr] = value & 0xFF;
      } else {
        this.memory[addr] = value & 0xFF;
        this.memory[(addr + 1) & 0xFFFF] = (value >> 8) & 0xFF;
      }
      return;
    }

    throw new Error(`Cannot set value on: ${operand}`);
  }

  parseAddress(addr) {
    addr = addr.slice(1, -1).toLowerCase().trim();
    let result = 0;

    const parts = addr.split('+');
    for (const part of parts) {
      const trimmed = part.trim();
      if (this.registers.hasOwnProperty(trimmed)) {
        result += this.registers[trimmed];
      } else {
        const val = parseNumeric(trimmed);
        if (!isNaN(val)) {
          result += val;
        }
      }
    }
    return result & 0xFFFF;
  }

  updateFlags(result) {
    // Zero Flag
    this.flags.zf = result === 0 ? 1 : 0;

    // Sign Flag (bit 15 for 16-bit)
    this.flags.sf = (result & 0x8000) ? 1 : 0;

    // Carry Flag (overflow from 16-bit)
    this.flags.cf = result > 0xFFFF ? 1 : 0;

    // Parity Flag (even number of 1s in low byte)
    const lowByte = result & 0xFF;
    const ones = lowByte.toString(2).split('1').length - 1;
    this.flags.pf = ones % 2 === 0 ? 1 : 0;
  }
}

// Utility helper functions for parsing assembler numbers and values
export function parseNumeric(str) {
  str = str.trim().toLowerCase();
  let isNegative = false;
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1).trim();
  }
  let val = NaN;
  if (str.startsWith('0x')) {
    val = parseInt(str.substring(2), 16);
  } else if (str.endsWith('h')) {
    let hex = str.slice(0, -1);
    // Remove leading zero MASM prefix if present (e.g. 0ffh -> ffh)
    if (hex.startsWith('0') && hex.length > 1) {
      hex = hex.slice(1);
    }
    val = parseInt(hex, 16);
  } else if (str.endsWith('b') && /^[01]+b$/.test(str)) {
    let bin = str.slice(0, -1);
    val = parseInt(bin, 2);
  } else if (/^\d+$/.test(str)) {
    val = parseInt(str, 10);
  }
  return isNegative ? -val : val;
}

export function parseDataValues(valueStr) {
  const values = [];
  let i = 0;
  while (i < valueStr.length) {
    if (/\s/.test(valueStr[i]) || valueStr[i] === ',') {
      i++;
      continue;
    }
    if (valueStr[i] === "'" || valueStr[i] === '"') {
      const quote = valueStr[i];
      i++;
      let str = "";
      while (i < valueStr.length && valueStr[i] !== quote) {
        str += valueStr[i];
        i++;
      }
      i++; // skip closing quote
      for (let j = 0; j < str.length; j++) {
        values.push(str.charCodeAt(j));
      }
    } else {
      let start = i;
      while (i < valueStr.length && valueStr[i] !== ',' && !/\s/.test(valueStr[i])) {
        i++;
      }
      let part = valueStr.substring(start, i).trim().toLowerCase();
      if (part) {
        let numVal = parseNumeric(part);
        if (!isNaN(numVal)) {
          values.push(numVal);
        } else {
          // Store string placeholder for labels (e.g. dw msg)
          values.push(part);
        }
      }
    }
  }
  return values;
}

