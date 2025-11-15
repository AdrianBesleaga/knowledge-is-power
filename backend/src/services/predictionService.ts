import OpenAI from 'openai';
import { TimelineEntry, Prediction, PredictionScenario, TimelineAnalysis } from '../types';
import { nanoid } from 'nanoid';
import { JSON_SCHEMA } from './schemas';
import { PROMPTS, SYSTEM_MESSAGES } from './prompts';

// Lazy initialization to ensure dotenv is loaded first
let openai: OpenAI | null = null;

/**
 * Validate and format sources to ensure they are valid HTTP URLs
 */
function validateAndFormatSources(sources: string[]): string[] {
  if (!Array.isArray(sources)) return [];

  return sources
    .map(source => {
      if (typeof source !== 'string') return null;

      const trimmed = source.trim();

      // If it's already a valid HTTP URL, return it
      try {
        const url = new URL(trimmed);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return url.toString();
        }
      } catch {
        // Not a valid URL, try to fix it
      }

      // Try to extract URL from text that might contain it
      const urlRegex = /(https?:\/\/[^\s<>"']+)/i;
      const match = trimmed.match(urlRegex);
      if (match) {
        try {
          const url = new URL(match[1]);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.toString();
          }
        } catch {
          // Invalid URL
        }
      }

      // If no valid URL found, return null (will be filtered out)
      return null;
    })
    .filter((source): source is string => source !== null);
}

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

    const data = await response.json() as any;
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
    const prompt = PROMPTS.detectValueLabel(topic);

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_MESSAGES.VALUE_LABEL_DETECTOR,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search the web for information about what metrics are commonly tracked for this topic',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query about common metrics for this topic',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 30,
      });

      const label = completion.choices[0]?.message?.content?.trim() || 'Value';
      return label;
    } catch (error) {
      console.error('Error detecting value label:', error);
      return 'Value';
    }
  }

  /**
   * Research both past data and current state using AI with web access in a SINGLE REQUEST
   * Focuses on major events: big pumps/dumps and market conditions (bull/bear markets)
   */
  async researchCombinedData(
    topic: string,
    valueLabel: string,
    yearsBack: number = 10
  ): Promise<{
    pastEntries: TimelineEntry[];
    presentEntry: TimelineEntry;
  }> {
    const currentDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(currentDate.getFullYear() - yearsBack);

    // Use OpenAI with function calling for web browsing, or Perplexity as fallback
    const usePerplexity = !!process.env.PERPLEXITY_API_KEY;

    const query = PROMPTS.combinedResearch(topic, valueLabel, currentDate, startDate);

    try {
      let researchResult: string;

      if (usePerplexity) {
        // Use Perplexity API (has built-in web access)
        researchResult = await callPerplexityAPI(query);
      } else {
        // Use OpenAI GPT-4o-mini with function calling for web browsing
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.FINANCIAL_ANALYST,
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
                description: 'Search the web for current market data, historical prices, news events, and official statistics',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Specific search query for market data, historical events, or current values',
                    },
                  },
                  required: ['query'],
                },
              },
            },
          ],
          tool_choice: 'auto',
          temperature: 0.2, // Lower temperature for more factual responses
          max_tokens: 6000, // Increased for comprehensive data
        });

        researchResult = completion.choices[0]?.message?.content || '';
      }

      // Parse the combined research result
      const { pastEntries, presentEntry } = await this.parseCombinedResearchResult(researchResult, valueLabel, currentDate);

      // Limit historical events to max 4 per year and sort by date
      const limitedPastEntries = this.limitEventsPerYear(pastEntries, yearsBack);

      return {
        pastEntries: limitedPastEntries,
        presentEntry,
      };
    } catch (error) {
      console.error('Error researching combined data:', error);
      // Fallback: use separate methods
      const pastEntries = await this.fallbackPastResearch(topic, valueLabel, yearsBack);
      const presentEntry = await this.fallbackPresentResearch(topic, valueLabel);
      return { pastEntries, presentEntry };
    }
  }

  /**
   * Fallback method for present research when combined research fails
   */
  private async fallbackPresentResearch(topic: string, valueLabel: string): Promise<TimelineEntry> {
    const currentDate = new Date();
    return {
      date: currentDate,
      value: 0,
      valueLabel,
      summary: `Current state information for ${topic} is not available.`,
      sources: [],
    };
  }

  /**
   * Research past data using AI with web access (legacy method, kept for compatibility)
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

    const query = PROMPTS.researchPastData(topic, valueLabel, startDate, currentDate);

    try {
      let researchResult: string;

      if (usePerplexity) {
        // Use Perplexity API (has built-in web access)
        researchResult = await callPerplexityAPI(query);
      } else {
        // Use OpenAI GPT-4o-mini with function calling for web browsing
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.HISTORICAL_ANALYST,
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
                description: 'Search historical market data, news archives, and financial records for significant events',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search query for historical market events and data',
                    },
                  },
                  required: ['query'],
                },
              },
            },
          ],
          tool_choice: 'auto',
          temperature: 0.3, // Lower temperature for factual historical data
          max_tokens: 5000,
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
    const query = PROMPTS.researchPresentState(topic, valueLabel, currentDate);

    const usePerplexity = !!process.env.PERPLEXITY_API_KEY;

    try {
      let researchResult: string;

      if (usePerplexity) {
        researchResult = await callPerplexityAPI(query);
      } else {
        const completion = await getOpenAIClient().chat.completions.create({
          model: 'gpt-5-mini',
          messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.MARKET_DATA_SPECIALIST,
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
                description: 'Search for current market prices, real-time data, and official statistics',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search query for current market data or prices',
                    },
                  },
                  required: ['query'],
                },
              },
            },
          ],
          tool_choice: 'auto',
          temperature: 0.1, // Very low for factual data
          max_tokens: 2500,
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

    const prompt = PROMPTS.generatePredictionsBatch(
      topic,
      valueLabel,
      intervalsList,
      historicalSummary,
      presentEntry
    );

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_MESSAGES.SENIOR_FINANCIAL_ANALYST,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search for current market news, analyst reports, economic data, and industry developments to support predictions',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for market data, news, or economic indicators',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.6, // Balanced creativity and accuracy
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'predictions_batch',
            schema: JSON_SCHEMA.PREDICTIONS_BATCH,
            strict: true,
          },
        },
        max_tokens: 18000, // Increased for comprehensive analysis
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
            sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
            confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
            predictedValue: s.predictedValue,
          }));

          // Schema requires at least 3 scenarios, but validate just in case
          if (scenarios.length < 3) {
            console.warn(`Warning: Only ${scenarios.length} scenarios received for interval ${interval}, expected at least 3. Schema should enforce this.`);
          }

          predictions.push({
            timeline: interval,
            scenarios,
          });
        } else {
          // Interval not found in response - this shouldn't happen with strict schema
          console.error(`Error: Interval "${interval}" not found in AI response. Schema should enforce all intervals are present.`);
          // Skip this interval rather than creating hardcoded fallback scenarios
          // The schema should ensure all intervals are provided by the AI
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

    const prompt = PROMPTS.generatePredictionForInterval(
      topic,
      valueLabel,
      interval,
      historicalSummary,
      presentEntry
    );

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_MESSAGES.SENIOR_FINANCIAL_ANALYST,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search for current market news, analyst reports, economic data, and industry developments to support predictions',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for market data, news, or economic indicators',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.6, // Balanced creativity and accuracy
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'prediction_scenarios',
            schema: JSON_SCHEMA.PREDICTION_SCENARIOS,
            strict: true,
          },
        },
        max_tokens: 3500,
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
        sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
        confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
        predictedValue: s.predictedValue,
      }));

      // Schema requires at least 3 scenarios, but validate just in case
      if (scenarios.length < 3) {
        console.warn(`Warning: Only ${scenarios.length} scenarios received for interval ${interval}, expected at least 3. Schema should enforce this.`);
      }

      return {
        timeline: interval,
        scenarios,
      };
    } catch (error) {
      console.error(`Error generating prediction for ${interval}:`, error);
      // Error case - throw error instead of returning hardcoded scenarios
      // The AI should always provide valid scenarios with confidence scores
      throw new Error(`Failed to generate predictions for interval ${interval}. AI should provide scenarios with confidence scores.`);
    }
  }

  /**
   * Parse combined research result into past entries and present entry
   */
  private async parseCombinedResearchResult(
    result: string,
    valueLabel: string,
    currentDate: Date
  ): Promise<{
    pastEntries: TimelineEntry[];
    presentEntry: TimelineEntry;
  }> {
    try {
      // Try to extract JSON from the result
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Parse current data
        const presentEntry: TimelineEntry = {
          date: currentDate,
          value: parsed.current?.value || 0,
          valueLabel,
          summary: parsed.current?.summary || '',
          sources: validateAndFormatSources(Array.isArray(parsed.current?.sources) ? parsed.current.sources : []),
        };

        // Parse historical data
        const pastEntries: TimelineEntry[] = [];
        if (Array.isArray(parsed.historical || parsed.entries)) {
          const data = parsed.historical || parsed.entries;
          for (const item of data) {
            if (item.date && typeof item.value === 'number') {
              // Build enhanced summary with event type information
              let summary = item.summary || '';
              if (item.eventType) {
                const eventTypeLabel = this.getEventTypeLabel(item.eventType);
                summary = `[${eventTypeLabel}] ${summary}`;
              }

              pastEntries.push({
                date: new Date(item.date),
                value: item.value,
                valueLabel,
                summary,
                sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
              });
            }
          }
        }

        return {
          pastEntries: pastEntries.sort((a, b) => a.date.getTime() - b.date.getTime()),
          presentEntry,
        };
      }
    } catch (error) {
      console.error('Error parsing combined research result:', error);
    }

    // Fallback: try to parse as separate sections
    return await this.fallbackParseCombinedResult(result, valueLabel, currentDate);
  }

  /**
   * Fallback parsing for combined research result when JSON parsing fails
   */
  private async fallbackParseCombinedResult(
    result: string,
    valueLabel: string,
    currentDate: Date
  ): Promise<{
    pastEntries: TimelineEntry[];
    presentEntry: TimelineEntry;
  }> {
    // Try to extract current value from text
    const presentEntry: TimelineEntry = {
      date: currentDate,
      value: 0,
      valueLabel,
      summary: 'Current state information extracted from research.',
      sources: [],
    };

    // Try to extract past entries using the existing text parsing method
    const pastEntries = await this.extractEntriesFromText(result, valueLabel);

    return { pastEntries, presentEntry };
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
                sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
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
      const sorted = yearEntries.sort((a: TimelineEntry, b: TimelineEntry) => {
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
    const prompt = PROMPTS.extractEntriesFromText(valueLabel, text);

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.DATA_EXTRACTION_SPECIALIST,
            },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search the web to verify historical dates, prices, and event details',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query to verify historical event data',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.2,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'historical_entries',
            schema: JSON_SCHEMA.HISTORICAL_ENTRIES,
            strict: true,
          },
        },
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
            sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
          };
        });
        return entries.sort((a: TimelineEntry, b: TimelineEntry) => a.date.getTime() - b.date.getTime());
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
          sources: validateAndFormatSources(Array.isArray(parsed.sources) ? parsed.sources : []),
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
   * Fallback past research using GPT-5 Mini with web browsing
   * Focuses on major events: pumps, dumps, bull/bear markets
   */
  private async fallbackPastResearch(
    topic: string,
    valueLabel: string,
    yearsBack: number
  ): Promise<TimelineEntry[]> {
    const prompt = PROMPTS.fallbackPastResearch(topic, valueLabel, yearsBack);

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.HISTORICAL_RESEARCHER,
            },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search historical market data and news archives for significant events',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for historical market events',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.4, // Balanced for historical research
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'historical_entries',
            schema: JSON_SCHEMA.HISTORICAL_ENTRIES,
            strict: true,
          },
        },
        max_tokens: 3500,
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
            sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
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
   * Generate complete timeline analysis in a SINGLE API call
   * Gets value label, past data, current data, and predictions all at once
   */
  async generateTimelineAnalysis(topic: string): Promise<Omit<TimelineAnalysis, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'userId' | 'isPublic' | 'viewCount'>> {
    console.log(`[Timeline Generation] Starting complete timeline analysis for topic: "${topic}" (single API call)`);

    const currentDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(currentDate.getFullYear() - 10);

    const intervals = ['1 month', '1 year', '2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years', '9 years', '10 years'];
    const intervalsList = intervals.map((interval, idx) => `${idx + 1}. ${interval}`).join('\n');

    const prompt = PROMPTS.generateTimelineAnalysis(topic, currentDate, startDate, intervalsList);

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.COMPREHENSIVE_ANALYST,
            },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search the web for current market data, historical prices, news events, analyst reports, and official statistics',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for market data, historical events, current prices, or predictions',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.3,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'timeline_analysis',
            schema: JSON_SCHEMA.TIMELINE_ANALYSIS,
            strict: true,
          },
        },
        max_tokens: 20000, // Large token limit for comprehensive response
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      // Extract value label
      const valueLabel = parsed.valueLabel || 'Value';
      console.log(`[Timeline Generation] Detected value label: "${valueLabel}"`);

      // Parse current state
      const presentEntry: TimelineEntry = {
        date: currentDate,
        value: parsed.current?.value || 0,
        valueLabel,
        summary: parsed.current?.summary || '',
        sources: validateAndFormatSources(Array.isArray(parsed.current?.sources) ? parsed.current.sources : []),
      };
      console.log(`[Timeline Generation] Current value: ${valueLabel} = ${presentEntry.value}`);

      // Parse historical data
      const pastEntries: TimelineEntry[] = [];
      if (Array.isArray(parsed.historical)) {
        for (const item of parsed.historical) {
          if (item.date && typeof item.value === 'number') {
            let summary = item.summary || '';
            if (item.eventType) {
              const eventTypeLabel = this.getEventTypeLabel(item.eventType);
              summary = `[${eventTypeLabel}] ${summary}`;
            }

            pastEntries.push({
              date: new Date(item.date),
              value: item.value,
              valueLabel,
              summary,
              sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
            });
          }
        }
      }
      
      // Limit to max 4 events per year
      const limitedPastEntries = this.limitEventsPerYear(pastEntries, 10);
      console.log(`[Timeline Generation] Found ${limitedPastEntries.length} past entries`);

      // Parse predictions
      const predictions: Prediction[] = [];
      if (Array.isArray(parsed.predictions)) {
        for (const pred of parsed.predictions) {
          if (pred.timeline && Array.isArray(pred.scenarios)) {
            const scenarios: PredictionScenario[] = pred.scenarios.slice(0, 5).map((s: any, idx: number) => ({
              id: nanoid(),
              title: s.title || `Scenario ${idx + 1}`,
              summary: s.summary || '',
              sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
              confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
              predictedValue: s.predictedValue,
            }));

            // Schema requires at least 3 scenarios, but validate just in case
            if (scenarios.length < 3) {
              console.warn(`Warning: Only ${scenarios.length} scenarios received for interval ${pred.timeline}, expected at least 3. Schema should enforce this.`);
            }

            predictions.push({
              timeline: pred.timeline,
              scenarios,
            });
          }
        }
      }

      // Validate all intervals are present - schema should enforce this
      for (const interval of intervals) {
        if (!predictions.find(p => p.timeline === interval)) {
          console.error(`Error: Interval "${interval}" missing from AI response. Schema should enforce all intervals are present.`);
        }
      }

      console.log(`[Timeline Generation] Generated ${predictions.length} prediction intervals`);
      console.log(`[Timeline Generation] Complete! (Single API call)`);

      return {
        topic,
        valueLabel,
        pastEntries: limitedPastEntries,
        presentEntry,
        predictions: predictions.sort((a, b) => {
          const order = intervals.indexOf(a.timeline) - intervals.indexOf(b.timeline);
          return order;
        }),
      };
    } catch (error) {
      console.error('[Timeline Generation] Error in single API call, falling back to multi-call approach:', error);
      // Fallback to original multi-call approach if single call fails
      return this.generateTimelineAnalysisFallback(topic);
    }
  }

  /**
   * Fallback method using multiple API calls (original approach)
   */
  private async generateTimelineAnalysisFallback(topic: string): Promise<Omit<TimelineAnalysis, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'userId' | 'isPublic' | 'viewCount'>> {
    console.log(`[Timeline Generation] Using fallback multi-call approach for topic: "${topic}"`);

    const valueLabel = await this.detectValueLabel(topic);
    const { pastEntries, presentEntry } = await this.researchCombinedData(topic, valueLabel, 10);
    const predictions = await this.generatePredictions(topic, valueLabel, pastEntries, presentEntry);

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

    const prompt = PROMPTS.generatePredictionsBatchWithContext(
      topic,
      valueLabel,
      intervalsList,
      historicalSummary,
      previousPresentEntry,
      newPresentEntry,
      valueChange,
      valueChangePercent,
      previousContexts
    );

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.PREDICTION_ADJUSTER,
            },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'predictions_batch',
            schema: JSON_SCHEMA.PREDICTIONS_BATCH,
            strict: true,
          },
        },
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
            sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
            confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
            predictedValue: s.predictedValue,
          }));

          // Schema requires at least 3 scenarios, but validate just in case
          if (scenarios.length < 3) {
            console.warn(`Warning: Only ${scenarios.length} scenarios received for interval ${interval}, expected at least 3. Schema should enforce this.`);
          }

          predictions.push({
            timeline: interval,
            scenarios,
          });
        } else {
          // Interval not found in response - this shouldn't happen with strict schema
          console.error(`Error: Interval "${interval}" not found in AI response. Schema should enforce all intervals are present.`);
          // Skip this interval rather than creating hardcoded fallback scenarios
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

    const prompt = PROMPTS.generatePredictionForIntervalWithContext(
      topic,
      valueLabel,
      interval,
      historicalSummary,
      previousPresentEntry,
      newPresentEntry,
      valueChange,
      valueChangePercent,
      previousContext
    );

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
            {
              role: 'system',
              content: SYSTEM_MESSAGES.PREDICTION_REVISER,
            },
          {
            role: 'user',
            content: prompt,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_web',
              description: 'Search for current market news, analyst reports, and economic data to understand value changes and support updated predictions',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query for market data, news, or economic indicators',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
        tool_choice: 'auto',
        temperature: 0.6, // Balanced creativity and accuracy
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'prediction_scenarios',
            schema: JSON_SCHEMA.PREDICTION_SCENARIOS,
            strict: true,
          },
        },
        max_tokens: 3500,
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
        sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
        confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
        predictedValue: s.predictedValue,
      }));

      // Schema requires at least 3 scenarios, but validate just in case
      if (scenarios.length < 3) {
        console.warn(`Warning: Only ${scenarios.length} scenarios received for interval ${interval}, expected at least 3. Schema should enforce this.`);
      }

      return {
        timeline: interval,
        scenarios,
      };
    } catch (error) {
      console.error(`Error generating prediction for ${interval}:`, error);
      // Error case - throw error instead of returning hardcoded scenarios
      // The AI should always provide valid scenarios with confidence scores
      throw new Error(`Failed to generate predictions for interval ${interval}. AI should provide scenarios with confidence scores.`);
    }
  }
}

export const predictionService = new PredictionService();

