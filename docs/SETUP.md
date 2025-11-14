# Knowledge is Power - Setup Guide

This guide will help you set up and run the Knowledge is Power application locally.

## Prerequisites

Before you begin, make sure you have:

1. **Node.js 18+** and npm installed
2. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/)
3. **Firebase Project** - Create one at [Firebase Console](https://console.firebase.google.com/)
4. **Neo4j AuraDB Instance** - Create a free instance at [Neo4j Aura](https://neo4j.com/cloud/aura/)

## Step 1: Install Dependencies

### Backend Setup
```bash
cd backend
npm install
```

### Frontend Setup
```bash
cd frontend
npm install
```

## Step 2: Configure Firebase

### 2.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the wizard
3. Once created, go to Project Settings

### 2.2 Enable Firebase Authentication
1. In Firebase Console, go to "Authentication" → "Get Started"
2. Enable "Email/Password" provider
3. Enable "Google" provider (optional but recommended)

### 2.3 Get Firebase Credentials

**For Frontend:**
1. In Project Settings, scroll to "Your apps"
2. Click "Web" (</>) to add a web app
3. Copy the firebaseConfig values

**For Backend:**
1. In Project Settings, go to "Service Accounts" tab
2. Click "Generate new private key"
3. Save the JSON file securely

## Step 3: Configure Neo4j AuraDB

1. Go to [Neo4j Aura](https://neo4j.com/cloud/aura/)
2. Sign up/Sign in and create a free instance
3. Choose "AuraDB Free"
4. Save the connection URI, username, and password
5. Download the credentials (you'll need them for .env)

## Step 4: Set Up Environment Variables

### Backend Environment Variables

Create `backend/.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# OpenAI API
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Neo4j Database
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-actual-private-key-content-here\n-----END PRIVATE KEY-----\n"
```

**Important Notes:**
- Replace all placeholder values with your actual credentials
- For `FIREBASE_PRIVATE_KEY`, copy the entire private key from your service account JSON file
- Keep the double quotes around the private key
- Ensure `\n` characters are preserved in the private key

### Frontend Environment Variables

Create `frontend/.env` file:

```env
# API Configuration
VITE_API_URL=http://localhost:3001

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

## Step 5: Run the Application

### Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:3001`

You should see:
```
✅ Firebase initialized
✅ Neo4j initialized
🚀 Server running on port 3001
```

### Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

The frontend should start on `http://localhost:5173`

## Step 6: Test the Application

1. Open your browser to `http://localhost:5173`
2. Enter a topic like "Bitcoin price today" or "Climate change impact"
3. Wait 10-30 seconds for the AI to generate the knowledge graph
4. Click on nodes to see detailed information
5. Sign up/Sign in to save graphs

## Troubleshooting

### Backend Issues

**Error: "Failed to initialize Firebase"**
- Check that your `FIREBASE_PRIVATE_KEY` is properly formatted
- Ensure the service account JSON is from the correct project
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project

**Error: "Failed to initialize Neo4j"**
- Verify `NEO4J_URI` is correct (should start with `neo4j+s://`)
- Check that your Neo4j instance is running
- Confirm username and password are correct

**Error: "OpenAI API error"**
- Verify your `OPENAI_API_KEY` is valid
- Check that you have credits/billing set up in OpenAI
- Ensure the API key has the correct permissions

### Frontend Issues

**Firebase Auth not working**
- Check that Authentication is enabled in Firebase Console
- Verify all `VITE_FIREBASE_*` variables are correct
- Make sure you're using the web app config (not Android/iOS)

**CORS errors**
- Ensure backend is running on port 3001
- Check that `FRONTEND_URL` in backend .env is `http://localhost:5173`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  - Search & generate graphs                                  │
│  - Interactive visualization (React Flow)                    │
│  - Firebase Auth for users                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTP/REST API
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                      Backend (Express)                       │
│  - Graph generation API                                      │
│  - OpenAI integration                                        │
│  - Firebase Auth verification                                │
└──────────┬─────────────────────────┬────────────────────────┘
           │                         │
           │                         │
┌──────────▼──────────┐   ┌─────────▼──────────┐
│   Neo4j AuraDB      │   │   Firebase Auth    │
│  (Graph Database)   │   │  (Authentication)  │
│  - Nodes & edges    │   │  - User accounts   │
│  - Relationships    │   │  - Tokens          │
└─────────────────────┘   └────────────────────┘
```

## Next Steps

1. **Customize the AI prompts** in `backend/src/services/aiService.ts`
2. **Adjust graph layout** in `frontend/src/components/KnowledgeGraph.tsx`
3. **Add more data sources** by enhancing the OpenAI prompts
4. **Deploy to production** (see deployment guides for Vercel, Railway, etc.)

## Cost Considerations

- **Neo4j AuraDB Free**: Limited to 200k nodes/400k relationships (sufficient for starting)
- **Firebase**: Free tier includes 10k authentications/month
- **OpenAI API**: Each graph generation costs ~$0.01-0.05 depending on complexity

## Support

If you encounter issues:
1. Check the console logs in both frontend and backend
2. Verify all environment variables are set correctly
3. Ensure all services (Firebase, Neo4j, OpenAI) are accessible
4. Check that you're using compatible Node.js version (18+)

