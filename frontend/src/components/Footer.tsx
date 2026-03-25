import Link from 'next/link';

const GITHUB_ISSUES_URL = 'https://github.com/fleXRPL/healthweave/issues';

export default function Footer() {
  return (
    <footer
      className="mt-16"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-0)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Disclaimer */}
        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 text-xs max-w-2xl mx-auto"
          style={{
            background: 'rgba(180,133,9,0.06)',
            border: '1px solid rgba(180,133,9,0.18)',
            color: '#92600a',
          }}
        >
          <svg className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>For informational use only.</strong> Not a substitute for professional medical advice,
            diagnosis, or treatment. Always consult qualified healthcare providers for medical decisions.
          </span>
        </div>

        {/* Copyright + nav */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            © 2025 HealthWeave · Demonstration application
          </p>
          <nav className="flex justify-center gap-5 text-xs" aria-label="Footer navigation">
            {[
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms',   label: 'Terms' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors"
                style={{ color: 'var(--hw-navy)' }}
              >
                {label}
              </Link>
            ))}
            <a
              href={GITHUB_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--hw-navy)' }}
              className="transition-colors"
            >
              Feedback
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
