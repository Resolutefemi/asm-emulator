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
      cs: 0,
      ds: 0,
      ss: 0,
      es: 0,
    };

    this.flags = {
      cf: 0,    // Carry Flag
      pf: 0,    // Parity Flag
      af: 0,    // Auxiliary Flag
      zf: 0,    // Zero Flag
      sf: 0,    // Sign Flag
      of: 0,    // Overflow Flag
      df: 0,    // Direction Flag
      iflag: 0, // Interrupt Flag
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
      // Ignore segment declarations and other directives
      if (
        /^\s*\.(model|stack|data|code)\b/i.test(line) ||
        /^\s*(assume|end)\b/i.test(line) ||
        /\b(segment|ends)\b/i.test(line)
      ) {
        continue;
      }

      // Handle procedure declarations as labels
      const procMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+proc\b/i);
      if (procMatch) {
        const labelName = procMatch[1].toLowerCase();
        this.symbolTable[labelName] = instructionIndex;
        continue;
      }
      if (/\b(endp)\b/i.test(line)) {
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
      if (
        /^\s*\.(model|stack|data|code)\b/i.test(line) ||
        /^\s*org\b/i.test(line) ||
        /^\s*(assume|end)\b/i.test(line) ||
        /\b(segment|ends|endp)\b/i.test(line) ||
        /^([a-zA-Z_][a-zA-Z0-9_]*)\s+proc\b/i.test(line)
      ) {
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
            const escapedSymbol = symbol.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(?<![a-zA-Z0-9_@])${escapedSymbol}(?![a-zA-Z0-9_@])`, 'gi');
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

  step() {
    if (this.ip >= this.code.length) {
      return { halted: true };
    }
    const instruction = this.code[this.ip];
    this.execute(instruction);
    if (this.ip < this.code.length) {
      this.ip++;
    }
    const halted = instruction.instr === 'hlt' || this.ip >= this.code.length;
    return { halted, instruction };
  }

  execute(instruction) {
    const { instr, args } = instruction;

    switch (instr) {
      case 'mov':
        this.mov(args[0], args[1]);
        break;
      case 'lea':
        this.lea(args[0], args[1]);
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
      case 'je':
      case 'jz':
        if (this.flags.zf) this.jmp(args[0]);
        break;
      case 'jne':
      case 'jnz':
        if (!this.flags.zf) this.jmp(args[0]);
        break;
      case 'js':
        if (this.flags.sf) this.jmp(args[0]);
        break;
      case 'jns':
        if (!this.flags.sf) this.jmp(args[0]);
        break;
      case 'jc':
      case 'jb':
        if (this.flags.cf) this.jmp(args[0]);
        break;
      case 'jnc':
      case 'jae':
        if (!this.flags.cf) this.jmp(args[0]);
        break;
      case 'jo':
        if (this.flags.of) this.jmp(args[0]);
        break;
      case 'jno':
        if (!this.flags.of) this.jmp(args[0]);
        break;
      case 'ja':
      case 'jnbe':
        if (!this.flags.cf && !this.flags.zf) this.jmp(args[0]);
        break;
      case 'jbe':
      case 'jna':
        if (this.flags.cf || this.flags.zf) this.jmp(args[0]);
        break;
      case 'jg':
      case 'jnle':
        if (!this.flags.zf && (this.flags.sf === this.flags.of)) this.jmp(args[0]);
        break;
      case 'jge':
      case 'jnl':
        if (this.flags.sf === this.flags.of) this.jmp(args[0]);
        break;
      case 'jl':
      case 'jnge':
        if (this.flags.sf !== this.flags.of) this.jmp(args[0]);
        break;
      case 'jle':
      case 'jng':
        if (this.flags.zf || (this.flags.sf !== this.flags.of)) this.jmp(args[0]);
        break;
      case 'loop':
        this.loop(args[0]);
        break;
      case 'call':
        this.call(args[0]);
        break;
      case 'ret':
        this.ret();
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
      case 'not':
        this.not(args[0]);
        break;
      case 'neg':
        this.neg(args[0]);
        break;
      case 'test':
        this.test(args[0], args[1]);
        break;
      case 'xchg':
        this.xchg(args[0], args[1]);
        break;
      case 'inc':
        this.inc(args[0]);
        break;
      case 'dec':
        this.dec(args[0]);
        break;
      case 'mul':
        this.mul(args[0]);
        break;
      case 'imul':
        this.imul(args[0], args[1]);
        break;
      case 'div':
        this.div(args[0]);
        break;
      case 'idiv':
        this.idiv(args[0]);
        break;
      case 'adc':
        this.adc(args[0], args[1]);
        break;
      case 'sbb':
        this.sbb(args[0], args[1]);
        break;
      case 'cbw':
        this.cbw();
        break;
      case 'cwd':
        this.cwd();
        break;
      case 'shl':
      case 'sal':
        this.shl(args[0], args[1]);
        break;
      case 'shr':
        this.shr(args[0], args[1]);
        break;
      case 'sar':
        this.sar(args[0], args[1]);
        break;
      case 'rol':
        this.rol(args[0], args[1]);
        break;
      case 'ror':
        this.ror(args[0], args[1]);
        break;
      case 'rcl':
        this.rcl(args[0], args[1]);
        break;
      case 'rcr':
        this.rcr(args[0], args[1]);
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
      case 'jcxz':
        if (this.registers.cx === 0) this.jmp(args[0]);
        break;
      case 'jp':
      case 'jpe':
        if (this.flags.pf) this.jmp(args[0]);
        break;
      case 'jnp':
      case 'jpo':
        if (!this.flags.pf) this.jmp(args[0]);
        break;
      case 'loope':
      case 'loopz':
        this.loope(args[0]);
        break;
      case 'loopne':
      case 'loopnz':
        this.loopne(args[0]);
        break;
      case 'stc':
        this.flags.cf = 1;
        this.output.push('stc → CF = 1');
        break;
      case 'clc':
        this.flags.cf = 0;
        this.output.push('clc → CF = 0');
        break;
      case 'cmc':
        this.flags.cf ^= 1;
        this.output.push(`cmc → CF = ${this.flags.cf}`);
        break;
      case 'std':
        this.flags.df = 1;
        this.output.push('std → DF = 1');
        break;
      case 'cld':
        this.flags.df = 0;
        this.output.push('cld → DF = 0');
        break;
      case 'sti':
        this.flags.iflag = 1;
        this.output.push('sti → IF = 1');
        break;
      case 'cli':
        this.flags.iflag = 0;
        this.output.push('cli → IF = 0');
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

  lea(dest, src) {
    let addressVal;
    src = src.trim().toLowerCase();
    if (src.includes('[') && src.endsWith(']')) {
      const bracketMatch = src.match(/\[.+\]/);
      addressVal = this.parseAddress(bracketMatch[0]);
    } else {
      addressVal = this.getValue(src);
    }
    this.setValue(dest, addressVal);
    this.output.push(`lea ${dest}, ${src} → ${dest} = 0x${addressVal.toString(16).toUpperCase()}`);
  }

  add(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal + srcVal) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result, destVal, srcVal, 'add');
    this.output.push(`add ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  sub(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal - srcVal) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result, destVal, srcVal, 'sub');
    this.output.push(`sub ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  cmp(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal - srcVal) & 0xFFFF;
    this.updateFlags(result, destVal, srcVal, 'sub');
    this.output.push(`cmp ${dest}, ${src} → flags updated`);
  }

  xor(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal ^ srcVal;
    this.setValue(dest, result, src);
    this.flags.cf = 0;
    this.flags.of = 0;
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`xor ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  and(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal & srcVal;
    this.setValue(dest, result, src);
    this.flags.cf = 0;
    this.flags.of = 0;
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`and ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  or(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal | srcVal;
    this.setValue(dest, result, src);
    this.flags.cf = 0;
    this.flags.of = 0;
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`or ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  not(dest) {
    const val = this.getValue(dest);
    const result = (~val) & 0xFFFF;
    this.setValue(dest, result);
    this.output.push(`not ${dest} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  neg(dest) {
    const val = this.getValue(dest);
    const result = (0 - val) & 0xFFFF;
    this.setValue(dest, result);
    this.flags.cf = val !== 0 ? 1 : 0;
    this.updateFlags(result, 0, val, 'sub');
    this.output.push(`neg ${dest} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  test(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = destVal & srcVal;
    this.flags.cf = 0;
    this.flags.of = 0;
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`test ${dest}, ${src} → flags updated`);
  }

  xchg(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src);
    this.setValue(dest, srcVal);
    this.setValue(src, destVal);
    this.output.push(`xchg ${dest}, ${src} → ${dest}=0x${srcVal.toString(16).toUpperCase()}, ${src}=0x${destVal.toString(16).toUpperCase()}`);
  }

  adc(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal + srcVal + this.flags.cf) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result, destVal, srcVal, 'add');
    this.output.push(`adc ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  sbb(dest, src) {
    const destVal = this.getValue(dest);
    const srcVal = this.getValue(src, dest);
    const result = (destVal - srcVal - this.flags.cf) & 0xFFFF;
    this.setValue(dest, result, src);
    this.updateFlags(result, destVal, srcVal, 'sub');
    this.output.push(`sbb ${dest}, ${src} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  mul(src) {
    // 8-bit: AX = AL * src (byte); 16-bit: DX:AX = AX * src (word)
    const srcVal = this.getValue(src);
    const isByte = ['al','ah','bl','bh','cl','ch','dl','dh'].includes(src.trim().toLowerCase());
    if (isByte) {
      const al = this.registers.ax & 0xFF;
      const result = al * (srcVal & 0xFF);
      this.registers.ax = result & 0xFFFF;
      this.flags.cf = this.flags.of = (result > 0xFF) ? 1 : 0;
      this.output.push(`mul ${src} → AX = 0x${(result & 0xFFFF).toString(16).toUpperCase()}`);
    } else {
      const ax = this.registers.ax;
      const result = ax * srcVal;
      this.registers.ax = result & 0xFFFF;
      this.registers.dx = (result >>> 16) & 0xFFFF;
      this.flags.cf = this.flags.of = (this.registers.dx !== 0) ? 1 : 0;
      this.output.push(`mul ${src} → DX:AX = 0x${this.registers.dx.toString(16).toUpperCase()}:0x${this.registers.ax.toString(16).toUpperCase()}`);
    }
  }

  imul(src, src2) {
    // 1-operand: AX = AL * src (signed byte) or DX:AX = AX * src (signed word)
    // 2-operand: dest = dest * src2 (dest is src, src2 is immediate/register)
    if (src2 !== undefined) {
      // 2-operand form: imul dest, src  (dest *= src)
      const destVal = this.toSigned16(this.getValue(src));
      const srcVal = this.toSigned16(this.getValue(src2));
      const result = (destVal * srcVal) & 0xFFFF;
      this.setValue(src, result);
      const fullResult = destVal * srcVal;
      this.flags.cf = this.flags.of = (fullResult < -32768 || fullResult > 32767) ? 1 : 0;
      this.output.push(`imul ${src}, ${src2} → ${src} = 0x${result.toString(16).toUpperCase()}`);
    } else {
      // 1-operand form
      const srcVal = this.getValue(src);
      const isByte = ['al','ah','bl','bh','cl','ch','dl','dh'].includes(src.trim().toLowerCase());
      if (isByte) {
        const al = this.toSigned8(this.registers.ax & 0xFF);
        const multiplier = this.toSigned8(srcVal & 0xFF);
        const result = al * multiplier;
        this.registers.ax = result & 0xFFFF;
        this.flags.cf = this.flags.of = (result < -128 || result > 127) ? 1 : 0;
        this.output.push(`imul ${src} → AX = 0x${(this.registers.ax).toString(16).toUpperCase()}`);
      } else {
        const ax = this.toSigned16(this.registers.ax);
        const multiplier = this.toSigned16(srcVal);
        const result = ax * multiplier;
        this.registers.ax = result & 0xFFFF;
        this.registers.dx = ((result >> 16) & 0xFFFF);
        this.flags.cf = this.flags.of = (result < -32768 || result > 32767) ? 1 : 0;
        this.output.push(`imul ${src} → DX:AX = 0x${this.registers.dx.toString(16).toUpperCase()}:0x${this.registers.ax.toString(16).toUpperCase()}`);
      }
    }
  }

  div(src) {
    const srcVal = this.getValue(src);
    if (srcVal === 0) throw new Error('Division by zero');
    const isByte = ['al','ah','bl','bh','cl','ch','dl','dh'].includes(src.trim().toLowerCase());
    if (isByte) {
      const ax = this.registers.ax;
      const quotient = Math.floor(ax / srcVal);
      const remainder = ax % srcVal;
      if (quotient > 0xFF) throw new Error('Division overflow');
      this.registers.ax = ((remainder & 0xFF) << 8) | (quotient & 0xFF); // AH=remainder, AL=quotient
      this.output.push(`div ${src} → AL = 0x${(quotient & 0xFF).toString(16).toUpperCase()}, AH = 0x${(remainder & 0xFF).toString(16).toUpperCase()}`);
    } else {
      const dxax = ((this.registers.dx & 0xFFFF) << 16) | (this.registers.ax & 0xFFFF);
      const quotient = Math.floor(dxax / srcVal);
      const remainder = dxax % srcVal;
      if (quotient > 0xFFFF) throw new Error('Division overflow');
      this.registers.ax = quotient & 0xFFFF;
      this.registers.dx = remainder & 0xFFFF;
      this.output.push(`div ${src} → AX = 0x${this.registers.ax.toString(16).toUpperCase()}, DX = 0x${this.registers.dx.toString(16).toUpperCase()}`);
    }
  }

  idiv(src) {
    const srcVal = this.getValue(src);
    if (srcVal === 0) throw new Error('Division by zero');
    const isByte = ['al','ah','bl','bh','cl','ch','dl','dh'].includes(src.trim().toLowerCase());
    if (isByte) {
      const ax = this.toSigned16(this.registers.ax);
      const divisor = this.toSigned8(srcVal & 0xFF);
      const quotient = Math.trunc(ax / divisor);
      const remainder = ax % divisor;
      if (quotient < -128 || quotient > 127) throw new Error('Division overflow');
      this.registers.ax = ((remainder & 0xFF) << 8) | (quotient & 0xFF);
      this.output.push(`idiv ${src} → AL = ${quotient}, AH = ${remainder}`);
    } else {
      const dxax = this.toSigned32(((this.registers.dx & 0xFFFF) * 0x10000) | (this.registers.ax & 0xFFFF));
      const divisor = this.toSigned16(srcVal);
      const quotient = Math.trunc(dxax / divisor);
      const remainder = dxax % divisor;
      if (quotient < -32768 || quotient > 32767) throw new Error('Division overflow');
      this.registers.ax = quotient & 0xFFFF;
      this.registers.dx = remainder & 0xFFFF;
      this.output.push(`idiv ${src} → AX = ${quotient}, DX = ${remainder}`);
    }
  }

  cbw() {
    // Sign-extend AL into AH
    const al = this.registers.ax & 0xFF;
    if (al & 0x80) {
      this.registers.ax = (this.registers.ax & 0x00FF) | 0xFF00;
    } else {
      this.registers.ax = this.registers.ax & 0x00FF;
    }
    this.output.push(`cbw → AX = 0x${this.registers.ax.toString(16).toUpperCase()}`);
  }

  cwd() {
    // Sign-extend AX into DX
    if (this.registers.ax & 0x8000) {
      this.registers.dx = 0xFFFF;
    } else {
      this.registers.dx = 0;
    }
    this.output.push(`cwd → DX = 0x${this.registers.dx.toString(16).toUpperCase()}`);
  }

  shl(dest, countArg) {
    const count = countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F);
    const val = this.getValue(dest);
    const result = (val << count) & 0xFFFF;
    this.setValue(dest, result);
    if (count > 0) {
      this.flags.cf = (val >> (16 - count)) & 1;
    }
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`shl ${dest}, ${countArg} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  shr(dest, countArg) {
    const count = countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F);
    const val = this.getValue(dest);
    const result = (val >>> count) & 0xFFFF;
    this.setValue(dest, result);
    if (count > 0) {
      this.flags.cf = (val >> (count - 1)) & 1;
    }
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`shr ${dest}, ${countArg} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  sar(dest, countArg) {
    const count = countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F);
    const val = this.toSigned16(this.getValue(dest));
    const result = (val >> count) & 0xFFFF;
    this.setValue(dest, result);
    if (count > 0) {
      this.flags.cf = (this.getValue(dest) >> (count - 1)) & 1;
    }
    this.updateFlags(result, 0, 0, 'logic');
    this.output.push(`sar ${dest}, ${countArg} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  rol(dest, countArg) {
    const count = (countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F)) % 16;
    const val = this.getValue(dest);
    const result = ((val << count) | (val >>> (16 - count))) & 0xFFFF;
    this.setValue(dest, result);
    this.flags.cf = result & 1;
    this.output.push(`rol ${dest}, ${countArg} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  ror(dest, countArg) {
    const count = (countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F)) % 16;
    const val = this.getValue(dest);
    const result = ((val >>> count) | (val << (16 - count))) & 0xFFFF;
    this.setValue(dest, result);
    this.flags.cf = (result >> 15) & 1;
    this.output.push(`ror ${dest}, ${countArg} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  rcl(dest, countArg) {
    const count = (countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F)) % 17;
    let val = this.getValue(dest);
    let cf = this.flags.cf;
    for (let i = 0; i < count; i++) {
      const newCf = (val >> 15) & 1;
      val = ((val << 1) | cf) & 0xFFFF;
      cf = newCf;
    }
    this.setValue(dest, val);
    this.flags.cf = cf;
    this.output.push(`rcl ${dest}, ${countArg} → ${dest} = 0x${val.toString(16).toUpperCase()}`);
  }

  rcr(dest, countArg) {
    const count = (countArg.trim().toLowerCase() === 'cl'
      ? (this.registers.cx & 0xFF)
      : (this.getValue(countArg) & 0x1F)) % 17;
    let val = this.getValue(dest);
    let cf = this.flags.cf;
    for (let i = 0; i < count; i++) {
      const newCf = val & 1;
      val = ((val >>> 1) | (cf << 15)) & 0xFFFF;
      cf = newCf;
    }
    this.setValue(dest, val);
    this.flags.cf = cf;
    this.output.push(`rcr ${dest}, ${countArg} → ${dest} = 0x${val.toString(16).toUpperCase()}`);
  }

  loope(label) {
    const cxVal = (this.registers.cx - 1) & 0xFFFF;
    this.registers.cx = cxVal;
    this.output.push(`loope ${label} → CX = 0x${cxVal.toString(16).toUpperCase()}`);
    if (cxVal !== 0 && this.flags.zf) {
      this.jmp(label);
    }
  }

  loopne(label) {
    const cxVal = (this.registers.cx - 1) & 0xFFFF;
    this.registers.cx = cxVal;
    this.output.push(`loopne ${label} → CX = 0x${cxVal.toString(16).toUpperCase()}`);
    if (cxVal !== 0 && !this.flags.zf) {
      this.jmp(label);
    }
  }

  // Signed conversion helpers
  toSigned8(val) {
    val = val & 0xFF;
    return val >= 0x80 ? val - 0x100 : val;
  }

  toSigned16(val) {
    val = val & 0xFFFF;
    return val >= 0x8000 ? val - 0x10000 : val;
  }

  toSigned32(val) {
    val = val >>> 0; // to unsigned 32-bit
    return val >= 0x80000000 ? val - 0x100000000 : val;
  }

  inc(dest) {
    const val = this.getValue(dest);
    const result = (val + 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, val, 1, 'add');
    this.output.push(`inc ${dest} → ${dest} = 0x${result.toString(16).toUpperCase()}`);
  }

  dec(dest) {
    const val = this.getValue(dest);
    const result = (val - 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, val, 1, 'sub');
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

  loop(label) {
    const cxVal = (this.registers.cx - 1) & 0xFFFF;
    this.registers.cx = cxVal;
    this.output.push(`loop ${label} → CX = 0x${cxVal.toString(16).toUpperCase()}`);
    if (cxVal !== 0) {
      this.jmp(label);
    }
  }

  call(label) {
    const nextIp = this.ip + 1;
    this.registers.sp = (this.registers.sp - 2) & 0xFFFF;
    this.memory[this.registers.sp] = nextIp & 0xFF;
    this.memory[(this.registers.sp + 1) & 0xFFFF] = (nextIp >> 8) & 0xFF;
    this.output.push(`call ${label} → push return IP = ${nextIp}`);
    this.jmp(label);
  }

  ret() {
    const value = this.memory[this.registers.sp] | (this.memory[(this.registers.sp + 1) & 0xFFFF] << 8);
    this.registers.sp = (this.registers.sp + 2) & 0xFFFF;
    this.ip = value - 1;
    this.output.push(`ret → pop return IP = ${value}`);
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

  updateFlags(result, destVal = 0, srcVal = 0, opType = 'add') {
    // Zero Flag
    this.flags.zf = (result & 0xFFFF) === 0 ? 1 : 0;

    // Sign Flag (bit 15 for 16-bit)
    this.flags.sf = (result & 0x8000) ? 1 : 0;

    // Carry Flag & Overflow Flag
    if (opType === 'add') {
      this.flags.cf = (destVal + srcVal) > 0xFFFF ? 1 : 0;
      const destSign = (destVal & 0x8000) >> 15;
      const srcSign = (srcVal & 0x8000) >> 15;
      const resSign = (result & 0x8000) >> 15;
      this.flags.of = (destSign === srcSign && destSign !== resSign) ? 1 : 0;
    } else if (opType === 'sub') {
      this.flags.cf = destVal < srcVal ? 1 : 0;
      const destSign = (destVal & 0x8000) >> 15;
      const srcSign = (srcVal & 0x8000) >> 15;
      const resSign = (result & 0x8000) >> 15;
      this.flags.of = (destSign !== srcSign && destSign !== resSign) ? 1 : 0;
    }

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

