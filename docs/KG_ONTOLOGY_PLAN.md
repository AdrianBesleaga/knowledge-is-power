# Knowledge Graph Ontology and Data Ingestion System

## Overview
Transform the application to support complex multi-source analysis (e.g., stock price factors) with proper KG ontology, AI-powered web search data ingestion, entity resolution, historical tracking, and predictive forecasting.

## Architecture Changes

### 1. Knowledge Graph Ontology Redesign

**Entity Types (Node Labels):**
- `Company` - Companies, organizations
- `Person` - CEOs, founders, board members, analysts
- `Event` - Earnings calls, product launches, mergers
- `Trend` - Market trends, industry movements
- `Technology` - Technologies, platforms, tools
- `Niche` - Market segments, industries
- `Website` - News sources, social platforms, data sources
- `Legislation` - Laws, regulations, policy changes
- `EconomicFactor` - GDP, inflation, interest rates
- `NewsArticle` - News articles, blog posts
- `SocialPost` - Reddit posts, tweets, social media content
- `StockPrice` - Historical price data points
- `Analysis` - Generated analyses, forecasts

**Relationship Types:**
- `MENTIONS` - Entity mentions another entity
- `INFLUENCES` - One entity influences another
- `OCCURRED_AT` - Event occurred at time
- `AUTHORED_BY` - Content authored by person
- `PUBLISHED_ON` - Content published on website
- `AFFECTS` - Entity affects stock price/outcome
- `SIMILAR_TO` - Entity similar to another (for predictions)
- `PREDICTS` - Analysis predicts future outcome
- `HAS_TREND` - Company/entity has trend
- `USES_TECHNOLOGY` - Entity uses technology
- `OPERATES_IN` - Company operates in niche

**Node Properties:**
- All entities: `id`, `name`, `description`, `createdAt`, `updatedAt`, `confidence`
- Company: `ticker`, `industry`, `marketCap`
- Person: `role`, `companyId`, `linkedInUrl`
- Event: `eventType`, `date`, `location`
- NewsArticle/SocialPost: `url`, `publishedAt`, `sentiment`, `relevanceScore`
- StockPrice: `date`, `price`, `volume`, `change`
- Analysis: `analysisType`, `timeframe`, `scenarios`

### 2. Data Ingestion with AI Web Search

**New Service: `dataIngestionService.ts`**
- Integrate AI model with web search (Tavily API or similar)
- Search strategy:
  - Query multiple sources: news, Reddit, financial data, social media
  - Extract entities and relationships from search results
  - Store raw data as `NewsArticle`/`SocialPost` nodes
  - Link to relevant entities

**Ingestion Flow:**
1. User queries topic (e.g., "Apple stock price factors")
2. AI generates search queries for different source types
3. Web search executed for each query
4. AI extracts entities, relationships, and metadata from results
5. Entity Resolution applied before storing
6. Entities and relationships stored in Neo4j
7. Historical data points stored with timestamps

### 3. Entity Resolution (Rule-Based)

**New Service: `entityResolutionService.ts`**
- Fuzzy string matching using Levenshtein distance
- Similarity thresholds:
  - Exact match: 1.0
  - High confidence: >0.9
  - Medium confidence: >0.8
  - Low confidence: >0.7 (requires manual review)
- Normalization:
  - Lowercase, remove special chars
  - Handle aliases (e.g., "Apple Inc." = "Apple")
  - Company ticker matching
- Merge strategy:
  - Create canonical entity
  - Merge duplicate entities
  - Preserve all relationships
  - Update confidence scores

### 4. Historical Data Storage

**Temporal Properties:**
- Add `timestamp` to all events and data points
- Store time-series data for stock prices, trends
- Version entities when key properties change
- Support time-based queries (e.g., "factors in Q1 2024")

**New Queries:**
- Get entity state at specific time
- Track changes over time
- Find similar historical patterns

### 5. Similarity-Based Prediction Model

**New Service: `predictionService.ts`**
- Find similar historical cases:
  - Graph structure similarity
  - Entity type matching
  - Relationship pattern matching
  - Time-series pattern matching
- Generate 3 forecast scenarios:
  - Optimistic (best-case historical outcomes)
  - Realistic (most likely based on similar cases)
  - Pessimistic (worst-case historical outcomes)
- Include reasoning for each scenario

**Prediction Flow:**
1. Analyze current graph structure and entities
2. Find similar historical graphs (by entity types, relationships, patterns)
3. Extract outcomes from similar cases
4. Generate 3 scenarios with probabilities
5. Store predictions as `Analysis` nodes

### 6. API Endpoints

**New Routes in `routes/graph.ts`:**
- `POST /api/graph/analyze` - Analyze topic with data ingestion
- `GET /api/graph/:slug/history` - Get historical data for graph
- `POST /api/graph/:slug/predict` - Generate predictions
- `GET /api/graph/:slug/similar` - Find similar historical cases
- `POST /api/entities/resolve` - Manual entity resolution
- `GET /api/entities/search` - Search entities across graphs

### 7. Frontend Updates

**New Components:**
- `AnalysisView.tsx` - High-level overview with key factors
- `FactorDetailPanel.tsx` - Deep dive into specific factors
- `TimelineView.tsx` - Historical timeline visualization
- `ForecastPanel.tsx` - Display 3 prediction scenarios
- `EntityDetailPanel.tsx` - Show entity details and relationships

**UI Flow:**
1. High-level view: Show top-level factors and summary
2. Click factor → Expand to show sub-factors and sources
3. Click entity → Show entity details, related entities, timeline
4. Forecast tab → Show 3 scenarios with reasoning

### 8. Database Schema Migration

**Neo4j Constraints and Indexes:**
- Create constraints for entity types
- Index on `name`, `ticker`, `url`, `timestamp`
- Full-text search indexes for entity names

**Migration Strategy:**
- Keep existing `Graph` and `Node` structure for backward compatibility
- Add new entity types alongside existing nodes
- Gradually migrate existing nodes to new ontology

## Implementation Files

**Backend:**
- `backend/src/services/dataIngestionService.ts` - Web search and data extraction
- `backend/src/services/entityResolutionService.ts` - Entity deduplication
- `backend/src/services/predictionService.ts` - Similarity matching and forecasting
- `backend/src/services/ontologyService.ts` - Entity type management
- `backend/src/types/ontology.ts` - Entity and relationship type definitions
- `backend/src/utils/fuzzyMatch.ts` - String similarity utilities
- `backend/src/routes/entities.ts` - Entity management endpoints
- Update `backend/src/services/aiService.ts` - Add web search integration
- Update `backend/src/services/graphService.ts` - Support new ontology
- Update `backend/src/routes/graph.ts` - Add new endpoints

**Frontend:**
- `frontend/src/components/AnalysisView.tsx` - High-level analysis view
- `frontend/src/components/FactorDetailPanel.tsx` - Factor deep dive
- `frontend/src/components/TimelineView.tsx` - Historical timeline
- `frontend/src/components/ForecastPanel.tsx` - Prediction scenarios
- `frontend/src/components/EntityDetailPanel.tsx` - Entity details
- `frontend/src/types/ontology.ts` - Frontend type definitions
- Update `frontend/src/components/KnowledgeGraph.tsx` - Support new entity types
- Update `frontend/src/pages/GraphViewPage.tsx` - Add new views

**Dependencies:**
- Add `tavily` or similar web search API client
- Add `fuse.js` or `string-similarity` for fuzzy matching
- Add `date-fns` for temporal operations

## Key Features

1. **Multi-Source Data Ingestion**: AI searches web for news, Reddit, financial data, social media
2. **Entity Resolution**: Automatically deduplicates entities using fuzzy matching
3. **Historical Tracking**: Stores temporal data for trend analysis
4. **Similarity Matching**: Finds similar historical cases for predictions
5. **Forecast Generation**: Creates 3 scenarios (optimistic, realistic, pessimistic) with reasoning
6. **Progressive Disclosure UI**: High-level view → factor details → entity details → timeline

## Implementation Todos

1. Create ontology type definitions (Entity types, Relationship types, properties) in `backend/src/types/ontology.ts`
2. Implement `entityResolutionService.ts` with fuzzy matching and merge logic
3. Integrate Tavily API (or similar) for AI-powered web search in `dataIngestionService.ts`
4. Build `dataIngestionService.ts` to extract entities and relationships from web search results
5. Add timestamp support and historical data storage in `graphService.ts`
6. Implement `predictionService.ts` with similarity matching and scenario generation
7. Create Neo4j constraints, indexes, and migration for new ontology
8. Add new API endpoints for analysis, history, predictions, and entity management
9. Create frontend type definitions for new ontology in `frontend/src/types/ontology.ts`
10. Build `AnalysisView.tsx` component for high-level overview
11. Build `FactorDetailPanel.tsx` for deep dive into factors
12. Build `TimelineView.tsx` for historical data visualization
13. Build `ForecastPanel.tsx` to display 3 prediction scenarios
14. Build `EntityDetailPanel.tsx` for entity details and relationships
15. Update `KnowledgeGraph.tsx` to support new entity types and visualization
16. Update `GraphViewPage.tsx` to integrate new views and navigation

