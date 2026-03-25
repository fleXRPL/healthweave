import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyzeResponse } from '@/types';

// Mock the API client before importing the component
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    downloadReportPDF: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  },
}));

import AnalysisResults from '@/components/AnalysisResults';
import apiClient from '@/lib/api';

const mockDownloadPDF = apiClient.downloadReportPDF as jest.Mock;

const baseResult: AnalyzeResponse = {
  success: true,
  reportId: 'test-report-123',
  summary: 'This is the AI summary.',
  keyFindings: ['Finding one', 'Finding two'],
  recommendations: ['Recommendation one', 'Recommendation two'],
};

describe('AnalysisResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock browser URL APIs not implemented in jsdom
    globalThis.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = jest.fn();
  });

  it('renders a truncated report ID in the success banner', () => {
    render(<AnalysisResults result={baseResult} />);
    const badge = screen.getByTestId('report-id-badge');
    expect(badge).toHaveAttribute('title', 'test-report-123');
    expect(badge.textContent).toMatch(/^test-rep/);
  });

  it('renders the AI summary', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.getByText(/this is the ai summary/i)).toBeInTheDocument();
  });

  it('renders all key findings', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.getByText('Finding one')).toBeInTheDocument();
    expect(screen.getByText('Finding two')).toBeInTheDocument();
  });

  it('shows empty state when there are no key findings', () => {
    render(<AnalysisResults result={{ ...baseResult, keyFindings: [] }} />);
    expect(screen.getByText(/no specific findings identified/i)).toBeInTheDocument();
  });

  it('renders all recommendations', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.getByText('Recommendation one')).toBeInTheDocument();
    expect(screen.getByText('Recommendation two')).toBeInTheDocument();
  });

  it('shows empty state when there are no recommendations', () => {
    render(<AnalysisResults result={{ ...baseResult, recommendations: [] }} />);
    expect(screen.getByText(/no specific recommendations/i)).toBeInTheDocument();
  });

  it('renders Questions for Your Doctor section when provided', () => {
    const result = { ...baseResult, questionsForDoctor: ['Should I take vitamin D?'] };
    render(<AnalysisResults result={result} />);
    expect(screen.getByText(/questions for your doctor/i)).toBeInTheDocument();
    expect(screen.getByText('Should I take vitamin D?')).toBeInTheDocument();
  });

  it('does not render Questions section when not provided', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.queryByText(/questions for your doctor/i)).not.toBeInTheDocument();
  });

  it('renders the Download PDF button', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.getByRole('button', { name: /download pdf report/i })).toBeInTheDocument();
  });

  it('renders document count when provided', () => {
    const result = { ...baseResult, documentCount: 5, keyFindings: [], recommendations: [] };
    render(<AnalysisResults result={result} />);
    expect(screen.getByText(/5\s*docs/)).toBeInTheDocument();
  });

  it('renders analysis duration when provided', () => {
    const result = { ...baseResult, analysisDurationFormatted: '2.1s' };
    render(<AnalysisResults result={result} />);
    expect(screen.getByText('2.1s')).toBeInTheDocument();
  });

  it('renders model name when provided', () => {
    // result.model triggers the outer metadata div; result.modelUsed ?? result.model is displayed
    const result = { ...baseResult, model: 'anthropic-model' };
    render(<AnalysisResults result={result} />);
    expect(screen.getByText('anthropic-model')).toBeInTheDocument();
  });

  it('calls downloadReportPDF when download button is clicked', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<AnalysisResults result={baseResult} />);
    const btn = screen.getByRole('button', { name: /download pdf report/i });
    fireEvent.click(btn);
    await waitFor(
      () => {
        expect(mockDownloadPDF).toHaveBeenCalledWith('test-report-123');
      },
      { timeout: 5000 }
    );
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
    clickSpy.mockRestore();
  });

  it('renders bold markdown in summary', () => {
    const result = { ...baseResult, summary: 'Normal **bold text** here.' };
    render(<AnalysisResults result={result} />);
    const boldEl = screen.getByText('bold text');
    expect(boldEl.tagName).toBe('STRONG');
  });

  it('renders the medical disclaimer', () => {
    render(<AnalysisResults result={baseResult} />);
    expect(screen.getByText(/for informational purposes only/i)).toBeInTheDocument();
  });
});
