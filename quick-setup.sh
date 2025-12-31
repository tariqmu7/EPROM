#!/bin/bash

# Idea Bank - Quick Start Script
# Run this in your EPROM directory

echo "🏦 Idea Bank - Setup Script"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if MongoDB is available
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found in PATH. You can:"
    echo "   1. Install MongoDB locally, or"
    echo "   2. Use MongoDB Atlas (cloud)"
    echo "   Update MONGODB_URI in server/.env accordingly"
    echo ""
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server
npm install
if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
cd ..
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo ""

# Create .env files if they don't exist
if [ ! -f "server/.env" ]; then
    echo "⚙️  Creating server/.env..."
    cat > server/.env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/idea-bank
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
NODE_ENV=development
EOF
    echo "✅ Created server/.env"
    echo "   ⚠️  Remember to change JWT_SECRET for production"
fi
echo ""

if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env..."
    cat > .env << 'EOF'
VITE_API_URL=http://localhost:5000/api
EOF
    echo "✅ Created .env"
fi
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1️⃣  Start MongoDB: mongod (in another terminal)"
echo "2️⃣  Start Backend: cd server && npm run dev"
echo "3️⃣  Start Frontend: npm run dev"
echo "4️⃣  Open: http://localhost:5173"
echo ""
echo "📚 For more details, see:"
echo "   - SETUP_GUIDE.md"
echo "   - README.md"
echo "   - PROJECT_SUMMARY.md"
echo "   - ARCHITECTURE_DIAGRAMS.md"
echo ""
