import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { codeInterpreterTool } from '@openai/agents';

export class CodeInterpreterTool implements Tool {
  metadata = {
    id: 'code_interpreter',
    name: 'Code Interpreter',
    description: 'Run code for analysis, calculations, and data processing',
    category: 'analysis' as const,
    icon: 'code',
    requiresApproval: false,
    experimental: false,
  };
  
  schema = z.object({
    code: z.string().describe('The code to execute'),
    language: z.string().optional().describe('The programming language (e.g., python, javascript)'),
  });
  
  private codeInterpreterInstance: any;
  
  constructor() {
    // Create the OpenAI code interpreter tool instance
    this.codeInterpreterInstance = codeInterpreterTool();
  }
  
  async execute(args: z.infer<typeof this.schema>, context: ToolContext) {
    try {
      // Execute the code using the OpenAI tool
      const result = await this.codeInterpreterInstance.execute(args);
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Code execution failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}