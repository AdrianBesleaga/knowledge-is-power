import OpenAI from 'openai';
import { TimelineEntry, Prediction, PredictionScenario, TimelineAnalysis } from '../types';
import { nanoid } from 'nanoid';
import { JSON_SCHEMA } from './schemas';
import { PROMPTS, SYSTEM_MESSAGES } from './prompts';
import { validateAndFormatSources, getEventTypeLabel } from '../utils/predictionUtils';

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

export class PredictionService {
  /**
   * Generate complete timeline analysis in a SINGLE API call
   * Gets value label, past data, current data, and predictions all at once
   * Uses internet access to get past data and current day data
   */
  async generateTimelineAnalysis(topic: string): Promise<Omit<TimelineAnalysis, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'userId' | 'isPublic' | 'viewCount'>> {
    console.log(`[Timeline Generation] Starting complete timeline analysis for topic: "${topic}" (single API call)`);

    const currentDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(currentDate.getFullYear() - 10);
    console.log(`[Timeline Generation] Date range: ${startDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);

    const intervals = ['1 month', '1 year', '2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years', '9 years', '10 years'];
    const intervalsList = intervals.map((interval, idx) => `${idx + 1}. ${interval}`).join('\n');
    console.log(`[Timeline Generation] Prediction intervals: ${intervals.length} intervals configured`);

    console.log(`[Timeline Generation] Generating prompt...`);
    const prompt = PROMPTS.generateTimelineAnalysis(topic, currentDate, startDate, intervalsList);
    console.log(`[Timeline Generation] Prompt generated (${prompt.length} characters)`);

    console.log(`[Timeline Generation] Preparing API request...`);
    console.log(`[Timeline Generation] Model: gpt-5-mini, Max tokens: 20000, Tool choice: none, Response format: strict JSON schema`);

    const apiCallStartTime = Date.now();
    try {
      console.log(`[Timeline Generation] Making API call to OpenAI...`);
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
        tool_choice: 'none', // Force direct JSON response when using strict JSON schema
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'timeline_analysis',
            schema: JSON_SCHEMA.TIMELINE_ANALYSIS,
            strict: true,
          },
        },
        max_completion_tokens: 20000, // Large token limit for comprehensive response
      });

      const apiCallDuration = Date.now() - apiCallStartTime;
      console.log(`[Timeline Generation] API call completed in ${apiCallDuration}ms`);

      console.log(`[Timeline Generation] Processing API response...`);
      console.log(`[Timeline Generation] Response has ${completion.choices?.length || 0} choices`);
      
      const message = completion.choices[0]?.message;
      if (!message) {
        console.error(`[Timeline Generation] ERROR: No message in OpenAI response`);
        console.error(`[Timeline Generation] Response structure:`, JSON.stringify(completion, null, 2));
        throw new Error('No message in OpenAI response');
      }

      console.log(`[Timeline Generation] Message role: ${message.role}`);
      console.log(`[Timeline Generation] Message has content: ${!!message.content}`);
      console.log(`[Timeline Generation] Message has tool_calls: ${!!message.tool_calls}`);
      if (message.tool_calls) {
        console.log(`[Timeline Generation] Tool calls count: ${message.tool_calls.length}`);
      }

      // Check if the model used tools instead of returning content directly
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Timeline Generation] ERROR: Model used tools (${message.tool_calls.length} calls). Tool calls are not supported with strict JSON schema.`);
        console.log(`[Timeline Generation] Tool calls:`, JSON.stringify(message.tool_calls, null, 2));
        throw new Error('Model attempted to use tools instead of returning JSON. This may indicate the model needs web search capabilities, but strict JSON schema mode requires direct JSON response.');
      }

      const content = message.content;
      if (!content) {
        console.error(`[Timeline Generation] ERROR: No content in response`);
        console.error(`[Timeline Generation] Full message:`, JSON.stringify(message, null, 2));
        throw new Error('No content in OpenAI response. The model may have used tools or returned an empty response.');
      }

      console.log(`[Timeline Generation] Content received (${content.length} characters)`);
      console.log(`[Timeline Generation] Full AI response:`, content);
      console.log(`[Timeline Generation] Parsing JSON response...`);
      
      let parsed;
      try {
        parsed = JSON.parse(content);
        console.log(`[Timeline Generation] JSON parsed successfully`);
        console.log(`[Timeline Generation] Parsed structure:`, JSON.stringify(parsed, null, 2));
      } catch (parseError) {
        console.error(`[Timeline Generation] ERROR: Failed to parse JSON`);
        console.error(`[Timeline Generation] Parse error:`, parseError);
        console.error(`[Timeline Generation] Content preview (first 500 chars):`, content.substring(0, 500));
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      // Extract value label
      console.log(`[Timeline Generation] Extracting value label...`);
      const valueLabel = parsed.valueLabel || 'Value';
      console.log(`[Timeline Generation] Detected value label: "${valueLabel}"`);

      // Parse current state
      console.log(`[Timeline Generation] Parsing current state...`);
      const presentEntry: TimelineEntry = {
        date: currentDate,
        value: parsed.current?.value || 0,
        valueLabel,
        summary: parsed.current?.summary || '',
        sources: validateAndFormatSources(Array.isArray(parsed.current?.sources) ? parsed.current.sources : []),
      };
      console.log(`[Timeline Generation] Current value: ${valueLabel} = ${presentEntry.value}`);
      console.log(`[Timeline Generation] Current summary length: ${presentEntry.summary.length} characters`);
      console.log(`[Timeline Generation] Current sources count: ${presentEntry.sources.length}`);

      // Parse historical data - schema enforces max 4 events per year (40 total)
      console.log(`[Timeline Generation] Parsing historical data...`);
      const pastEntries: TimelineEntry[] = [];
      if (Array.isArray(parsed.historical)) {
        console.log(`[Timeline Generation] Historical array has ${parsed.historical.length} items`);
        for (let i = 0; i < parsed.historical.length; i++) {
          const item = parsed.historical[i];
          if (item.date && typeof item.value === 'number') {
            let summary = item.summary || '';
            if (item.eventType) {
              const eventTypeLabel = getEventTypeLabel(item.eventType);
              summary = `[${eventTypeLabel}] ${summary}`;
            }

            pastEntries.push({
              date: new Date(item.date),
              value: item.value,
              valueLabel,
              summary,
              sources: validateAndFormatSources(Array.isArray(item.sources) ? item.sources : []),
            });
          } else {
            console.log(`[Timeline Generation] Skipping invalid historical item ${i}: missing date or value`);
          }
        }
      } else {
        console.log(`[Timeline Generation] WARNING: Historical data is not an array:`, typeof parsed.historical);
      }
      
      // Sort entries by date (schema ensures max 4 per year)
      const sortedPastEntries = pastEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
      console.log(`[Timeline Generation] Found ${sortedPastEntries.length} valid past entries`);

      // Parse predictions
      console.log(`[Timeline Generation] Parsing predictions...`);
      const predictions: Prediction[] = [];
      if (Array.isArray(parsed.predictions)) {
        console.log(`[Timeline Generation] Predictions array has ${parsed.predictions.length} items`);
        for (let i = 0; i < parsed.predictions.length; i++) {
          const pred = parsed.predictions[i];
          if (pred.timeline && Array.isArray(pred.scenarios)) {
            console.log(`[Timeline Generation] Processing prediction for timeline: "${pred.timeline}" with ${pred.scenarios.length} scenarios`);
            const scenarios: PredictionScenario[] = pred.scenarios.map((s: any, idx: number) => ({
              id: nanoid(),
              title: s.title || `Scenario ${idx + 1}`,
              summary: s.summary || '',
              sources: validateAndFormatSources(Array.isArray(s.sources) ? s.sources : []),
              confidenceScore: Math.max(0, Math.min(100, s.confidenceScore ?? 0)),
              predictedValue: s.predictedValue,
            }));

            predictions.push({
              timeline: pred.timeline,
              scenarios,
            });
          } else {
            console.log(`[Timeline Generation] Skipping invalid prediction ${i}: missing timeline or scenarios`);
          }
        }
      } else {
        console.log(`[Timeline Generation] WARNING: Predictions data is not an array:`, typeof parsed.predictions);
      }

      // Validate all intervals are present - schema should enforce this
      console.log(`[Timeline Generation] Validating prediction intervals...`);
      const missingIntervals: string[] = [];
      for (const interval of intervals) {
        if (!predictions.find(p => p.timeline === interval)) {
          missingIntervals.push(interval);
          console.error(`[Timeline Generation] ERROR: Interval "${interval}" missing from AI response`);
        }
      }
      if (missingIntervals.length > 0) {
        console.error(`[Timeline Generation] Missing intervals: ${missingIntervals.join(', ')}`);
      }

      console.log(`[Timeline Generation] Generated ${predictions.length} prediction intervals`);
      console.log(`[Timeline Generation] Sorting predictions by timeline order...`);
      const sortedPredictions = predictions.sort((a, b) => {
        const order = intervals.indexOf(a.timeline) - intervals.indexOf(b.timeline);
        return order;
      });
      
      const totalDuration = Date.now() - apiCallStartTime;
      console.log(`[Timeline Generation] Complete! Total duration: ${totalDuration}ms`);
      console.log(`[Timeline Generation] Summary: ${sortedPastEntries.length} past entries, 1 present entry, ${sortedPredictions.length} prediction intervals`);

      return {
        topic,
        valueLabel,
        pastEntries: sortedPastEntries,
        presentEntry,
        predictions: sortedPredictions,
      };
    } catch (error) {
      const errorDuration = Date.now() - apiCallStartTime;
      console.error(`[Timeline Generation] ERROR in single API call after ${errorDuration}ms`);
      console.error(`[Timeline Generation] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
      console.error(`[Timeline Generation] Error message:`, error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(`[Timeline Generation] Error stack:`, error.stack);
      }
      throw error;
    }
  }

  /**
   * Reprocess timeline: Get current value and regenerate predictions
   * Makes a single API call to get updated current state and new predictions
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

    // Simply regenerate the entire timeline - the AI will get current data and generate new predictions
    const fullAnalysis = await this.generateTimelineAnalysis(topic);

    console.log(`[Timeline Reprocess] Reprocess complete!`);

    return {
      presentEntry: fullAnalysis.presentEntry,
      predictions: fullAnalysis.predictions,
    };
  }
}

export const predictionService = new PredictionService();
