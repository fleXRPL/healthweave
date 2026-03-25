'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, ArrowLeft } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import AnalysisResults from '@/components/AnalysisResults';
import ReportHistory from '@/components/ReportHistory';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { AnalyzeResponse } from '@/types';

type View = 'upload' | 'results' | 'history';

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('upload');

  const handleAnalyze = async (files: File[], patientContext: string, localOnly?: boolean) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const result = await api.analyzeDocuments(files, patientContext, undefined, localOnly);
      if (result.success) {
        setAnalysisResult(result);
        setView('results');
      } else {
        setError(result.error || 'Analysis failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze documents');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => { setAnalysisResult(null); setError(null); setView('upload'); };
  const handleViewHistoricalReport = (report: AnalyzeResponse) => { setAnalysisResult(report); setView('results'); };

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <Header
        pastReportsAsToggle
        onPastReportsClick={() => setView((v) => (v === 'history' ? 'upload' : 'history'))}
      />

      <main
        style={{
          flex: 1,
          maxWidth: '72rem',
          margin: '0 auto',
          width: '100%',
          padding: '2.5rem 1.5rem',
        }}
      >

        {/* ── History ───────────────────────────────────────────────── */}
        {view === 'history' && (
          <div className="animate-fade-in-up">
            <ReportHistory onViewReport={handleViewHistoricalReport} onBack={() => setView('upload')} />
          </div>
        )}

        {/* ── Upload ────────────────────────────────────────────────── */}
        {view === 'upload' && (
          <div className="animate-fade-in-up" style={{ maxWidth: '48rem', margin: '0 auto' }}>

            {/* Hero — gradient blobs behind (Magic Patterns pattern) */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative' }}>
              {/* Background gradient blobs */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: -1,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 600,
                    height: 350,
                    background: 'rgba(70,147,195,0.12)',
                    borderRadius: '50%',
                    filter: 'blur(90px)',
                    mixBlendMode: 'multiply',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -60,
                    width: 480,
                    height: 480,
                    background: 'rgba(28,70,106,0.06)',
                    borderRadius: '50%',
                    filter: 'blur(110px)',
                    mixBlendMode: 'multiply',
                  }}
                />
              </div>

              {/* Pulsing pill badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 1rem',
                  borderRadius: '9999px',
                  background: 'rgba(255,255,255,0.65)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(70,147,195,0.22)',
                  color: 'var(--hw-navy-dark)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                  marginBottom: '1.25rem',
                }}
              >
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  {/* Ping ring */}
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '9999px',
                      background: 'var(--hw-teal)',
                      opacity: 0.6,
                      animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
                    }}
                  />
                  <span
                    style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '9999px',
                      background: 'var(--hw-teal)',
                      display: 'block',
                    }}
                  />
                </span>
                AI-Powered Health Analysis
              </div>

              <h1
                style={{
                  fontSize: 'clamp(2rem, 5vw, 2.75rem)',
                  fontWeight: 800,
                  color: 'var(--hw-navy-dark)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  marginBottom: '0.85rem',
                }}
              >
                Upload Your Health Documents
              </h1>
              <p style={{ fontSize: '1.05rem', color: '#4b6080', maxWidth: '36rem', margin: '0 auto' }}>
                Our AI synthesizes your medical records, lab results, and clinical notes into
                clear, citation-backed insights.
              </p>
            </div>

            {/* Amber disclaimer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                background: 'rgba(255,251,235,0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(180,133,9,0.25)',
                marginBottom: '1.5rem',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.8rem', color: '#92600a' }}>
                <strong>For informational use only.</strong> HealthWeave does not provide medical
                advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="animate-fade-in-up"
                style={{
                  display: 'flex',
                  gap: '0.625rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.25)',
                  marginBottom: '1.25rem',
                }}
              >
                <AlertTriangle size={15} style={{ color: '#b91c1c', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                  <strong>Analysis failed</strong>
                  <div style={{ opacity: 0.85, marginTop: 2 }}>{error}</div>
                </div>
              </div>
            )}

            {/* Glass upload card */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <FileUpload onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            </div>

            {/* Feature chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '0.75rem',
                marginTop: '1.75rem',
              }}
            >
              {[
                { icon: '🔬', label: 'Citation-backed findings' },
                { icon: '🛡️', label: 'HIPAA-conscious design' },
                { icon: '📄', label: 'PDF export' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 1rem',
                    borderRadius: '9999px',
                    background: 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--border)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    color: '#4b6080',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────── */}
        {view === 'results' && analysisResult && (
          <div className="animate-fade-in-up">
            {/* Action bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: '0.875rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: '#92600a',
                  background: 'rgba(180,133,9,0.08)',
                  border: '1px solid rgba(180,133,9,0.2)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.5rem',
                }}
              >
                <AlertTriangle size={13} />
                AI-generated summary. Verify with your doctor.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <OutlineBtn onClick={() => setView('history')}><Clock size={14} /> Past Reports</OutlineBtn>
                <OutlineBtn onClick={handleReset}><ArrowLeft size={14} /> New Analysis</OutlineBtn>
              </div>
            </div>
            <AnalysisResults result={analysisResult} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function OutlineBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.45rem 0.9rem',
        borderRadius: '0.6rem',
        fontSize: '0.8rem',
        fontWeight: 500,
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        color: '#374151',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {children}
    </button>
  );
}
