// src/components/SettingsModal.jsx
import React, { useState, useEffect, useRef } from 'react';

// ─── Theme Definitions ────────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    id: 'dark',
    label: 'Dark (Default)',
    icon: '🌑',
    preview: ['#010409', '#0d1117', '#161b22'],
    vars: {
      '--bg-darkest':     '#010409',
      '--bg-dark':        '#0d1117',
      '--bg-panel':       '#161b22',
      '--bg-hover':       '#1c2128',
      '--bg-active':      '#2d333b',
      '--border':         '#30363d',
      '--text-primary':   '#c9d1d9',
      '--text-secondary': '#8b949e',
      '--text-tertiary':  '#6e7681',
      '--primary':        '#58a6ff',
      '--success':        '#3fb950',
      '--danger':         '#f85149',
      '--warning':        '#d29922',
      '--info':           '#79c0ff',
      '--terminal-bg':    '#0d1117',
      '--terminal-text':  '#3fb950',
      '--terminal-prompt':'#58a6ff',
    },
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Blue',
    icon: '🌊',
    preview: ['#050d1a', '#0a1628', '#0f2040'],
    vars: {
      '--bg-darkest':     '#050d1a',
      '--bg-dark':        '#0a1628',
      '--bg-panel':       '#0f2040',
      '--bg-hover':       '#152a55',
      '--bg-active':      '#1e3a6e',
      '--border':         '#1e3a6e',
      '--text-primary':   '#cdd9ff',
      '--text-secondary': '#7a9fd4',
      '--text-tertiary':  '#4d6d9a',
      '--primary':        '#4fc3f7',
      '--success':        '#26c6da',
      '--danger':         '#ef5350',
      '--warning':        '#ffb74d',
      '--info':           '#81d4fa',
      '--terminal-bg':    '#050d1a',
      '--terminal-text':  '#26c6da',
      '--terminal-prompt':'#4fc3f7',
    },
  },
  dracula: {
    id: 'dracula',
    label: 'Dracula Purple',
    icon: '🧛',
    preview: ['#1a0533', '#282a36', '#383a59'],
    vars: {
      '--bg-darkest':     '#1a0533',
      '--bg-dark':        '#282a36',
      '--bg-panel':       '#383a59',
      '--bg-hover':       '#44475a',
      '--bg-active':      '#6272a4',
      '--border':         '#6272a4',
      '--text-primary':   '#f8f8f2',
      '--text-secondary': '#bd93f9',
      '--text-tertiary':  '#6272a4',
      '--primary':        '#bd93f9',
      '--success':        '#50fa7b',
      '--danger':         '#ff5555',
      '--warning':        '#ffb86c',
      '--info':           '#8be9fd',
      '--terminal-bg':    '#1a0533',
      '--terminal-text':  '#50fa7b',
      '--terminal-prompt':'#bd93f9',
    },
  },
  glass: {
    id: 'glass',
    label: 'Glassmorphic',
    icon: '🪟',
    preview: ['#0a0a1a', '#12121f', 'rgba(255,255,255,0.05)'],
    vars: {
      '--bg-darkest':     '#0a0a1a',
      '--bg-dark':        '#12121f',
      '--bg-panel':       'rgba(255,255,255,0.05)',
      '--bg-hover':       'rgba(255,255,255,0.08)',
      '--bg-active':      'rgba(255,255,255,0.12)',
      '--border':         'rgba(255,255,255,0.12)',
      '--text-primary':   '#ffffff',
      '--text-secondary': 'rgba(255,255,255,0.65)',
      '--text-tertiary':  'rgba(255,255,255,0.4)',
      '--primary':        '#a78bfa',
      '--success':        '#34d399',
      '--danger':         '#f87171',
      '--warning':        '#fbbf24',
      '--info':           '#60a5fa',
      '--terminal-bg':    'rgba(10,10,26,0.85)',
      '--terminal-text':  '#34d399',
      '--terminal-prompt':'#a78bfa',
    },
  },
  light: {
    id: 'light',
    label: 'Light Mode',
    icon: '☀️',
    preview: ['#f0f0f5', '#ffffff', '#e8eaf0'],
    vars: {
      '--bg-darkest':     '#f0f0f5',
      '--bg-dark':        '#ffffff',
      '--bg-panel':       '#f8f8fc',
      '--bg-hover':       '#eeeef5',
      '--bg-active':      '#e0e0ed',
      '--border':         '#d0d0dd',
      '--text-primary':   '#1a1a2e',
      '--text-secondary': '#4a4a6a',
      '--text-tertiary':  '#7a7a9a',
      '--primary':        '#4361ee',
      '--success':        '#2d6a4f',
      '--danger':         '#d62839',
      '--warning':        '#e07a0f',
      '--info':           '#3a86ff',
      '--terminal-bg':    '#1a1a2e',
      '--terminal-text':  '#2d6a4f',
      '--terminal-prompt':'#4361ee',
    },
  },
};

// ─── Font options ────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { id: 'fira', label: 'Fira Code',     value: "'Fira Code', 'Courier New', monospace" },
  { id: 'jb',   label: 'JetBrains Mono',value: "'JetBrains Mono', 'Courier New', monospace" },
  { id: 'mono', label: 'Source Code Pro',value: "'Source Code Pro', monospace" },
  { id: 'consolas', label: 'Consolas',  value: "Consolas, 'Courier New', monospace" },
  { id: 'hack', label: 'Hack',          value: "Hack, 'Courier New', monospace" },
];

const TERMINAL_TEXT_COLORS = [
  { id: 'green',  label: 'Terminal Green', value: '#3fb950' },
  { id: 'cyan',   label: 'Cyan',           value: '#26c6da' },
  { id: 'amber',  label: 'Amber',          value: '#f5a623' },
  { id: 'white',  label: 'White',          value: '#e8e8e8' },
  { id: 'purple', label: 'Purple',         value: '#bd93f9' },
  { id: 'blue',   label: 'Blue',           value: '#58a6ff' },
];

const TERMINAL_BG_COLORS = [
  { id: 'pitch',    label: 'Pitch Black',  value: '#000000' },
  { id: 'dark',     label: 'Dark Gray',    value: '#0d1117' },
  { id: 'midnight', label: 'Midnight',     value: '#050d1a' },
  { id: 'dracula',  label: 'Dracula',      value: '#1a0533' },
  { id: 'light',    label: 'Light',        value: '#1a1a2e' },
];

const ACCENT_COLORS = [
  { id: 'blue',   label: 'Blue',   value: '#58a6ff', success: '#3fb950' },
  { id: 'purple', label: 'Purple', value: '#bd93f9', success: '#50fa7b' },
  { id: 'teal',   label: 'Teal',   value: '#26c6da', success: '#26c6da' },
  { id: 'orange', label: 'Orange', value: '#ff9f43', success: '#3fb950' },
  { id: 'pink',   label: 'Pink',   value: '#ff6b9d', success: '#34d399' },
];

// ─── Default settings ────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: "'Fira Code', 'Courier New', monospace",
  terminalTextColor: '#3fb950',
  terminalBgColor: '#0d1117',
  terminalPromptColor: '#58a6ff',
  accentColor: '#58a6ff',
  successColor: '#3fb950',
  lineNumbers: true,
  minimap: false,
  wordWrap: false,
  tabSize: 4,
  autoSave: true,
  highlightCurrentLine: true,
  cursorStyle: 'block',
};

// ─── Apply theme to DOM ────────────────────────────────────────────────────────
export function applyTheme(themeId, overrides = {}) {
  const theme = THEMES[themeId] || THEMES.dark;
  const merged = { ...theme.vars, ...overrides };
  const root = document.documentElement;
  Object.entries(merged).forEach(([k, v]) => root.style.setProperty(k, v));
  // Mark theme on body for glass blur effects
  document.body.setAttribute('data-theme', themeId);
}

export function applySettings(settings) {
  const root = document.documentElement;
  applyTheme(settings.theme, {
    '--terminal-text':   settings.terminalTextColor,
    '--terminal-bg':     settings.terminalBgColor,
    '--terminal-prompt': settings.terminalPromptColor,
    '--primary':         settings.accentColor,
    '--success':         settings.successColor,
    '--font-mono':       settings.fontFamily,
  });
  root.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
}

// ─── SettingsModal Component ───────────────────────────────────────────────────
export default function SettingsModal({ isOpen, onClose, settings, onSave, isFirstVisit = false }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeSection, setActiveSection] = useState('appearance');
  const modalRef = useRef(null);

  // Sync when settings prop changes
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Live preview
  useEffect(() => {
    if (isOpen) {
      applySettings(localSettings);
    }
  }, [localSettings, isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !isFirstVisit) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFirstVisit, onClose]);

  // Click outside to close (not on first visit)
  useEffect(() => {
    if (!isOpen || isFirstVisit) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [isOpen, isFirstVisit, onClose]);

  const update = (key, value) => setLocalSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    applySettings(localSettings);
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
  };

  if (!isOpen) return null;

  const SECTIONS = [
    { id: 'appearance',  icon: '🎨', label: 'Appearance' },
    { id: 'editor',      icon: '✏️', label: 'Editor' },
    { id: 'terminal',    icon: '⬛', label: 'Terminal' },
    { id: 'keybindings', icon: '⌨️', label: 'Keybindings' },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      padding: '16px',
      animation: 'settingsFadeIn 0.25s ease-out',
    }}>
      <style>{`
        @keyframes settingsFadeIn {
          from { opacity:0; transform: scale(0.96) translateY(10px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
        .settings-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; border-radius: 7px; cursor: pointer;
          font-size: 13px; font-weight: 500;
          border: none; background: transparent; width: 100%;
          text-align: left; color: var(--text-secondary);
          transition: all 0.15s ease; white-space: nowrap;
        }
        .settings-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .settings-nav-item.active { background: var(--bg-active); color: var(--text-primary); }
        .settings-theme-card {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 12px 10px; border-radius: 10px;
          border: 2px solid transparent; cursor: pointer;
          background: var(--bg-hover); transition: all 0.2s ease;
          min-width: 0; flex: 1;
        }
        .settings-theme-card:hover { border-color: var(--primary); transform: translateY(-2px); }
        .settings-theme-card.selected { border-color: var(--primary); background: var(--bg-active); }
        .settings-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; margin-bottom: 6px; }
        .settings-slider { width:100%; accent-color: var(--primary); height: 4px; cursor: pointer; }
        .settings-color-dot {
          width: 24px; height: 24px; border-radius: 50%;
          border: 2px solid transparent; cursor: pointer;
          transition: all 0.15s; flex-shrink: 0;
        }
        .settings-color-dot:hover { transform: scale(1.2); border-color: white; }
        .settings-color-dot.selected { transform: scale(1.2); border-color: white; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
        .settings-toggle {
          width: 40px; height: 22px; border-radius: 11px;
          border: none; cursor: pointer; position: relative;
          transition: background 0.2s; flex-shrink: 0;
        }
        .settings-toggle::after {
          content: ''; position: absolute; top: 3px; left: 3px;
          width: 16px; height: 16px; border-radius: 50%; background: white;
          transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .settings-toggle.on { background: var(--primary); }
        .settings-toggle.on::after { transform: translateX(18px); }
        .settings-toggle.off { background: var(--bg-active); }
        .settings-select {
          background: var(--bg-hover); border: 1px solid var(--border);
          color: var(--text-primary); padding: 7px 10px;
          border-radius: 6px; font-size: 12px; font-family: var(--font-mono);
          width: 100%; cursor: pointer;
        }
        .settings-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0; border-bottom: 1px solid var(--border); gap: 12px;
        }
        .settings-row:last-child { border-bottom: none; }
        .kbd {
          display: inline-flex; align-items: center; gap: 4px;
          background: var(--bg-hover); border: 1px solid var(--border);
          border-radius: 4px; padding: 3px 8px; font-size: 11px;
          font-family: var(--font-mono); color: var(--text-secondary);
        }
      `}</style>

      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '780px',
          height: 'min(88vh, 580px)',
          background: 'var(--bg-dark)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Settings
              </div>
              {isFirstVisit && (
                <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '2px' }}>
                  Welcome! Customize your workspace before getting started.
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', padding: '6px 12px',
                borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--primary)', border: 'none',
                color: '#fff', padding: '6px 16px',
                borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {isFirstVisit ? '🚀 Get Started' : 'Save & Close'}
            </button>
            {!isFirstVisit && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-tertiary)', fontSize: '18px',
                  cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Navigation Sidebar */}
          <div style={{
            width: '160px', flexShrink: 0, borderRight: '1px solid var(--border)',
            background: 'var(--bg-panel)', padding: '12px 8px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            overflowY: 'auto',
          }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* ── APPEARANCE ── */}
            {activeSection === 'appearance' && (
              <div>
                <p className="settings-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '14px' }}>
                  Theme
                </p>

                {/* Theme cards */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {Object.values(THEMES).map(t => (
                    <div
                      key={t.id}
                      className={`settings-theme-card ${localSettings.theme === t.id ? 'selected' : ''}`}
                      onClick={() => update('theme', t.id)}
                      style={{ minWidth: '80px', maxWidth: '120px' }}
                    >
                      {/* Color preview swatches */}
                      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', width: '100%', height: '28px' }}>
                        {t.preview.map((c, i) => (
                          <div key={i} style={{ flex: 1, background: c }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '16px' }}>{t.icon}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3 }}>
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Accent color */}
                <p className="settings-label">Accent Color</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {ACCENT_COLORS.map(c => (
                    <div
                      key={c.id}
                      className={`settings-color-dot ${localSettings.accentColor === c.value ? 'selected' : ''}`}
                      style={{ background: c.value }}
                      onClick={() => { update('accentColor', c.value); update('successColor', c.success); }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={localSettings.accentColor}
                    onChange={e => update('accentColor', e.target.value)}
                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}
                    title="Custom color"
                  />
                </div>

                {/* Font size */}
                <p className="settings-label">Editor Font Size: <strong style={{ color: 'var(--primary)' }}>{localSettings.fontSize}px</strong></p>
                <input
                  type="range" min="11" max="22" step="1"
                  value={localSettings.fontSize}
                  onChange={e => update('fontSize', Number(e.target.value))}
                  className="settings-slider"
                  style={{ marginBottom: '20px' }}
                />

                {/* Font family */}
                <p className="settings-label">Font Family</p>
                <select
                  className="settings-select"
                  value={localSettings.fontFamily}
                  onChange={e => update('fontFamily', e.target.value)}
                  style={{ marginBottom: '0' }}
                >
                  {FONT_OPTIONS.map(f => (
                    <option key={f.id} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── EDITOR ── */}
            {activeSection === 'editor' && (
              <div>
                <p className="settings-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '14px' }}>
                  Editor Preferences
                </p>
                {[
                  { key: 'lineNumbers',        label: 'Line Numbers',           desc: 'Show line numbers in the gutter' },
                  { key: 'highlightCurrentLine',label: 'Highlight Current Line', desc: 'Highlight the active editing line' },
                  { key: 'wordWrap',            label: 'Word Wrap',              desc: 'Wrap long lines to fit the viewport' },
                  { key: 'autoSave',            label: 'Auto Save',              desc: 'Automatically save to IndexedDB' },
                ].map(opt => (
                  <div key={opt.key} className="settings-row">
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                    <button
                      className={`settings-toggle ${localSettings[opt.key] ? 'on' : 'off'}`}
                      onClick={() => update(opt.key, !localSettings[opt.key])}
                    />
                  </div>
                ))}

                <div className="settings-row">
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>Tab Size</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Number of spaces per tab</div>
                  </div>
                  <select
                    className="settings-select"
                    value={localSettings.tabSize}
                    onChange={e => update('tabSize', Number(e.target.value))}
                    style={{ width: 'auto', minWidth: '80px' }}
                  >
                    {[2, 4, 8].map(n => <option key={n} value={n}>{n} spaces</option>)}
                  </select>
                </div>

                <div className="settings-row">
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>Cursor Style</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Shape of the text cursor</div>
                  </div>
                  <select
                    className="settings-select"
                    value={localSettings.cursorStyle}
                    onChange={e => update('cursorStyle', e.target.value)}
                    style={{ width: 'auto', minWidth: '100px' }}
                  >
                    <option value="block">Block</option>
                    <option value="line">Line</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── TERMINAL ── */}
            {activeSection === 'terminal' && (
              <div>
                <p className="settings-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '14px' }}>
                  Terminal Colors
                </p>

                {/* Preview */}
                <div style={{
                  background: localSettings.terminalBgColor,
                  borderRadius: '8px', padding: '12px 16px',
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  marginBottom: '20px', border: '1px solid var(--border)',
                  lineHeight: '1.8',
                }}>
                  <span style={{ color: localSettings.terminalPromptColor }}>
                    user@renance MINGW64 ~/asm
                  </span>
                  <span style={{ color: localSettings.terminalTextColor }}> $ tasm main.asm</span>
                  <br />
                  <span style={{ color: localSettings.terminalTextColor }}>Assembling...  Done ✓</span>
                </div>

                <p className="settings-label">Text Color</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                  {TERMINAL_TEXT_COLORS.map(c => (
                    <div
                      key={c.id}
                      className={`settings-color-dot ${localSettings.terminalTextColor === c.value ? 'selected' : ''}`}
                      style={{ background: c.value }}
                      onClick={() => update('terminalTextColor', c.value)}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={localSettings.terminalTextColor}
                    onChange={e => update('terminalTextColor', e.target.value)}
                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}
                  />
                </div>

                <p className="settings-label">Prompt Color</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                  {ACCENT_COLORS.map(c => (
                    <div
                      key={c.id}
                      className={`settings-color-dot ${localSettings.terminalPromptColor === c.value ? 'selected' : ''}`}
                      style={{ background: c.value }}
                      onClick={() => update('terminalPromptColor', c.value)}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={localSettings.terminalPromptColor}
                    onChange={e => update('terminalPromptColor', e.target.value)}
                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}
                  />
                </div>

                <p className="settings-label">Background Color</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {TERMINAL_BG_COLORS.map(c => (
                    <div
                      key={c.id}
                      className={`settings-color-dot ${localSettings.terminalBgColor === c.value ? 'selected' : ''}`}
                      style={{ background: c.value, border: '2px solid var(--border)' }}
                      onClick={() => update('terminalBgColor', c.value)}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={localSettings.terminalBgColor}
                    onChange={e => update('terminalBgColor', e.target.value)}
                    style={{ width: '24px', height: '24px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}
                  />
                </div>
              </div>
            )}

            {/* ── KEYBINDINGS ── */}
            {activeSection === 'keybindings' && (
              <div>
                <p className="settings-label" style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '14px' }}>
                  Keyboard Shortcuts
                </p>
                {[
                  { action: 'Run Program',        keys: ['F5'] },
                  { action: 'Step Through',        keys: ['F10'] },
                  { action: 'Save File',           keys: ['Ctrl', 'S'] },
                  { action: 'Reset Emulator',      keys: ['Ctrl', 'Alt', 'R'] },
                  { action: 'Toggle Terminal',     keys: ['Ctrl', '`'] },
                  { action: 'Command Palette',     keys: ['Ctrl', 'Shift', 'P'] },
                  { action: 'Find in File',        keys: ['Ctrl', 'F'] },
                  { action: 'Toggle Comment',      keys: ['Ctrl', '/'] },
                ].map(({ action, keys }) => (
                  <div key={action} className="settings-row">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{action}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {keys.map((k, i) => (
                        <span key={i} className="kbd">{k}</span>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{
                  marginTop: '16px', padding: '12px', borderRadius: '8px',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    💡 Custom keybinding remapping coming in a future release. These are the current default shortcuts.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
