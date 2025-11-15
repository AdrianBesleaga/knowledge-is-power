/**
 * Validate and format sources to ensure they are valid HTTP URLs
 */
export function validateAndFormatSources(sources: string[]): string[] {
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

/**
 * Get human-readable label for event type
 */
export function getEventTypeLabel(eventType: string): string {
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

