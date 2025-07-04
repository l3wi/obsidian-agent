import { webSearchTool } from '@openai/agents';

// WebSearchTool is a special pass-through wrapper for OpenAI's web search tool
// It returns the OpenAI tool directly to avoid schema conflicts
export class WebSearchTool {
  static create() {
    return webSearchTool();
  }
}