'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';

const navButtonClass =
  'inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary';

interface HeaderProps {
  /** When true, Past Reports is a toggle button; when false, it links to home */
  readonly pastReportsAsToggle?: boolean;
  readonly onPastReportsClick?: () => void;
}

export default function Header({ pastReportsAsToggle, onPastReportsClick }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/"
            className="flex items-center space-x-4 text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-lg"
            aria-label="Home"
            title="Home"
          >
            <Logo size="md" />
            <div>
              <h1 className="text-2xl font-bold text-primary">HealthWeave</h1>
              <p className="text-sm text-accent">Synthesizing Your Health Story</p>
            </div>
          </Link>
          <nav className="flex items-center gap-3 flex-wrap" aria-label="Main navigation">
            <Link href="/" className={navButtonClass}>
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New Analysis
            </Link>
            {pastReportsAsToggle && typeof onPastReportsClick === 'function' ? (
              <button type="button" onClick={onPastReportsClick} className={navButtonClass}>
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Past Reports
              </button>
            ) : (
              <Link href="/" className={navButtonClass}>
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Past Reports
              </Link>
            )}
            <Link href="/about" className={navButtonClass}>
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
