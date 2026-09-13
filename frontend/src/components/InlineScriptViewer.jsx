import React from 'react';
import { FileText, ExternalLink, Download } from 'lucide-react';

export default function InlineScriptViewer({ scriptUrl, fileType, fileName }) {
  if (!scriptUrl) {
    return (
      <div style={{
        padding: '3rem',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '12px',
        border: '1px stroke var(--border-light)',
        color: 'var(--text-muted)'
      }}>
        <FileText size={48} style={{ opacity: 0.4, marginBottom: '1rem' }} />
        <p>No answer script uploaded yet.</p>
      </div>
    );
  }

  // Prepend current origin if scriptUrl is relative (/uploads/...)
  const fullUrl = scriptUrl.startsWith('http') ? scriptUrl : (typeof window !== 'undefined' ? `${window.location.origin}${scriptUrl}` : `http://localhost:5000${scriptUrl}`);
  const isPdf = fileType?.includes('pdf') || scriptUrl.toLowerCase().endsWith('.pdf');

  return (
    <div className="glass-card" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} color="var(--primary)" />
          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
            {fileName || 'Student Scanned Answer Script'}
          </span>
        </div>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
        >
          <ExternalLink size={14} /> Open Full View
        </a>
      </div>

      <div style={{ flex: 1, minHeight: '450px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
        {isPdf ? (
          <iframe
            src={`${fullUrl}#toolbar=1&navpanes=0`}
            title="Student Scanned Answer Script"
            style={{ width: '100%', height: '100%', minHeight: '480px', border: 'none' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            minHeight: '480px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '1rem'
          }}>
            <img
              src={fullUrl}
              alt="Handwritten Answer Script Scan"
              style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '4px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
