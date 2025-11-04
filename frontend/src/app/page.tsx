'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import AnalysisResults from '@/components/AnalysisResults';
import Logo from '@/components/Logo';
import api from '@/lib/api';
import { AnalyzeResponse } from '@/types';

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (files: File[], patientContext: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await api.analyzeDocuments(files, patientContext);

      if (result.success) {
        setAnalysisResult(result);
      } else {
        setError(result.error || 'Analysis failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze documents');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="md" />
              <div>
                <h1 className="text-2xl font-bold text-primary">HealthWeave</h1>
                <p className="text-sm text-accent">Synthesizing Your Health Story</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!analysisResult ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Upload Your Health Documents
              </h2>
              <p className="text-lg text-gray-600">
                Our AI will analyze your medical records, lab results, and clinical notes to
                generate comprehensive insights and actionable recommendations.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <FileUpload onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Analyze New Documents
              </button>
            </div>
            <AnalysisResults result={analysisResult} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-gray-500">
            © 2025 HealthWeave. This is a demonstration application. Always consult with
            qualified healthcare providers for medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
