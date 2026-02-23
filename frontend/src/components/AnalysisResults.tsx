'use client';

import React from 'react';
import { AnalyzeResponse } from '@/types';
import api from '@/lib/api';

interface AnalysisResultsProps {
  result: AnalyzeResponse;
}

/**
 * Convert markdown bold (**text**) to HTML strong tags
 */
function renderMarkdown(text: string): React.JSX.Element {
  const parts: (string | React.JSX.Element)[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add the bold text
    parts.push(<strong key={key++}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}

export default function AnalysisResults({ result }: AnalysisResultsProps) {
  const handleDownloadPDF = async () => {
    try {
      const blob = await api.downloadReportPDF(result.reportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthweave-report-${result.reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      alert('Failed to download PDF: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Success Banner with Timing Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-green-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-green-800">Analysis Complete</h3>
            <p className="mt-1 text-sm text-green-700">
              Your health documents have been successfully analyzed. Report ID: {result.reportId}
            </p>
          </div>
        </div>
        
        {/* Analysis Stats */}
        {(result.documentCount || result.analysisDurationFormatted || result.model || result.documentNames?.length) && (
          <div className="mt-3 pt-3 border-t border-green-200 flex flex-wrap gap-4 text-sm">
            {result.documentCount != null && result.documentCount > 0 && (
              <div className="flex items-center text-green-700">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span><strong>{result.documentCount}</strong> documents analyzed</span>
              </div>
            )}
            {result.documentNames && result.documentNames.length > 0 && (
              <div className="w-full text-green-700">
                <span className="font-medium">Based on: </span>
                <span>{result.documentNames.join(', ')}</span>
              </div>
            )}
            {result.analysisDurationFormatted && (
              <div className="flex items-center text-green-700">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Completed in <strong>{result.analysisDurationFormatted}</strong></span>
              </div>
            )}
            {(result.model || result.modelUsed) && (
              <div className="flex items-center text-green-700">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Generated with model: <strong>{result.modelUsed ?? result.model}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-primary px-6 py-4">
          <h2 className="text-xl font-bold text-white">AI Summary</h2>
        </div>
        <div className="px-6 py-4">
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {renderMarkdown(result.summary)}
          </div>
        </div>
      </div>

      {/* Key Findings */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-accent px-6 py-4">
          <h2 className="text-xl font-bold text-white">Key Findings</h2>
        </div>
        <div className="px-6 py-4">
          {result.keyFindings.length > 0 ? (
            <ul className="space-y-3">
              {result.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start">
                  <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-primary font-semibold text-sm mr-3">
                    {index + 1}
                  </span>
                  <div className="text-gray-700 flex-1">{renderMarkdown(finding)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No specific findings identified.</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-primary-dark px-6 py-4">
          <h2 className="text-xl font-bold text-white">Recommendations</h2>
        </div>
        <div className="px-6 py-4">
          {result.recommendations.length > 0 ? (
            <ul className="space-y-3">
              {result.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <svg
                    className="flex-shrink-0 h-6 w-6 text-green-500 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="text-gray-700 flex-1">{renderMarkdown(rec)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No specific recommendations at this time.</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Steps</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Download PDF Report
          </button>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Important Reminder</h3>
              <p className="mt-1 text-sm text-yellow-700">
                This AI-generated analysis is for informational purposes only. Always consult with
                your healthcare provider before making any medical decisions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
