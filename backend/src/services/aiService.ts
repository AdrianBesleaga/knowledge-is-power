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

interface SubFactor {
  id: string;
  name: string;
  description: string;
  category: string;
  sources: string[];
  impactScore: number;
  parentId: string;
}

type Level2Factor = SubFactor;
type Level3Factor = SubFactor;

export class AIService {
  /**
   * Generate a complete knowledge graph from a topic with 3 levels of depth
   * @param topic - The main topic to analyze
   */
  async generateKnowledgeGraph(topic: string): Promise<AIResponse> {
    const startTime = Date.now();
    console.log(`[Graph Generation] Starting graph generation for topic: "${topic}"`);
    
    try {
      const DEPTH = 3; // Fixed to 3 levels
      console.log(`[Graph Generation] Target depth: ${DEPTH} levels`);
      
      // Step 1: Analyze the topic and identify Level 1 key factors
      console.log(`[Graph Generation] Step 1/4: Analyzing Level 1 factors...`);
      const level1StartTime = Date.now();
      const level1Analysis = await this.analyzeTopicFactors(topic);
      const level1Time = Date.now() - level1StartTime;
      console.log(`[Graph Generation] Level 1 complete: ${level1Analysis.factors.length} factors identified (${level1Time}ms)`);
      console.log(`[Graph Generation] Level 1 factors: ${level1Analysis.factors.map(f => f.name).join(', ')}`);
      
      // Step 2: Generate Level 2 sub-factors (batched to reduce API calls)
      console.log(`[Graph Generation] Step 2/4: Generating Level 2 sub-factors (batched)...`);
      const level2StartTime = Date.now();
      const { factors: level2Factors, apiCalls: level2Calls } = await this.analyzeSubFactorsBatch(level1Analysis.factors, topic, 1, DEPTH);
      const level2Time = Date.now() - level2StartTime;
      console.log(`[Graph Generation] Level 2 complete: ${level2Factors.length} total sub-factors generated (${level2Time}ms)`);
      
      // Step 3: Generate Level 3 sub-aspects (batched to reduce API calls)
      console.log(`[Graph Generation] Step 3/4: Generating Level 3 sub-aspects (batched)...`);
      const level3StartTime = Date.now();
      const { factors: level3Factors, apiCalls: level3Calls } = await this.analyzeSubFactorsBatch(level2Factors, topic, 2, DEPTH);
      const level3Time = Date.now() - level3StartTime;
      console.log(`[Graph Generation] Level 3 complete: ${level3Factors.length} total sub-aspects generated (${level3Time}ms)`);
      
      const allLevels = [level2Factors, level3Factors];
      
      // Step 4: Convert all levels to graph structure
      console.log(`[Graph Generation] Step 4/4: Building graph structure...`);
      const buildStartTime = Date.now();
      const nodes = this.createNodesFromAnalysis(topic, level1Analysis, allLevels);
      const edges = this.createEdgesFromAnalysis(level1Analysis, allLevels);
      const buildTime = Date.now() - buildStartTime;
      console.log(`[Graph Generation] Graph structure complete: ${nodes.length} nodes, ${edges.length} edges (${buildTime}ms)`);
      
      // Step 5: Generate a summary/conclusion for the graph
      console.log(`[Graph Generation] Generating summary...`);
      const summaryStartTime = Date.now();
      const summary = await this.generateGraphSummary(topic, level1Analysis, allLevels, DEPTH);
      const summaryTime = Date.now() - summaryStartTime;
      console.log(`[Graph Generation] Summary generated (${summaryTime}ms)`);
      
      const totalTime = Date.now() - startTime;
      const totalApiCalls = 1 + level2Calls + level3Calls + 1; // Level 1 + Level 2 chunks + Level 3 chunks + Summary
      console.log(`[Graph Generation] Graph generation complete! Total time: ${totalTime}ms`);
      console.log(`[Graph Generation] Final stats: ${nodes.length} nodes, ${edges.length} edges, ${DEPTH} levels`);
      console.log(`[Graph Generation] Cost optimization: Used ${totalApiCalls} API calls total (1 Level 1 + ${level2Calls} Level 2 batch(es) + ${level3Calls} Level 3 batch(es) + 1 summary)`);
      const estimatedIndividualCalls = 1 + level1Analysis.factors.length + level2Factors.length + 1;
      console.log(`[Graph Generation] Estimated cost savings: ~${estimatedIndividualCalls - totalApiCalls} fewer API calls (${estimatedIndividualCalls} → ${totalApiCalls})`);
      
      return { summary, nodes, edges };
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`[Graph Generation] Error after ${totalTime}ms:`, error);
      
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
   * Analyze sub-factors in batch to reduce API calls (cost optimization)
   * Processes multiple parent factors in chunks to avoid response truncation
   */
  private async analyzeSubFactorsBatch(
    parentFactors: Array<{ id: string; name: string; description: string; category: string }>,
    topic: string,
    currentLevel: number,
    totalDepth: number
  ): Promise<{ factors: SubFactor[]; apiCalls: number }> {
    if (parentFactors.length === 0) {
      return { factors: [], apiCalls: 0 };
    }

    const levelName = `Level ${currentLevel + 1}`;
    const isNearEnd = currentLevel + 1 >= totalDepth;
    const countPerFactor = isNearEnd ? '2-3' : currentLevel === 1 ? '3-5' : '2-4';
    const depthDescription = isNearEnd
      ? 'specific granular sub-aspects that provide the deepest level of detail'
      : currentLevel === 1
      ? 'detailed sub-factors that dive deeper into specific aspects'
      : 'specific sub-aspects that provide more granular detail';

    // Split into chunks to avoid response truncation
    // Level 2: smaller chunks (8-10 factors) since responses are larger
    // Level 3: even smaller chunks (6-8 factors) since we have more factors
    const maxBatchSize = currentLevel === 1 ? 10 : 8;
    const chunks: Array<typeof parentFactors> = [];
    
    for (let i = 0; i < parentFactors.length; i += maxBatchSize) {
      chunks.push(parentFactors.slice(i, i + maxBatchSize));
    }

    const batchStartTime = Date.now();
    if (chunks.length > 1) {
      console.log(`[Graph Generation]     Splitting ${parentFactors.length} ${levelName} factors into ${chunks.length} batches (max ${maxBatchSize} per batch)...`);
    } else {
      console.log(`[Graph Generation]     Batching ${parentFactors.length} ${levelName} factors into single API call...`);
    }

    // Process chunks sequentially to avoid rate limits
    const allSubFactors: SubFactor[] = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkStartTime = Date.now();
      
      if (chunks.length > 1) {
        console.log(`[Graph Generation]       Processing batch ${chunkIndex + 1}/${chunks.length} (${chunk.length} factors)...`);
      }
      
      const chunkResults = await this.processBatchChunk(
        chunk,
        topic,
        levelName,
        countPerFactor,
        depthDescription,
        totalDepth
      );
      
      allSubFactors.push(...chunkResults);
      
      const chunkTime = Date.now() - chunkStartTime;
      if (chunks.length > 1) {
        console.log(`[Graph Generation]       Batch ${chunkIndex + 1}/${chunks.length} complete: ${chunkResults.length} sub-factors (${chunkTime}ms)`);
      }
    }

    const batchTime = Date.now() - batchStartTime;
    console.log(`[Graph Generation]     Batch processing complete: ${allSubFactors.length} total sub-factors generated from ${parentFactors.length} parent factors (${batchTime}ms)`);
    
    // Log if we're missing any factors
    const processedParentIds = new Set(allSubFactors.map(sf => sf.parentId));
    const missingFactors = parentFactors.filter(f => !processedParentIds.has(f.id));
    if (missingFactors.length > 0) {
      console.warn(`[Graph Generation]     Warning: ${missingFactors.length} factors were not processed: ${missingFactors.map(f => f.name).join(', ')}`);
    }

    return { factors: allSubFactors, apiCalls: chunks.length };
  }

  /**
   * Process a single batch chunk of factors
   */
  private async processBatchChunk(
    parentFactors: Array<{ id: string; name: string; description: string; category: string }>,
    topic: string,
    levelName: string,
    countPerFactor: string,
    depthDescription: string,
    totalDepth: number
  ): Promise<SubFactor[]> {

    // Build the prompt to analyze all factors at once
    const factorsList = parentFactors.map((factor, idx) => 
      `${idx + 1}. "${factor.name}" (ID: ${factor.id})
   Description: ${factor.description}
   Category: ${factor.category}`
    ).join('\n\n');

    const prompt = `You are a knowledge graph analyst conducting a rabbithole investigation with ${totalDepth} levels of depth. Analyze the following ${parentFactors.length} ${levelName} factors and identify ${countPerFactor} ${depthDescription} for EACH factor. Use your knowledge to provide current, relevant information and realistic sources.

Main Topic: "${topic}"

${levelName} Factors to Analyze:
${factorsList}

For EACH factor above, provide:
1. A unique ID (lowercase, no spaces, use underscores, format: [parent_factor_id]_sub_X)
2. A clear name/label that is more specific than the parent
3. A detailed description/summary (2-3 sentences) that provides deeper insight
4. A category (choose from: "social", "news", "economic", "technical", "political", "environmental")
5. Example sources where this information might be found - provide actual URLs/links (e.g., https://www.reddit.com/r/subreddit, https://news.outlet.com/article, https://data.source.com/indicator). Each source must be a valid URL starting with http:// or https://
6. An impact score from -1 to 1, where:
   - Positive values (0 to 1) indicate aspects that positively influence the parent factor
   - Negative values (-1 to 0) indicate aspects that negatively influence the parent factor
   - The magnitude indicates the strength of the impact

Respond ONLY with valid JSON in this exact format:
{
  "results": [
    {
      "parentId": "parent_factor_id",
      "subFactors": [
        {
          "id": "parent_factor_id_sub_1",
          "name": "Sub-Factor Name",
          "description": "Detailed description of this sub-factor and how it relates to the parent factor.",
          "category": "economic",
          "sources": ["https://example.com/source1", "https://example.com/source2"],
          "impactScore": 0.7
        }
      ]
    }
  ]
}

IMPORTANT: Provide results for ALL ${parentFactors.length} factors listed above. Each result must have the correct parentId matching one of the factor IDs provided.`;

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert analyst who creates detailed knowledge graphs with deep investigation. Always respond with valid JSON only, no additional text. Use your knowledge to provide current, relevant information and realistic sources. You must analyze ALL factors provided in the request."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_completion_tokens: 16000 // Increased to handle larger batch responses
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        console.warn(`[Graph Generation]     No response from OpenAI, returning empty results`);
        return [];
      }

      let analysis: any;
      try {
        analysis = JSON.parse(content);
      } catch (parseError: any) {
        // Try to extract valid JSON from partial/truncated response
        console.warn(`[Graph Generation]     JSON parse error: ${parseError.message}. Attempting to extract partial results...`);
        
        // Try to find where the JSON breaks and extract up to that point
        // Look for the "results" array and try to extract complete objects
        const resultsStart = content.indexOf('"results"');
        if (resultsStart === -1) {
          console.warn(`[Graph Generation]     Could not find results array, returning empty array`);
          return [];
        }
        
        // Find the opening bracket of results array
        const arrayStart = content.indexOf('[', resultsStart);
        if (arrayStart === -1) {
          console.warn(`[Graph Generation]     Could not find results array start, returning empty array`);
          return [];
        }
        
        // Try to extract complete result objects by finding closing braces
        const resultObjects: any[] = [];
        let currentPos = arrayStart + 1;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let currentObjectStart = -1;
        
        // Simple state machine to find complete JSON objects
        for (let i = currentPos; i < content.length; i++) {
          const char = content[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (inString) continue;
          
          if (char === '{') {
            if (braceCount === 0) {
              currentObjectStart = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && currentObjectStart !== -1) {
              // Found a complete object
              try {
                const objStr = content.substring(currentObjectStart, i + 1);
                const obj = JSON.parse(objStr);
                if (obj.parentId && obj.subFactors) {
                  resultObjects.push(obj);
                }
              } catch (e) {
                // Skip invalid objects
              }
              currentObjectStart = -1;
            }
          } else if (char === ']' && braceCount === 0) {
            // End of results array
            break;
          }
        }
        
        if (resultObjects.length > 0) {
          analysis = { results: resultObjects };
          console.log(`[Graph Generation]     Successfully extracted ${resultObjects.length} complete result objects from partial JSON`);
        } else {
          console.warn(`[Graph Generation]     Could not extract any complete result objects, returning empty array`);
          return [];
        }
      }

      const results = analysis.results || [];
      
      // Flatten results and add parentId to each sub-factor
      const allSubFactors: SubFactor[] = [];
      for (const result of results) {
        if (!result || !result.parentId) {
          continue; // Skip invalid results
        }
        
        const parentId = result.parentId;
        const subFactors = result.subFactors || [];
        
        for (const sf of subFactors) {
          if (sf && sf.id && sf.name) {
            allSubFactors.push({
              ...sf,
              parentId: parentId,
            });
          }
        }
      }

      return allSubFactors;
    } catch (error: any) {
      console.error(`[Graph Generation]     Error in batch chunk processing for ${levelName}:`, error);
      console.warn(`[Graph Generation]     Returning empty results for this chunk (no fallback to individual calls to save costs)`);
      return [];
    }
  }

  /**
   * Step 1: Use OpenAI to analyze topic and identify key factors
   * Uses OpenAI's knowledge and reasoning to provide current, relevant information
   */
  private async analyzeTopicFactors(topic: string): Promise<AIFactorAnalysis> {
    console.log(`[Graph Generation]     Calling OpenAI API for Level 1 analysis...`);
    
    const prompt = `You are a knowledge graph analyst. Analyze the following topic and identify 6-8 key factors that influence it. Use your knowledge to provide current, relevant information and realistic sources.

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
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert analyst who creates detailed knowledge graphs. Always respond with valid JSON only, no additional text. Use your knowledge to provide current, relevant information and realistic sources."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }
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
   * Convert AI factor analysis to graph nodes (dynamic levels)
   */
  private createNodesFromAnalysis(
    topic: string,
    level1Analysis: AIFactorAnalysis,
    allLevels: SubFactor[][]
  ): GraphNode[] {
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

    // Add Level 1 factor nodes
    for (const factor of level1Analysis.factors) {
      nodes.push({
        id: factor.id,
        label: factor.name,
        summary: factor.description,
        sources: this.normalizeSources(factor.sources),
        impactScore: factor.impactScore,
        category: factor.category,
      });
    }

    // Add all sub-level nodes dynamically
    for (const levelFactors of allLevels) {
      for (const factor of levelFactors) {
        nodes.push({
          id: factor.id,
          label: factor.name,
          summary: factor.description,
          sources: this.normalizeSources(factor.sources),
          impactScore: factor.impactScore,
          category: factor.category,
        });
      }
    }

    return nodes;
  }

  /**
   * Convert AI relationship analysis to graph edges (dynamic levels)
   */
  private createEdgesFromAnalysis(
    level1Analysis: AIFactorAnalysis,
    allLevels: SubFactor[][]
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];

    // Level 1: Create edges from Level 1 factors to main topic
    for (const factor of level1Analysis.factors) {
      edges.push({
        source: factor.id,
        target: 'topic_main',
        relationship: factor.impactScore >= 0 ? 'supports' : 'opposes',
        strength: Math.abs(factor.impactScore),
      });
    }

    // Level 1: Add inter-factor relationships between Level 1 factors
    for (const rel of level1Analysis.relationships) {
      edges.push({
        source: rel.from,
        target: rel.to,
        relationship: rel.relationship,
        strength: rel.strength,
      });
    }

    // Dynamically create edges for all sub-levels
    for (let levelIndex = 0; levelIndex < allLevels.length; levelIndex++) {
      const levelFactors = allLevels[levelIndex];
      const isLevel2 = levelIndex === 0;
      
      for (const factor of levelFactors) {
        // Determine relationship type based on level and impact
        let relationship: string;
        if (isLevel2) {
          relationship = factor.impactScore >= 0 ? 'details' : 'challenges';
        } else if (levelIndex === allLevels.length - 1) {
          // Last level
          relationship = factor.impactScore >= 0 ? 'elaborates' : 'complicates';
        } else {
          // Middle levels
          relationship = factor.impactScore >= 0 ? 'expands' : 'contradicts';
        }
        
        edges.push({
          source: factor.id,
          target: factor.parentId,
          relationship,
          strength: Math.abs(factor.impactScore),
        });
      }
    }

    return edges;
  }

  /**
   * Generate a summary/conclusion for the knowledge graph (dynamic levels)
   */
  private async generateGraphSummary(
    topic: string,
    level1Analysis: AIFactorAnalysis,
    allLevels: SubFactor[][],
    totalDepth: number
  ): Promise<string> {
    const level1Summary = level1Analysis.factors
      .map(f => `${f.name} (${f.impactScore >= 0 ? 'positive' : 'negative'} impact)`)
      .join(', ');

    // Build level summary
    const levelSummaries = allLevels.map((levelFactors, index) => {
      const levelNum = index + 2;
      return `Level ${levelNum}: ${levelFactors.length} ${index === 0 ? 'sub-factors' : 'sub-aspects'}`;
    }).join('\n');

    const totalSubFactors = allLevels.reduce((sum, level) => sum + level.length, 0);

    const prompt = `Based on the following ${totalDepth}-level deep knowledge graph analysis (rabbithole investigation), provide a comprehensive summary and conclusion.

Topic: "${topic}"

Level 1 - Key Factors (${level1Analysis.factors.length} factors):
${level1Summary}

${levelSummaries}

This is a deep investigation with ${totalDepth} levels of depth, where each level provides more detailed information.

Provide a 4-5 sentence summary that:
1. Synthesizes the main insights about the topic from all ${totalDepth} levels
2. Highlights the most significant positive and negative factors at each level
3. Emphasizes the depth of investigation and how each level adds more detail
4. Draws a conclusion about the overall dynamics and relationships across all levels
5. Is written in clear, accessible language

Respond with ONLY the summary text, no additional formatting or labels.`;

    try {
      console.log(`[Graph Generation]     Calling OpenAI API for summary generation...`);
      const completion = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o-mini",
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
        max_completion_tokens: 400,
      });

      const summary = completion.choices[0].message.content?.trim() || '';
      const finalSummary = summary || `This knowledge graph explores ${topic} through ${level1Analysis.factors.length} key factors and ${totalSubFactors} sub-factors across ${totalDepth} levels, creating a comprehensive deep investigation. The analysis reveals both positive and negative influences that shape the topic's dynamics at multiple levels of detail.`;
      console.log(`[Graph Generation]     Summary generated (${finalSummary.length} characters)`);
      return finalSummary;
    } catch (error) {
      console.error('[Graph Generation]     Error generating graph summary:', error);
      // Fallback summary if AI generation fails
      return `This knowledge graph explores ${topic} through ${level1Analysis.factors.length} key factors and ${totalSubFactors} sub-factors across ${totalDepth} levels, creating a comprehensive deep investigation. The analysis reveals both positive and negative influences that shape the topic's dynamics at multiple levels of detail.`;
    }
  }
}

export const aiService = new AIService();

