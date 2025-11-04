'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onAnalyze: (files: File[], patientContext: string) => Promise<void>;
  isAnalyzing: boolean;
}

export default function FileUpload({ onAnalyze, isAnalyzing }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [patientContext, setPatientContext] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length > 0) {
      await onAnalyze(files, patientContext);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Context */}
      <div>
        <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-2">
          Patient Context (Optional)
        </label>
        <textarea
          id="context"
          rows={3}
          className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
          placeholder="E.g., Recently diagnosed with CLL, experiencing fatigue, scheduled for follow-up..."
          value={patientContext}
          onChange={(e) => setPatientContext(e.target.value)}
          disabled={isAnalyzing}
        />
        <p className="mt-1 text-sm text-gray-500">
          Provide any relevant context to help our AI understand your situation better
        </p>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Medical Documents *
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-blue-50'
              : 'border-gray-300 hover:border-primary hover:bg-gray-50'
          } ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} disabled={isAnalyzing} />
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive ? (
              <span className="font-medium text-primary">Drop files here...</span>
            ) : (
              <>
                <span className="font-medium text-primary">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PDF, JPG, PNG, TXT up to 10MB each
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Uploaded Files ({files.length})
          </h3>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <svg
                    className="flex-shrink-0 h-5 w-5 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={isAnalyzing}
                  className="ml-4 flex-shrink-0 text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={files.length === 0 || isAnalyzing}
          className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing Documents...
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Analyze Documents
            </>
          )}
        </button>
      </div>
    </form>
  );
}
