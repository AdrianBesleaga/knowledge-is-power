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
const WebResearchAgentSchema = z.object({ valueLabel: z.string(), current: z.object({ value: z.number(), summary: z.string(), sources: z.array(z.string()) }), historical: z.array(z.object({ date: z.string(), value: z.number(), eventType: z.enum(["pump", "dump", "bull_market_start", "bull_market_end", "bear_market_start", "bear_market_end", "major_event"]), summary: z.string(), sources: z.array(z.string()) })), predictions: z.array(z.object({ timeline: z.string(), scenarios: z.array(z.object({ title: z.string(), predictedValue: z.number(), summary: z.string(), sources: z.array(z.string()), confidenceScore: z.number() })) })) });
interface WebResearchAgentContext {
  stateTopic: string;
}
const webResearchAgentInstructions = (runContext: RunContext<WebResearchAgentContext>, _agent: Agent<WebResearchAgentContext, typeof WebResearchAgentSchema>) => {
  const { stateTopic } = runContext.context;
  return `You are an expert financial analyst with full web access. Complete comprehensive timeline analyses by searching current market data, historical archives, and news sources. Provide accurate, verifiable data with proper sources.

The time intervals are: ['1 month', '1 year', '2 years', '3 years', '4 years', '5 years', '6 years', '7 years', '8 years', '9 years', '10 years']

For EACH time interval, create 3 realistic scenarios based on:
- Current market sentiment and technical indicators
- Economic data (GDP, inflation, interest rates, employment)
- Industry news and regulatory developments
- Historical patterns and cycle analysis
- Risk factors and potential catalysts

For each scenario provide:
1. DESCRIPTIVE title (e.g., \"Strong Bull Market Recovery\", \"Regulatory Crackdown Impact\", \"Tech Innovation Surge\")
2. DETAILED analysis (3-4 sentences) explaining drivers, supporting evidence, and market logic
3. SOURCES: 2-3 VALID HTTP/HTTPS URLs from recent news, analyst reports, or official data sources
4. CONFIDENCE score (0-100) based on current market data and historical precedents

Focus on realistic, data-driven predictions. Consider both bullish and bearish catalysts.
NEVER ASK FOR CLARIFICATIONS!
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
      topic: null
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
