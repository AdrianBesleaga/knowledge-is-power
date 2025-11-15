/**
 * JSON Schema constants for AI request responses
 * These schemas are used with OpenAI's structured outputs feature
 */
export const JSON_SCHEMA = {
  /**
   * Schema for timeline analysis response (complete analysis with valueLabel, current, historical, and predictions)
   */
  TIMELINE_ANALYSIS: {
    type: 'object',
    properties: {
      valueLabel: {
        type: 'string',
        description: 'The label describing the value being tracked (e.g., "Price (USD)", "Population")',
      },
      current: {
        type: 'object',
        properties: {
          value: {
            type: 'number',
            description: 'The current value of the metric',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of current market conditions (2-3 sentences)',
          },
          sources: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri',
            },
            description: 'Array of valid HTTP/HTTPS URLs from reputable sources',
          },
        },
        required: ['value', 'summary', 'sources'],
      },
      historical: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Date in YYYY-MM-DD format',
            },
            value: {
              type: 'number',
              description: 'The value at that point in time',
            },
            eventType: {
              type: 'string',
              enum: ['pump', 'dump', 'bull_market_start', 'bull_market_end', 'bear_market_start', 'bear_market_end', 'major_event'],
              description: 'Type of event that occurred',
            },
            summary: {
              type: 'string',
              description: 'Detailed summary explaining what happened, why, and impact (3-4 sentences)',
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'Array of valid HTTP/HTTPS URLs from reputable sources',
            },
          },
          required: ['date', 'value', 'eventType', 'summary', 'sources'],
        },
        description: 'Array of historical events, maximum 4 per year',
      },
      predictions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timeline: {
              type: 'string',
              description: 'Time interval (e.g., "1 month", "1 year", "2 years")',
            },
            scenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Descriptive title for the scenario (e.g., "Strong Bull Market Recovery")',
                  },
                  predictedValue: {
                    type: 'number',
                    description: 'Specific predicted value based on current trends',
                  },
                  summary: {
                    type: 'string',
                    description: 'Detailed analysis explaining drivers, supporting evidence, and market logic (3-4 sentences)',
                  },
                  sources: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'uri',
                    },
                    description: 'Array of valid HTTP/HTTPS URLs from recent news or analyst reports',
                  },
                  confidenceScore: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    description: 'Confidence score based on current market data and historical precedents',
                  },
                },
                required: ['title', 'predictedValue', 'summary', 'sources', 'confidenceScore'],
              },
              minItems: 3,
              maxItems: 5,
              description: 'Array of 3-5 prediction scenarios for this timeline',
            },
          },
          required: ['timeline', 'scenarios'],
        },
        description: 'Array of predictions for different time intervals',
      },
    },
    required: ['valueLabel', 'current', 'historical', 'predictions'],
  },

  /**
   * Schema for predictions batch response (predictions for multiple intervals)
   */
  PREDICTIONS_BATCH: {
    type: 'object',
    properties: {
      predictions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timeline: {
              type: 'string',
              description: 'Time interval (e.g., "1 month", "1 year", "2 years")',
            },
            scenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Descriptive title for the scenario',
                  },
                  predictedValue: {
                    type: 'number',
                    description: 'Specific predicted value',
                  },
                  summary: {
                    type: 'string',
                    description: 'Detailed analysis (3-4 sentences)',
                  },
                  sources: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'uri',
                    },
                    description: 'Array of valid HTTP/HTTPS URLs',
                  },
                  confidenceScore: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    description: 'Confidence score (0-100)',
                  },
                },
                required: ['title', 'predictedValue', 'summary', 'sources', 'confidenceScore'],
              },
              minItems: 3,
              maxItems: 5,
            },
          },
          required: ['timeline', 'scenarios'],
        },
      },
    },
    required: ['predictions'],
  },

  /**
   * Schema for combined research response (current and historical data)
   */
  COMBINED_RESEARCH: {
    type: 'object',
    properties: {
      current: {
        type: 'object',
        properties: {
          value: {
            type: 'number',
            description: 'The current value of the metric',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of current market conditions (2-3 sentences)',
          },
          sources: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri',
            },
            description: 'Array of valid HTTP/HTTPS URLs from reputable sources',
          },
        },
        required: ['value', 'summary', 'sources'],
      },
      historical: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Date in YYYY-MM-DD format',
            },
            value: {
              type: 'number',
              description: 'The value at that point in time',
            },
            eventType: {
              type: 'string',
              enum: ['pump', 'dump', 'bull_market_start', 'bull_market_end', 'bear_market_start', 'bear_market_end', 'major_event'],
              description: 'Type of event that occurred',
            },
            summary: {
              type: 'string',
              description: 'Detailed summary (3-4 sentences)',
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'Array of valid HTTP/HTTPS URLs',
            },
          },
          required: ['date', 'value', 'eventType', 'summary', 'sources'],
        },
        description: 'Array of historical events',
      },
    },
    required: ['current', 'historical'],
  },

  /**
   * Schema for present data response (current state only)
   */
  PRESENT_DATA: {
    type: 'object',
    properties: {
      value: {
        type: 'number',
        description: 'The current value of the metric',
      },
      summary: {
        type: 'string',
        description: 'Brief summary of current market conditions (2-3 sentences)',
      },
      sources: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uri',
        },
        description: 'Array of valid HTTP/HTTPS URLs from reputable sources',
      },
    },
    required: ['value', 'summary', 'sources'],
  },

  /**
   * Schema for single interval prediction response (scenarios only)
   */
  PREDICTION_SCENARIOS: {
    type: 'object',
    properties: {
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Descriptive title for the scenario',
            },
            predictedValue: {
              type: 'number',
              description: 'Specific predicted value',
            },
            summary: {
              type: 'string',
              description: 'Detailed analysis (3-4 sentences)',
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'Array of valid HTTP/HTTPS URLs',
            },
            confidenceScore: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Confidence score (0-100)',
            },
          },
          required: ['title', 'predictedValue', 'summary', 'sources', 'confidenceScore'],
        },
        minItems: 3,
        maxItems: 5,
        description: 'Array of 3-5 prediction scenarios',
      },
    },
    required: ['scenarios'],
  },

  /**
   * Schema for historical entries response
   */
  HISTORICAL_ENTRIES: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Date in YYYY-MM-DD format',
            },
            value: {
              type: 'number',
              description: 'The value at that point in time',
            },
            eventType: {
              type: 'string',
              enum: ['pump', 'dump', 'bull_market_start', 'bull_market_end', 'bear_market_start', 'bear_market_end', 'major_event'],
              description: 'Type of event that occurred',
            },
            summary: {
              type: 'string',
              description: 'Detailed summary (3-4 sentences)',
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description: 'Array of valid HTTP/HTTPS URLs',
            },
          },
          required: ['date', 'value', 'eventType', 'summary', 'sources'],
        },
        description: 'Array of historical events',
      },
    },
    required: ['entries'],
  },
} as const;

