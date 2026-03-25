'use client';

import React, { useState } from 'react';
import {
  CheckCircle, Search, Sparkles, MessageCircle, BookOpen,
  Download, AlertTriangle, FileText, Clock, Activity,
} from 'lucide-react';
import { AnalyzeResponse, Citation } from '@/types';
import api from '@/lib/api';

interface AnalysisResultsProps { readonly result: AnalyzeResponse; }

/** Render **bold** markdown inline */
function MD({ text }: { text: string }) {
  const parts: (string | React.JSX.Element)[] = [];
  const rx = /\*\*([^*]+)\*\*/g;
  let last = 0; let m; let k = 0;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={k++}>{m[1]}</strong>);
    last = rx.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.length > 0 ? parts : text}</>;
}

const CITE_META: Record<string, { label: string; bg: string; color: string }> = {
  research:           { label: 'Research',  bg: 'rgba(29,78,216,0.10)',  color: '#1d4ed8' },
  clinical_guideline: { label: 'Guideline', bg: 'rgba(6,95,70,0.10)',    color: '#065f46' },
  document:           { label: 'Reference', bg: 'rgba(107,33,168,0.10)', color: '#6b21a8' },
};

export default function AnalysisResults({ result }: AnalysisResultsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const citations: Citation[] | undefined = result.citations;
  const hasCitations = (citations?.length ?? 0) > 0;

  const handleDownloadPDF = async () => {
    setPdfLoading(true); setPdfErr(null);
    try {
      const blob = await api.downloadReportPDF(result.reportId);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `healthweave-report-${result.reportId}.pdf`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
    } catch (e: any) {
      setPdfErr('Failed to download PDF: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Meta banner ─────────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,0.09) 0%, rgba(22,163,74,0.04) 100%)',
          border: '1px solid rgba(22,163,74,0.25)',
          borderRadius: '1rem',
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: '9999px', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={16} style={{ color: '#16a34a' }} />
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#15803d' }}>Analysis Complete</span>
          <span
            data-testid="report-id-badge"
            title={result.reportId}
            style={{ marginLeft: 'auto', fontSize: '0.7rem', fontFamily: 'Geist Mono, monospace', background: 'rgba(22,163,74,0.12)', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '0.35rem' }}
          >
            {result.reportId.slice(0, 8)}…
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {(result.documentCount ?? 0) > 0 && (
            <MetaStat icon={<FileText size={13} />} label={`${result.documentCount} doc${result.documentCount !== 1 ? 's' : ''}`} />
          )}
          {result.analysisDurationFormatted && (
            <MetaStat icon={<Clock size={13} />} label={result.analysisDurationFormatted} />
          )}
          {(result.modelUsed ?? result.model) && (
            <MetaStat icon={<Activity size={13} />} label={result.modelUsed ?? result.model ?? ''} />
          )}
          {hasCitations && (
            <MetaStat icon={<BookOpen size={13} />} label={`${citations!.length} citation${citations!.length !== 1 ? 's' : ''}`} />
          )}
        </div>

        {result.documentNames && result.documentNames.length > 0 && (
          <p style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.5rem' }}>
            <strong>Based on:</strong> {result.documentNames.join(', ')}
          </p>
        )}
      </div>

      {/* ── Bento grid ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.1rem',
        }}
        className="results-grid"
      >

        {/* AI Summary — full width */}
        <ResultCard
          title="AI Summary"
          icon={<Sparkles size={16} style={{ color: 'var(--hw-navy)' }} />}
          headerClass="card-header-navy"
          span={3}
          delay={0.05}
        >
          <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#1a2535', whiteSpace: 'pre-wrap' }}>
            <MD text={result.summary} />
          </p>
        </ResultCard>

        {/* Key Findings — 2/3 */}
        <ResultCard
          title="Key Findings"
          icon={<Search size={15} style={{ color: '#1d4ed8' }} />}
          headerClass="card-header-blue"
          count={result.keyFindings.length}
          span={2}
          delay={0.1}
        >
          {result.keyFindings.length > 0 ? (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {result.keyFindings.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', background: 'rgba(255,255,255,0.7)', padding: '0.625rem', borderRadius: '0.6rem', border: '1px solid rgba(29,78,216,0.1)' }}>
                  <span className="badge-num" style={{ marginTop: '0.05rem' }}>{i + 1}</span>
                  <span style={{ fontSize: '0.825rem', lineHeight: 1.6, color: '#1a2535', flex: 1 }}><MD text={f} /></span>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ fontSize: '0.825rem', color: '#6b8099', fontStyle: 'italic' }}>No specific findings identified.</p>
          )}
        </ResultCard>

        {/* Recommendations — 1/3 */}
        <ResultCard
          title="Recommendations"
          icon={<CheckCircle size={15} style={{ color: '#16a34a' }} />}
          headerClass="card-header-green"
          count={result.recommendations.length}
          span={1}
          delay={0.15}
        >
          {result.recommendations.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {result.recommendations.map((r, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <CheckCircle size={15} style={{ color: '#16a34a', flexShrink: 0, marginTop: '0.15rem' }} />
                  <span style={{ fontSize: '0.8rem', lineHeight: 1.55, color: '#1a2535' }}><MD text={r} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#6b8099', fontStyle: 'italic' }}>No specific recommendations.</p>
          )}
        </ResultCard>

        {/* Questions for Doctor — conditional, 2/3 */}
        {(result.questionsForDoctor?.length ?? 0) > 0 && (
          <ResultCard
            title="Questions for Your Doctor"
            icon={<MessageCircle size={15} style={{ color: '#b45309' }} />}
            headerClass="card-header-amber"
            count={result.questionsForDoctor!.length}
            span={hasCitations ? 2 : 3}
            delay={0.2}
          >
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {result.questionsForDoctor!.map((q, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', background: 'rgba(255,255,255,0.7)', padding: '0.625rem', borderRadius: '0.6rem', border: '1px solid rgba(180,133,9,0.12)' }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '9999px', background: 'rgba(180,133,9,0.12)', color: '#92600a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>?</span>
                  <span style={{ fontSize: '0.825rem', lineHeight: 1.55, color: '#1a2535', flex: 1 }}><MD text={q} /></span>
                </li>
              ))}
            </ul>
          </ResultCard>
        )}

        {/* Citations — 1/3 */}
        {hasCitations && (
          <ResultCard
            title="Sources"
            icon={<BookOpen size={15} style={{ color: '#6b21a8' }} />}
            headerClass="card-header-purple"
            count={citations!.length}
            span={1}
            delay={0.25}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '16rem', overflowY: 'auto' }}>
              {citations!.map((c, i) => {
                const m = CITE_META[c.type] ?? CITE_META.document;
                return (
                  <div key={i}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', background: m.bg, color: m.color, display: 'inline-block', marginBottom: '0.35rem' }}>
                      {m.label}
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.55, margin: 0 }}>{c.source}</p>
                    {i < citations!.length - 1 && (
                      <div style={{ height: 1, background: 'rgba(107,33,168,0.1)', marginTop: '0.875rem' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </ResultCard>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up"
        style={{
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 12px rgba(41,98,139,0.06)',
          animationDelay: '0.3s',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--hw-navy-dark)', marginBottom: '0.2rem' }}>Save your analysis</p>
            <p style={{ fontSize: '0.775rem', color: '#6b8099' }}>Download a PDF report to share with your healthcare provider.</p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.7rem',
              border: 'none',
              cursor: pdfLoading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, var(--hw-navy-dark), var(--hw-navy))',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: pdfLoading ? 'none' : '0 3px 14px rgba(41,98,139,0.35)',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              opacity: pdfLoading ? 0.7 : 1,
            }}
          >
            {pdfLoading ? (
              <>
                <svg className="animate-spin" style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating…
              </>
            ) : (
              <><Download size={15} /> Download PDF Report</>
            )}
          </button>
        </div>

        {pdfErr && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem' }}>{pdfErr}</p>}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '0.65rem', background: 'rgba(180,133,9,0.06)', border: '1px solid rgba(180,133,9,0.18)' }}>
          <AlertTriangle size={13} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.75rem', color: '#92600a', lineHeight: 1.55 }}>
            <strong>Important:</strong> This AI-generated analysis is for informational purposes only.
            Always consult your healthcare provider before making any medical decisions.
          </p>
        </div>
      </div>

      {/* Responsive grid override */}
      <style>{`
        @media (max-width: 768px) {
          .results-grid { grid-template-columns: 1fr !important; }
          .results-grid > * { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function MetaStat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.775rem', color: '#166534' }}>
      {icon} {label}
    </span>
  );
}

function ResultCard({
  title, icon, headerClass, count, span = 1, delay = 0, children,
}: {
  title: string;
  icon: React.ReactNode;
  headerClass: string;
  count?: number;
  span?: number;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="animate-fade-in-up"
      style={{
        gridColumn: `span ${span}`,
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(41,98,139,0.05)',
        animationDelay: `${delay}s`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header band */}
      <div
        className={headerClass}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.7rem 1rem',
        }}
      >
        {icon}
        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f1e2e', margin: 0, flex: 1 }}>{title}</h2>
        {count !== undefined && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '9999px', background: 'rgba(0,0,0,0.07)', color: '#374151' }}>
            {count}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '1rem', flex: 1 }}>{children}</div>
    </div>
  );
}
