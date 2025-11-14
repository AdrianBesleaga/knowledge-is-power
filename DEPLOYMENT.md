# Deployment Guide

This guide covers deploying your Knowledge is Power application to production.

## Overview

**Recommended Stack:**
- Frontend: Vercel (free tier available)
- Backend: Railway or Render (free tier available)
- Database: Neo4j AuraDB (free tier available)
- Auth: Firebase (free tier available)

## Part 1: Deploy Backend

### Option A: Railway (Recommended)

1. **Sign up at [Railway.app](https://railway.app/)**

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Select the repository

3. **Configure Service**
   - Set root directory to `backend`
   - Railway will auto-detect Node.js

4. **Add Environment Variables**
   Go to Variables tab and add:
   ```
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   OPENAI_API_KEY=your-key
   NEO4J_URI=your-neo4j-uri
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-email
   FIREBASE_PRIVATE_KEY=your-private-key
   ```

5. **Deploy**
   - Railway will automatically deploy
   - Note your backend URL (e.g., `https://your-app.railway.app`)

### Option B: Render

1. **Sign up at [Render.com](https://render.com/)**

2. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure Service**
   - Name: `knowledge-is-power-backend`
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Add Environment Variables**
   Add all variables from Railway option above

5. **Create Service**
   - Note your backend URL

## Part 2: Deploy Frontend

### Vercel (Recommended)

1. **Sign up at [Vercel.com](https://vercel.com/)**

2. **Import Project**
   - Click "Add New..." → "Project"
   - Import your Git repository

3. **Configure Project**
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Environment Variables**
   Add these variables:
   ```
   VITE_API_URL=https://your-backend.railway.app
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

5. **Deploy**
   - Click "Deploy"
   - Note your frontend URL (e.g., `https://knowledge-is-power.vercel.app`)

6. **Update Backend**
   - Go back to Railway/Render
   - Update `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy backend

## Part 3: Configure Firebase for Production

1. **Add Authorized Domains**
   - Go to Firebase Console → Authentication → Settings
   - Add your Vercel domain to "Authorized domains"

2. **Update OAuth Redirect URIs** (if using Google Sign-In)
   - Go to Google Cloud Console
   - Add your Vercel domain to authorized redirect URIs

## Part 4: Configure Neo4j for Production

Your Neo4j AuraDB instance works the same in production. Just ensure:
1. The connection URI is accessible from your backend
2. Credentials are properly set in environment variables
3. Consider upgrading from free tier if you need more capacity

## Part 5: Set Up Custom Domain (Optional)

### For Vercel (Frontend)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### For Railway (Backend)
1. Go to Settings → Networking
2. Add custom domain
3. Configure DNS records

### Update Environment Variables
After setting up custom domains:
1. Update `VITE_API_URL` in Vercel to use custom backend domain
2. Update `FRONTEND_URL` in Railway to use custom frontend domain
3. Update Firebase authorized domains

## Part 6: Monitoring & Optimization

### Backend Monitoring
- Railway/Render provides basic metrics
- Add logging service like LogTail or Papertrail
- Monitor OpenAI API usage and costs

### Frontend Monitoring
- Vercel Analytics (built-in)
- Add error tracking (Sentry)
- Monitor Core Web Vitals

### Database Monitoring
- Neo4j Aura Console provides metrics
- Monitor query performance
- Set up alerts for capacity

## Environment Variable Checklist

### Backend (.env)
- [ ] PORT
- [ ] NODE_ENV
- [ ] FRONTEND_URL (use production domain)
- [ ] OPENAI_API_KEY
- [ ] NEO4J_URI
- [ ] NEO4J_USER
- [ ] NEO4J_PASSWORD
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_PRIVATE_KEY

### Frontend (.env)
- [ ] VITE_API_URL (use production backend domain)
- [ ] VITE_FIREBASE_API_KEY
- [ ] VITE_FIREBASE_AUTH_DOMAIN
- [ ] VITE_FIREBASE_PROJECT_ID
- [ ] VITE_FIREBASE_STORAGE_BUCKET
- [ ] VITE_FIREBASE_MESSAGING_SENDER_ID
- [ ] VITE_FIREBASE_APP_ID

## Security Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Use environment variables** - Always use env vars for secrets
3. **Enable CORS properly** - Only allow your frontend domain
4. **Rate limiting** - Consider adding rate limiting to prevent abuse
5. **HTTPS only** - Both platforms provide HTTPS by default
6. **Firebase Security Rules** - Set up proper rules for your use case

## Cost Optimization

### Free Tier Limits
- **Railway**: 500 hours/month, $5 credit
- **Vercel**: 100 GB bandwidth, unlimited requests
- **Neo4j AuraDB Free**: 200k nodes, 400k relationships
- **Firebase**: 10k auth/month, 50k document reads/day
- **OpenAI**: Pay per use (~$0.01-0.05 per graph)

### Tips to Reduce Costs
1. Cache frequently requested topics
2. Limit number of graph generations per user
3. Optimize OpenAI prompts for shorter responses
4. Use Neo4j efficiently (avoid duplicate nodes)
5. Consider upgrading selectively based on usage

## Troubleshooting Production Issues

### CORS Errors
- Check `FRONTEND_URL` matches exactly (no trailing slash)
- Verify CORS middleware in backend

### Firebase Auth Errors
- Ensure domain is authorized in Firebase Console
- Check that API keys are for web platform

### Neo4j Connection Issues
- Verify URI format: `neo4j+s://...`
- Check firewall/network settings
- Ensure credentials are correct

### OpenAI API Errors
- Check API key is valid
- Verify billing is set up
- Monitor rate limits

## CI/CD Setup (Optional)

### Vercel
- Auto-deploys on push to main branch
- Preview deployments for PRs
- No additional setup needed

### Railway
- Auto-deploys on push to main branch
- Can configure deployment triggers

### GitHub Actions (Advanced)
You can set up GitHub Actions for:
- Running tests before deployment
- Building and deploying manually
- Running migrations

## Post-Deployment Checklist

- [ ] Frontend is accessible at production URL
- [ ] Backend health check responds (`/health`)
- [ ] Can create new knowledge graphs
- [ ] Firebase authentication works
- [ ] Graphs are saved to Neo4j
- [ ] Sharing URLs work correctly
- [ ] All environment variables are set
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring is set up
- [ ] SSL certificates are valid

## Scaling Considerations

When your app grows:

1. **Backend**: Upgrade Railway/Render plan for more resources
2. **Database**: Upgrade Neo4j to a paid tier
3. **Caching**: Add Redis for caching frequent queries
4. **CDN**: Vercel provides CDN by default
5. **Load Balancing**: Consider multiple backend instances

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Neo4j Aura Docs**: https://neo4j.com/docs/aura/
- **Firebase Docs**: https://firebase.google.com/docs

Good luck with your deployment! 🚀

