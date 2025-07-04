import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { webSearchTool } from '@openai/agents';

export class WebSearchTool implements Tool {
  metadata = {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for current information',
    category: 'web' as const,
    icon: 'search',
    requiresApproval: false,
    experimental: false,
  };
  
  schema = z.object({
    query: z.string().describe('The search query to execute'),
  });
  
  private webSearchInstance: any;
  
  constructor() {
    // Create the OpenAI web search tool instance
    this.webSearchInstance = webSearchTool();
  }
  
  async execute(args: z.infer<typeof this.schema>, context: ToolContext) {
    try {
      // Execute the web search using the OpenAI tool
      const result = await this.webSearchInstance.execute(args);
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Web search failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}