import React, { useState } from 'react';
import { Code2, Copy, Check } from 'lucide-react';

/**
 * Modern IDE Code Display Component
 * Formats programming code snippets with line numbers, language badge, and copy support.
 */
export default function CodeBlock({
  code = '',
  language = '',
  title = '',
  showLineNumbers = true,
  maxHeight = '450px',
  allowCopy = true,
  fontSize = '0.84rem'
}) {
  const [copied, setCopied] = useState(false);

  if (!code || typeof code !== 'string') return null;

  const lines = code.replace(/\r\n/g, '\n').split('\n');

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanLang = (language || '').toUpperCase();

  return (
    <div style={{
      background: '#090d16',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '8px',
      overflow: 'hidden',
      margin: '0.6rem 0',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
        padding: '0.4rem 0.8rem',
        fontSize: '0.72rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginRight: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308', display: 'inline-block' }}></span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          </div>
          <Code2 size={13} color="#38bdf8" />
          <span style={{ color: '#e2e8f0', fontWeight: '600', letterSpacing: '0.02em' }}>
            {title || 'Program Code Snippet'}
          </span>
          {cleanLang && (
            <span style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              fontWeight: '700',
              fontSize: '0.65rem'
            }}>
              {cleanLang}
            </span>
          )}
        </div>

        {allowCopy && (
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${copied ? 'var(--emerald)' : 'rgba(255, 255, 255, 0.15)'}`,
              color: copied ? 'var(--emerald)' : '#94a3b8',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.15s ease'
            }}
            title="Copy snippet"
          >
            {copied ? (
              <>
                <Check size={12} /> Copied!
              </>
            ) : (
              <>
                <Copy size={12} /> Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* Code Container with Optional Line Numbers */}
      <div style={{
        display: 'flex',
        maxHeight,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: '0.6rem 0'
      }}>
        {showLineNumbers && (
          <div style={{
            padding: '0 0.65rem',
            textAlign: 'right',
            color: 'rgba(148, 163, 184, 0.4)',
            userSelect: 'none',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize,
            lineHeight: '1.55',
            flexShrink: 0
          }}>
            {lines.map((_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>
        )}

        <pre style={{
          margin: 0,
          padding: '0 0.85rem',
          color: '#e2e8f0',
          fontSize,
          lineHeight: '1.55',
          tabSize: 4,
          whiteSpace: 'pre',
          fontFamily: 'inherit',
          flex: 1
        }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
