import Link from 'next/link';

const GITHUB_ISSUES_URL = 'https://github.com/fleXRPL/healthweave/issues';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 max-w-2xl mx-auto">
          <strong>For informational use only.</strong> Not a substitute for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers for medical decisions.
        </p>
        <p className="text-center text-sm text-gray-500 mb-4">
          © 2025 HealthWeave. This is a demonstration application.
        </p>
        <nav className="flex justify-center gap-6 text-sm" aria-label="Footer navigation">
          <Link href="/privacy" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded">
            Privacy
          </Link>
          <Link href="/terms" className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded">
            Terms
          </Link>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Contact / Feedback
          </a>
        </nav>
      </div>
    </footer>
  );
}
