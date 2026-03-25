'use client';

import { useState, useEffect } from 'react';
import { AnalysisResult, AnalyzeResponse } from '@/types';
import api from '@/lib/api';
import {
  Clock,
  FileText,
  Download,
  Trash2,
  Eye,
  Plus,
  AlertTriangle,
  AlertCircle,
  Activity,
  Lightbulb,
} from 'lucide-react';

interface ReportHistoryProps {
  readonly onViewReport: (report: AnalyzeResponse) => void;
  readonly onBack: () => void;
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toAnalyzeResponse(report: AnalysisResult): AnalyzeResponse {
  return {
    success: true,
    reportId: report.id,
    summary: report.summary,
    keyFindings: report.keyFindings,
    recommendations: report.recommendations,
    questionsForDoctor: report.questionsForDoctor,
    documentNames: report.documentNames,
    modelUsed: report.modelUsed,
  };
}

export default function ReportHistory({ onViewReport, onBack }: ReportHistoryProps) {
  const [reports, setReports]           = useState<AnalysisResult[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getUserReports()
      .then((res) => setReports(res.reports ?? []))
      .catch(() => setError('Failed to load report history'))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    try {
      const blob = await api.downloadReportPDF(reportId);
      const url  = globalThis.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `healthweave-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to download PDF: ' + msg);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    setConfirmDelete(null);
    setDeleting(reportId);
    setError(null);
    try {
      await api.deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete report';
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto' }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.75rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--hw-navy-dark)',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Past Reports
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b8099', marginTop: '0.25rem' }}>
            Your previous health document analyses
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.65rem',
            fontSize: '0.825rem',
            fontWeight: 500,
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            color: '#374151',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all 0.15s',
          }}
        >
          <Plus size={14} />
          New Analysis
        </button>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div
          className="animate-fade-in-up"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.875rem 1rem',
            borderRadius: '0.75rem',
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.2)',
            color: '#b91c1c',
            fontSize: '0.825rem',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Loading spinner ──────────────────────────────────────────── */}
      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5rem 0',
            gap: '0.875rem',
          }}
        >
          <svg
            className="animate-spin"
            style={{ width: 32, height: 32, color: 'var(--hw-teal)' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span style={{ fontSize: '0.875rem', color: '#6b8099' }}>Loading reports…</span>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!loading && !error && reports.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5rem 1.5rem',
            borderRadius: '1rem',
            background: 'var(--surface-0)',
            border: '2px dashed var(--border)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '1rem',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <FileText size={28} style={{ color: '#94a3b8' }} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', margin: 0 }}>No reports yet</p>
          <p style={{ fontSize: '0.8rem', color: '#6b8099', marginTop: '0.375rem' }}>
            Upload documents to create your first analysis
          </p>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: '1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.55rem 1.25rem',
              borderRadius: '0.65rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, var(--hw-navy-dark) 0%, var(--hw-teal) 100%)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(41,98,139,0.3)',
            }}
          >
            <Plus size={14} />
            Start your first analysis
          </button>
        </div>
      )}

      {/* ── Report cards ─────────────────────────────────────────────── */}
      {!loading && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {reports.map((report, idx) => (
            <ReportCard
              key={report.id}
              report={report}
              idx={idx}
              downloading={downloading}
              deleting={deleting}
              confirmDelete={confirmDelete}
              onView={() => onViewReport(toAnalyzeResponse(report))}
              onDownload={() => handleDownload(report.id)}
              onConfirmDelete={() => setConfirmDelete(report.id)}
              onDelete={() => handleDelete(report.id)}
              onCancelDelete={() => setConfirmDelete(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ReportCard sub-component ─────────────────────────────────────────────── */
interface ReportCardProps {
  report:        AnalysisResult;
  idx:           number;
  downloading:   string | null;
  deleting:      string | null;
  confirmDelete: string | null;
  onView:        () => void;
  onDownload:    () => void;
  onConfirmDelete: () => void;
  onDelete:      () => void;
  onCancelDelete: () => void;
}

function ReportCard({
  report,
  idx,
  downloading,
  deleting,
  confirmDelete,
  onView,
  onDownload,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: ReportCardProps) {
  const isDownloading = downloading === report.id;
  const isDeleting    = deleting    === report.id;
  const pendingDelete = confirmDelete === report.id;

  return (
    <div
      className="animate-fade-in-up"
      style={{
        borderRadius: '1rem',
        overflow: 'hidden',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(41,98,139,0.06)',
        animationDelay: `${idx * 0.05}s`,
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Top accent strip — same gradient as Magic Patterns design */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--hw-navy-dark) 0%, var(--hw-navy) 50%, var(--hw-teal) 100%)',
        }}
      />

      <div style={{ padding: '1.125rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* ── Main content ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Date row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <Clock size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1a2535' }}>
              {formatDate(report.createdAt)}
            </span>

            {report.documentNames && report.documentNames.length > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  background: 'var(--surface-2)',
                  color: '#6b8099',
                  border: '1px solid var(--border)',
                }}
              >
                {report.documentNames.length} doc{report.documentNames.length !== 1 ? 's' : ''}
              </span>
            )}

            {report.modelUsed && (
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{report.modelUsed}</span>
            )}
          </div>

          {/* Doc names */}
          {report.documentNames && report.documentNames.length > 0 && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#6b8099',
                marginBottom: '0.5rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <FileText
                size={11}
                style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle', color: '#94a3b8' }}
              />
              {report.documentNames.join(', ')}
            </p>
          )}

          {/* Summary preview */}
          <p
            style={{
              fontSize: '0.825rem',
              color: '#374151',
              lineHeight: 1.55,
              marginBottom: '0.75rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {report.summary}
          </p>

          {/* Counts row */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Chip
              icon={<Activity size={11} />}
              label={`${report.keyFindings.length} finding${report.keyFindings.length !== 1 ? 's' : ''}`}
              color="blue"
            />
            <Chip
              icon={<Lightbulb size={11} />}
              label={`${report.recommendations.length} recommendation${report.recommendations.length !== 1 ? 's' : ''}`}
              color="green"
            />
            {report.questionsForDoctor && report.questionsForDoctor.length > 0 && (
              <Chip
                icon={<AlertTriangle size={11} />}
                label={`${report.questionsForDoctor.length} question${report.questionsForDoctor.length !== 1 ? 's' : ''}`}
                color="amber"
              />
            )}
          </div>
        </div>

        {/* ── Sidebar actions ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            flexShrink: 0,
            alignItems: 'stretch',
            minWidth: '5.5rem',
          }}
        >
          {/* View */}
          <ActionBtn
            onClick={onView}
            variant="primary"
            icon={<Eye size={12} />}
            label="View"
          />

          {/* PDF */}
          <ActionBtn
            onClick={onDownload}
            disabled={isDownloading}
            variant="outline"
            icon={<Download size={12} />}
            label={isDownloading ? '…' : 'PDF'}
          />

          {/* Delete / Confirm */}
          {pendingDelete ? (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '0.4rem 0.4rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {isDeleting ? '…' : 'Yes'}
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                style={{
                  flex: 1,
                  padding: '0.4rem 0.4rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: 'var(--surface-2)',
                  color: '#374151',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          ) : (
            <ActionBtn
              onClick={onConfirmDelete}
              disabled={isDeleting}
              variant="danger"
              icon={<Trash2 size={12} />}
              label={isDeleting ? '…' : 'Delete'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Chip helper ──────────────────────────────────────────────────────────── */
function Chip({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'blue' | 'green' | 'amber';
}) {
  const palette = {
    blue:  { bg: 'rgba(29,78,216,0.07)',  color: '#1d4ed8' },
    green: { bg: 'rgba(22,163,74,0.07)',  color: '#15803d' },
    amber: { bg: 'rgba(180,133,9,0.07)',  color: '#b45309' },
  };
  const p = palette[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.2rem 0.6rem',
        borderRadius: '9999px',
        background: p.bg,
        color: p.color,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

/* ── ActionBtn helper ─────────────────────────────────────────────────────── */
function ActionBtn({
  onClick,
  disabled,
  variant,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'outline' | 'danger';
  icon: React.ReactNode;
  label: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, var(--hw-navy-dark) 0%, var(--hw-teal) 100%)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 8px rgba(41,98,139,0.28)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--hw-navy)',
      border: '1px solid var(--hw-teal)',
    },
    danger: {
      background: 'transparent',
      color: 'var(--danger)',
      border: '1px solid rgba(220,38,38,0.3)',
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        padding: '0.45rem 0.65rem',
        borderRadius: '0.55rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
        width: '100%',
        ...styles[variant],
      }}
    >
      {icon}
      {label}
    </button>
  );
}
