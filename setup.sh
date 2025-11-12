#!/bin/bash

echo "========================================="
echo "  HealthWeave Setup Script"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "✓ Node.js $(node --version) found"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
echo "✓ Docker found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
echo "✓ Docker Compose found"

echo ""
echo "========================================="
echo "  Step 1: Starting LocalStack"
echo "========================================="
echo ""

docker-compose up -d
if [ $? -eq 0 ]; then
    echo "✓ LocalStack started successfully"
else
    echo "❌ Failed to start LocalStack"
    exit 1
fi

echo ""
echo "Waiting for LocalStack to be ready (this may take a minute)..."
sleep 10

echo ""
echo "========================================="
echo "  Step 2: Setting up Backend"
echo "========================================="
echo ""

cd backend
echo "Installing backend dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✓ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

echo ""
echo "========================================="
echo "  Step 3: Setting up Frontend"
echo "========================================="
echo ""

cd frontend
echo "Installing frontend dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✓ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

cd ..

echo ""
echo "========================================="
echo "  ✓ Setup Complete!"
echo "========================================="
echo ""
echo "To start development:"
echo ""
echo "1. Backend (Terminal 1):"
echo "   cd backend && npm run dev"
echo ""
echo "2. Frontend (Terminal 2):"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "LocalStack Dashboard:"
echo "   http://localhost:4566"
echo ""
echo "For more information, see docs/DEVELOPMENT.md"
echo ""
