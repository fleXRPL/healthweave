'use client';

import { useState, useEffect } from 'react';
import { AnalysisResult, AnalyzeResponse } from '@/types';
import api from '@/lib/api';

interface ReportHistoryProps {
  readonly onViewReport: (report: AnalyzeResponse) => void;
  readonly onBack: () => void;
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  const [reports, setReports] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchReports = () => {
    setLoading(true);
    api
      .getUserReports()
      .then((res) => setReports(res.reports ?? []))
      .catch(() => setError('Failed to load report history'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    try {
      const blob = await api.downloadReportPDF(reportId);
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthweave-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert('Failed to download PDF: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    setDeleting(reportId);
    setError(null);
    try {
      await api.deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Past Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Your previous health document analyses</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Analysis
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No past reports yet. Upload documents to get started.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white shadow-sm rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Date + doc count */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(report.createdAt)}
                    </span>
                    {report.documentNames && report.documentNames.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {report.documentNames.length} {report.documentNames.length === 1 ? 'document' : 'documents'}
                      </span>
                    )}
                    {report.modelUsed && (
                      <span className="text-xs text-gray-400">{report.modelUsed}</span>
                    )}
                  </div>

                  {/* Document names */}
                  {report.documentNames && report.documentNames.length > 0 && (
                    <p className="text-xs text-gray-500 mb-2 truncate">
                      {report.documentNames.join(', ')}
                    </p>
                  )}

                  {/* Summary preview */}
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {report.summary}
                  </p>

                  {/* Finding count chips */}
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {report.keyFindings.length} findings
                    </span>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                      {report.recommendations.length} recommendations
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => onViewReport(toAnalyzeResponse(report))}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(report.id)}
                    disabled={downloading === report.id}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-primary border border-primary hover:bg-blue-50 disabled:opacity-40 transition-colors"
                  >
                    {downloading === report.id ? 'Saving...' : 'PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(report.id)}
                    disabled={deleting === report.id}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-red-600 border border-red-300 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {deleting === report.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
