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

      // Parse historical data - schema enforces max 4 events per year (40 total)
      const pastEntries: TimelineEntry[] = [];
      if (Array.isArray(parsed.historical)) {
        for (const item of parsed.historical) {
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
          }
        }
      }
      
      // Sort entries by date (schema ensures max 4 per year)
      const sortedPastEntries = pastEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
      console.log(`[Timeline Generation] Found ${sortedPastEntries.length} past entries`);

      // Parse predictions
      const predictions: Prediction[] = [];
      if (Array.isArray(parsed.predictions)) {
        for (const pred of parsed.predictions) {
          if (pred.timeline && Array.isArray(pred.scenarios)) {
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
        pastEntries: sortedPastEntries,
        presentEntry,
        predictions: predictions.sort((a, b) => {
          const order = intervals.indexOf(a.timeline) - intervals.indexOf(b.timeline);
          return order;
        }),
      };
    } catch (error) {
      console.error('[Timeline Generation] Error in single API call:', error);
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
