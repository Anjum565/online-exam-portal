import React, { useState, useRef, useEffect } from 'react';
import {
  Code, Terminal, Copy, Check, RotateCcw,
  Maximize2, Minimize2, Sparkles, ChevronDown
} from 'lucide-react';

const BOILERPLATES = {
  c: `// C Language Program\n#include <stdio.h>\n\nint main() {\n    // Type your program code here\n    printf("Hello, World!\\n");\n    return 0;\n}`,
  cpp: `// C++ Language Program\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Type your program code here\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  java: `// Java Program\npublic class Solution {\n    public static void main(String[] args) {\n        // Type your program code here\n        System.out.println("Hello, World!");\n    }\n}`,
  python: `# Python Program\ndef solution():\n    # Type your program code here\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    solution()`,
  javascript: `// JavaScript Program\nfunction solution() {\n    // Type your program code here\n    console.log("Hello, World!");\n}\n\nsolution();`,
  sql: `-- SQL Query Script\nSELECT * \nFROM students \nWHERE semester = 'Semester 4';`
};

export default function CodeEditor({
  value = '',
  onChange,
  language = 'python',
  onLanguageChange,
  placeholder = '// Type or paste your program code here...\n// Tab key is enabled for indentation',
  minHeight = '280px',
  readOnly = false,
  title = 'Program Code Editor'
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fontSize, setFontSize] = useState(14); // in px
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Synchronize line numbers vertical scrolling with textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lines = (value || '').replace(/\r\n/g, '\n').split('\n');
  const lineCount = Math.max(lines.length, 1);

  // Tab key & Smart Enter indentation handler
  const handleKeyDown = (e) => {
    if (readOnly) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value: text } = textarea;

    // 1. Handle TAB Key (Indentation)
    if (e.key === 'Tab') {
      e.preventDefault();
      const indent = '    '; // 4 spaces

      if (e.shiftKey) {
        // Shift + Tab: Dedent current line
        const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLine = text.substring(lineStart, selectionStart);
        if (currentLine.startsWith('    ')) {
          const newText = text.substring(0, lineStart) + text.substring(lineStart + 4);
          onChange(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, selectionStart - 4);
          }, 0);
        } else if (currentLine.startsWith('  ')) {
          const newText = text.substring(0, lineStart) + text.substring(lineStart + 2);
          onChange(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, selectionStart - 2);
          }, 0);
        }
      } else {
        // Normal Tab: Insert 4 spaces at cursor
        const newText = text.substring(0, selectionStart) + indent + text.substring(selectionEnd);
        onChange(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + indent.length;
        }, 0);
      }
      return;
    }

    // 2. Handle ENTER Key (Auto-indent preservation)
    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = text.substring(lineStart, selectionStart);

      // Extract existing indentation
      const matchIndent = currentLine.match(/^(\s*)/);
      let indent = matchIndent ? matchIndent[1] : '';

      // If line ends with '{' or ':' or '(', add extra 4 spaces
      const trimmedLine = currentLine.trim();
      if (trimmedLine.endsWith('{') || trimmedLine.endsWith(':') || trimmedLine.endsWith('(')) {
        indent += '    ';
      }

      const insertion = '\n' + indent;
      const newText = text.substring(0, selectionStart) + insertion + text.substring(selectionEnd);
      onChange(newText);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
      }, 0);
      return;
    }

    // 3. Auto-close brackets / quotes
    const pairs = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'"
    };

    if (pairs[e.key] && selectionStart === selectionEnd) {
      // If user typed an opening bracket, insert closing pair
      const closing = pairs[e.key];
      // Only auto-close if not immediately before an alphanumeric char
      const nextChar = text.charAt(selectionStart);
      if (!nextChar || /\s/.test(nextChar) || nextChar === ')' || nextChar === ']' || nextChar === '}') {
        e.preventDefault();
        const newText = text.substring(0, selectionStart) + e.key + closing + text.substring(selectionEnd);
        onChange(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
        }, 0);
      }
    }
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadBoilerplate = (langKey) => {
    const template = BOILERPLATES[langKey];
    if (template) {
      if (value && value.trim().length > 10) {
        if (!window.confirm('Replace current editor code with starter template?')) return;
      }
      onChange(template);
    }
  };

  const handleClear = () => {
    if (value && window.confirm('Clear all code in editor?')) {
      onChange('');
    }
  };

  return (
    <div style={{
      background: '#0a0e17',
      border: '1.5px solid rgba(56, 189, 248, 0.35)',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      position: isExpanded ? 'fixed' : 'relative',
      top: isExpanded ? '2%' : 'auto',
      left: isExpanded ? '2%' : 'auto',
      right: isExpanded ? '2%' : 'auto',
      bottom: isExpanded ? '2%' : 'auto',
      width: isExpanded ? '96vw' : '100%',
      height: isExpanded ? '96vh' : 'auto',
      zIndex: isExpanded ? 99999 : 'auto',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    }}>
      {/* Top IDE Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        padding: '0.45rem 0.85rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#e2e8f0', fontWeight: '700', fontSize: '0.82rem' }}>
            <Terminal size={14} color="#38bdf8" />
            <span>{title}</span>
          </div>

          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value;
              if (onLanguageChange) onLanguageChange(newLang);
            }}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '0.15rem 0.45rem',
              borderRadius: '5px',
              fontSize: '0.72rem',
              fontWeight: '700',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="python" style={{ background: '#0f172a', color: '#e2e8f0' }}>Python</option>
            <option value="c" style={{ background: '#0f172a', color: '#e2e8f0' }}>C</option>
            <option value="cpp" style={{ background: '#0f172a', color: '#e2e8f0' }}>C++</option>
            <option value="java" style={{ background: '#0f172a', color: '#e2e8f0' }}>Java</option>
            <option value="javascript" style={{ background: '#0f172a', color: '#e2e8f0' }}>JavaScript</option>
            <option value="sql" style={{ background: '#0f172a', color: '#e2e8f0' }}>SQL</option>
            <option value="text" style={{ background: '#0f172a', color: '#e2e8f0' }}>Plain Text</option>
          </select>

          {/* Starter Template Button */}
          {!readOnly && BOILERPLATES[language] && (
            <button
              type="button"
              onClick={() => handleLoadBoilerplate(language)}
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#a5b4fc',
                padding: '0.18rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              title="Insert starter code template"
            >
              <Sparkles size={11} /> Starter Code
            </button>
          )}
        </div>

        {/* Right Controls: Font size, Copy, Clear, Expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginRight: '0.2rem' }}>
            {lineCount} lines &bull; {value.length} chars
          </span>

          {/* Font size buttons */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setFontSize(prev => Math.max(11, prev - 1))}
              style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: 'none', padding: '0.15rem 0.35rem', fontSize: '0.65rem', cursor: 'pointer' }}
              title="Decrease font size">
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize(prev => Math.min(20, prev + 1))}
              style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: '0.15rem 0.35rem', fontSize: '0.65rem', cursor: 'pointer' }}
              title="Increase font size">
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            style={{
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${copied ? 'var(--emerald)' : 'rgba(255,255,255,0.12)'}`,
              color: copied ? 'var(--emerald)' : '#94a3b8',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: value ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {!readOnly && (
            <button
              type="button"
              onClick={handleClear}
              disabled={!value}
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: '#f87171',
                padding: '0.2rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                cursor: value ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Clear editor">
              <RotateCcw size={11} /> Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: isExpanded ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: isExpanded ? '#ffffff' : '#94a3b8',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem'
            }}
            title={isExpanded ? 'Collapse editor' : 'Full screen editor'}>
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Code Editor Body: Line Numbers + Textarea */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: isExpanded ? 'calc(96vh - 85px)' : minHeight,
        background: '#070a12',
        position: 'relative'
      }}>
        {/* Synchronized Line Numbers */}
        <div
          ref={lineNumbersRef}
          style={{
            width: '42px',
            padding: '0.75rem 0.4rem 0.75rem 0.2rem',
            textAlign: 'right',
            color: 'rgba(148, 163, 184, 0.35)',
            userSelect: 'none',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.35)',
            fontSize: `${fontSize}px`,
            lineHeight: '1.6',
            overflowY: 'hidden',
            flexShrink: 0
          }}
        >
          {Array.from({ length: lineCount }).map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Textarea Code Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={placeholder}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            minHeight: isExpanded ? 'calc(96vh - 85px)' : minHeight,
            padding: '0.75rem 0.9rem',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#38bdf8',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: `${fontSize}px`,
            lineHeight: '1.6',
            tabSize: 4,
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
            overflowY: 'auto',
            resize: isExpanded ? 'none' : 'vertical'
          }}
        />
      </div>

      {/* Editor Footer Help Bar */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '0.3rem 0.85rem',
        fontSize: '0.68rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>⌨️ <strong style={{ color: '#94a3b8' }}>Tab</strong> indents 4 spaces &bull; <strong style={{ color: '#94a3b8' }}>Shift+Tab</strong> dedents &bull; <strong style={{ color: '#94a3b8' }}>Enter</strong> auto-indents</span>
        <span style={{ color: '#38bdf8' }}>● Syntax & Indentation Engine Ready</span>
      </div>
    </div>
  );
}
