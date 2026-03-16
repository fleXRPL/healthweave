import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy - HealthWeave',
  description: 'How HealthWeave handles your data and privacy.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Privacy</h2>
        <p className="text-sm text-gray-500 mb-8">Last updated: 2025</p>

        <section className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Overview</h3>
            <p>
              HealthWeave is a demonstration application that processes health-related documents you upload to generate synthesized reports. This page describes how we handle data in the context of this application.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Data You Provide</h3>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Documents:</strong> Files you upload (e.g., PDFs, images, text) are sent to the application backend for analysis. They may be processed by an AI service (cloud or local, depending on configuration).</li>
              <li><strong>Optional context:</strong> You may provide brief patient context to improve the analysis. This is stored only as configured by the deployment.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">How Data Is Used</h3>
            <p>
              Uploaded documents and any context are used solely to generate your analysis report. Reports may be stored so you can view or download them later (e.g., in Past Reports). We do not use your data for advertising or selling to third parties.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Storage and Retention</h3>
            <p>
              Report data may be stored in the application’s database for the duration of the deployment. You can delete individual reports from the Past Reports page. Actual retention and backup policies depend on the environment where HealthWeave is run.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Local and Cloud Modes</h3>
            <p>
              In <strong>local-only</strong> mode, documents may be processed entirely on your machine. No health data need be sent to external services. In <strong>cloud</strong> mode, documents may be sent to supported cloud AI services; data handling then follows those providers’ policies as well as this application’s configuration.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Security</h3>
            <p>
              The application uses standard security practices (e.g., HTTPS, secure headers). You are responsible for using the application in a secure environment and not uploading documents through untrusted networks or devices if you are concerned about privacy.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Third Parties</h3>
            <p>
              If cloud AI or storage services are used, their respective privacy and data processing policies apply. We do not sell or share your personal health information with third parties for marketing.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Changes</h3>
            <p>
              We may update this privacy description from time to time. The “Last updated” date at the top will be revised when we do.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Contact</h3>
            <p>
              For questions or feedback about privacy, please open an issue or contact the project maintainers via the repository:{' '}
              <a href="https://github.com/fleXRPL/healthweave/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub Issues</a>.
            </p>
          </section>
        </section>

        <p className="mt-8 text-sm text-gray-500 border-t border-gray-200 pt-6">
          The canonical version of this document is maintained in the repository as <code className="bg-gray-100 px-1 rounded">docs/PRIVACY.md</code>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
