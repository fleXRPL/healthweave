'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Image, Lock, Sparkles, X } from 'lucide-react';
import apiClient from '@/lib/api';

interface FileUploadProps {
  onAnalyze: (files: File[], patientContext: string, localOnly?: boolean) => Promise<void>;
  isAnalyzing: boolean;
}

const ACCEPT_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg':      ['.jpg', '.jpeg'],
  'image/png':       ['.png'],
  'text/plain':      ['.txt'],
};

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <Image size={15} />;
  return <FileText size={15} />;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileUpload({ onAnalyze, isAnalyzing }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [patientContext, setPatientContext] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [savedContext, setSavedContext] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    apiClient.getPatientContext().then((ctx) => {
      if (ctx) { setPatientContext(ctx); setSavedContext(ctx); }
    });
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...accepted.filter((f) => !seen.has(f.name + f.size))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_TYPES,
    maxSize: 10 * 1024 * 1024,
    disabled: isAnalyzing,
  });

  const removeFile = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const handleSaveContext = async () => {
    setSaveStatus('saving');
    try {
      await apiClient.savePatientContext(patientContext);
      setSavedContext(patientContext);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length > 0 && !isAnalyzing) await onAnalyze(files, patientContext, localOnly);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Patient context ───────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label
            htmlFor="context"
            style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--hw-navy-dark)' }}
          >
            Patient Context
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b8099', marginLeft: '0.3rem' }}>(optional)</span>
          </label>
          <button
            type="button"
            onClick={handleSaveContext}
            disabled={isAnalyzing || saveStatus === 'saving' || patientContext === savedContext}
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '0.25rem 0.65rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--hw-teal)',
              color: 'var(--hw-navy)',
              background: 'transparent',
              cursor: 'pointer',
              opacity: patientContext === savedContext ? 0.45 : 1,
              transition: 'all 0.15s',
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save for next time'}
          </button>
        </div>
        <textarea
          id="context"
          rows={3}
          disabled={isAnalyzing}
          value={patientContext}
          onChange={(e) => setPatientContext(e.target.value)}
          placeholder="E.g., Recently diagnosed with CLL, experiencing fatigue, scheduled for follow-up..."
          style={{
            width: '100%',
            resize: 'none',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.6rem',
            border: '1.5px solid var(--border)',
            background: 'rgba(255,255,255,0.6)',
            fontSize: '0.83rem',
            color: '#1a2535',
            outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--hw-teal)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        {saveStatus === 'error' && (
          <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '0.25rem' }}>Failed to save context</p>
        )}
      </div>

      {/* ── Dropzone ──────────────────────────────────────────────── */}
      <div>
        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--hw-navy-dark)', marginBottom: '0.4rem' }}>
          Medical Documents <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--hw-teal)' : 'var(--border)'}`,
            borderRadius: '0.875rem',
            padding: '2rem 1.25rem',
            textAlign: 'center',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            background: isDragActive ? 'rgba(70,147,195,0.06)' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <input {...getInputProps()} />

          {/* Icon with hover grow — matches Magic Patterns */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '9999px',
              background: isDragActive ? 'rgba(70,147,195,0.15)' : 'rgba(255,255,255,0.9)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.85rem',
              transition: 'transform 0.25s',
              transform: isDragActive ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <UploadCloud size={26} style={{ color: 'var(--hw-teal)' }} />
          </div>

          {isDragActive ? (
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--hw-navy)' }}>Drop to add files…</p>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                <span style={{ fontWeight: 600, color: 'var(--hw-navy)' }}>Click to upload</span> or drag &amp; drop
              </p>
              <p style={{ fontSize: '0.75rem', color: '#6b8099', marginTop: '0.25rem' }}>
                PDF, JPG, PNG, TXT — up to 10 MB each, 25 files max
              </p>
            </>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="animate-fade-in-up"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.65rem',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    padding: '0.35rem',
                    background: 'var(--surface-2)',
                    borderRadius: '0.4rem',
                    color: 'var(--hw-navy)',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  {fileIcon(file.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1a2535', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: '#6b8099' }}>{fmtSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={isAnalyzing}
                  aria-label={`Remove ${file.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0.25rem', borderRadius: '0.35rem', display: 'flex' }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Privacy toggle ────────────────────────────────────────── */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          borderRadius: '0.75rem',
          border: `1.5px solid ${localOnly ? 'var(--hw-teal)' : 'var(--border)'}`,
          background: localOnly ? 'rgba(70,147,195,0.06)' : 'rgba(255,255,255,0.5)',
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <input
          type="checkbox"
          checked={localOnly}
          onChange={(e) => setLocalOnly(e.target.checked)}
          disabled={isAnalyzing}
          style={{ marginTop: '0.15rem', width: '1rem', height: '1rem', accentColor: 'var(--hw-teal)', flexShrink: 0 }}
        />
        <div>
          <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--hw-navy-dark)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Lock size={13} /> Local-only analysis (Privacy mode)
          </p>
          <p style={{ fontSize: '0.75rem', color: '#6b8099', marginTop: '0.2rem', lineHeight: 1.5 }}>
            Analyze entirely on this device using Ollama. No data is sent to AWS or cloud AI services.
          </p>
        </div>
      </label>

      {/* ── Submit ────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={files.length === 0 || isAnalyzing}
        style={{
          width: '100%',
          padding: '0.875rem',
          borderRadius: '0.75rem',
          border: 'none',
          cursor: files.length === 0 || isAnalyzing ? 'not-allowed' : 'pointer',
          background: files.length === 0 || isAnalyzing
            ? '#94a3b8'
            : 'linear-gradient(135deg, var(--hw-navy-dark) 0%, var(--hw-navy) 55%, var(--hw-teal) 100%)',
          color: '#fff',
          fontSize: '0.925rem',
          fontWeight: 600,
          boxShadow: files.length > 0 && !isAnalyzing ? '0 4px 20px rgba(41,98,139,0.35)' : 'none',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontFamily: 'inherit',
        }}
      >
        {isAnalyzing ? (
          <>
            <svg className="animate-spin" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Analyzing Documents…
          </>
        ) : (
          <>
            <Sparkles size={17} />
            Analyze {files.length > 0 ? `${files.length} Document${files.length !== 1 ? 's' : ''}` : 'Documents'}
          </>
        )}
      </button>
    </form>
  );
}
