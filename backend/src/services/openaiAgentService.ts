import { webSearchTool, RunContext, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";


// Tool definitions
const webSearchPreview = webSearchTool({
  searchContextSize: "low",
  userLocation: {
    country: "US",
    type: "approximate"
  }
})
const WebResearchAgentSchema = z.object({
  valueLabel: z.string().describe("The label describing the value being tracked (e.g., \"Price (USD)\", \"Population\")"),
  valueDirection: z.enum(["higher_is_better", "lower_is_better", "neutral"]).describe("Whether higher values are better, lower values are better, or neutral"),
  current: z.object({
    value: z.number().describe("The current value of the metric"),
    summary: z.string().describe("Brief summary of current market conditions (2-3 sentences)"),
    sources: z.array(z.string()).describe("Array of valid HTTP/HTTPS URLs from reputable sources")
  }),
  historical: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format"),
    value: z.number().describe("The value at that point in time"),
    eventType: z.enum(["pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", "major_event"]).describe("Type of event that occurred"),
    summary: z.string().describe("Detailed summary explaining what happened, why, and impact (3-4 sentences)"),
    sources: z.array(z.string()).describe("Array of valid HTTP/HTTPS URLs from reputable sources")
  })).min(10).max(40).describe("Array of historical events covering the past 10 years. CRITICAL: Must contain at least 10 events, maximum 4 events per year (40 total). Select only the most significant events that had the biggest impact on the value. Prioritize major price movements, market cycle turning points, and regulatory/fundamental events."),
  predictions: z.array(z.object({
    timeline: z.string().describe("Time interval (e.g., \"1 month\", \"1 year\", \"2 years\")"),
    scenarios: z.array(z.object({
      title: z.string().describe("Descriptive title for the scenario (e.g., \"Strong Bull Market Recovery\")"),
      predictedValue: z.number().describe("Specific predicted value based on current trends"),
      summary: z.string().describe("Detailed analysis explaining drivers, supporting evidence, and market logic (3-4 sentences)"),
      sources: z.array(z.string()).describe("Array of valid HTTP/HTTPS URLs from recent news or analyst reports"),
      confidenceScore: z.number().min(0).max(100).describe("Confidence score based on current market data and historical precedents")
    })).min(3).max(3).describe("CRITICAL: Exactly 3 prediction scenarios required for this timeline. Provide 3 distinct scenarios with different outcomes (e.g., optimistic, neutral, pessimistic).")
  })).min(11).describe("Array of predictions for different time intervals. CRITICAL: Must contain predictions for all 11 intervals: 1 month, 1 year, 2 years, 3 years, 4 years, 5 years, 6 years, 7 years, 8 years, 9 years, 10 years. Each interval must have exactly 3 scenarios.")
});
interface WebResearchAgentContext {
  stateTopic: string;
}
const webResearchAgentInstructions = (runContext: RunContext<WebResearchAgentContext>, _agent: Agent<WebResearchAgentContext, typeof WebResearchAgentSchema>) => {
  const { stateTopic } = runContext.context;
  return `You are an expert analyst with full web access. Complete comprehensive timeline analyses by searching current data, historical archives, and news sources. Provide accurate, verifiable data with proper sources. ADAPT YOUR ANALYSIS based on the topic type (financial, geopolitical, real estate, social, technological, environmental, etc.).

FIRST, determine the VALUE DIRECTION: Analyze the topic and determine whether higher values are better, lower values are better, or if it's neutral. Examples:
- Financial: "bitcoin price" or "stock price" → "higher_is_better"
- Economic: "unemployment rate" or "inflation rate" → "lower_is_better"
- Geopolitical: "tension level" or "conflict probability" → "lower_is_better"
- Real Estate: "home prices" → "higher_is_better" (for investors) or "lower_is_better" (for buyers)
- Environmental: "CO2 emissions" → "lower_is_better"
- Social: "education levels" → "higher_is_better"
- Neutral: "temperature", "population counts" → "neutral"

CRITICAL REQUIREMENTS:
- You MUST provide data for ALL required fields
- The "historical" array MUST contain at least 10 events (up to 40 maximum, 4 per year)
- The "predictions" array MUST contain predictions for ALL 11 intervals: 1 month, 1 year, 2 years, 3 years, 4 years, 5 years, 6 years, 7 years, 8 years, 9 years, 10 years
- Each prediction interval MUST have exactly 3 scenarios
- CRITICAL: AVOID DUPLICATES in historical events - Do not include the same event multiple times

For historical events, use these event types:
- "pump": Significant price increases
- "dump": Significant price decreases
- "bull_market_start": Beginning of upward trend/market cycle
- "bull_market_end": End of upward trend/market cycle
- "bear_market_start": Beginning of downward trend/market cycle
- "bear_market_end": End of downward trend/market cycle
- "major_event": Significant events that don't fit other categories

For EACH of the 11 time intervals above, create EXACTLY 3 scenarios based on current conditions, historical patterns, and relevant factors for the topic type:

CRITICAL: AVOID DUPLICATES - Ensure each scenario for each interval is completely unique and covers different potential outcomes. Do not repeat similar scenarios or predictions.

For each scenario provide:
1. DESCRIPTIVE title (tailored to the topic, e.g., financial: "Bull Market Recovery", geopolitical: "Diplomatic Resolution", real estate: "Housing Market Boom")
2. SPECIFIC predicted value (realistic number based on current trends and topic context)
3. DETAILED analysis (3-4 sentences) explaining drivers, supporting evidence, and logic specific to the topic
4. SOURCES: 2-3 VALID HTTP/HTTPS URLs from recent news, analyst reports, or official data sources relevant to the topic
5. CONFIDENCE score (0-100) based on available data and historical precedents

Focus on realistic, data-driven predictions appropriate for the topic type. Consider multiple perspectives and potential catalysts.
NEVER ASK FOR CLARIFICATIONS!
ALWAYS RETURN COMPLETE DATA FOR ALL REQUIRED FIELDS AND INTERVALS.
JUST RETURN THE RESPONSE IN THE GIVEN JSON SCHEMA FORMAT.

The topic: ${stateTopic}`
}
const webResearchAgent = new Agent<WebResearchAgentContext, typeof WebResearchAgentSchema>({
  name: "Web research agent",
  instructions: webResearchAgentInstructions,
  model: "gpt-5-mini",
  tools: [
    webSearchPreview
  ],
  outputType: WebResearchAgentSchema,
  modelSettings: {
    reasoning: {
      effort: "low"
    },
    store: true
  }
});

type WorkflowInput = { input_as_text: string };


// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("Market_Data", async () => {
    const state = {
      topic: workflow.input_as_text
    };
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] }
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_69189041b1088190af8de90deab057930cb1133e49609e49"
      }
    });
    const webResearchAgentResultTemp = await runner.run(
      webResearchAgent,
      [
        ...conversationHistory
      ],
      {
        context: {
          stateTopic: state.topic
        }
      }
    );
    conversationHistory.push(...webResearchAgentResultTemp.newItems.map((item) => item.rawItem));

    if (!webResearchAgentResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    return webResearchAgentResultTemp.finalOutput;
  });
}
