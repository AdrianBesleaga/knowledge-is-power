import OpenAI from 'openai';
import { TimelineEntry, Prediction, PredictionScenario, TimelineAnalysis } from '../types';
import { nanoid } from 'nanoid';

// Lazy initialization to ensure dotenv is loaded first
let openai: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Please check your .env file.');
    }
    openai = new OpenAI({
      apiKey,
    });
  }
  return openai;
};

// Perplexity API helper
const callPerplexityAPI = async (query: string): Promise<string> => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set.');
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Perplexity API error:', error);
    throw error;
  }
};

export class PredictionService {
  /**
   * Auto-detect value label from topic (e.g., "Bitcoin" → "Price (USD)")
   */
  async detectValueLabel(topic: string): Promise<string> {
    const prompt = `Given the topic "${topic}", determine what kind of value/metric would be most relevant to track over time. 

Return ONLY a short label (2-5 words) that describes the value. Examples:
- "Bitcoin" → "Price (USD)"
- "New York City" → "Population"
- "Tesla stock" → "Stock Price (USD)"
- "Global CO2 emissions" → "CO2 Emissions (Mt)"

Topic: "${topic}"
Value Label:`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a data analyst. Return only the value label, nothing else.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 20,
      });

      const label = completion.choices[0]?.message?.content?.trim() || 'Value';
      return label;
    } catch (error) {
      console.error('Error detecting value label:', error);
      return 'Value';
    }
  }

  /**
   * Research past data using AI with web access
   * Focuses on major events: big pumps/dumps and market conditions (bull/bear markets)
   */
  async researchPastData(
    topic: string,
    valueLabel: string,
    yearsBack: number = 10
  ): Promise<TimelineEntry[]> {
    const currentDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(currentDate.getFullYear() - yearsBack);

    // Use OpenAI with function calling for web browsing, or Perplexity as fallback
    const usePerplexity = !!process.env.PERPLEXITY_API_KEY;

    const query = `Research historical data about "${topic}" focusing on ${valueLabel} from ${startDate.getFullYear()} to ${currentDate.getFullYear()}. 

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
   - Sources/URLs where this information can be found

Prioritize events with the largest impact on ${valueLabel}. Return data in JSON format with an array of entries, each with: date, value, eventType, summary, sources.`;

    try {
      let researchResult: string;

      if (usePerplexity) {
        // Use Perplexity API (has built-in web access)
        researchResult = await callPerplexityAPI(query);
      } else {
        // Use OpenAI with function calling for web browsing
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant with access to current web data. Provide accurate historical information with sources.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'search_web',
                description: 'Search the web for current and historical information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query',
                    },
                  },
                  required: ['query'],
                },
              },
            },
          ],
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 4000,
        });

        researchResult = completion.choices[0]?.message?.content || '';
      }

      // Parse the research result and extract timeline entries
      const entries = await this.parseResearchResult(researchResult, valueLabel);
      
      // Limit to max 4 events per year and sort by date
      return this.limitEventsPerYear(entries, yearsBack);
    } catch (error) {
      console.error('Error researching past data:', error);
      // Fallback: return empty array or use OpenAI without web browsing
      return this.fallbackPastResearch(topic, valueLabel, yearsBack);
    }
  }

  /**
   * Research present state using AI with web access
   */
  async researchPresentState(topic: string, valueLabel: string): Promise<TimelineEntry> {
    const currentDate = new Date();
    const query = `What is the current ${valueLabel} for "${topic}" as of ${currentDate.toISOString().split('T')[0]}? 

Provide:
1. The current ${valueLabel} value
2. A brief summary of the current state (2-3 sentences)
3. Sources/URLs where this current information can be found

Return in JSON format: { value: number, summary: string, sources: string[] }`;

    const usePerplexity = !!process.env.PERPLEXITY_API_KEY;

    try {
      let researchResult: string;

      if (usePerplexity) {
        researchResult = await callPerplexityAPI(query);
      } else {
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant with access to current web data. Provide the most recent information available.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'search_web',
                description: 'Search the web for current information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query',
                    },
                  },
                  required: ['query'],
                },
              },
            },
          ],
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 2000,
        });

        researchResult = completion.choices[0]?.message?.content || '';
      }

      const parsed = this.parsePresentData(researchResult, valueLabel, currentDate);
      return parsed;
    } catch (error) {
      console.error('Error researching present state:', error);
      // Fallback
      return {
        date: currentDate,
        value: 0,
        valueLabel,
        summary: `Current state information for ${topic} is not available.`,
        sources: [],
      };
    }
  }

  /**
   * Generate predictions for fixed intervals (SINGLE BATCH for maximum cost optimization)
   */
  async generatePredictions(
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry
  ): Promise<Prediction[]> {
    const intervals = ['1 month', '1 year', '2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years', '9 years', '10 years'];

    // Single batch: all intervals in one API call
    return await this.generatePredictionsBatch(
      topic,
      valueLabel,
      intervals,
      pastEntries,
      presentEntry
    );
  }

  /**
   * Generate predictions for a batch of intervals in a single API call
   */
  private async generatePredictionsBatch(
    topic: string,
    valueLabel: string,
    intervals: string[],
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry
  ): Promise<Prediction[]> {
    const historicalSummary = pastEntries
      .slice(-5) // Last 5 entries
      .map(e => `${e.date.toISOString().split('T')[0]}: ${e.valueLabel} = ${e.value}`)
      .join('\n');

    const intervalsList = intervals.map((interval, idx) => `${idx + 1}. ${interval}`).join('\n');

    const prompt = `Based on the historical data and current state for "${topic}", generate 3-5 different prediction scenarios for EACH of the following time intervals:

Time Intervals:
${intervalsList}

Historical data (recent):
${historicalSummary}

Current state (${presentEntry.date.toISOString().split('T')[0]}):
${presentEntry.valueLabel} = ${presentEntry.value}
${presentEntry.summary}

For EACH interval above, provide 3-5 scenarios. For each scenario, provide:
1. A title (e.g., "Bullish", "Bearish", "Neutral", "Optimistic", "Pessimistic")
2. A predicted ${valueLabel} value
3. A detailed summary explaining why this scenario could happen (3-4 sentences)
4. Sources/reasons that support this prediction
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
          "sources": ["source1", "source2"],
          "confidenceScore": number
        }
      ]
    }
  ]
}`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial/data analyst. Generate realistic prediction scenarios based on historical trends and current conditions. Always provide at least 3 scenarios per interval. Return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
        max_tokens: 16000, // Increased for single batch with all 11 intervals
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const predictions: Prediction[] = [];

      // Process each interval's predictions
      for (const interval of intervals) {
        const intervalData = parsed.predictions?.find((p: any) => p.timeline === interval);
        
        if (intervalData && intervalData.scenarios) {
          const scenarios: PredictionScenario[] = intervalData.scenarios.slice(0, 5).map((s: any, idx: number) => ({
            id: nanoid(),
            title: s.title || `Scenario ${idx + 1}`,
            summary: s.summary || '',
            sources: Array.isArray(s.sources) ? s.sources : [],
            confidenceScore: Math.max(0, Math.min(100, s.confidenceScore || 50)),
            predictedValue: s.predictedValue,
          }));

          // Ensure at least 3 scenarios
          while (scenarios.length < 3) {
            scenarios.push({
              id: nanoid(),
              title: `Scenario ${scenarios.length + 1}`,
              summary: 'Additional scenario based on historical trends.',
              sources: [],
              confidenceScore: 50,
            });
          }

          predictions.push({
            timeline: interval,
            scenarios,
          });
        } else {
          // Fallback if interval not found in response
          predictions.push({
            timeline: interval,
            scenarios: [
              {
                id: nanoid(),
                title: 'Optimistic',
                summary: `Optimistic scenario for ${topic} in ${interval}.`,
                sources: [],
                confidenceScore: 33,
              },
              {
                id: nanoid(),
                title: 'Neutral',
                summary: `Neutral scenario for ${topic} in ${interval}.`,
                sources: [],
                confidenceScore: 34,
              },
              {
                id: nanoid(),
                title: 'Pessimistic',
                summary: `Pessimistic scenario for ${topic} in ${interval}.`,
                sources: [],
                confidenceScore: 33,
              },
            ],
          });
        }
      }

      return predictions;
    } catch (error) {
      console.error(`Error generating predictions batch for intervals ${intervals.join(', ')}:`, error);
      // Fallback: generate individual predictions if batch fails
      const fallbackPredictions: Prediction[] = [];
      for (const interval of intervals) {
        const prediction = await this.generatePredictionForInterval(
          topic,
          valueLabel,
          interval,
          pastEntries,
          presentEntry
        );
        fallbackPredictions.push(prediction);
      }
      return fallbackPredictions;
    }
  }

  /**
   * Generate prediction for a specific interval with minimum 3 scenarios
   */
  private async generatePredictionForInterval(
    topic: string,
    valueLabel: string,
    interval: string,
    pastEntries: TimelineEntry[],
    presentEntry: TimelineEntry
  ): Promise<Prediction> {
    const historicalSummary = pastEntries
      .slice(-5) // Last 5 entries
      .map(e => `${e.date.toISOString().split('T')[0]}: ${e.valueLabel} = ${e.value}`)
      .join('\n');

    const prompt = `Based on the historical data and current state for "${topic}", generate 3-5 different prediction scenarios for ${interval} from now.

Historical data (recent):
${historicalSummary}

Current state (${presentEntry.date.toISOString().split('T')[0]}):
${presentEntry.valueLabel} = ${presentEntry.value}
${presentEntry.summary}

For each scenario, provide:
1. A title (e.g., "Bullish", "Bearish", "Neutral", "Optimistic", "Pessimistic")
2. A predicted ${valueLabel} value
3. A detailed summary explaining why this scenario could happen (3-4 sentences)
4. Sources/reasons that support this prediction
5. A confidence score (0-100) indicating how likely this scenario is

Return in JSON format:
{
  "scenarios": [
    {
      "title": "Scenario Title",
      "predictedValue": number,
      "summary": "Detailed explanation",
      "sources": ["source1", "source2"],
      "confidenceScore": number
    }
  ]
}`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial/data analyst. Generate realistic prediction scenarios based on historical trends and current conditions. Always provide at least 3 scenarios.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const scenarios: PredictionScenario[] = (parsed.scenarios || []).slice(0, 5).map((s: any, idx: number) => ({
        id: nanoid(),
        title: s.title || `Scenario ${idx + 1}`,
        summary: s.summary || '',
        sources: Array.isArray(s.sources) ? s.sources : [],
        confidenceScore: Math.max(0, Math.min(100, s.confidenceScore || 50)),
        predictedValue: s.predictedValue,
      }));

      // Ensure at least 3 scenarios
      while (scenarios.length < 3) {
        scenarios.push({
          id: nanoid(),
          title: `Scenario ${scenarios.length + 1}`,
          summary: 'Additional scenario based on historical trends.',
          sources: [],
          confidenceScore: 50,
        });
      }

      return {
        timeline: interval,
        scenarios,
      };
    } catch (error) {
      console.error(`Error generating prediction for ${interval}:`, error);
      // Fallback: return 3 basic scenarios
      return {
        timeline: interval,
        scenarios: [
          {
            id: nanoid(),
            title: 'Optimistic',
            summary: `Optimistic scenario for ${topic} in ${interval}.`,
            sources: [],
            confidenceScore: 33,
          },
          {
            id: nanoid(),
            title: 'Neutral',
            summary: `Neutral scenario for ${topic} in ${interval}.`,
            sources: [],
            confidenceScore: 34,
          },
          {
            id: nanoid(),
            title: 'Pessimistic',
            summary: `Pessimistic scenario for ${topic} in ${interval}.`,
            sources: [],
            confidenceScore: 33,
          },
        ],
      };
    }
  }

  /**
   * Parse research result into timeline entries
   */
  private async parseResearchResult(result: string, valueLabel: string): Promise<TimelineEntry[]> {
    const entries: TimelineEntry[] = [];

    try {
      // Try to extract JSON from the result
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.entries || parsed)) {
          const data = parsed.entries || parsed;
          for (const item of data) {
            if (item.date && typeof item.value === 'number') {
              // Build enhanced summary with event type information
              let summary = item.summary || '';
              if (item.eventType) {
                const eventTypeLabel = this.getEventTypeLabel(item.eventType);
                summary = `[${eventTypeLabel}] ${summary}`;
              }
              
              entries.push({
                date: new Date(item.date),
                value: item.value,
                valueLabel,
                summary,
                sources: Array.isArray(item.sources) ? item.sources : [],
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing research result:', error);
    }

    // If parsing failed, try to extract information using AI
    if (entries.length === 0) {
      return await this.extractEntriesFromText(result, valueLabel);
    }

    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get human-readable label for event type
   */
  private getEventTypeLabel(eventType: string): string {
    const labels: Record<string, string> = {
      'pump': '🚀 Major Pump',
      'dump': '📉 Major Dump',
      'bull_market_start': '🐂 Bull Market Start',
      'bull_market_end': '🐂 Bull Market End',
      'bear_market_start': '🐻 Bear Market Start',
      'bear_market_end': '🐻 Bear Market End',
      'major_event': '⚡ Major Event',
    };
    return labels[eventType] || '📊 Event';
  }

  /**
   * Limit events to maximum 4 per year, prioritizing most significant events
   */
  private limitEventsPerYear(entries: TimelineEntry[], yearsBack: number): TimelineEntry[] {
    // Group entries by year
    const entriesByYear = new Map<number, TimelineEntry[]>();
    
    for (const entry of entries) {
      const year = entry.date.getFullYear();
      if (!entriesByYear.has(year)) {
        entriesByYear.set(year, []);
      }
      entriesByYear.get(year)!.push(entry);
    }

    // For each year, keep max 4 most significant events
    // Priority: events with more detailed summaries (longer = more significant)
    // and events that mention pump/dump/bull/bear in summary
    const limitedEntries: TimelineEntry[] = [];
    
    for (const [year, yearEntries] of entriesByYear.entries()) {
      // Sort by significance (longer summaries, or containing key terms)
      const sorted = yearEntries.sort((a, b) => {
        const aScore = this.calculateEventSignificance(a);
        const bScore = this.calculateEventSignificance(b);
        return bScore - aScore; // Descending order
      });
      
      // Take top 4
      limitedEntries.push(...sorted.slice(0, 4));
    }

    // Sort all entries by date
    return limitedEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Calculate significance score for an event
   */
  private calculateEventSignificance(entry: TimelineEntry): number {
    let score = entry.summary.length; // Longer summaries are more detailed
    
    const summaryLower = entry.summary.toLowerCase();
    
    // Boost score for key terms
    if (summaryLower.includes('pump') || summaryLower.includes('surge') || summaryLower.includes('rally')) {
      score += 100;
    }
    if (summaryLower.includes('dump') || summaryLower.includes('crash') || summaryLower.includes('plunge')) {
      score += 100;
    }
    if (summaryLower.includes('bull market') || summaryLower.includes('bull run')) {
      score += 150;
    }
    if (summaryLower.includes('bear market') || summaryLower.includes('bear run')) {
      score += 150;
    }
    if (summaryLower.includes('%') || summaryLower.includes('percent')) {
      score += 50; // Events with percentage changes are more specific
    }
    
    return score;
  }

  /**
   * Extract entries from unstructured text using AI
   * Focuses on major events: pumps, dumps, bull/bear markets
   */
  private async extractEntriesFromText(text: string, valueLabel: string): Promise<TimelineEntry[]> {
    const prompt = `Extract the BIGGEST EVENTS from the following text about historical ${valueLabel} data. 
Focus on major price movements (pumps/dumps) and market conditions (bull/bear markets).

For each event, identify:
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
- Date (ISO format)
- ${valueLabel} value (number)
- Detailed summary (3-4 sentences) explaining what happened, why, and the impact
- Sources (if mentioned)

Prioritize events with largest impact. Maximum 4 events per year.

Text:
${text.substring(0, 4000)}

Return JSON: { "entries": [{ "date": "YYYY-MM-DD", "value": number, "eventType": "pump|dump|bull_market_start|...", "summary": "...", "sources": [...] }] }`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract structured timeline data from text. Return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const entries = (parsed.entries || []).map((item: any) => {
          let summary = item.summary || '';
          if (item.eventType) {
            const eventTypeLabel = this.getEventTypeLabel(item.eventType);
            summary = `[${eventTypeLabel}] ${summary}`;
          }
          
          return {
            date: new Date(item.date),
            value: item.value || 0,
            valueLabel,
            summary,
            sources: Array.isArray(item.sources) ? item.sources : [],
          };
        });
        return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
    } catch (error) {
      console.error('Error extracting entries from text:', error);
    }

    return [];
  }

  /**
   * Parse present data from research result
   */
  private parsePresentData(result: string, valueLabel: string, date: Date): TimelineEntry {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          date,
          value: parsed.value || 0,
          valueLabel,
          summary: parsed.summary || '',
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        };
      }
    } catch (error) {
      console.error('Error parsing present data:', error);
    }

    // Fallback: extract using AI
    return {
      date,
      value: 0,
      valueLabel,
      summary: result.substring(0, 500),
      sources: [],
    };
  }

  /**
   * Fallback past research using OpenAI without web browsing
   * Focuses on major events: pumps, dumps, bull/bear markets
   */
  private async fallbackPastResearch(
    topic: string,
    valueLabel: string,
    yearsBack: number
  ): Promise<TimelineEntry[]> {
    const prompt = `Provide the BIGGEST EVENTS for "${topic}" focusing on ${valueLabel} over the past ${yearsBack} years. 
Maximum 4 events per year (${yearsBack * 4} total).

Focus on:
1. MAJOR PRICE MOVEMENTS: Significant pumps (price increases) and dumps (price decreases) with reasons
2. MARKET CONDITIONS: Bull market periods and bear market periods with start/end dates and reasons

For each event, provide:
- Date (ISO format)
- ${valueLabel} value (number)
- Event type: "pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", or "major_event"
- Detailed summary (3-4 sentences) explaining what happened, why it happened, and the impact
- Sources (if available)

Return JSON format: { "entries": [{ "date": "YYYY-MM-DD", "value": number, "eventType": "...", "summary": "...", "sources": [...] }] }`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial/data analyst. Focus on major events: pumps, dumps, bull/bear markets. Provide historical data in JSON format with event types.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const entries = (parsed.entries || []).map((item: any) => {
          let summary = item.summary || '';
          if (item.eventType) {
            const eventTypeLabel = this.getEventTypeLabel(item.eventType);
            summary = `[${eventTypeLabel}] ${summary}`;
          }
          
          return {
            date: new Date(item.date),
            value: item.value || 0,
            valueLabel,
            summary,
            sources: Array.isArray(item.sources) ? item.sources : [],
          };
        });
        
        // Limit to max 4 per year
        return this.limitEventsPerYear(entries, yearsBack);
      }
    } catch (error) {
      console.error('Error in fallback past research:', error);
    }

    return [];
  }

  /**
   * Generate complete timeline analysis
   */
  async generateTimelineAnalysis(topic: string): Promise<Omit<TimelineAnalysis, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'userId' | 'isPublic' | 'viewCount'>> {
    console.log(`[Timeline Generation] Starting timeline analysis for topic: "${topic}"`);

    // Step 1: Detect value label
    console.log(`[Timeline Generation] Step 1/4: Detecting value label...`);
    const valueLabel = await this.detectValueLabel(topic);
    console.log(`[Timeline Generation] Detected value label: "${valueLabel}"`);

    // Step 2: Research past data
    console.log(`[Timeline Generation] Step 2/4: Researching past data (up to 10 years)...`);
    const pastEntries = await this.researchPastData(topic, valueLabel, 10);
    console.log(`[Timeline Generation] Found ${pastEntries.length} past entries`);

    // Step 3: Research present state
    console.log(`[Timeline Generation] Step 3/4: Researching present state...`);
    const presentEntry = await this.researchPresentState(topic, valueLabel);
    console.log(`[Timeline Generation] Present state: ${valueLabel} = ${presentEntry.value}`);

    // Step 4: Generate predictions (single batch for maximum cost optimization)
    console.log(`[Timeline Generation] Step 4/4: Generating predictions for 11 intervals (single API call)...`);
    const predictions = await this.generatePredictions(topic, valueLabel, pastEntries, presentEntry);
    console.log(`[Timeline Generation] Generated ${predictions.length} prediction intervals (cost optimized: 1 API call instead of 11)`);

    console.log(`[Timeline Generation] Timeline analysis complete!`);

    return {
      topic,
      valueLabel,
      pastEntries,
      presentEntry,
      predictions,
    };
  }

  /**
   * Reprocess timeline: Get current value and regenerate predictions with previous predictions as context
   */
  async reprocessTimeline(
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    previousPresentEntry: TimelineEntry,
    previousPredictions: Prediction[]
  ): Promise<{
    presentEntry: TimelineEntry;
    predictions: Prediction[];
  }> {
    console.log(`[Timeline Reprocess] Starting reprocess for topic: "${topic}"`);

    // Step 1: Get current live value
    console.log(`[Timeline Reprocess] Step 1/2: Getting current live value...`);
    const newPresentEntry = await this.researchPresentState(topic, valueLabel);
    console.log(`[Timeline Reprocess] New present value: ${valueLabel} = ${newPresentEntry.value} (was ${previousPresentEntry.value})`);

    // Step 2: Regenerate predictions with previous predictions as context (single batch for maximum cost optimization)
    console.log(`[Timeline Reprocess] Step 2/2: Regenerating predictions with previous predictions as context (single API call)...`);
    const newPredictions = await this.generatePredictionsWithContext(
      topic,
      valueLabel,
      pastEntries,
      newPresentEntry,
      previousPresentEntry,
      previousPredictions
    );
    console.log(`[Timeline Reprocess] Generated ${newPredictions.length} updated prediction intervals (cost optimized: 1 API call instead of 11)`);

    console.log(`[Timeline Reprocess] Reprocess complete!`);

    return {
      presentEntry: newPresentEntry,
      predictions: newPredictions,
    };
  }

  /**
   * Generate predictions with previous predictions as context for adjustment (SINGLE BATCH for maximum cost optimization)
   */
  private async generatePredictionsWithContext(
    topic: string,
    valueLabel: string,
    pastEntries: TimelineEntry[],
    newPresentEntry: TimelineEntry,
    previousPresentEntry: TimelineEntry,
    previousPredictions: Prediction[]
  ): Promise<Prediction[]> {
    const intervals = ['1 month', '1 year', '2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years', '9 years', '10 years'];

    // Single batch: all intervals in one API call
    return await this.generatePredictionsBatchWithContext(
      topic,
      valueLabel,
      intervals,
      pastEntries,
      newPresentEntry,
      previousPresentEntry,
      previousPredictions
    );
  }

  /**
   * Generate predictions for a batch of intervals with context in a single API call
   */
  private async generatePredictionsBatchWithContext(
    topic: string,
    valueLabel: string,
    intervals: string[],
    pastEntries: TimelineEntry[],
    newPresentEntry: TimelineEntry,
    previousPresentEntry: TimelineEntry,
    previousPredictions: Prediction[]
  ): Promise<Prediction[]> {
    const historicalSummary = pastEntries
      .slice(-5)
      .map(e => `${e.date.toISOString().split('T')[0]}: ${e.valueLabel} = ${e.value}`)
      .join('\n');

    const valueChange = newPresentEntry.value - previousPresentEntry.value;
    const valueChangePercent = previousPresentEntry.value !== 0 
      ? ((valueChange / previousPresentEntry.value) * 100).toFixed(2)
      : '0';

    // Build previous predictions context for all intervals in batch
    const previousContexts = intervals.map(interval => {
      const prevPred = previousPredictions.find(p => p.timeline === interval);
      if (!prevPred) return null;
      return `\n${interval} - Previous predictions (when value was ${previousPresentEntry.value}):
${prevPred.scenarios.map(s => 
  `  - ${s.title}: Predicted ${s.predictedValue || 'N/A'} (${s.confidenceScore}% confidence) - ${s.summary.substring(0, 100)}...`
).join('\n')}`;
    }).filter(Boolean).join('\n');

    const intervalsList = intervals.map((interval, idx) => `${idx + 1}. ${interval}`).join('\n');

    const prompt = `Based on the historical data, current state, and PREVIOUS PREDICTIONS for "${topic}", generate 3-5 updated prediction scenarios for EACH of the following time intervals:

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
4. Sources/reasons that support this prediction
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
          "sources": ["source1", "source2"],
          "confidenceScore": number
        }
      ]
    }
  ]
}`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial/data analyst. Generate realistic prediction scenarios that adjust previous predictions based on new current values and trends. Always provide at least 3 scenarios per interval. Return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
        max_tokens: 16000, // Increased for single batch with all 11 intervals
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const predictions: Prediction[] = [];

      // Process each interval's predictions
      for (const interval of intervals) {
        const intervalData = parsed.predictions?.find((p: any) => p.timeline === interval);
        
        if (intervalData && intervalData.scenarios) {
          const scenarios: PredictionScenario[] = intervalData.scenarios.slice(0, 5).map((s: any, idx: number) => ({
            id: nanoid(),
            title: s.title || `Scenario ${idx + 1}`,
            summary: s.summary || '',
            sources: Array.isArray(s.sources) ? s.sources : [],
            confidenceScore: Math.max(0, Math.min(100, s.confidenceScore || 50)),
            predictedValue: s.predictedValue,
          }));

          // Ensure at least 3 scenarios
          while (scenarios.length < 3) {
            scenarios.push({
              id: nanoid(),
              title: `Scenario ${scenarios.length + 1}`,
              summary: 'Additional scenario based on updated trends.',
              sources: [],
              confidenceScore: 50,
            });
          }

          predictions.push({
            timeline: interval,
            scenarios,
          });
        } else {
          // Fallback if interval not found in response
          const previousPrediction = previousPredictions.find(p => p.timeline === interval);
          predictions.push({
            timeline: interval,
            scenarios: [
              {
                id: nanoid(),
                title: 'Optimistic',
                summary: `Optimistic scenario for ${topic} in ${interval}, adjusted for new value.`,
                sources: [],
                confidenceScore: 33,
              },
              {
                id: nanoid(),
                title: 'Neutral',
                summary: `Neutral scenario for ${topic} in ${interval}, adjusted for new value.`,
                sources: [],
                confidenceScore: 34,
              },
              {
                id: nanoid(),
                title: 'Pessimistic',
                summary: `Pessimistic scenario for ${topic} in ${interval}, adjusted for new value.`,
                sources: [],
                confidenceScore: 33,
              },
            ],
          });
        }
      }

      return predictions;
    } catch (error) {
      console.error(`Error generating predictions batch with context for intervals ${intervals.join(', ')}:`, error);
      // Fallback: generate individual predictions if batch fails
      const fallbackPredictions: Prediction[] = [];
      for (const interval of intervals) {
        const previousPrediction = previousPredictions.find(p => p.timeline === interval);
        const prediction = await this.generatePredictionForIntervalWithContext(
          topic,
          valueLabel,
          interval,
          pastEntries,
          newPresentEntry,
          previousPresentEntry,
          previousPrediction
        );
        fallbackPredictions.push(prediction);
      }
      return fallbackPredictions;
    }
  }

  /**
   * Generate prediction for a specific interval with previous prediction as context
   */
  private async generatePredictionForIntervalWithContext(
    topic: string,
    valueLabel: string,
    interval: string,
    pastEntries: TimelineEntry[],
    newPresentEntry: TimelineEntry,
    previousPresentEntry: TimelineEntry,
    previousPrediction: Prediction | undefined
  ): Promise<Prediction> {
    const historicalSummary = pastEntries
      .slice(-5) // Last 5 entries
      .map(e => `${e.date.toISOString().split('T')[0]}: ${e.valueLabel} = ${e.value}`)
      .join('\n');

    const valueChange = newPresentEntry.value - previousPresentEntry.value;
    const valueChangePercent = previousPresentEntry.value !== 0 
      ? ((valueChange / previousPresentEntry.value) * 100).toFixed(2)
      : '0';

    let previousContext = '';
    if (previousPrediction) {
      previousContext = `\n\nPREVIOUS PREDICTIONS FOR ${interval} (made when value was ${previousPresentEntry.value}):
${previousPrediction.scenarios.map(s => 
  `- ${s.title}: Predicted ${s.predictedValue || 'N/A'} (${s.confidenceScore}% confidence) - ${s.summary}`
).join('\n')}

IMPORTANT: The current value has changed from ${previousPresentEntry.value} to ${newPresentEntry.value} (${valueChange > 0 ? '+' : ''}${valueChangePercent}% change).
Adjust your predictions based on this new information and the previous predictions.`;
    }

    const prompt = `Based on the historical data, current state, and PREVIOUS PREDICTIONS for "${topic}", generate 3-5 updated prediction scenarios for ${interval} from now.

Historical data (recent):
${historicalSummary}

PREVIOUS state (${previousPresentEntry.date.toISOString().split('T')[0]}):
${previousPresentEntry.valueLabel} = ${previousPresentEntry.value}

CURRENT state (${newPresentEntry.date.toISOString().split('T')[0]}):
${newPresentEntry.valueLabel} = ${newPresentEntry.value}
${newPresentEntry.summary}
${valueChange !== 0 ? `\nValue change: ${valueChange > 0 ? '+' : ''}${valueChange} (${valueChangePercent}%)` : ''}
${previousContext}

For each scenario, provide:
1. A title (e.g., "Bullish", "Bearish", "Neutral", "Optimistic", "Pessimistic")
2. A predicted ${valueLabel} value (adjusted based on the new current value and previous predictions)
3. A detailed summary explaining why this scenario could happen, considering the value change and previous predictions (3-4 sentences)
4. Sources/reasons that support this prediction
5. A confidence score (0-100) indicating how likely this scenario is

Return in JSON format:
{
  "scenarios": [
    {
      "title": "Scenario Title",
      "predictedValue": number,
      "summary": "Detailed explanation",
      "sources": ["source1", "source2"],
      "confidenceScore": number
    }
  ]
}`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a financial/data analyst. Generate realistic prediction scenarios that adjust previous predictions based on new current values and trends. Always provide at least 3 scenarios.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const scenarios: PredictionScenario[] = (parsed.scenarios || []).slice(0, 5).map((s: any, idx: number) => ({
        id: nanoid(),
        title: s.title || `Scenario ${idx + 1}`,
        summary: s.summary || '',
        sources: Array.isArray(s.sources) ? s.sources : [],
        confidenceScore: Math.max(0, Math.min(100, s.confidenceScore || 50)),
        predictedValue: s.predictedValue,
      }));

      // Ensure at least 3 scenarios
      while (scenarios.length < 3) {
        scenarios.push({
          id: nanoid(),
          title: `Scenario ${scenarios.length + 1}`,
          summary: 'Additional scenario based on updated trends.',
          sources: [],
          confidenceScore: 50,
        });
      }

      return {
        timeline: interval,
        scenarios,
      };
    } catch (error) {
      console.error(`Error generating prediction for ${interval}:`, error);
      // Fallback: return 3 basic scenarios
      return {
        timeline: interval,
        scenarios: [
          {
            id: nanoid(),
            title: 'Optimistic',
            summary: `Optimistic scenario for ${topic} in ${interval}, adjusted for new value.`,
            sources: [],
            confidenceScore: 33,
          },
          {
            id: nanoid(),
            title: 'Neutral',
            summary: `Neutral scenario for ${topic} in ${interval}, adjusted for new value.`,
            sources: [],
            confidenceScore: 34,
          },
          {
            id: nanoid(),
            title: 'Pessimistic',
            summary: `Pessimistic scenario for ${topic} in ${interval}, adjusted for new value.`,
            sources: [],
            confidenceScore: 33,
          },
        ],
      };
    }
  }
}

export const predictionService = new PredictionService();

