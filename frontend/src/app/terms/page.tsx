import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms of Use - HealthWeave',
  description: 'Terms of use for HealthWeave.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Terms of Use</h2>
        <p className="text-sm text-gray-500 mb-8">Last updated: 2025</p>

        <section className="prose prose-gray max-w-none space-y-6 text-gray-600">
          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Acceptance</h3>
            <p>
              By using HealthWeave, you agree to these terms. If you do not agree, do not use the application.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nature of the Service</h3>
            <p>
              HealthWeave is a <strong>demonstration application</strong> that uses AI to analyze health-related documents you upload and to generate synthesized reports. It is provided for informational and educational purposes only. It is <strong>not</strong> a medical device, clinical decision support system, or substitute for professional medical advice, diagnosis, or treatment.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Medical Advice</h3>
            <p>
              <strong>Always seek the advice of qualified healthcare providers</strong> with any questions you have about a medical condition, treatment, or health decisions. Do not rely on HealthWeave output for diagnosis, treatment, or any clinical decision. Reports are for your personal reference only.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Responsibilities</h3>
            <p>
              You are responsible for the documents you upload and for ensuring you have the right to use and process them. You must use the application in compliance with applicable laws, including those governing health information (e.g., HIPAA or local equivalents) if you are subject to them. You must not use HealthWeave for any illegal or unauthorized purpose.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Data and Privacy</h3>
            <p>
              Your use of the application may involve uploading sensitive health information. How that data is processed and stored is described in our <Link href="/privacy" className="text-primary hover:underline">Privacy</Link> documentation. By uploading documents, you acknowledge that they may be processed by the application and any configured AI or storage services as described in the documentation and deployment configuration.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Availability and Changes</h3>
            <p>
              The application may be modified, suspended, or discontinued at any time. We do not guarantee availability or specific features. We may update these terms; continued use after changes constitutes acceptance of the updated terms where applicable.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Disclaimer of Warranties</h3>
            <p>
              HealthWeave is provided <strong>“as is.”</strong> We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not warrant that the application will be error-free, secure, or suitable for your specific use case.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Limitation of Liability</h3>
            <p>
              To the fullest extent permitted by law, the project and its contributors are not liable for any direct, indirect, incidental, special, or consequential damages arising from your use or inability to use HealthWeave, including any reliance on its output for health or medical decisions.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Open Source and Attribution</h3>
            <p>
              HealthWeave may be made available under an open source license. Your use may be subject to that license in addition to these terms. Attribution and license terms can be found in the project repository.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Contact</h3>
            <p>
              For questions about these terms or the application, please use{' '}
              <a href="https://github.com/fleXRPL/healthweave/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub Issues</a> or contact the project maintainers through the repository.
            </p>
          </section>
        </section>

        <p className="mt-8 text-sm text-gray-500 border-t border-gray-200 pt-6">
          The canonical version of this document is maintained in the repository as <code className="bg-gray-100 px-1 rounded">docs/TERMS.md</code>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
