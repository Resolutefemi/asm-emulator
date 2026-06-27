// src/emulator/Emulator8086Enhanced.js
import { INSTRUCTION_SET } from '../data/InstructionSet8086';

export class Emulator8086Enhanced {
  constructor() {
    this.reset();
  }

  reset() {
    this.registers = {
      ax: 0, bx: 0, cx: 0, dx: 0,
      si: 0, di: 0, bp: 0, sp: 0xFFFF,
      cs: 0, ds: 0, es: 0, ss: 0,
      ip: 0,
    };

    this.flags = {
      cf: 0, pf: 0, af: 0, zf: 0,
      sf: 0, of: 0, df: 0, tf: 0, iflag: 0
    };

    this.memory = new Array(65536).fill(0);
    this.code = [];
    this.output = [];
    this.instructionCount = 0;
    this.labels = {};
  }

  load(asmCode) {
    this.code = this.parse(asmCode);
    this.output = [];
    this.instructionCount = 0;
    this.findLabels();
  }

  parse(asmCode) {
    const lines = asmCode
      .split('\n')
      .map(line => {
        const commentIdx = line.indexOf(';');
        return commentIdx > -1 ? line.substring(0, commentIdx) : line;
      })
      .map(line => line.trim())
      .filter(line => line);

    const instructions = [];
    for (const line of lines) {
      if (line.endsWith(':')) {
        // Label
        this.labels[line.slice(0, -1).toLowerCase()] = instructions.length;
        continue;
      }

      const [instr, ...argsPart] = line.split(/\s+/);
      if (instr) {
        const args = argsPart.join(' ').split(',').map(s => s.trim());
        instructions.push({
          instr: instr.toLowerCase(),
          args: args.filter(a => a),
          original: line
        });
      }
    }
    return instructions;
  }

  findLabels() {
    const lines = this.code;
    this.labels = {};
    lines.forEach((line, idx) => {
      if (line.original && line.original.endsWith(':')) {
        const label = line.original.slice(0, -1).toLowerCase();
        this.labels[label] = idx;
      }
    });
  }

  run(maxSteps = 10000) {
    this.output = [];
    let steps = 0;

    while (this.registers.ip < this.code.length && steps < maxSteps) {
      const instruction = this.code[this.registers.ip];
      
      try {
        this.execute(instruction);
        this.instructionCount++;
        
        if (instruction.instr === 'hlt') break;
        
        // Only increment IP if not a jump (jump sets IP)
        if (!['jmp', 'je', 'jz', 'jne', 'jnz', 'jo', 'jno', 'js', 'jns',
              'jp', 'jpe', 'jnp', 'jpo', 'jc', 'jnc', 'jl', 'jge', 'jle', 'jg',
              'jb', 'jae', 'jbe', 'ja', 'loop', 'loope', 'loopz', 'loopne', 'loopnz',
              'call', 'ret'].includes(instruction.instr)) {
          this.registers.ip++;
        } else {
          this.registers.ip++;
        }
      } catch (err) {
        this.output.push(`❌ Error at IP ${this.registers.ip}: ${err.message}`);
        break;
      }
      
      steps++;
    }

    if (steps === maxSteps) {
      this.output.push('⚠️ Max execution steps (infinite loop detected)');
    }

    return this.output;
  }

  execute(instruction) {
    const { instr, args } = instruction;
    const method = this[instr];

    if (!method) {
      throw new Error(`Unknown instruction: ${instr}`);
    }

    method.call(this, ...args);
  }

  // ===== DATA TRANSFER =====
  mov(dest, src) {
    const val = this.getValue(src);
    this.setValue(dest, val);
    this.log(`mov ${dest}, ${src}`);
  }

  xchg(dest, src) {
    const val1 = this.getValue(dest);
    const val2 = this.getValue(src);
    this.setValue(dest, val2);
    this.setValue(src, val1);
    this.log(`xchg ${dest}, ${src}`);
  }

  lea(dest, src) {
    // Simplified: just get address
    const addr = this.parseAddress(src);
    this.setValue(dest, addr);
    this.log(`lea ${dest}, ${src}`);
  }

  push(src) {
    const val = this.getValue(src);
    this.registers.sp = (this.registers.sp - 2) & 0xFFFF;
    this.writeWord(this.registers.sp, val);
    this.log(`push ${src}`);
  }

  pop(dest) {
    const val = this.readWord(this.registers.sp);
    this.registers.sp = (this.registers.sp + 2) & 0xFFFF;
    this.setValue(dest, val);
    this.log(`pop ${dest}`);
  }

  // ===== ARITHMETIC =====
  add(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = (d + s) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'add');
    this.log(`add ${dest}, ${src} → ${result}`);
  }

  adc(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = (d + s + this.flags.cf) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'add');
    this.log(`adc ${dest}, ${src}`);
  }

  sub(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = (d - s) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'sub');
    this.log(`sub ${dest}, ${src} → ${result}`);
  }

  sbb(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = (d - s - this.flags.cf) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'sub');
    this.log(`sbb ${dest}, ${src}`);
  }

  mul(src) {
    const al = this.registers.ax & 0xFF;
    const val = this.getValue(src);
    const result = (al * val) & 0xFFFF;
    this.registers.ax = result;
    this.flags.cf = this.flags.of = result > 0xFF ? 1 : 0;
    this.log(`mul ${src}`);
  }

  imul(dest, src, imm = null) {
    let d = this.getValue(dest);
    let s = imm ? parseInt(imm) : this.getValue(src);
    const result = (d * s) & 0xFFFF;
    this.setValue(dest, result);
    this.flags.cf = this.flags.of = 0;
    this.log(`imul ${dest}, ${src}`);
  }

  div(src) {
    const divisor = this.getValue(src);
    if (divisor === 0) throw new Error('Division by zero');
    const ax = this.registers.ax;
    this.registers.ax = Math.floor(ax / divisor) & 0xFF;
    this.registers.dx = (ax % divisor) & 0xFF;
    this.log(`div ${src}`);
  }

  idiv(src) {
    const divisor = this.getValue(src);
    if (divisor === 0) throw new Error('Division by zero');
    const ax = this.registers.ax;
    this.registers.ax = Math.floor(ax / divisor) & 0xFF;
    this.registers.dx = (ax % divisor) & 0xFF;
    this.log(`idiv ${src}`);
  }

  inc(dest) {
    const val = this.getValue(dest);
    const result = (val + 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, val, 1, 'add');
    this.log(`inc ${dest}`);
  }

  dec(dest) {
    const val = this.getValue(dest);
    const result = (val - 1) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, val, 1, 'sub');
    this.log(`dec ${dest}`);
  }

  neg(dest) {
    const val = this.getValue(dest);
    const result = (0 - val) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, 0, val, 'sub');
    this.log(`neg ${dest}`);
  }

  cmp(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = (d - s) & 0xFFFF;
    this.updateFlags(result, d, s, 'sub');
    this.log(`cmp ${dest}, ${src}`);
  }

  // ===== LOGIC =====
  and(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = d & s;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'and');
    this.log(`and ${dest}, ${src}`);
  }

  or(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = d | s;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'or');
    this.log(`or ${dest}, ${src}`);
  }

  xor(dest, src) {
    const d = this.getValue(dest);
    const s = this.getValue(src);
    const result = d ^ s;
    this.setValue(dest, result);
    this.updateFlags(result, d, s, 'xor');
    this.log(`xor ${dest}, ${src}`);
  }

  not(dest) {
    const val = this.getValue(dest);
    const result = (~val) & 0xFFFF;
    this.setValue(dest, result);
    this.log(`not ${dest}`);
  }

  shl(dest, count_str) {
    const count = count_str === 'cl' ? (this.registers.cx & 0xFF) : parseInt(count_str);
    const val = this.getValue(dest);
    const result = (val << count) & 0xFFFF;
    this.setValue(dest, result);
    this.updateFlags(result, val, count, 'shl');
    this.log(`shl ${dest}, ${count_str}`);
  }

  shr(dest, count_str) {
    const count = count_str === 'cl' ? (this.registers.cx & 0xFF) : parseInt(count_str);
    const val = this.getValue(dest);
    const result = val >> count;
    this.setValue(dest, result);
    this.updateFlags(result, val, count, 'shr');
    this.log(`shr ${dest}, ${count_str}`);
  }

  sar(dest, count_str) {
    const count = count_str === 'cl' ? (this.registers.cx & 0xFF) : parseInt(count_str);
    const val = this.getValue(dest);
    const result = val >> count;
    this.setValue(dest, result);
    this.updateFlags(result, val, count, 'sar');
    this.log(`sar ${dest}, ${count_str}`);
  }

  rol(dest, count_str) {
    const count = count_str === 'cl' ? (this.registers.cx & 0xFF) : parseInt(count_str);
    const val = this.getValue(dest);
    const result = ((val << count) | (val >> (16 - count))) & 0xFFFF;
    this.setValue(dest, result);
    this.log(`rol ${dest}, ${count_str}`);
  }

  ror(dest, count_str) {
    const count = count_str === 'cl' ? (this.registers.cx & 0xFF) : parseInt(count_str);
    const val = this.getValue(dest);
    const result = ((val >> count) | (val << (16 - count))) & 0xFFFF;
    this.setValue(dest, result);
    this.log(`ror ${dest}, ${count_str}`);
  }

  // ===== CONTROL FLOW =====
  jmp(label) {
    const addr = this.labels[label.toLowerCase()];
    if (addr !== undefined) {
      this.registers.ip = addr - 1; // -1 because IP will be incremented
    }
    this.log(`jmp ${label}`);
  }

  je(label) {
    if (this.flags.zf === 1) this.jmp(label);
    else this.log(`je ${label} (not taken)`);
  }

  jz(label) { this.je(label); }

  jne(label) {
    if (this.flags.zf === 0) this.jmp(label);
    else this.log(`jne ${label} (not taken)`);
  }

  jnz(label) { this.jne(label); }

  jo(label) {
    if (this.flags.of === 1) this.jmp(label);
    else this.log(`jo ${label} (not taken)`);
  }

  jno(label) {
    if (this.flags.of === 0) this.jmp(label);
    else this.log(`jno ${label} (not taken)`);
  }

  js(label) {
    if (this.flags.sf === 1) this.jmp(label);
    else this.log(`js ${label} (not taken)`);
  }

  jns(label) {
    if (this.flags.sf === 0) this.jmp(label);
    else this.log(`jns ${label} (not taken)`);
  }

  jc(label) {
    if (this.flags.cf === 1) this.jmp(label);
    else this.log(`jc ${label} (not taken)`);
  }

  jnc(label) {
    if (this.flags.cf === 0) this.jmp(label);
    else this.log(`jnc ${label} (not taken)`);
  }

  jl(label) {
    if (this.flags.sf !== this.flags.of) this.jmp(label);
    else this.log(`jl ${label} (not taken)`);
  }

  jge(label) {
    if (this.flags.sf === this.flags.of) this.jmp(label);
    else this.log(`jge ${label} (not taken)`);
  }

  loop(label) {
    this.registers.cx = (this.registers.cx - 1) & 0xFFFF;
    if (this.registers.cx !== 0) this.jmp(label);
    else this.log(`loop ${label} (cx=0)`);
  }

  call(label) {
    this.push('ax'); // Simplified: just save ax
    this.jmp(label);
    this.log(`call ${label}`);
  }

  ret() {
    this.pop('ax');
    this.log(`ret`);
  }

  // ===== FLAG INSTRUCTIONS =====
  stc() { this.flags.cf = 1; this.log('stc'); }
  clc() { this.flags.cf = 0; this.log('clc'); }
  cmc() { this.flags.cf ^= 1; this.log('cmc'); }
  std() { this.flags.df = 1; this.log('std'); }
  cld() { this.flags.df = 0; this.log('cld'); }
  sti() { this.flags.iflag = 1; this.log('sti'); }
  cli() { this.flags.iflag = 0; this.log('cli'); }

  // ===== MISC =====
  nop() { this.log('nop'); }
  hlt() { this.log('✓ CPU halted'); }
  int(num) { this.log(`int ${num}`); }

  // ===== HELPERS =====
  getValue(operand) {
    operand = operand.trim();

    if (this.registers.hasOwnProperty(operand)) {
      return this.registers[operand];
    }

    if (operand.startsWith('0x')) {
      return parseInt(operand, 16);
    }

    if (/^-?\d+$/.test(operand)) {
      return parseInt(operand);
    }

    if (operand.startsWith('[') && operand.endsWith(']')) {
      const addr = this.parseAddress(operand);
      return this.readWord(addr);
    }

    throw new Error(`Invalid operand: ${operand}`);
  }

  setValue(operand, value) {
    operand = operand.trim();
    value = value & 0xFFFF;

    if (this.registers.hasOwnProperty(operand)) {
      this.registers[operand] = value;
    } else if (operand.startsWith('[') && operand.endsWith(']')) {
      const addr = this.parseAddress(operand);
      this.writeWord(addr, value);
    } else {
      throw new Error(`Cannot set: ${operand}`);
    }
  }

  parseAddress(addr) {
    // Simplified: [si], [bx], [bx+1], etc.
    addr = addr.slice(1, -1).toLowerCase();
    let result = 0;

    const parts = addr.split('+');
    for (const part of parts) {
      if (this.registers.hasOwnProperty(part)) {
        result += this.registers[part];
      } else if (/^\d+$/.test(part)) {
        result += parseInt(part);
      }
    }

    return result & 0xFFFF;
  }

  readWord(addr) {
    addr = addr & 0xFFFF;
    return (this.memory[addr] | (this.memory[addr + 1] << 8)) & 0xFFFF;
  }

  writeWord(addr, val) {
    addr = addr & 0xFFFF;
    this.memory[addr] = val & 0xFF;
    this.memory[addr + 1] = (val >> 8) & 0xFF;
  }

  updateFlags(result, op1, op2, operation) {
    result = result & 0xFFFF;

    this.flags.zf = result === 0 ? 1 : 0;
    this.flags.sf = (result & 0x8000) ? 1 : 0;

    const lowByte = result & 0xFF;
    const ones = lowByte.toString(2).split('1').length - 1;
    this.flags.pf = ones % 2 === 0 ? 1 : 0;

    if (['add', 'adc'].includes(operation)) {
      this.flags.cf = (op1 + op2) > 0xFFFF ? 1 : 0;
      this.flags.of = ((op1 & 0x8000) === (op2 & 0x8000)) && 
                      ((op1 & 0x8000) !== (result & 0x8000)) ? 1 : 0;
    } else if (['sub', 'sbb', 'cmp'].includes(operation)) {
      this.flags.cf = op1 < op2 ? 1 : 0;
      this.flags.of = ((op1 & 0x8000) !== (op2 & 0x8000)) && 
                      ((op1 & 0x8000) !== (result & 0x8000)) ? 1 : 0;
    }
  }

  log(msg) {
    this.output.push(msg);
  }
}
