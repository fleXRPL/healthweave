# HealthWeave - Quick Start Guide

Welcome to HealthWeave! This guide will get you up and running in under 5 minutes.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Docker Desktop ([Download](https://www.docker.com/products/docker-desktop))
- Any terminal/command prompt

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./setup.sh

# Then start the servers (in separate terminals):
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

### Option 2: Manual Setup

```bash
# 1. Start LocalStack
docker-compose up -d

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Start backend (Terminal 1)
cd backend
npm run dev

# 5. Start frontend (Terminal 2)
cd frontend
npm run dev
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **LocalStack**: http://localhost:4566

## 🧪 Test It Out

1. Go to http://localhost:3000
2. Upload a test medical document (PDF, image, or text file)
3. Add optional patient context
4. Click "Analyze Documents"
5. View the AI-generated analysis
6. Download the PDF report

## 📁 Project Structure

```
healthweave/
├── backend/          # Node.js + Express API
├── frontend/         # Next.js React app
├── docker-compose.yml # LocalStack configuration
├── setup.sh          # Automated setup script
└── docs/             # Documentation
```

## 🔧 Key Technologies

- **Backend**: Node.js, Express, TypeScript, AWS SDK
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **AI**: AWS Bedrock (Claude in production, Mistral locally)
- **Storage**: S3 (LocalStack), DynamoDB
- **Development**: LocalStack for AWS emulation

## 📖 Documentation

- **Full Development Guide**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- **Architecture Overview**: [README.md](README.md)

## 🐛 Troubleshooting

### LocalStack won't start
```bash
# Check Docker is running
docker ps

# Restart LocalStack
docker-compose down
docker-compose up -d
```

### Backend errors
```bash
# Check LocalStack is running
docker-compose ps

# View LocalStack logs
docker-compose logs -f localstack

# Restart backend
cd backend && npm run dev
```

### Frontend errors
```bash
# Verify backend is running
curl http://localhost:4000/health

# Check environment variables
cat frontend/.env.local
```

## 🎯 What's Next?

1. **Explore the Code**
   - Backend services in `backend/src/services/`
   - React components in `frontend/src/components/`

2. **Customize**
   - Update logo in `frontend/src/components/Logo.tsx`
   - Modify AI prompts in `backend/src/services/bedrock.ts`
   - Adjust styling in `frontend/src/app/globals.css`

3. **Deploy to Production**
   - See deployment guide for AWS setup
   - Configure real Bedrock with Claude
   - Set up HIPAA-compliant infrastructure

## 💡 Tips

- **First Run**: LocalStack downloads the Mistral model on first start (takes 5-10 minutes)
- **Development**: Changes auto-reload in both backend and frontend
- **Testing**: Use sample medical documents from the web or create your own
- **Logs**: Check terminal output for debugging

## 🤝 Need Help?

1. Check [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed information
2. Review terminal logs for error messages
3. Verify all services are running: `docker-compose ps`

## 🎉 You're Ready!

Open http://localhost:3000 and start analyzing health documents with AI!

---

Built with ❤️ for better healthcare outcomes
