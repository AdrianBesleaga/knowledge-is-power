# Knowledge is Power

A visual knowledge graph application that helps users understand complex topics by analyzing and visualizing relationships between different information sources.

## Features

- 🧠 AI-powered knowledge graph generation using OpenAI
- 📊 Interactive graph visualization with React Flow
- 🔐 Firebase Authentication (view free, save requires account)
- 🔗 Shareable SEO-friendly URLs
- 💾 Neo4j graph database for efficient relationship queries
- 🎨 Modern, responsive UI

## Architecture

- **Frontend**: React + TypeScript + Vite + React Flow
- **Backend**: Node.js + Express + TypeScript
- **Database**: Neo4j AuraDB (graph database)
- **Authentication**: Firebase Auth
- **AI**: OpenAI API

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Firebase project (for authentication)
- Neo4j AuraDB instance

### Installation

1. Clone the repository
2. Set up backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run dev
   ```

3. Set up frontend:
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run dev
   ```

### Environment Variables

See `.env.example` files in both `backend/` and `frontend/` directories.

## Usage

1. Visit the homepage
2. Enter a topic (e.g., "Bitcoin price today")
3. View the generated knowledge graph
4. Click on nodes to see detailed information
5. Sign in to save and share graphs

## Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** - Get up and running in 5 minutes
- **[Setup Guide](docs/SETUP.md)** - Detailed local setup instructions
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[OpenAI Setup](docs/OPENAI_SETUP.md)** - OpenAI API configuration and troubleshooting
- **[Project Summary](docs/PROJECT_SUMMARY.md)** - Complete technical documentation

## License

MIT

