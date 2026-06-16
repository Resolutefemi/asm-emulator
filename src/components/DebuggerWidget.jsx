// src/components/DebuggerWidget.jsx
import React, { useState, useEffect, useRef } from 'react';

// Obstacles on the robot grid
const GRID_SIZE = 10;
const INITIAL_OBSTACLES = [
  { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
  { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 8, y: 7 },
  { x: 4, y: 5 }, { x: 5, y: 5 }
];

export default function DebuggerWidget({ emulatorState, emulatorRef, onUpdateState, onClose }) {
  const [activeSubTab, setActiveSubTab] = useState('stack'); // 'stack' | 'flags' | 'io' | 'memory'
  const [ioSubTab, setIoSubTab] = useState('robot'); // 'robot' | 'traffic' | 'calc' | 'mach'
  
  // ─── Stack Viewer State ───
  const [prevSP, setPrevSP] = useState(0xFFFF);
  const [prevBP, setPrevBP] = useState(0);
  const [changedStackAddresses, setChangedStackAddresses] = useState({});

  // ─── Flags Inspector State ───
  const [prevFlags, setPrevFlags] = useState({});
  const [changedFlags, setChangedFlags] = useState({});

  // ─── Robot Simulator State ───
  const [robotPos, setRobotPos] = useState({ x: 1, y: 1 });
  const [robotDir, setRobotDir] = useState('E'); // 'N' | 'E' | 'S' | 'W'
  const [laserIntensity, setLaserIntensity] = useState(0);
  const [portLogs, setPortLogs] = useState([]);
  const [sensorStatus, setSensorStatus] = useState(0); // 0 = clear, 1 = obstacle in front

  // ─── Traffic Light State ───
  const [nsLight, setNsLight] = useState(1); // 1 = Red, 2 = Yellow, 4 = Green
  const [ewLight, setEwLight] = useState(1); // 1 = Red, 2 = Yellow, 4 = Green

  // ─── Calculator State ───
  const [calcOpA, setCalcOpA] = useState('');
  const [calcOpB, setCalcOpB] = useState('');
  const [calcOp, setCalcOp] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // ─── Machine Controls State ───
  const [machPower, setMachPower] = useState(0);         // Port 20 (14h)
  const [machConveyorSpeed, setMachConveyorSpeed] = useState(0); // Port 21 (15h)
  const [machArmAngle, setMachArmAngle] = useState(90);   // Port 22 (16h)
  const [machClawState, setMachClawState] = useState(0); // Port 23 (17h) (0=Open, 1=Closed)

  // ─── Memory Inspector State ───
  const [memBaseAddr, setMemBaseAddr] = useState(0x0100);   // current page start
  const [memSearchInput, setMemSearchInput] = useState(''); // hex search query
  const [memSearchResult, setMemSearchResult] = useState(null); // found address or null
  const [memChangedBytes, setMemChangedBytes] = useState({}); // { addr: true }
  const [memEditCell, setMemEditCell] = useState(null);     // addr being edited
  const [memEditValue, setMemEditValue] = useState('');     // draft hex value
  const BYTES_PER_ROW = 8;   // 8 bytes per row so it fits narrow sidebars
  const MEM_PAGE_SIZE = 64;  // 8 rows × 8 bytes

  // Keep track of memory changes
  const prevMemoryRef = useRef([]);

  // Setup callbacks and listen to CPU changes
  useEffect(() => {
    if (!emulatorRef || !emulatorRef.current) return;
    
    // Register port listener on the emulator
    emulatorRef.current.onPortWrite = (port, val) => {
      const time = new Date().toLocaleTimeString();
      let logText = `OUT port 0x${port.toString(16).toUpperCase()}, val: 0x${val.toString(16).toUpperCase()} (${val})`;
      let logType = 'OUT';

      if (port === 9) {
        // Robot movement command
        if (val === 1) {
          moveForward();
        } else if (val === 2) {
          turnLeft();
        } else if (val === 3) {
          turnRight();
        } else if (val === 4) {
          resetRobot();
        }
        logText = `🤖 Robot Action: ${val === 1 ? 'Move Forward' : val === 2 ? 'Turn Left' : val === 3 ? 'Turn Right' : 'Reset'}`;
      } else if (port === 10) {
        setLaserIntensity(val & 0xFF);
        logText = `⚡ Laser intensity set to ${val & 0xFF}`;
      } else if (port === 12) {
        setNsLight(val & 7);
        logText = `🚦 Traffic N-S set to: ${val === 4 ? 'GREEN' : val === 2 ? 'YELLOW' : 'RED'}`;
        logType = 'INFO';
      } else if (port === 13) {
        setEwLight(val & 7);
        logText = `🚦 Traffic E-W set to: ${val === 4 ? 'GREEN' : val === 2 ? 'YELLOW' : 'RED'}`;
        logType = 'INFO';
      } else if (port === 18) {
        setCalcResult(val === 0xFF ? 'ERR' : val.toString());
        logText = `🧮 Calculator Result: ${val === 0xFF ? 'ERROR' : val}`;
        logType = 'SUCCESS';
      } else if (port === 20) {
        setMachPower(val & 1);
        logText = `⚙️ Machine Power: ${val === 1 ? 'POWER ON' : 'POWER OFF'}`;
        logType = 'INFO';
      } else if (port === 21) {
        setMachConveyorSpeed(Math.min(100, val));
        logText = `⚙️ Machine Conveyor Speed set to: ${Math.min(100, val)}%`;
        logType = 'INFO';
      } else if (port === 22) {
        setMachArmAngle(Math.min(180, val));
        logText = `⚙️ Machine Robotic Arm Angle set to: ${Math.min(180, val)}°`;
        logType = 'INFO';
      } else if (port === 23) {
        setMachClawState(val & 1);
        logText = `⚙️ Machine Claw Pincers: ${val === 1 ? 'CLAMPED' : 'RELEASED'}`;
        logType = 'INFO';
      }

      setPortLogs(prev => [
        { time, type: logType, port, val, text: logText },
        ...prev.slice(0, 49)
      ]);
    };

    // Inject sensor reading mechanism before instruction execute
    // Port 11 (0Bh): Collision sensor
    const updateSensorValue = () => {
      const nextPos = getNextPosition(robotPos, robotDir);
      const isWall = isObstacle(nextPos.x, nextPos.y);
      const sensorVal = isWall ? 1 : 0;
      setSensorStatus(sensorVal);
      if (emulatorRef.current) {
        emulatorRef.current.ports[11] = sensorVal;
      }
    };
    
    updateSensorValue();
  }, [robotPos, robotDir, emulatorRef]);

  // Handle register / memory updates to highlight changes
  useEffect(() => {
    if (!emulatorState) return;

    const curSP = emulatorState.registers.sp || 0xFFFF;
    const curBP = emulatorState.registers.bp || 0;
    
    if (curSP !== prevSP) {
      setPrevSP(curSP);
    }
    if (curBP !== prevBP) {
      setPrevBP(curBP);
    }

    const changedAddrs = {};
    if (prevMemoryRef.current && prevMemoryRef.current.length > 0) {
      const checkRangeStart = Math.max(0, curSP - 16);
      const checkRangeEnd = Math.min(65535, curSP + 32);
      for (let i = checkRangeStart; i <= checkRangeEnd; i++) {
        if (emulatorState.memory[i] !== prevMemoryRef.current[i]) {
          changedAddrs[i] = true;
        }
      }
    }
    
    if (Object.keys(changedAddrs).length > 0) {
      setChangedStackAddresses(prev => ({ ...prev, ...changedAddrs }));
      const timer = setTimeout(() => {
        setChangedStackAddresses(prev => {
          const next = { ...prev };
          Object.keys(changedAddrs).forEach(k => delete next[k]);
          return next;
        });
      }, 1500);
      return () => clearTimeout(timer);
    }

    prevMemoryRef.current = [...emulatorState.memory];
  }, [emulatorState, prevSP, prevBP]);

  // Trace flags changes
  useEffect(() => {
    if (!emulatorState) return;
    const currentFlags = emulatorState.flags || {};
    const newChanges = {};
    
    Object.keys(currentFlags).forEach(f => {
      if (prevFlags[f] !== undefined && prevFlags[f] !== currentFlags[f]) {
        newChanges[f] = true;
      }
    });

    if (Object.keys(newChanges).length > 0) {
      setChangedFlags(prev => ({ ...prev, ...newChanges }));
      const timer = setTimeout(() => {
        setChangedFlags(prev => {
          const next = { ...prev };
          Object.keys(newChanges).forEach(k => delete next[k]);
          return next;
        });
      }, 1500);
      setPrevFlags({ ...currentFlags });
      return () => clearTimeout(timer);
    }

    setPrevFlags({ ...currentFlags });
  }, [emulatorState.flags]);

  // ─── Robot Helper Functions ───
  const getNextPosition = (pos, dir) => {
    let { x, y } = pos;
    if (dir === 'N') y = Math.max(0, y - 1);
    else if (dir === 'S') y = Math.min(GRID_SIZE - 1, y + 1);
    else if (dir === 'E') x = Math.min(GRID_SIZE - 1, x + 1);
    else if (dir === 'W') x = Math.max(0, x - 1);
    return { x, y };
  };

  const isObstacle = (x, y) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;
    return INITIAL_OBSTACLES.some(obs => obs.x === x && obs.y === y);
  };

  const moveForward = () => {
    setRobotPos(prev => {
      const next = getNextPosition(prev, robotDir);
      if (isObstacle(next.x, next.y)) {
        const time = new Date().toLocaleTimeString();
        setPortLogs(l => [
          { time, type: 'ALERT', port: 11, val: 1, text: `⚠️ COLLISION DETECTED at [${next.x}, ${next.y}]` },
          ...l
        ]);
        return prev;
      }
      return next;
    });
  };

  const turnLeft = () => {
    const dirs = ['N', 'W', 'S', 'E'];
    setRobotDir(prev => {
      const idx = dirs.indexOf(prev);
      return dirs[(idx + 1) % 4];
    });
  };

  const turnRight = () => {
    const dirs = ['N', 'E', 'S', 'W'];
    setRobotDir(prev => {
      const idx = dirs.indexOf(prev);
      return dirs[(idx + 1) % 4];
    });
  };

  const resetRobot = () => {
    setRobotPos({ x: 1, y: 1 });
    setRobotDir('E');
    setLaserIntensity(0);
    setPortLogs(prev => [
      { time: new Date().toLocaleTimeString(), type: 'INFO', port: 0, val: 0, text: '🤖 Robot Simulator Position Reset' },
      ...prev
    ]);
  };

  // ─── Traffic Light helpers ───
  const handleWriteTrafficLight = (light, stateVal) => {
    if (!emulatorRef || !emulatorRef.current) return;
    const port = light === 'ns' ? 12 : 13;
    
    emulatorRef.current.ports[port] = stateVal;
    if (light === 'ns') {
      setNsLight(stateVal);
    } else {
      setEwLight(stateVal);
    }

    const time = new Date().toLocaleTimeString();
    const stateStr = stateVal === 4 ? 'GREEN' : stateVal === 2 ? 'YELLOW' : 'RED';
    setPortLogs(prev => [
      { time, type: 'MANUAL', port, val: stateVal, text: `🚦 Manual: Set ${light.toUpperCase()} traffic light to ${stateStr}` },
      ...prev
    ]);
  };

  // ─── Calculator helpers ───
  const updateCalculatorPorts = (opA, opB, op) => {
    if (!emulatorRef || !emulatorRef.current) return;
    const parsedA = parseInt(opA, 10) || 0;
    const parsedB = parseInt(opB, 10) || 0;
    let opCode = 0;
    if (op === '+') opCode = 1;
    else if (op === '-') opCode = 2;
    else if (op === '*') opCode = 3;
    else if (op === '/') opCode = 4;

    emulatorRef.current.ports[14] = parsedA;
    emulatorRef.current.ports[15] = parsedB;
    emulatorRef.current.ports[16] = opCode;
  };

  const handleCalculatorPress = (key) => {
    if (key >= '0' && key <= '9') {
      if (!calcOp) {
        setCalcOpA(prev => prev + key);
      } else {
        setCalcOpB(prev => prev + key);
      }
    } else if (['+', '-', '*', '/'].includes(key)) {
      if (calcOpA) {
        setCalcOp(key);
      }
    } else if (key === 'C') {
      setCalcOpA('');
      setCalcOpB('');
      setCalcOp('');
      setCalcResult('');
      updateCalculatorPorts('', '', '');
    } else if (key === '=') {
      handleCalculatorCompute();
    }
  };

  const handleCalculatorCompute = () => {
    if (!calcOpA || !calcOpB || !calcOp) return;
    
    updateCalculatorPorts(calcOpA, calcOpB, calcOp);

    const time = new Date().toLocaleTimeString();
    setPortLogs(prev => [
      { time, type: 'INFO', port: 16, val: 0, text: `🧮 Calculator: Starting calculation: ${calcOpA} ${calcOp} ${calcOpB}` },
      ...prev
    ]);

    if (emulatorRef && emulatorRef.current) {
      let steps = 0;
      let maxSteps = 2000;
      let halted = false;

      while (steps < maxSteps && emulatorRef.current.ports[16] !== 0 && !halted) {
        const stepRes = emulatorRef.current.step();
        if (stepRes.halted) {
          halted = true;
        }
        steps++;
      }

      const resVal = emulatorRef.current.ports[18] !== undefined ? emulatorRef.current.ports[18] : 0;
      setCalcResult(resVal === 0xFF ? 'ERR' : resVal.toString());

      setPortLogs(prev => [
        { time: new Date().toLocaleTimeString(), type: 'SUCCESS', port: 18, val: resVal, text: `🧮 Calculator: Computed in ${steps} steps. Result: ${resVal === 0xFF ? 'ERROR' : resVal}` },
        ...prev
      ]);

      if (onUpdateState) {
        onUpdateState({
          ...emulatorState,
          registers: { ...emulatorRef.current.registers },
          flags: { ...emulatorRef.current.flags },
          ip: emulatorRef.current.ip,
          memory: [...emulatorRef.current.memory],
          running: !halted,
        });
      }
    }
  };

  // ─── Machine Controls helpers ───
  const handleWriteMachineControl = (port, value) => {
    if (!emulatorRef || !emulatorRef.current) return;
    emulatorRef.current.ports[port] = value;
    
    if (port === 20) setMachPower(value);
    else if (port === 21) setMachConveyorSpeed(value);
    else if (port === 22) setMachArmAngle(value);
    else if (port === 23) setMachClawState(value);

    const time = new Date().toLocaleTimeString();
    setPortLogs(prev => [
      { time, type: 'MANUAL', port, val: value, text: `⚙️ Manual: Set Machine Port ${port} to ${value}` },
      ...prev
    ]);
  };

  // Generate Stack entries to display
  const renderStackItems = () => {
    const sp = emulatorState.registers.sp || 0xFFFF;
    const bp = emulatorState.registers.bp || 0;
    const ss = emulatorState.registers.ss || 0;
    const items = [];

    const alignedSP = sp & 0xFFFE;
    const startAddr = Math.max(0, alignedSP - 4);
    const endAddr = Math.min(0xFFFE, alignedSP + 14);

    for (let addr = endAddr; addr >= startAddr; addr -= 2) {
      const val = (emulatorState.memory[addr] | (emulatorState.memory[addr + 1] << 8)) & 0xFFFF;
      const isSP = addr === sp;
      const isBP = addr === bp;
      
      const isWordChanged = changedStackAddresses[addr] || changedStackAddresses[addr + 1];

      let pointerLabel = '';
      if (isSP && isBP) pointerLabel = 'SP, BP';
      else if (isSP) pointerLabel = 'SP';
      else if (isBP) pointerLabel = 'BP';

      items.push(
        <tr 
          key={addr} 
          className={`border-b border-white/5 font-mono text-[12px] transition-colors duration-300 ${
            isSP ? 'bg-primary/10 text-primary' : isBP ? 'bg-emerald-500/10 text-emerald-400' : 'text-text-secondary hover:bg-white/5'
          }`}
        >
          <td className="px-2.5 py-1.5 font-bold tracking-tight text-text-tertiary">
            {ss.toString(16).toUpperCase().padStart(4, '0')}:{addr.toString(16).toUpperCase().padStart(4, '0')}
          </td>
          <td className={`px-2.5 py-1.5 text-right font-medium transition-all ${
            isWordChanged ? 'text-amber-400 font-bold scale-102 filter drop-shadow-[0_0_6px_rgba(245,166,35,0.4)]' : 'text-text-primary'
          }`}>
            0x{val.toString(16).toUpperCase().padStart(4, '0')}
          </td>
          <td className="px-2.5 py-1.5 text-right text-text-tertiary">
            {val}
          </td>
          <td className="px-2.5 py-1.5 text-center font-bold">
            {pointerLabel ? (
              <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] uppercase ${
                isSP ? 'bg-primary/20 text-primary' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                ← {pointerLabel}
              </span>
            ) : null}
          </td>
        </tr>
      );
    }
    return items;
  };

  // Memory Inspector Page Calculation
  const memPage = () => {
    const start = memBaseAddr & 0xFFFF;
    const rows = [];
    for (let r = 0; r < MEM_PAGE_SIZE / BYTES_PER_ROW; r++) {
      const rowAddr = (start + r * BYTES_PER_ROW) & 0xFFFF;
      const bytes = [];
      for (let c = 0; c < BYTES_PER_ROW; c++) {
        const addr = (rowAddr + c) & 0xFFFF;
        bytes.push({ addr, val: emulatorState?.memory?.[addr] ?? 0 });
      }
      rows.push({ rowAddr, bytes });
    }
    return rows;
  };

  const handleMemSearch = () => {
    const query = parseInt(memSearchInput, 16);
    if (isNaN(query)) return;
    setMemBaseAddr(query & 0xFFF8); // align to row
    setMemSearchResult(query & 0xFFFF);
  };

  const handleMemEdit = (addr) => {
    if (!emulatorRef?.current) return;
    const parsed = parseInt(memEditValue, 16);
    if (!isNaN(parsed)) {
      emulatorRef.current.memory[addr] = parsed & 0xFF;
      if (onUpdateState) {
        const updatedMem = [...(emulatorState?.memory ?? [])];
        updatedMem[addr] = parsed & 0xFF;
        onUpdateState({ ...emulatorState, memory: updatedMem });
      }
      setMemChangedBytes(prev => ({ ...prev, [addr]: true }));
      setTimeout(() => setMemChangedBytes(prev => { const n = {...prev}; delete n[addr]; return n; }), 1500);
    }
    setMemEditCell(null);
    setMemEditValue('');
  };

  return (
    <div className="glass-debugger-widget backdrop-blur-md bg-slate-950/70 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full">
      <style>{`
        .debugger-premium-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .debugger-premium-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .debugger-premium-btn.active {
          background: linear-gradient(135deg, var(--primary) 0%, #3a8dff 100%);
          color: #fff;
          border-color: var(--primary);
          box-shadow: 0 4px 14px rgba(88, 166, 255, 0.4);
        }
        .debugger-summary-card {
          background: rgba(13, 17, 23, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .debugger-summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .debugger-summary-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-tertiary);
          font-weight: 700;
        }
        .debugger-summary-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .debugger-premium-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .debugger-premium-table th {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 12px 14px;
          background: rgba(10, 10, 15, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .debugger-premium-table td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .flag-premium-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .flag-premium-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .flag-premium-card.active {
          background: rgba(88, 166, 255, 0.04);
          border-color: rgba(88, 166, 255, 0.25);
        }
        .flag-premium-lcd {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 800;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.25s ease;
        }
        .flag-premium-lcd.set {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
        }
        .flag-premium-lcd.clear {
          background: rgba(0, 0, 0, 0.4);
          color: var(--text-tertiary);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .robot-premium-cell {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
        }
        .robot-premium-cell:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .robot-premium-barrier {
          background: linear-gradient(135deg, #1e293b 25%, #0f172a 25%, #0f172a 50%, #1e293b 50%, #1e293b 75%, #0f172a 75%, #0f172a 100%);
          background-size: 8px 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.6);
        }
        .robot-laser-pulsing {
          background: rgba(239, 68, 68, 0.25);
          box-shadow: inset 0 0 8px rgba(239, 68, 68, 0.5);
        }
        .log-premium-console {
          background: rgba(5, 10, 5, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        }
        .log-terminal-output {
          color: #10b981 !important;
          text-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
        }
        .mem-premium-cell {
          font-family: var(--font-mono);
          font-size: 11px;
          text-align: center;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
          user-select: none;
        }
        .io-selector-pill {
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .io-selector-pill:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
        }
        .io-selector-pill.active {
          color: #fff;
          background: var(--primary);
          border-color: var(--primary);
          box-shadow: 0 2px 8px rgba(88,166,255,0.3);
        }
        .traffic-intersection {
          position: relative;
          width: 100%;
          height: 190px;
          background: #080b10;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          overflow: hidden;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
        }
        .traffic-road-ns {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 46px;
          transform: translateX(-50%);
          background: #111827;
          border-left: 2px dashed rgba(255, 255, 255, 0.15);
          border-right: 2px dashed rgba(255, 255, 255, 0.15);
        }
        .traffic-road-ew {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 46px;
          transform: translateY(-50%);
          background: #111827;
          border-top: 2px dashed rgba(255, 255, 255, 0.15);
          border-bottom: 2px dashed rgba(255, 255, 255, 0.15);
        }
        .traffic-divider-ns {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 0px;
          border-left: 1px dashed #f59e0b;
        }
        .traffic-divider-ew {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 0px;
          border-top: 1px dashed #f59e0b;
        }
        .traffic-road-center {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 46px;
          height: 46px;
          transform: translate(-50%, -50%);
          background: #1f2937;
          z-index: 1;
        }
        .traffic-pole {
          position: absolute;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 4px;
          display: flex;
          gap: 3px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6);
          z-index: 5;
        }
        .traffic-pole-ns {
          top: 10px;
          left: calc(50% + 28px);
          flex-direction: column;
        }
        .traffic-pole-ew {
          bottom: 10px;
          left: calc(50% - 50px);
          flex-direction: row;
        }
        .traffic-bulb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.2s ease;
        }
        .traffic-bulb.red.active {
          background: #ef4444;
          box-shadow: 0 0 12px #ef4444, inset 0 0 4px #ef4444;
        }
        .traffic-bulb.yellow.active {
          background: #f59e0b;
          box-shadow: 0 0 12px #f59e0b, inset 0 0 4px #f59e0b;
        }
        .traffic-bulb.green.active {
          background: #10b981;
          box-shadow: 0 0 12px #10b981, inset 0 0 4px #10b981;
        }
        .calc-body {
          background: linear-gradient(145deg, #181d28 0%, #0c0f16 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .calc-lcd {
          background: #041006;
          border: 2px solid #0f3016;
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          font-family: var(--font-mono);
          color: #10b981;
          text-shadow: 0 0 4px rgba(16, 185, 129, 0.7);
          box-shadow: inset 0 4px 10px rgba(0,0,0,0.9);
          min-height: 52px;
          text-align: right;
        }
        .calc-btn {
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.03);
          background: rgba(255,255,255,0.03);
          color: var(--text-primary);
          font-weight: bold;
          font-size: 13px;
          font-family: var(--font-mono);
          padding: 10px 0;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .calc-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.1);
          transform: scale(1.03);
        }
        .calc-btn:active {
          transform: scale(0.97);
        }
        .calc-btn.operator {
          background: rgba(88, 166, 255, 0.1);
          border-color: rgba(88, 166, 255, 0.15);
          color: #58a6ff;
        }
        .calc-btn.operator:hover {
          background: rgba(88, 166, 255, 0.18);
          border-color: rgba(88, 166, 255, 0.3);
        }
        .calc-btn.action {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .calc-btn.action:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .calc-btn.compute {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-color: #10b981;
          color: #fff;
          box-shadow: 0 2px 8px rgba(16,185,129,0.3);
        }
        .calc-btn.compute:hover {
          box-shadow: 0 4px 12px rgba(16,185,129,0.5);
        }
        .calc-reg-monitor {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: space-between;
        }
        .calc-reg-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          display: flex;
          gap: 4px;
        }

        /* Machine simulation styles */
        .mach-container {
          background: linear-gradient(145deg, #131620 0%, #0a0b10 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .mach-display {
          position: relative;
          height: 140px;
          background: #07090e;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.05);
          overflow: hidden;
          box-shadow: inset 0 0 12px rgba(0,0,0,0.8);
        }
        .mach-belt {
          position: absolute;
          bottom: 25px;
          left: 10px;
          right: 10px;
          height: 14px;
          background: repeating-linear-gradient(90deg, #1f2937, #1f2937 10px, #111827 10px, #111827 20px);
          border: 2px solid #374151;
          border-radius: 7px;
          overflow: hidden;
        }
        .mach-belt.active {
          animation: mach-belt-roll var(--belt-duration, 2s) linear infinite;
        }
        @keyframes mach-belt-roll {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        .mach-box {
          position: absolute;
          bottom: 37px;
          width: 18px;
          height: 18px;
          background: #b45309;
          border: 1.5px solid #d97706;
          border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .mach-box.active {
          animation: mach-box-flow var(--belt-duration, 4s) linear infinite;
        }
        @keyframes mach-box-flow {
          0% { left: 0%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { left: 90%; opacity: 0; }
        }
        .mach-robot-arm-container {
          position: absolute;
          bottom: 35px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 10px;
          z-index: 10;
        }
        .mach-arm-base {
          position: absolute;
          bottom: 0;
          left: -8px;
          width: 26px;
          height: 12px;
          background: #4b5563;
          border: 2px solid #6b7280;
          border-radius: 6px 6px 0 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        .mach-arm-beam {
          position: absolute;
          bottom: 6px;
          left: 3px;
          width: 4px;
          height: 55px;
          background: #f59e0b;
          border: 1px solid #d97706;
          border-radius: 2px;
          transform-origin: bottom center;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mach-claw {
          position: absolute;
          top: -6px;
          left: -6px;
          width: 16px;
          height: 8px;
          background: #4b5563;
          border-radius: 3px;
        }
        .mach-pincer {
          position: absolute;
          top: 8px;
          width: 3px;
          height: 8px;
          background: #ef4444;
          transition: transform 0.2s ease;
        }
        .mach-pincer-left {
          left: 2px;
          transform: translateX(var(--pincer-left-offset, 0px));
        }
        .mach-pincer-right {
          right: 2px;
          transform: translateX(var(--pincer-right-offset, 0px));
        }
        .mach-led {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
          transition: all 0.2s;
        }
        .mach-led.on {
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
        }
      `}</style>

      {/* Widget Tabs */}
      <div className="flex border-b border-white/10 bg-black/40 p-1.5 gap-1.5 overflow-x-auto no-scrollbar items-center">
        {onClose && (
          <button
            onClick={onClose}
            className="debugger-premium-btn bg-red-500/10 border-red-500/20 text-red-300 mr-auto flex-shrink-0"
            style={{ padding: '6px 10px', fontSize: '10px' }}
          >
            ✕ Close Modal
          </button>
        )}
        <div className="flex gap-1.5">
          {[
            { id: 'stack', icon: '🥞', label: 'Stack' },
            { id: 'flags', icon: '🚩', label: 'Flags' },
            { id: 'io', icon: '🔌', label: 'I/O Devices' },
            { id: 'memory', icon: '🔬', label: 'Memory' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`debugger-premium-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 bg-black/10">
        
        {/* ─── STACK VIEWER ─── */}
        {activeSubTab === 'stack' && (
          <div className="flex flex-col h-full min-h-0">
            <div className="debugger-summary-card">
              <div className="debugger-summary-item">
                <span className="debugger-summary-label">Stack Segment (SS)</span>
                <span className="debugger-summary-value">0x{(emulatorState.registers.ss || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
              </div>
              <div className="debugger-summary-item">
                <span className="debugger-summary-label">Stack Pointer (SP)</span>
                <span className="debugger-summary-value" style={{ color: 'var(--primary)' }}>0x{(emulatorState.registers.sp || 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}</span>
              </div>
              <div className="debugger-summary-item">
                <span className="debugger-summary-label">Base Pointer (BP)</span>
                <span className="debugger-summary-value" style={{ color: '#10b981' }}>0x{(emulatorState.registers.bp || 0).toString(16).toUpperCase().padStart(4, '0')}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-slate-950/60 shadow-inner">
              <table className="debugger-premium-table">
                <thead>
                  <tr>
                    <th className="text-left">Address</th>
                    <th className="text-right">Value (Hex)</th>
                    <th className="text-right">Decimal</th>
                    <th className="text-center">Pointer</th>
                  </tr>
                </thead>
                <tbody>
                  {renderStackItems()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── FLAGS INSPECTOR ─── */}
        {activeSubTab === 'flags' && (
          <div className="flex flex-col gap-4">
            <div style={{
              background: 'rgba(58, 141, 255, 0.05)',
              borderLeft: '3px solid var(--primary)',
              padding: '10px 14px',
              borderRadius: '0 8px 8px 0',
              fontSize: '11px',
              lineHeight: 1.5,
              color: 'var(--text-secondary)'
            }}>
              Click flag cards to toggle bit states manually. Operations will automatically mutate carry, overflow, and zero flags.
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'CF', desc: 'Carry Flag (bit 0): Unsigned carry or borrow' },
                { name: 'PF', desc: 'Parity Flag (bit 2): Even number of 1s in low byte' },
                { name: 'AF', desc: 'Auxiliary Flag (bit 4): Carry/borrow from lower nibble' },
                { name: 'ZF', desc: 'Zero Flag (bit 6): Set if result is zero' },
                { name: 'SF', desc: 'Sign Flag (bit 7): Set if result is negative' },
                { name: 'OF', desc: 'Overflow Flag (bit 11): Signed overflow bounds' },
                { name: 'DF', desc: 'Direction Flag (bit 10): String index increment (0=up)' },
                { name: 'IF', desc: 'Interrupt Flag (bit 9): Listen to hardware interrupts' }
              ].map(f => {
                const val = emulatorState.flags[f.name.toLowerCase()] || 0;
                const isChanged = changedFlags[f.name.toLowerCase()];
                return (
                  <div
                    key={f.name}
                    title={f.desc}
                    onClick={() => handleToggleFlag(f.name)}
                    className={`flag-premium-card ${val ? 'active' : ''} ${isChanged ? 'ring-2 ring-amber-400/50 border-amber-400' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-bold text-[12px] tracking-wide text-text-primary">{f.name}</span>
                      <span className="text-[9px] text-text-tertiary truncate max-w-[120px]">{f.desc.split(':')[0]}</span>
                    </div>
                    <span className={`flag-premium-lcd ${val ? 'set' : 'clear'}`}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── HARDWARE I/O DEVICES ─── */}
        {activeSubTab === 'io' && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Sub-tab picker for I/O Devices */}
            <div className="flex gap-1.5 justify-center border-b border-white/5 pb-2.5 flex-wrap">
              <button onClick={() => setIoSubTab('robot')} className={`io-selector-pill ${ioSubTab === 'robot' ? 'active' : ''}`}>🤖 Robot Grid</button>
              <button onClick={() => setIoSubTab('traffic')} className={`io-selector-pill ${ioSubTab === 'traffic' ? 'active' : ''}`}>🚦 Traffic Light</button>
              <button onClick={() => setIoSubTab('calc')} className={`io-selector-pill ${ioSubTab === 'calc' ? 'active' : ''}`}>🧮 Calculator</button>
              <button onClick={() => setIoSubTab('mach')} className={`io-selector-pill ${ioSubTab === 'mach' ? 'active' : ''}`}>⚙️ Machine Controls</button>
            </div>

            {/* Sub-tab 1: ROBOT GRID */}
            {ioSubTab === 'robot' && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-slate-950/70 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col p-1.5">
                  <div className="grid grid-cols-10 grid-rows-10 gap-[2px] flex-1">
                    {Array.from({ length: 100 }).map((_, idx) => {
                      const x = idx % 10;
                      const y = Math.floor(idx / 10);
                      const isObst = isObstacle(x, y);
                      const isRobot = robotPos.x === x && robotPos.y === y;
                      
                      let isLaser = false;
                      if (laserIntensity > 0) {
                        if (robotDir === 'N' && x === robotPos.x && y < robotPos.y) {
                          const obstructed = INITIAL_OBSTACLES.some(o => o.x === x && o.y > y && o.y < robotPos.y);
                          isLaser = !obstructed;
                        } else if (robotDir === 'S' && x === robotPos.x && y > robotPos.y) {
                          const obstructed = INITIAL_OBSTACLES.some(o => o.x === x && o.y < y && o.y > robotPos.y);
                          isLaser = !obstructed;
                        } else if (robotDir === 'E' && y === robotPos.y && x > robotPos.x) {
                          const obstructed = INITIAL_OBSTACLES.some(o => o.y === y && o.x < x && o.x > robotPos.x);
                          isLaser = !obstructed;
                        } else if (robotDir === 'W' && y === robotPos.y && x < robotPos.x) {
                          const obstructed = INITIAL_OBSTACLES.some(o => o.y === y && o.x > x && o.x < robotPos.x);
                          isLaser = !obstructed;
                        }
                      }

                      return (
                        <div 
                          key={idx} 
                          className={`relative rounded transition-all duration-300 flex items-center justify-center ${
                            isObst 
                              ? 'robot-premium-barrier' 
                              : isLaser 
                                ? 'robot-laser-pulsing' 
                                : 'robot-premium-cell'
                          }`}
                        >
                          {isRobot && (
                            <div 
                              className="absolute inset-0.5 rounded bg-primary flex items-center justify-center shadow-lg shadow-primary/50 text-white z-10 font-bold transition-transform duration-300"
                              style={{
                                transform: `rotate(${
                                  robotDir === 'N' ? '0deg' :
                                  robotDir === 'E' ? '90deg' :
                                  robotDir === 'S' ? '180deg' : '270deg'
                                })`
                              }}
                            >
                              🛸
                            </div>
                          )}
                          
                          {isLaser && (
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/80 animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { label: 'Forward', action: moveForward, style: 'px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-text-primary rounded text-[10px] font-semibold' },
                      { label: '↺ Left', action: turnLeft, style: 'px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-text-primary rounded text-[10px] font-semibold' },
                      { label: '↺ Right', action: turnRight, style: 'px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-text-primary rounded text-[10px] font-semibold' },
                      { label: 'Reset', action: resetRobot, style: 'px-2.5 py-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-300 rounded text-[10px] font-semibold' },
                    ].map((btn, bidx) => (
                      <button key={bidx} onClick={btn.action} className={`${btn.style} transition-all cursor-pointer`}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="font-mono text-[9px] text-text-secondary flex-shrink-0">
                    Pos: <strong className="text-text-primary">({robotPos.x},{robotPos.y})</strong> | {robotDir}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: TRAFFIC LIGHT SIMULATOR */}
            {ioSubTab === 'traffic' && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <div className="traffic-intersection">
                  <div className="traffic-road-ns" />
                  <div className="traffic-road-ew" />
                  <div className="traffic-divider-ns" />
                  <div className="traffic-divider-ew" />
                  <div className="traffic-road-center" />

                  <div className="traffic-pole traffic-pole-ns">
                    <div className={`traffic-bulb red ${nsLight === 1 ? 'active' : ''}`} />
                    <div className={`traffic-bulb yellow ${nsLight === 2 ? 'active' : ''}`} />
                    <div className={`traffic-bulb green ${nsLight === 4 ? 'active' : ''}`} />
                  </div>

                  <div className="traffic-pole traffic-pole-ew">
                    <div className={`traffic-bulb red ${ewLight === 1 ? 'active' : ''}`} />
                    <div className={`traffic-bulb yellow ${ewLight === 2 ? 'active' : ''}`} />
                    <div className={`traffic-bulb green ${ewLight === 4 ? 'active' : ''}`} />
                  </div>

                  <div className="absolute top-2 left-3 font-mono text-[10px] text-text-secondary bg-black/60 px-2 py-0.5 rounded border border-white/5 z-10">
                    N-S State: <strong style={{ color: nsLight === 4 ? '#10b981' : nsLight === 2 ? '#f59e0b' : '#ef4444' }}>{nsLight === 4 ? 'GREEN' : nsLight === 2 ? 'YELLOW' : 'RED'}</strong>
                  </div>

                  <div className="absolute bottom-2 right-3 font-mono text-[10px] text-text-secondary bg-black/60 px-2 py-0.5 rounded border border-white/5 z-10">
                    E-W State: <strong style={{ color: ewLight === 4 ? '#10b981' : ewLight === 2 ? '#f59e0b' : '#ef4444' }}>{ewLight === 4 ? 'GREEN' : ewLight === 2 ? 'YELLOW' : 'RED'}</strong>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 bg-white/[0.02] border border-white/5 p-2 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider">Manual Override (Writes Port 12 & 13)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] text-text-secondary">North-South Control</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleWriteTrafficLight('ns', 1)} className="flex-1 py-1 text-[9px] font-bold rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20">RED</button>
                        <button onClick={() => handleWriteTrafficLight('ns', 2)} className="flex-1 py-1 text-[9px] font-bold rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20">YEL</button>
                        <button onClick={() => handleWriteTrafficLight('ns', 4)} className="flex-1 py-1 text-[9px] font-bold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">GRN</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] text-text-secondary">East-West Control</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleWriteTrafficLight('ew', 1)} className="flex-1 py-1 text-[9px] font-bold rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20">RED</button>
                        <button onClick={() => handleWriteTrafficLight('ew', 2)} className="flex-1 py-1 text-[9px] font-bold rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20">YEL</button>
                        <button onClick={() => handleWriteTrafficLight('ew', 4)} className="flex-1 py-1 text-[9px] font-bold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">GRN</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 3: HARDWARE CALCULATOR */}
            {ioSubTab === 'calc' && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <div className="calc-body">
                  <div className="calc-lcd">
                    <div className="text-[10px] opacity-40 font-mono tracking-wider">
                      {calcOpA} {calcOp} {calcOpB}
                    </div>
                    <div className="text-[18px] font-bold font-mono tracking-tight">
                      {calcResult || (calcOpB ? calcOpB : calcOpA ? calcOpA : '0')}
                    </div>
                  </div>

                  <div className="calc-reg-monitor">
                    <div className="calc-reg-pill">
                      <span className="opacity-45">AX:</span>
                      <strong className="text-sky-400">0x{(emulatorState?.registers?.ax || 0).toString(16).toUpperCase().padStart(4,'0')}</strong>
                    </div>
                    <div className="calc-reg-pill">
                      <span className="opacity-45">BX:</span>
                      <strong className="text-emerald-400">0x{(emulatorState?.registers?.bx || 0).toString(16).toUpperCase().padStart(4,'0')}</strong>
                    </div>
                    <div className="calc-reg-pill">
                      <span className="opacity-45">CX:</span>
                      <strong className="text-amber-400">0x{(emulatorState?.registers?.cx || 0).toString(16).toUpperCase().padStart(4,'0')}</strong>
                    </div>
                    <div className="calc-reg-pill">
                      <span className="opacity-45">DX:</span>
                      <strong className="text-purple-400">0x{(emulatorState?.registers?.dx || 0).toString(16).toUpperCase().padStart(4,'0')}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {['7', '8', '9', '/'].map(k => (
                      <button key={k} onClick={() => handleCalculatorPress(k)} className={`calc-btn ${['/'].includes(k) ? 'operator' : ''}`}>{k}</button>
                    ))}
                    {['4', '5', '6', '*'].map(k => (
                      <button key={k} onClick={() => handleCalculatorPress(k)} className={`calc-btn ${['*'].includes(k) ? 'operator' : ''}`}>{k}</button>
                    ))}
                    {['1', '2', '3', '-'].map(k => (
                      <button key={k} onClick={() => handleCalculatorPress(k)} className={`calc-btn ${['-'].includes(k) ? 'operator' : ''}`}>{k}</button>
                    ))}
                    {['0', 'C', '=', '+'].map(k => (
                      <button 
                        key={k} 
                        onClick={() => handleCalculatorPress(k)} 
                        className={`calc-btn ${k === 'C' ? 'action' : k === '=' ? 'compute' : k === '+' ? 'operator' : ''}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 4: MACHINE CONTROLS */}
            {ioSubTab === 'mach' && (
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                {/* Visual Machine Display */}
                <div className="mach-container">
                  <div className="mach-display">
                    {/* Power LED Indicator */}
                    <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
                      <div className={`mach-led ${machPower === 1 ? 'on' : ''}`} />
                      <span className="font-mono text-[9px] text-text-secondary">SYSTEM POWER: {machPower === 1 ? 'ON' : 'OFF'}</span>
                    </div>

                    {/* Speed/Angle Indicators */}
                    <div className="absolute top-2.5 right-3 font-mono text-[9px] text-text-tertiary flex flex-col items-end gap-0.5">
                      <span>BELT SPEED: <strong className="text-sky-400">{machConveyorSpeed}%</strong></span>
                      <span>ARM ANGLE: <strong className="text-amber-400">{machArmAngle}°</strong></span>
                    </div>

                    {/* Conveyor Belt */}
                    <div 
                      className={`mach-belt ${machPower === 1 && machConveyorSpeed > 0 ? 'active' : ''}`} 
                      style={{ '--belt-duration': `${10 - (machConveyorSpeed / 11)}s` }}
                    />

                    {/* Boxes sliding on Conveyor belt */}
                    {machPower === 1 && machConveyorSpeed > 0 && (
                      <>
                        <div className="mach-box active" style={{ '--belt-duration': `${12 - (machConveyorSpeed / 10)}s`, animationDelay: '0s' }} />
                        <div className="mach-box active" style={{ '--belt-duration': `${12 - (machConveyorSpeed / 10)}s`, animationDelay: '3s' }} />
                      </>
                    )}

                    {/* Static box if stopped */}
                    {!(machPower === 1 && machConveyorSpeed > 0) && (
                      <div className="mach-box" style={{ left: '45%' }} />
                    )}

                    {/* Robotic Arm Base & Pivots */}
                    <div className="mach-robot-arm-container">
                      <div className="mach-arm-base" />
                      <div 
                        className="mach-arm-beam" 
                        style={{ transform: `rotate(${-90 + machArmAngle}deg)` }}
                      >
                        {/* Claw Head */}
                        <div className="mach-claw">
                          <div 
                            className="mach-pincer mach-pincer-left" 
                            style={{ '--pincer-left-offset': machClawState === 1 ? '3px' : '0px' }} 
                          />
                          <div 
                            className="mach-pincer mach-pincer-right" 
                            style={{ '--pincer-right-offset': machClawState === 1 ? '-3px' : '0px' }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Overrides */}
                  <div className="flex flex-col gap-1.5 bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                    <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider">Manual Console overrides (Ports 20 - 23)</span>
                    
                    <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Sys Power (Port 20)</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleWriteMachineControl(20, 1)} className={`flex-1 py-0.8 text-[9px] rounded font-semibold ${machPower === 1 ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>POWER ON</button>
                          <button onClick={() => handleWriteMachineControl(20, 0)} className={`flex-1 py-0.8 text-[9px] rounded font-semibold ${machPower === 0 ? 'bg-red-500/25 border border-red-500/40 text-red-300' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>POWER OFF</button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Conveyor speed (Port 21)</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleWriteMachineControl(21, 0)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">STOP</button>
                          <button onClick={() => handleWriteMachineControl(21, 40)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">MED</button>
                          <button onClick={() => handleWriteMachineControl(21, 90)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">FAST</button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Robot Arm Angle (Port 22)</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleWriteMachineControl(22, 45)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">45° (L)</button>
                          <button onClick={() => handleWriteMachineControl(22, 90)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">90° (C)</button>
                          <button onClick={() => handleWriteMachineControl(22, 135)} className="flex-1 py-0.8 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded font-semibold">135° (R)</button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary">Claw Grip (Port 23)</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleWriteMachineControl(23, 0)} className={`flex-1 py-0.8 text-[9px] rounded font-semibold ${machClawState === 0 ? 'bg-sky-500/25 border border-sky-500/40 text-sky-300' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>RELEASE</button>
                          <button onClick={() => handleWriteMachineControl(23, 1)} className={`flex-1 py-0.8 text-[9px] rounded font-semibold ${machClawState === 1 ? 'bg-amber-500/25 border border-amber-500/40 text-amber-300' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>CLAMP</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explanations block */}
                <div className="font-mono text-[9px] text-text-tertiary bg-white/[0.01] border border-white/5 p-3 rounded-lg flex flex-col gap-1.5 leading-relaxed">
                  <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>🛠️ MACHINE ASSEMBLY MANUAL:</div>
                  <div>- <strong className="text-text-secondary">Port 20 (14h)</strong> controls the system power. Write <strong className="text-text-secondary">1</strong> to turn it ON, or <strong className="text-text-secondary">0</strong> to turn it OFF.</div>
                  <div>- <strong className="text-text-secondary">Port 21 (15h)</strong> controls the speed of the conveyor belt. Accepts values from <strong className="text-text-secondary">0 to 100</strong> (percent speed).</div>
                  <div>- <strong className="text-text-secondary">Port 22 (16h)</strong> controls the mechanical arm angle. Accepts positions from <strong className="text-text-secondary">0 to 180</strong> degrees.</div>
                  <div>- <strong className="text-text-secondary">Port 23 (17h)</strong> controls the end claw. Write <strong className="text-text-secondary">1</strong> to close pincer clamps, or <strong className="text-text-secondary">0</strong> to open them.</div>
                </div>
              </div>
            )}

            {/* Port I/O Terminal Log (Visible for all I/O devices) */}
            <div className="flex-1 min-h-[90px] max-h-[120px] log-premium-console">
              <div className="bg-black/75 border-b border-white/10 px-3 py-1.5 text-[10px] text-text-secondary uppercase flex justify-between font-mono">
                <span>Port Activity Log (Green Default)</span>
                {ioSubTab === 'robot' && (
                  <span style={{ color: sensorStatus ? '#ef4444' : '#10b981' }}>Sensor: {sensorStatus ? 'BLOCKED' : 'CLEAR'}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col-reverse gap-1 font-mono text-[11px] log-terminal-output custom-scrollbar">
                {portLogs.length === 0 ? (
                  <div className="text-text-tertiary text-center py-5 italic">No I/O activity detected yet. Run assembly OUT/IN operations.</div>
                ) : (
                  portLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`${
                        log.type === 'ALERT' ? 'text-red-400' : 
                        log.type === 'INFO' ? 'text-sky-400' : 
                        log.type === 'SUCCESS' ? 'text-emerald-400' : 'text-[#10b981]'
                      }`}
                    >
                      [{log.time}] {log.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── MEMORY INSPECTOR ─── */}
        {activeSubTab === 'memory' && (
          <div className="flex flex-col h-full gap-3 min-h-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                <span className="font-mono text-[10px] text-text-tertiary">0x</span>
                <input
                  type="text"
                  maxLength={4}
                  value={memSearchInput}
                  onChange={e => setMemSearchInput(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleMemSearch()}
                  placeholder="Jump to addr..."
                  className="flex-1 bg-slate-950/80 border border-white/8 rounded-lg px-2.5 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 w-0 transition-colors"
                />
                <button
                  onClick={handleMemSearch}
                  className="px-3 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/25 rounded-lg text-[10px] font-semibold text-primary transition-all cursor-pointer"
                >
                  Go
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setMemBaseAddr(a => Math.max(0, a - MEM_PAGE_SIZE))}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-text-secondary font-bold cursor-pointer"
                  title="Previous page"
                >‹ Prev</button>
                <button
                  onClick={() => setMemBaseAddr(a => Math.min(0xFFFF - MEM_PAGE_SIZE, a + MEM_PAGE_SIZE))}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-text-secondary font-bold cursor-pointer"
                  title="Next page"
                >Next ›</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-slate-950/60 min-h-0 shadow-inner">
              <table className="w-full border-collapse text-[11px] font-mono debugger-premium-table">
                <thead>
                  <tr className="bg-black/35 border-b border-white/10 text-[9px] text-text-tertiary uppercase">
                    <th className="px-3 py-1.5 text-left sticky left-0 bg-black">Addr</th>
                    {Array.from({ length: BYTES_PER_ROW }, (_, i) => (
                      <th key={i} className="px-1 py-1.5 text-center w-6 bg-black/30">+{i.toString(16).toUpperCase()}</th>
                    ))}
                    <th className="px-3 py-1.5 text-left text-text-tertiary bg-black/30">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {memPage().map(({ rowAddr, bytes }) => (
                    <tr
                      key={rowAddr}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-1 text-text-tertiary tracking-tight sticky left-0 bg-[#0f172a] font-bold">
                        {rowAddr.toString(16).toUpperCase().padStart(4, '0')}
                      </td>
                      {bytes.map(({ addr, val }) => {
                        const isSearchHit = memSearchResult === addr;
                        const isChanged   = memChangedBytes[addr];
                        const isEditing   = memEditCell === addr;
                        return (
                          <td
                            key={addr}
                            title={`Addr: 0x${addr.toString(16).toUpperCase()} = ${val}`}
                            onClick={() => { setMemEditCell(addr); setMemEditValue(val.toString(16).padStart(2,'0')); }}
                            className={`mem-premium-cell px-1 py-1 text-center ${
                              isEditing
                                ? 'bg-primary/20 ring-1 ring-primary'
                                : isSearchHit
                                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 font-bold glow-cyan'
                                  : isChanged
                                    ? 'text-amber-400 bg-amber-400/10 font-bold'
                                    : 'text-text-primary hover:bg-white/10'
                            }`}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                maxLength={2}
                                value={memEditValue}
                                onChange={e => setMemEditValue(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                                onBlur={() => handleMemEdit(addr)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleMemEdit(addr);
                                  if (e.key === 'Escape') { setMemEditCell(null); setMemEditValue(''); }
                                }}
                                className="w-5 bg-transparent border-none outline-none text-center font-mono text-[11px] text-primary p-0"
                              />
                            ) : (
                              val.toString(16).toUpperCase().padStart(2, '0')
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1 text-text-tertiary tracking-wider font-semibold opacity-75">
                        {bytes.map(({ val }) =>
                          val >= 0x20 && val < 0x7f ? String.fromCharCode(val) : '.'
                        ).join('')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between text-[10px] text-text-tertiary font-mono px-1">
              <span>Range: 0x{memBaseAddr.toString(16).toUpperCase().padStart(4,'0')} – 0x{Math.min(0xFFFF, memBaseAddr + MEM_PAGE_SIZE - 1).toString(16).toUpperCase().padStart(4,'0')}</span>
              {memSearchResult !== null && (
                <span className="text-cyan-400 font-semibold">Jumped: 0x{memSearchResult.toString(16).toUpperCase().padStart(4,'0')}</span>
              )}
              <span className="text-text-tertiary italic">Click cell to edit byte</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
