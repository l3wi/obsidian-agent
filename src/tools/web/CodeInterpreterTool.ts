import { codeInterpreterTool } from '@openai/agents';

// CodeInterpreterTool is a special pass-through wrapper for OpenAI's code interpreter tool
// It returns the OpenAI tool directly to avoid schema conflicts
export class CodeInterpreterTool {
  static create() {
    return codeInterpreterTool();
  }
}