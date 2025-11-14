import OpenAI from 'openai';
import { AIFactorAnalysis, GraphNode, GraphEdge } from '../types';

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

interface AIResponse {
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class AIService {
  /**
   * Generate a complete knowledge graph from a topic
   */
  async generateKnowledgeGraph(topic: string): Promise<AIResponse> {
    try {
      // Step 1: Analyze the topic and identify key factors
      const factorAnalysis = await this.analyzeTopicFactors(topic);
      
      // Step 2: Convert AI analysis to graph structure
      const nodes = this.createNodesFromAnalysis(topic, factorAnalysis);
      const edges = this.createEdgesFromAnalysis(factorAnalysis);
      
      // Step 3: Generate a summary/conclusion for the graph
      const summary = await this.generateGraphSummary(topic, factorAnalysis);
      
      return { summary, nodes, edges };
    } catch (error: any) {
      console.error('Error generating knowledge graph:', error);
      
      // Handle specific OpenAI API errors
      if (error?.code === 'insufficient_quota') {
        throw new Error(
          'OpenAI API quota exceeded. Please add a payment method to your OpenAI account at https://platform.openai.com/account/billing. ' +
          'Even free credits require billing information to be set up.'
        );
      }
      
      if (error?.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in the .env file.');
      }
      
      if (error?.message) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      
      throw new Error('Failed to generate knowledge graph. Please check your OpenAI API configuration.');
    }
  }

  /**
   * Step 1: Use OpenAI to analyze topic and identify key factors
   */
  private async analyzeTopicFactors(topic: string): Promise<AIFactorAnalysis> {
    const prompt = `You are a knowledge graph analyst. Analyze the following topic and identify 6-8 key factors that influence it.

Topic: "${topic}"

For each factor, provide:
1. A unique ID (lowercase, no spaces, use underscores)
2. A clear name/label
3. A detailed description/summary (2-3 sentences)
4. A category (choose from: "social", "news", "economic", "technical", "political", "environmental")
5. Example sources where this information might be found - provide actual URLs/links (e.g., https://www.reddit.com/r/subreddit, https://news.outlet.com/article, https://data.source.com/indicator). Each source must be a valid URL starting with http:// or https://
6. An impact score from -1 to 1, where:
   - Positive values (0 to 1) indicate factors that positively influence the topic
   - Negative values (-1 to 0) indicate factors that negatively influence the topic
   - The magnitude indicates the strength of the impact

Also identify relationships between factors, including:
1. Which factor influences which other factor
2. The nature of the relationship (e.g., "drives", "contradicts", "supports", "correlates_with")
3. The strength of the relationship (0 to 1)

Respond ONLY with valid JSON in this exact format:
{
  "factors": [
    {
      "id": "factor_id",
      "name": "Factor Name",
      "description": "Detailed description of this factor and how it relates to the topic.",
      "category": "economic",
      "sources": ["https://example.com/source1", "https://example.com/source2"],
      "impactScore": 0.8
    }
  ],
  "relationships": [
    {
      "from": "factor_id_1",
      "to": "factor_id_2",
      "relationship": "drives",
      "strength": 0.9
    }
  ]
}`;

    let completion;
    try {
      completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert analyst who creates detailed knowledge graphs. Always respond with valid JSON only, no additional text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
    } catch (error: any) {
      // Re-throw with more context
      if (error?.error) {
        error.code = error.error.code;
        error.message = error.error.message;
      }
      throw error;
    }

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const analysis = JSON.parse(content);
    return analysis as AIFactorAnalysis;
  }

  /**
   * Normalize sources to ensure they are valid URLs
   */
  private normalizeSources(sources: string[]): string[] {
    return sources.map(source => {
      // If source is already a URL, return as is
      if (source.startsWith('http://') || source.startsWith('https://')) {
        return source;
      }
      // If source looks like a domain, add https://
      if (source.includes('.') && !source.includes(' ')) {
        return `https://${source}`;
      }
      // Otherwise, try to construct a URL from common patterns
      // For Reddit subreddits
      if (source.startsWith('r/') || source.startsWith('/r/')) {
        const subreddit = source.replace(/^\/?r\//, '');
        return `https://www.reddit.com/r/${subreddit}`;
      }
      // For news outlets or other sources, return as is (will be displayed as text in frontend)
      return source;
    });
  }

  /**
   * Convert AI factor analysis to graph nodes
   */
  private createNodesFromAnalysis(topic: string, analysis: AIFactorAnalysis): GraphNode[] {
    const nodes: GraphNode[] = [];

    // Add central topic node
    nodes.push({
      id: 'topic_main',
      label: topic,
      summary: `Central topic: ${topic}`,
      sources: [],
      impactScore: 0,
      category: 'central',
    });

    // Add factor nodes
    for (const factor of analysis.factors) {
      nodes.push({
        id: factor.id,
        label: factor.name,
        summary: factor.description,
        sources: this.normalizeSources(factor.sources),
        impactScore: factor.impactScore,
        category: factor.category,
      });
    }

    return nodes;
  }

  /**
   * Convert AI relationship analysis to graph edges
   */
  private createEdgesFromAnalysis(analysis: AIFactorAnalysis): GraphEdge[] {
    const edges: GraphEdge[] = [];

    // Create edges from factors to main topic
    for (const factor of analysis.factors) {
      edges.push({
        source: factor.id,
        target: 'topic_main',
        relationship: factor.impactScore >= 0 ? 'supports' : 'opposes',
        strength: Math.abs(factor.impactScore),
      });
    }

    // Add inter-factor relationships
    for (const rel of analysis.relationships) {
      edges.push({
        source: rel.from,
        target: rel.to,
        relationship: rel.relationship,
        strength: rel.strength,
      });
    }

    return edges;
  }

  /**
   * Generate a summary/conclusion for the knowledge graph
   */
  private async generateGraphSummary(topic: string, analysis: AIFactorAnalysis): Promise<string> {
    const factorsSummary = analysis.factors
      .map(f => `${f.name} (${f.impactScore >= 0 ? 'positive' : 'negative'} impact)`)
      .join(', ');

    const prompt = `Based on the following knowledge graph analysis, provide a comprehensive summary and conclusion.

Topic: "${topic}"

Key Factors Identified:
${factorsSummary}

Provide a 3-4 sentence summary that:
1. Synthesizes the main insights about the topic
2. Highlights the most significant positive and negative factors
3. Draws a conclusion about the overall dynamics and relationships
4. Is written in clear, accessible language

Respond with ONLY the summary text, no additional formatting or labels.`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert analyst who creates clear, insightful summaries. Respond with only the summary text, no additional formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const summary = completion.choices[0].message.content?.trim() || '';
      return summary || `This knowledge graph explores ${topic} through multiple interconnected factors and their relationships.`;
    } catch (error) {
      console.error('Error generating graph summary:', error);
      // Fallback summary if AI generation fails
      return `This knowledge graph explores ${topic} through ${analysis.factors.length} key factors and their relationships. The analysis reveals both positive and negative influences that shape the topic's dynamics.`;
    }
  }
}

export const aiService = new AIService();

