# HealthWeave Privacy

*Last updated: 2025*

## Overview

HealthWeave is a demonstration application that processes health-related documents you upload to generate synthesized reports. This page describes how we handle data in the context of this application.

## Data You Provide

- **Documents**: Files you upload (e.g., PDFs, images, text) are sent to the application backend for analysis. They may be processed by an AI service (cloud or local, depending on configuration).
- **Optional context**: You may provide brief patient context (e.g., reason for the upload) to improve the analysis. This is stored only as configured by the deployment.

## How Data Is Used

- Uploaded documents and any context are used solely to generate your analysis report.
- Reports may be stored so you can view or download them later (e.g., in “Past Reports”).
- We do not use your data for advertising or selling to third parties.

## Storage and Retention

- Report data may be stored in the application’s database (e.g., DynamoDB or equivalent) for the duration of the deployment.
- You can delete individual reports from the Past Reports page when that feature is available.
- Actual retention and backup policies depend on the environment where HealthWeave is run (e.g., your own infrastructure or a hosted demo).

## Local and Cloud Modes

- In **local-only** mode, documents may be processed entirely on your machine (e.g., via a local AI model). No health data need be sent to external services.
- In **cloud** mode, documents may be sent to supported cloud AI services. Data handling then follows those providers’ policies as well as this application’s configuration.

## Security

- The application uses standard security practices (e.g., HTTPS, secure headers). Specific safeguards depend on the deployment environment.
- You are responsible for using the application in a secure environment and not uploading documents through untrusted networks or devices if you are concerned about privacy.

## Third Parties

- If cloud AI or storage services are used, their respective privacy and data processing policies apply to the data they process or store.
- We do not sell or share your personal health information with third parties for marketing.

## Changes

- We may update this privacy description from time to time. The “Last updated” date at the top will be revised when we do. Continued use of the application after changes constitutes acceptance of the updated description where applicable.

## Contact

- For questions or feedback about privacy, please open an issue or contact the project maintainers via the repository: [GitHub Issues](https://github.com/fleXRPL/healthweave/issues).

---

*This is a demonstration application. It is not a certified medical or health product. Always consider the sensitivity of your health data and use the application in accordance with your own privacy and security requirements.*
