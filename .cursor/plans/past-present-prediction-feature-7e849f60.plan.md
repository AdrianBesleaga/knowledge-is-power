<!-- 7e849f60-d1c1-4b0a-8732-342b56d5f11d b64415a1-2c20-49d4-a586-084d60f2446f -->
# Past-Present-Prediction Feature Implementation Plan

## Overview

Create a new page that allows users to research any topic with AI-powered analysis of past, present, and future predictions. The system will use AI models with web access (OpenAI with browsing tools + Perplexity API support) to gather real-time data and generate predictions with confidence scores.

## Database Setup

- **MongoDB** for timeline/prediction data (separate from Neo4j knowledge graph)
- Schema design for timeline entries, predictions, and value tracking
- Connection configuration in backend

## Backend Implementation

### 1. MongoDB Configuration

- Add MongoDB driver dependency (`mongodb` package)
- Create `backend/src/config/mongodb.ts` for connection management
- Environment variables for MongoDB URI

### 2. Timeline Data Models

- Create TypeScript types for:
- TimelineEntry (past/present data points with value, label, date, summary, sources)
- Prediction (future scenarios with timeline, summary, sources, confidence score)
- TimelineAnalysis (complete analysis with topic, valueLabel, past entries, present entry, predictions)

### 3. AI Service Enhancement

- Extend `aiService.ts` or create new `predictionService.ts`:
- Support OpenAI with web browsing tools (function calling)
- Add Perplexity API integration as alternative/fallback
- Methods for:
  - Researching past data (up to 10 years back)
  - Researching present state
  - Generating predictions for fixed intervals (1m, 1y, 2y, 3y, 4y, 5y, 6y, 7y, 8y, 9y, 10y)
  - Auto-detecting value label (e.g., "price", "population")
  - Generating minimum 3 scenarios per timeline interval

### 4. Timeline Service

- Create `backend/src/services/timelineService.ts`:
- Save timeline analysis to MongoDB
- Retrieve timeline by topic/slug
- Update timeline entries
- Query historical data points

### 5. API Routes

- Create `backend/src/routes/timeline.ts`:
- `POST /api/timeline/generate` - Generate timeline analysis for a topic
- `GET /api/timeline/:slug` - Get timeline by slug
- `GET /api/timeline/topic/:topic` - Search timeline by topic
- `PATCH /api/timeline/:slug` - Update timeline (user's own timelines)

## Frontend Implementation

### 6. New Page Component

- Create `frontend/src/pages/PredictionPage.tsx`:
- Topic input/search
- Loading states for AI research
- Timeline visualization component
- Prediction display with scenarios

### 7. Timeline Slider Component

- Create `frontend/src/components/TimelineSlider.tsx`:
- Interactive slider for navigating past/present/future
- Visual timeline with markers for each interval
- Display current time period's data

### 8. Prediction Display Component

- Create `frontend/src/components/PredictionCard.tsx`:
- Show multiple scenarios (minimum 3)
- Display confidence scores
- Show sources with links
- Summary for each scenario

### 9. Timeline Chart Component

- Create `frontend/src/components/TimelineChart.tsx`:
- Visual chart showing value over time (past + predictions)
- Different styling for historical vs predicted data
- Value label display (e.g., "Price (USD)", "Population")

### 10. API Service Methods

- Extend `frontend/src/services/api.ts`:
- `generateTimeline(topic: string)` - Generate timeline analysis
- `getTimelineBySlug(slug: string)` - Get saved timeline
- `getTimelineByTopic(topic: string)` - Search timelines

### 11. Routing

- Add route in `frontend/src/App.tsx`:
- `/prediction` or `/timeline` route to new page
- Update Header navigation to include link

### 12. Styling

- Create CSS files for new components
- Timeline slider styling
- Prediction cards styling
- Chart visualization styling

## Key Features to Implement

### Timeline Data Structure

- **Past entries**: Up to 10 years back, with value, date, summary, sources
- **Present entry**: Current state with value, summary, sources
- **Future predictions**: Fixed intervals (1m, 1y, 2y-10y), each with:
- Minimum 3 scenarios
- Summary per scenario
- Sources per scenario
- Confidence score (0-100%) per scenario

### Value Tracking

- Auto-detect value label from topic (e.g., "Bitcoin" → "Price (USD)")
- Store numeric value for each timeline entry
- Display value label in UI

### AI Research Flow

1. User enters topic
2. AI researches past (web access for historical data)
3. AI researches present (web access for current data)
4. AI generates predictions for each future interval
5. Store complete analysis in MongoDB

### UI/UX Flow

1. User navigates to Prediction page
2. Enters topic (e.g., "Bitcoin")
3. System shows loading state while AI researches
4. Timeline slider appears with past/present/future
5. User can navigate timeline to see different periods
6. Each period shows value, summary, sources
7. Future periods show multiple prediction scenarios

## Dependencies to Add

### Backend

- `mongodb` - MongoDB driver
- `@perplexity/perplexity-sdk` or similar (if available) OR direct API calls

### Frontend

- Chart library (e.g., `recharts` or `chart.js`) for timeline visualization
- Slider component (or custom implementation)

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `PERPLEXITY_API_KEY` - Perplexity API key (optional, for fallback)
- Keep existing `OPENAI_API_KEY` for OpenAI with browsing

## Implementation Todos

1. **mongodb-setup**: Set up MongoDB configuration and connection in backend (config/mongodb.ts, add mongodb package, environment variables)
2. **timeline-types**: Create TypeScript types for timeline data models (TimelineEntry, Prediction, TimelineAnalysis)
3. **ai-service-enhancement**: Enhance AI service to support OpenAI with web browsing tools and add Perplexity API integration for timeline research
4. **timeline-service**: Create timelineService.ts with MongoDB operations (save, retrieve, update timeline analyses) - depends on: mongodb-setup, timeline-types
5. **timeline-api-routes**: Create API routes for timeline operations (generate, get by slug, search by topic) - depends on: timeline-service, ai-service-enhancement
6. **prediction-page**: Create PredictionPage.tsx component with topic input and main layout
7. **timeline-slider**: Create TimelineSlider component for navigating past/present/future periods
8. **prediction-card**: Create PredictionCard component to display multiple scenarios with confidence scores and sources
9. **timeline-chart**: Create TimelineChart component to visualize value over time (past + predictions)
10. **frontend-api-methods**: Add timeline API methods to frontend api.ts service
11. **routing-integration**: Add prediction page route to App.tsx and update Header navigation - depends on: prediction-page
12. **styling**: Create CSS files and styling for all new components (timeline slider, prediction cards, chart) - depends on: timeline-slider, prediction-card, timeline-chart