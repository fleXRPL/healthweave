import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">About HealthWeave</h2>

        <section className="mb-10">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">What is HealthWeave?</h3>
          <p className="text-gray-600 mb-4">
            HealthWeave is an AI-powered tool that helps you make sense of your health documents. 
            Upload medical records, lab results, and clinical notes from multiple providers; 
            HealthWeave analyzes them and produces a single, readable synthesis with key findings, 
            recommendations, and questions you might want to ask your doctor.
          </p>
          <p className="text-gray-600">
            It is designed for personal use to organize and understand your own health story—not 
            as a replacement for your care team. Always rely on qualified healthcare providers 
            for medical advice and decisions.
          </p>
        </section>

        <section className="mb-10">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">How it works</h3>
          <ol className="list-decimal list-inside space-y-4 text-gray-600">
            <li>
              <strong className="text-gray-900">Upload</strong> — Add one or more health documents 
              (PDF, images, or text). You can include lab results, visit summaries, imaging reports, 
              or other records you have.
            </li>
            <li>
              <strong className="text-gray-900">Analyze</strong> — Our AI reads and analyzes your 
              documents, identifying important results, trends, and connections across your records.
            </li>
            <li>
              <strong className="text-gray-900">Report</strong> — You receive a synthesized report 
              with a summary, key findings, recommendations, and suggested questions for your doctor. 
              You can view it in the app or download it as a PDF and keep it in your Past Reports.
            </li>
          </ol>
        </section>

        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          For informational use only. Not a substitute for professional medical advice, diagnosis, 
          or treatment. Always consult qualified healthcare providers for medical decisions.
        </p>
      </main>
      <Footer />
    </div>
  );
}
