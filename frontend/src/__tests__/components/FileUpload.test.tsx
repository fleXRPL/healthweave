import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock API client before importing component
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    getPatientContext: jest.fn(),
    savePatientContext: jest.fn(),
  },
}));

// Mock react-dropzone to isolate from browser file APIs
jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn(() => ({
    getRootProps: () => ({}),
    getInputProps: () => ({ type: 'file' }),
    isDragActive: false,
  })),
}));

import FileUpload from '@/components/FileUpload';
import apiClient from '@/lib/api';

const mockGetPatientContext = apiClient.getPatientContext as jest.Mock;
const mockSavePatientContext = apiClient.savePatientContext as jest.Mock;

describe('FileUpload', () => {
  const mockOnAnalyze = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPatientContext.mockResolvedValue('');
    mockSavePatientContext.mockResolvedValue(undefined);
  });

  it('renders the patient context textarea', () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    expect(screen.getByLabelText(/patient context/i)).toBeInTheDocument();
  });

  it('renders the file upload dropzone area', () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    expect(screen.getByText(/click to upload/i)).toBeInTheDocument();
  });

  it('pre-fills patient context from saved data on mount', async () => {
    mockGetPatientContext.mockResolvedValue('CLL, MTHFR mutation');
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/patient context/i)).toHaveValue('CLL, MTHFR mutation');
    });
  });

  it('calls getPatientContext on mount', async () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => {
      expect(mockGetPatientContext).toHaveBeenCalledTimes(1);
    });
  });

  it('save button is disabled when context is unchanged', async () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    // Wait for mount effect to complete
    await waitFor(() => expect(mockGetPatientContext).toHaveBeenCalled());
    const saveBtn = screen.getByRole('button', { name: /save for next time/i });
    expect(saveBtn).toBeDisabled();
  });

  it('save button is enabled after typing new context', async () => {
    const user = userEvent.setup();
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => expect(mockGetPatientContext).toHaveBeenCalled());

    const textarea = screen.getByLabelText(/patient context/i);
    await user.type(textarea, 'new context');

    const saveBtn = screen.getByRole('button', { name: /save for next time/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('shows Saved confirmation after successfully saving context', async () => {
    const user = userEvent.setup();
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => expect(mockGetPatientContext).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/patient context/i), 'new context');
    await user.click(screen.getByRole('button', { name: /save for next time/i }));

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
    expect(mockSavePatientContext).toHaveBeenCalledWith('new context');
  });

  it('shows error message when save fails', async () => {
    const user = userEvent.setup();
    mockSavePatientContext.mockRejectedValue(new Error('Network error'));
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => expect(mockGetPatientContext).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/patient context/i), 'new context');
    await user.click(screen.getByRole('button', { name: /save for next time/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });

  it('submit button is disabled when no files are selected', async () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    await waitFor(() => expect(mockGetPatientContext).toHaveBeenCalled());
    const analyzeBtn = screen.getByRole('button', { name: /analyze documents/i });
    expect(analyzeBtn).toBeDisabled();
  });

  it('shows analyzing state when isAnalyzing is true', () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={true} />);
    expect(screen.getByText(/analyzing documents/i)).toBeInTheDocument();
  });

  it('renders local-only privacy mode checkbox', () => {
    render(<FileUpload onAnalyze={mockOnAnalyze} isAnalyzing={false} />);
    expect(screen.getByLabelText(/local-only analysis/i)).toBeInTheDocument();
  });
});
