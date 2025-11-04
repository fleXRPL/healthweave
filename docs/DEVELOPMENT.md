# HealthWeave Development Guide

## Overview

HealthWeave is a HIPAA-compliant healthcare application that uses AWS Bedrock (Claude) to analyze patient health documents and generate clinical insights.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│                                                              │
│  - File Upload Interface                                     │
│  - Analysis Results Display                                  │
│  - PDF Report Download                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                   Backend API (Node.js + Express)            │
│                                                              │
│  - Document Upload Handler                                   │
│  - Analysis Orchestration                                    │
│  - Report Generation                                         │
│  - Audit Logging                                             │
└──────┬────────┬────────┬────────┬────────┬─────────────────┘
       │        │        │        │        │
       │        │        │        │        │
       ▼        ▼        ▼        ▼        ▼
    ┌──────┐┌──────┐┌────────┐┌────────┐┌──────┐
    │  S3  ││Bedrock││DynamoDB││Cognito││ Logs │
    │      ││(Claude)││        ││        ││      │
    └──────┘└──────┘└────────┘└────────┘└──────┘
```

## Local Development Setup

### Prerequisites

1. **Node.js 18+** and npm
2. **Docker** and Docker Compose
3. **Git**

### Step 1: Start LocalStack

LocalStack emulates AWS services locally, including Bedrock with Ollama models.

```bash
# Start LocalStack
docker-compose up -d

# Check LocalStack is running
docker-compose ps

# View LocalStack logs
docker-compose logs -f localstack
```

LocalStack will:
- Start on `http://localhost:4566`
- Pull the Mistral model from Ollama (this may take a few minutes on first run)
- Create S3 buckets and DynamoDB tables automatically

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend will start on `http://localhost:4000`

**Backend Services:**
- ✅ Express API server
- ✅ AWS SDK configured for LocalStack
- ✅ Bedrock integration (using Mistral locally)
- ✅ S3 file storage
- ✅ DynamoDB for reports and audit logs
- ✅ Automatic table/bucket creation

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:3000`

**Frontend Features:**
- ✅ Next.js 15 with App Router
- ✅ Tailwind CSS styling
- ✅ File upload with drag-and-drop
- ✅ Real-time analysis progress
- ✅ Beautiful results display
- ✅ PDF report download

### Step 4: Test the Application

1. Open `http://localhost:3000` in your browser
2. Upload test medical documents (PDF, images, or text files)
3. Add optional patient context
4. Click "Analyze Documents"
5. View the AI-generated analysis
6. Download the PDF report

## Development vs Production

### Development (LocalStack)

- ✅ **Free** - No AWS costs
- ✅ **Fast** - Everything runs locally
- ✅ **Offline** - Works without internet
- ⚠️ **Different AI** - Uses Mistral instead of Claude
- ⚠️ **Not HIPAA** - For development only

**Configuration:**
```env
AWS_ENDPOINT=http://localhost:4566
BEDROCK_MODEL_ID=mistral
```

### Production (AWS)

- ✅ **Claude 4** - Production-grade AI
- ✅ **HIPAA Compliant** - With BAA
- ✅ **Scalable** - Auto-scaling infrastructure
- ⚠️ **Costs Money** - Pay for AWS usage
- ⚠️ **Requires Setup** - AWS account and BAA

**Configuration:**
```env
AWS_ENDPOINT=  # Leave empty for real AWS
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
# Plus: Real Cognito, real credentials, etc.
```

## Project Structure

```
healthweave/
├── backend/
│   ├── src/
│   │   ├── handlers/          # API request handlers
│   │   │   └── analysis.ts    # Document analysis endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── bedrock.ts     # AWS Bedrock/Claude integration
│   │   │   ├── storage.ts     # S3 file operations
│   │   │   ├── audit.ts       # Audit logging (HIPAA compliance)
│   │   │   └── report.ts      # Report management & PDF generation
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/             # Utilities
│   │   │   ├── config.ts      # Configuration loader
│   │   │   └── logger.ts      # Winston logger
│   │   ├── types/             # TypeScript types
│   │   └── index.ts           # Main Express app
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.development
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js app directory
│   │   │   ├── layout.tsx     # Root layout
│   │   │   ├── page.tsx       # Home page
│   │   │   └── globals.css    # Global styles
│   │   ├── components/        # React components
│   │   │   ├── Logo.tsx       # HealthWeave logo
│   │   │   ├── FileUpload.tsx # File upload with drag-drop
│   │   │   └── AnalysisResults.tsx  # Display analysis
│   │   ├── lib/               # Utilities
│   │   │   └── api.ts         # Backend API client
│   │   └── types/             # TypeScript types
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── .env.local
├── docker-compose.yml         # LocalStack configuration
└── README.md                  # Project overview
```

## API Endpoints

### POST /api/analyze
Upload and analyze health documents

**Request:**
```
Content-Type: multipart/form-data

documents: File[]           # Medical documents (PDF, images, text)
patientContext: string      # Optional context about patient
userId: string              # User identifier
```

**Response:**
```json
{
  "success": true,
  "reportId": "uuid",
  "summary": "Executive summary of analysis",
  "keyFindings": ["Finding 1", "Finding 2"],
  "recommendations": ["Rec 1", "Rec 2"]
}
```

### GET /api/reports/:reportId
Retrieve a specific report

### GET /api/reports
List all reports for a user

### GET /api/reports/:reportId/pdf
Download report as PDF

### GET /health
Health check endpoint

## Environment Variables

### Backend (.env.development)

```env
# Server
NODE_ENV=development
PORT=4000
HOST=localhost

# AWS LocalStack
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
BEDROCK_MODEL_ID=mistral

# Storage
S3_BUCKET_NAME=healthweave-patient-data

# Database
DYNAMODB_TABLE_REPORTS=healthweave-reports
DYNAMODB_TABLE_AUDIT=healthweave-audit-logs

# Security
JWT_SECRET=dev-secret-key
ENCRYPTION_KEY=dev-encryption-key-32-chars!!

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Testing

### Manual Testing

1. **Upload Test Documents**
   - Create sample medical documents (lab results, doctor's notes)
   - Test with PDF, images, and text files
   - Verify file size limits (10MB max)

2. **Analysis Testing**
   - Test with single document
   - Test with multiple documents
   - Test with patient context
   - Test without patient context
   - Verify AI generates appropriate insights

3. **Report Testing**
   - Verify report displays correctly
   - Test PDF download
   - Check report persistence in DynamoDB

### Automated Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Common Issues

### LocalStack not starting
```bash
# Check Docker is running
docker ps

# Restart LocalStack
docker-compose down
docker-compose up -d
```

### Bedrock model download slow
The first time LocalStack starts, it downloads the Mistral model from Ollama. This can take 5-10 minutes. Check logs:
```bash
docker-compose logs -f localstack
```

### Backend can't connect to LocalStack
- Verify LocalStack is running: `docker-compose ps`
- Check AWS_ENDPOINT in .env.development
- Try restarting backend: `npm run dev`

### Frontend API errors
- Verify backend is running on port 4000
- Check NEXT_PUBLIC_API_URL in .env.local
- Check browser console for CORS errors

## Next Steps

1. **Add Authentication**
   - Implement Cognito integration
   - Add JWT middleware
   - Secure API endpoints

2. **Enhance Document Processing**
   - Add AWS Textract for better PDF/image text extraction
   - Support more document formats
   - Improve document parsing

3. **Production Deployment**
   - Set up AWS account
   - Request BAA from AWS Bedrock
   - Deploy to AWS with Terraform/CDK
   - Configure real Cognito, S3, DynamoDB

4. **HIPAA Compliance**
   - Complete security audit
   - Implement data encryption at rest
   - Set up audit log monitoring
   - Obtain SOC 2 / HITRUST certification

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/index.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Review this documentation
3. Check backend logs for errors
4. Verify all services are running

## License

Proprietary - All Rights Reserved
