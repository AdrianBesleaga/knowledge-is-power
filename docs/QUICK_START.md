# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] OpenAI API key
- [ ] Firebase project created
- [ ] Neo4j AuraDB instance created

## 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

## 2. Configure Environment Variables

### Backend (.env)
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `OPENAI_API_KEY` - From OpenAI Platform
- `NEO4J_URI`, `NEO4J_PASSWORD` - From Neo4j Aura
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - From Firebase

### Frontend (.env)
```bash
cd frontend
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `VITE_API_URL=http://localhost:3001`
- `VITE_FIREBASE_*` - From Firebase Console

## 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Wait for:
```
✅ Firebase initialized
✅ Neo4j initialized
🚀 Server running on port 3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 4. Test It Out

1. Open browser to `http://localhost:5173`
2. Enter a topic: "Bitcoin price today"
3. Wait 10-30 seconds for generation
4. Explore the knowledge graph!

## Common Issues

**"Failed to initialize Firebase"**
→ Check FIREBASE_PRIVATE_KEY format (must include \n characters)

**"Failed to initialize Neo4j"**
→ Verify NEO4J_URI starts with `neo4j+s://`

**"OpenAI API error"**
→ Verify API key and billing setup

## Need More Help?

- Detailed setup: See `docs/SETUP.md`
- Deployment: See `docs/DEPLOYMENT.md`
- Architecture: See `docs/PROJECT_SUMMARY.md`

## Quick Commands Reference

```bash
# Backend
npm run dev          # Development mode with hot reload
npm run build        # Build for production
npm start            # Run production build

# Frontend
npm run dev          # Development mode
npm run build        # Build for production
npm run preview      # Preview production build
```

## What's Next?

1. Create an account (click Sign In)
2. Generate and save your first graph
3. Share it with the generated URL
4. Check your profile to see saved graphs

Ready to deploy? Check out `docs/DEPLOYMENT.md`!
