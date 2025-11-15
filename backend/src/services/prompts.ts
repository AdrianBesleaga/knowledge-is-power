/**
 * Prompt templates for AI requests
 * These prompts are used with OpenAI API calls for various prediction and research tasks
 */

import { TimelineEntry, Prediction } from '../types';

/**
 * System messages for different AI roles
 */
export const SYSTEM_MESSAGES = {
  VALUE_LABEL_DETECTOR: 'You are a data analyst with web access. Return only the value label, nothing else.',
  
  FINANCIAL_ANALYST: 'You are an expert financial analyst with real-time web access. Search current market data, historical archives, and reputable news sources to provide the most accurate information. Focus on verifiable data from official sources.',
  
  HISTORICAL_ANALYST: 'You are a historical market analyst with web access. Search historical archives, news databases, and official records to find the most significant events that impacted market values.',
  
  MARKET_DATA_SPECIALIST: 'You are a market data specialist with real-time web access. Always search for the most current and accurate market data from official sources.',
  
  SENIOR_FINANCIAL_ANALYST: 'You are a senior financial analyst with real-time market data access. Generate evidence-based predictions using current economic indicators, news, and historical patterns. Always search for supporting data.',
  
  DATA_EXTRACTION_SPECIALIST: 'You are a data extraction specialist with web access. Extract and verify historical market events, using web search to confirm dates and values when needed. Return valid JSON only.',
  
  HISTORICAL_RESEARCHER: 'You are a historical market researcher with full web access. Search historical archives, news databases, and market data sources to find the most significant events that impacted market values. Provide accurate, verifiable data with proper sources.',
  
  COMPREHENSIVE_ANALYST: 'You are an expert financial analyst with full web access. Complete comprehensive timeline analyses by searching current market data, historical archives, and news sources. Provide accurate, verifiable data with proper sources.',
  
  PREDICTION_ADJUSTER: 'You are a financial/data analyst. Generate realistic prediction scenarios that adjust previous predictions based on new current values and trends. Always provide at least 3 scenarios per interval. Return valid JSON only.',
  
  PREDICTION_REVISER: 'You are a senior financial analyst with real-time market data access. Generate evidence-based predictions that logically adjust previous forecasts based on new market data and current conditions. Always search for supporting data.',
} as const;

/**
 * Prompt templates for different AI operations
 */
export const PROMPTS = {
  /**
   * Detect value label from topic
   */
  detectValueLabel: (topic: string): string => {
    return `Given the topic "${topic}", determine what kind of value/metric would be most relevant to track over time.

Use your knowledge of current market data and search the web if needed to understand what metric is commonly tracked for this topic.

Return ONLY a short label (2-5 words) that describes the value. Examples:
- "Bitcoin" → "Price (USD)"
- "New York City" → "Population"
- "Tesla stock" → "Stock Price (USD)"
- "Global CO2 emissions" → "CO2 Emissions (Mt)"
- "Apple Inc" → "Stock Price (USD)"
- "US Inflation Rate" → "Inflation Rate (%)"

Topic: "${topic}"
Value Label:`;
  },

  /**
   * Combined research query (current + historical data)
   */
  combinedResearch: (topic: string, valueLabel: string, currentDate: Date, startDate: Date): string => {
    return `You have FULL WEB ACCESS. Research the most accurate and up-to-date information for "${topic}" focusing on ${valueLabel}.

CURRENT STATE (as of ${currentDate.toISOString().split('T')[0]}):
- Search current market data, news, and official sources to find the EXACT current ${valueLabel} value
- Provide a brief summary (2-3 sentences) of the current market conditions and recent trends
- Include VALID HTTP/HTTPS URLs from reputable sources (CoinMarketCap, Yahoo Finance, official websites, etc.)

HISTORICAL DATA from ${startDate.getFullYear()} to ${currentDate.getFullYear()}:
Find the MOST SIGNIFICANT EVENTS that had the biggest impact on ${valueLabel}. Maximum 4 events per year (40 total).

SEARCH FOR AND INCLUDE:
1. MAJOR PRICE MOVEMENTS (pumps and dumps):
   - Largest price increases/decreases with exact dates and ${valueLabel} values
   - News events, regulatory changes, market sentiment shifts that caused these movements
   - Include percentage changes and specific catalysts

2. MARKET CYCLE TURNING POINTS:
   - Bull market starts/ends with exact dates and ${valueLabel} levels
   - Bear market starts/ends with exact dates and ${valueLabel} levels
   - Major market cycle transitions with supporting evidence

3. REGULATORY AND FUNDAMENTAL EVENTS:
   - Government regulations, policy changes, technological breakthroughs
   - Major company announcements, partnerships, or product launches
   - Global events (wars, pandemics, economic crises) that affected the market

For each event provide:
- EXACT date (YYYY-MM-DD format preferred, or YYYY-MM if specific day unknown)
- PRECISE ${valueLabel} value at that time
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", "major_event"
- Detailed summary (3-4 sentences) explaining the event, causes, and market impact
- Multiple VALID HTTP/HTTPS URLs from reputable news sources, official announcements, or data providers

PRIORITY: Focus on events that caused the largest ${valueLabel} changes. Use current market data sources and historical archives.

Return data in JSON format:
{
  "current": {
    "value": number,
    "summary": string,
    "sources": ["https://coinmarketcap.com/currencies/bitcoin/", "https://finance.yahoo.com/"]
  },
  "historical": [
    {
      "date": "2021-11-10",
      "value": 69000,
      "eventType": "pump",
      "summary": "Bitcoin reached all-time high after Tesla's $1.5B investment announcement...",
      "sources": ["https://www.reuters.com/article/us-crypto-currency-idUSKBN2A12M7", "https://www.coindesk.com/policy/2021/02/08/tesla-buys-1-5-billion-in-bitcoin/"]
    }
  ]
}`;
  },

  /**
   * Research past data query
   */
  researchPastData: (topic: string, valueLabel: string, startDate: Date, currentDate: Date): string => {
    return `Research historical data about "${topic}" focusing on ${valueLabel} from ${startDate.getFullYear()} to ${currentDate.getFullYear()}.

IMPORTANT: Find the BIGGEST EVENTS only - maximum 4 events per year (40 total for 10 years).

Focus on:
1. MAJOR PRICE MOVEMENTS (pumps and dumps):
   - Significant price increases (pumps) - what caused them and the ${valueLabel} value
   - Significant price decreases (dumps) - what caused them and the ${valueLabel} value
   - Include the percentage change and reasons for each movement

2. MARKET CONDITIONS:
   - Bull market periods - when they started/ended, ${valueLabel} values, and reasons why
   - Bear market periods - when they started/ended, ${valueLabel} values, and reasons why
   - Market cycle transitions - when bull turned to bear or vice versa

3. For each event, provide:
   - Specific date (year and month, or specific date if available)
   - The ${valueLabel} value at that time
   - Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
   - Detailed summary (3-4 sentences) explaining:
     * What happened (the event)
     * Why it happened (the reasons/causes)
     * Impact on the ${valueLabel}
     * Market sentiment/conditions
   - Sources: Provide VALID HTTP/HTTPS URLs (e.g., https://example.com) where this information can be found

Prioritize events with the largest impact on ${valueLabel}. Return data in JSON format with an array of entries, each with: date, value, eventType, summary, sources.`;
  },

  /**
   * Research present state query
   */
  researchPresentState: (topic: string, valueLabel: string, currentDate: Date): string => {
    return `You have FULL WEB ACCESS. Find the EXACT current ${valueLabel} for "${topic}" as of ${currentDate.toISOString().split('T')[0]}.

SEARCH REQUIREMENTS:
- Check official sources, market data providers, and current news
- Get the most recent and accurate ${valueLabel} value
- Look for real-time data from exchanges, government sites, or official APIs

Provide:
1. The EXACT current ${valueLabel} value (use the most recent available data)
2. A brief summary (2-3 sentences) of current market conditions and recent price action
3. Sources: Provide 2-3 VALID HTTP/HTTPS URLs from reputable current data sources

Example for Bitcoin: Check CoinMarketCap, CoinGecko, major exchanges, or official financial data providers.

Return in JSON format: { value: number, summary: string, sources: ["https://coinmarketcap.com/currencies/bitcoin/", "https://finance.yahoo.com/quote/BTC-USD/"] }`;
  },

  /**
   * Generate predictions batch prompt
   */
  generatePredictionsBatch: (
    topic: string,
    valueLabel: string,
    intervalsList: string,
    historicalSummary: string,
    presentEntry: TimelineEntry
  ): string => {
    return `You have FULL WEB ACCESS. As an expert financial analyst, analyze current market conditions and generate data-driven predictions for "${topic}".

ANALYZE THESE TIME INTERVALS:
${intervalsList}

MARKET DATA PROVIDED:
Historical data (recent trends):
${historicalSummary}

Current state (${presentEntry.date.toISOString().split('T')[0]}):
${presentEntry.valueLabel} = ${presentEntry.value}
${presentEntry.summary}

INSTRUCTIONS:
Search current news, analyst reports, economic indicators, and market data to inform your predictions.
For EACH time interval, create 3-5 realistic scenarios based on:
- Current market sentiment and technical indicators
- Economic data (GDP, inflation, interest rates, employment)
- Industry news and regulatory developments
- Historical patterns and cycle analysis
- Risk factors and potential catalysts

For each scenario provide:
1. DESCRIPTIVE title (e.g., "Strong Bull Market Recovery", "Regulatory Crackdown Impact", "Tech Innovation Surge")
2. SPECIFIC predicted ${valueLabel} value (realistic number based on current trends)
3. DETAILED analysis (3-4 sentences) explaining drivers, supporting evidence, and market logic
4. SOURCES: 2-3 VALID HTTP/HTTPS URLs from recent news, analyst reports, or official data sources
5. CONFIDENCE score (0-100) based on current market data and historical precedents

Focus on realistic, data-driven predictions. Consider both bullish and bearish catalysts.

Return in JSON format:
{
  "predictions": [
    {
      "timeline": "1 month",
      "scenarios": [
        {
          "title": "Bullish Recovery Scenario",
          "predictedValue": 85000,
          "summary": "Based on recent positive economic data and institutional adoption trends, expect a 15% recovery driven by ETF approvals and corporate treasury allocations...",
          "sources": ["https://www.coindesk.com/policy/2024/01/10/sec-spot-bitcoin-etf-decision-expected-soon/", "https://finance.yahoo.com/news/bitcoin-etf-approvals-drive-institutional-120000000.html"],
          "confidenceScore": 75
        }
      ]
    }
  ]
}`;
  },

  /**
   * Generate prediction for single interval
   */
  generatePredictionForInterval: (
    topic: string,
    valueLabel: string,
    interval: string,
    historicalSummary: string,
    presentEntry: TimelineEntry
  ): string => {
    return `You have FULL WEB ACCESS. As an expert financial analyst, analyze current market conditions and generate data-driven predictions for "${topic}" for ${interval} from now.

MARKET DATA PROVIDED:
Historical data (recent trends):
${historicalSummary}

Current state (${presentEntry.date.toISOString().split('T')[0]}):
${presentEntry.valueLabel} = ${presentEntry.value}
${presentEntry.summary}

INSTRUCTIONS:
Search current news, analyst reports, economic indicators, and market data to inform your predictions.
Create 3-5 realistic scenarios based on:
- Current market sentiment and technical indicators
- Economic data (GDP, inflation, interest rates, employment)
- Industry news and regulatory developments
- Historical patterns and cycle analysis
- Risk factors and potential catalysts

For each scenario provide:
1. DESCRIPTIVE title (e.g., "Strong Bull Market Recovery", "Regulatory Crackdown Impact", "Tech Innovation Surge")
2. SPECIFIC predicted ${valueLabel} value (realistic number based on current trends)
3. DETAILED analysis (3-4 sentences) explaining drivers, supporting evidence, and market logic
4. SOURCES: 2-3 VALID HTTP/HTTPS URLs from recent news, analyst reports, or official data sources
5. CONFIDENCE score (0-100) based on current market data and historical precedents

Focus on realistic, data-driven predictions. Consider both bullish and bearish catalysts.

Return in JSON format:
{
  "scenarios": [
    {
      "title": "Bullish Recovery Scenario",
      "predictedValue": 85000,
      "summary": "Based on recent positive economic data and institutional adoption trends, expect a 15% recovery driven by ETF approvals and corporate treasury allocations...",
      "sources": ["https://www.coindesk.com/policy/2024/01/10/sec-spot-bitcoin-etf-decision-expected-soon/", "https://finance.yahoo.com/news/bitcoin-etf-approvals-drive-institutional-120000000.html"],
      "confidenceScore": 75
    }
  ]
}`;
  },

  /**
   * Extract entries from text
   */
  extractEntriesFromText: (valueLabel: string, text: string): string => {
    return `You have FULL WEB ACCESS. Extract and verify the BIGGEST EVENTS from the following text about historical ${valueLabel} data.

If the text mentions events but lacks specific dates or values, search the web to find accurate historical data.

Focus on major price movements (pumps/dumps) and market conditions (bull/bear markets).

For each event, identify:
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
- EXACT date (ISO format YYYY-MM-DD, verify via web search if needed)
- PRECISE ${valueLabel} value (number, verify via historical data sources)
- Detailed summary (3-4 sentences) explaining what happened, why, and the impact
- Sources: Provide 2-3 VALID HTTP/HTTPS URLs from reputable news sources or data providers

Prioritize events with largest impact. Maximum 4 events per year.

Text to analyze:
${text.substring(0, 4000)}

Return JSON: { "entries": [{ "date": "YYYY-MM-DD", "value": number, "eventType": "pump|dump|bull_market_start|...", "summary": "...", "sources": ["https://..."] }] }`;
  },

  /**
   * Fallback past research prompt
   */
  fallbackPastResearch: (topic: string, valueLabel: string, yearsBack: number): string => {
    return `You have FULL WEB ACCESS. Research and find the BIGGEST EVENTS for "${topic}" focusing on ${valueLabel} over the past ${yearsBack} years.

SEARCH REQUIREMENTS:
- Search historical market data archives, news databases, and financial records
- Find the most significant events that caused major ${valueLabel} movements
- Maximum 4 events per year (${yearsBack * 4} total)

FOCUS ON:
1. MAJOR PRICE MOVEMENTS: 
   - Largest pumps (price increases) with exact dates, ${valueLabel} values, and catalysts
   - Largest dumps (price decreases) with exact dates, ${valueLabel} values, and causes
   - Include percentage changes and specific news events that triggered movements

2. MARKET CYCLE TURNING POINTS:
   - Bull market starts/ends with exact dates and ${valueLabel} levels
   - Bear market starts/ends with exact dates and ${valueLabel} levels
   - Major cycle transitions with supporting evidence

3. REGULATORY AND FUNDAMENTAL EVENTS:
   - Government regulations, policy changes, technological breakthroughs
   - Major company announcements, partnerships, product launches
   - Global economic events (crises, wars, pandemics) that affected the market

For each event, provide:
- EXACT date (ISO format YYYY-MM-DD, verify via historical sources)
- PRECISE ${valueLabel} value (number, verify via market data archives)
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
- Detailed summary (3-4 sentences) explaining what happened, why it happened, and the market impact
- Sources: Provide 2-3 VALID HTTP/HTTPS URLs from reputable news sources, official announcements, or data providers

PRIORITY: Focus on events that caused the largest ${valueLabel} changes. Use historical market data and verified news sources.

Return JSON format: { "entries": [{ "date": "YYYY-MM-DD", "value": number, "eventType": "...", "summary": "...", "sources": ["https://..."] }] }`;
  },

  /**
   * Generate complete timeline analysis prompt
   */
  generateTimelineAnalysis: (topic: string, currentDate: Date, startDate: Date, intervalsList: string): string => {
    return `Complete a comprehensive timeline analysis for "${topic}" using your knowledge of market data, historical events, and current trends.

CRITICAL REQUIREMENTS:
- You MUST provide data for ALL required fields
- The "historical" array MUST contain at least 10-20 significant events (up to 40 maximum, 4 per year)
- The "predictions" array MUST contain predictions for ALL ${intervalsList.split('\n').length} intervals listed below
- Each prediction interval MUST have exactly 3 scenarios
- Use your training data knowledge of historical events, market data, and trends

TASK 1: DETERMINE VALUE LABEL
- Determine what metric/value is most relevant to track for "${topic}"
- Examples: "Bitcoin" → "Price (USD)", "Tesla stock" → "Stock Price (USD)", "New York City" → "Population"
- Return a short label (2-5 words)

TASK 2: GET CURRENT STATE
- Provide the approximate current value as of ${currentDate.toISOString().split('T')[0]} based on your knowledge
- Provide brief summary (2-3 sentences) of current market conditions
- Include 2-3 realistic HTTP/HTTPS URLs from reputable sources (e.g., coinmarketcap.com, finance.yahoo.com, etc.)

TASK 3: RESEARCH HISTORICAL DATA (${startDate.getFullYear()} to ${currentDate.getFullYear()})
You MUST find at least 10-20 of the BIGGEST EVENTS that had the largest impact. Maximum 4 events per year (40 total).

Focus on:
1. MAJOR PRICE MOVEMENTS: Largest pumps/dumps with exact dates, values, and catalysts
2. MARKET CYCLE TURNING POINTS: Bull/bear market starts/ends with exact dates and values
3. REGULATORY/FUNDAMENTAL EVENTS: Regulations, policy changes, major announcements

For each event provide:
- EXACT date (YYYY-MM-DD format)
- PRECISE value at that time
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
- Detailed summary (3-4 sentences) explaining what happened, why, and impact
- 2-3 realistic HTTP/HTTPS URLs from reputable sources

TASK 4: GENERATE PREDICTIONS (REQUIRED FOR ALL INTERVALS)
For EACH of these intervals, you MUST provide exactly 3 scenarios: ${intervalsList}

Create 3 realistic scenarios per interval based on:
- Current market sentiment and technical indicators
- Economic data (GDP, inflation, interest rates)
- Industry news and regulatory developments
- Historical patterns and cycle analysis

For each scenario provide:
- DESCRIPTIVE title (e.g., "Strong Bull Market Recovery", "Regulatory Impact", "Neutral Growth")
- SPECIFIC predicted value (realistic number)
- DETAILED analysis (3-4 sentences) with drivers and evidence
- 2-3 realistic HTTP/HTTPS URLs from recent news or analyst reports
- CONFIDENCE score (0-100)

IMPORTANT: The "historical" array cannot be empty. The "predictions" array must have entries for ALL intervals listed above. Each prediction must have exactly 3 scenarios.

Return in this EXACT JSON format:
{
  "valueLabel": "Price (USD)",
  "current": {
    "value": 65000,
    "summary": "Current market conditions...",
    "sources": ["https://coinmarketcap.com/currencies/bitcoin/", "https://finance.yahoo.com/quote/BTC-USD/"]
  },
  "historical": [
    {
      "date": "2021-11-10",
      "value": 69000,
      "eventType": "pump",
      "summary": "Bitcoin reached all-time high after Tesla's investment...",
      "sources": ["https://www.reuters.com/article/...", "https://www.coindesk.com/..."]
    }
  ],
  "predictions": [
    {
      "timeline": "1 month",
      "scenarios": [
        {
          "title": "Bullish Recovery",
          "predictedValue": 70000,
          "summary": "Based on recent positive data...",
          "sources": ["https://www.coindesk.com/...", "https://finance.yahoo.com/..."],
          "confidenceScore": 75
        }
      ]
    }
  ]
}`;
  },

  /**
   * Generate predictions batch with context
   */
  generatePredictionsBatchWithContext: (
    topic: string,
    valueLabel: string,
    intervalsList: string,
    historicalSummary: string,
    previousPresentEntry: TimelineEntry,
    newPresentEntry: TimelineEntry,
    valueChange: number,
    valueChangePercent: string,
    previousContexts: string
  ): string => {
    return `Based on the historical data, current state, and PREVIOUS PREDICTIONS for "${topic}", generate 3-5 updated prediction scenarios for EACH of the following time intervals:

Time Intervals:
${intervalsList}

Historical data (recent):
${historicalSummary}

PREVIOUS state (${previousPresentEntry.date.toISOString().split('T')[0]}):
${previousPresentEntry.valueLabel} = ${previousPresentEntry.value}

CURRENT state (${newPresentEntry.date.toISOString().split('T')[0]}):
${newPresentEntry.valueLabel} = ${newPresentEntry.value}
${newPresentEntry.summary}
${valueChange !== 0 ? `\nValue change: ${valueChange > 0 ? '+' : ''}${valueChange} (${valueChangePercent}%)` : ''}

PREVIOUS PREDICTIONS:
${previousContexts || 'No previous predictions available'}

IMPORTANT: The current value has changed from ${previousPresentEntry.value} to ${newPresentEntry.value} (${valueChange > 0 ? '+' : ''}${valueChangePercent}% change).
For EACH interval, adjust your predictions based on this new information and the previous predictions.

For EACH interval above, provide 3-5 scenarios. For each scenario, provide:
1. A title (e.g., "Bullish", "Bearish", "Neutral", "Optimistic", "Pessimistic")
2. A predicted ${valueLabel} value (adjusted based on the new current value and previous predictions)
3. A detailed summary explaining why this scenario could happen, considering the value change and previous predictions (3-4 sentences)
4. Sources: Provide VALID HTTP/HTTPS URLs (e.g., https://example.com) that support this prediction
5. A confidence score (0-100) indicating how likely this scenario is

Return in JSON format:
{
  "predictions": [
    {
      "timeline": "1 month",
      "scenarios": [
        {
          "title": "Scenario Title",
          "predictedValue": number,
          "summary": "Detailed explanation",
          "sources": ["https://example.com/source1", "https://example.com/source2"],
          "confidenceScore": number
        }
      ]
    }
  ]
}`;
  },

  /**
   * Generate prediction for interval with context
   */
  generatePredictionForIntervalWithContext: (
    topic: string,
    valueLabel: string,
    interval: string,
    historicalSummary: string,
    previousPresentEntry: TimelineEntry,
    newPresentEntry: TimelineEntry,
    valueChange: number,
    valueChangePercent: string,
    previousContext: string
  ): string => {
    return `You have FULL WEB ACCESS. As an expert financial analyst, analyze updated market conditions and generate revised predictions for "${topic}" for ${interval} from now.

MARKET DATA PROVIDED:
Historical data (recent trends):
${historicalSummary}

PREVIOUS state (${previousPresentEntry.date.toISOString().split('T')[0]}):
${previousPresentEntry.valueLabel} = ${previousPresentEntry.value}

CURRENT state (${newPresentEntry.date.toISOString().split('T')[0]}):
${newPresentEntry.valueLabel} = ${newPresentEntry.value}
${newPresentEntry.summary}
${valueChange !== 0 ? `\nValue change: ${valueChange > 0 ? '+' : ''}${valueChange} (${valueChangePercent}%)` : ''}
${previousContext}

INSTRUCTIONS:
Search current news, analyst reports, and market data to understand why the value changed and how it affects future predictions.
Create 3-5 updated scenarios that:
- Adjust previous predictions based on the new current value
- Consider recent market developments and news
- Factor in economic indicators and industry trends
- Account for the value change direction and magnitude

For each scenario provide:
1. DESCRIPTIVE title (e.g., "Accelerated Bull Run", "Correction Recovery", "Sustained Decline")
2. SPECIFIC predicted ${valueLabel} value (adjusted based on new data and previous predictions)
3. DETAILED analysis (3-4 sentences) explaining how the value change affects the prediction, supporting evidence, and market logic
4. SOURCES: 2-3 VALID HTTP/HTTPS URLs from recent news, analyst reports, or official data sources
5. CONFIDENCE score (0-100) based on how well the new data aligns with the scenario

Focus on realistic, data-driven predictions that logically adjust previous forecasts.

Return in JSON format:
{
  "scenarios": [
    {
      "title": "Updated Bullish Scenario",
      "predictedValue": 90000,
      "summary": "The recent price increase suggests stronger momentum than previously anticipated. Based on current institutional flows and regulatory clarity, we revise our prediction upward...",
      "sources": ["https://www.coindesk.com/markets/2024/01/15/institutional-bitcoin-adoption-accelerates/", "https://finance.yahoo.com/news/bitcoin-price-surge-analysis-120000000.html"],
      "confidenceScore": 80
    }
  ]
}`;
  },
} as const;

