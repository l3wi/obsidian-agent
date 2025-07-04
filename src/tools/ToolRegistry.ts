import { Tool, ToolMetadata, ToolContext } from './types';
import { tool as createAgentTool } from '@openai/agents';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private enabledTools: Set<string> = new Set();
  private toolInstances: Map<string, any> = new Map(); // Cached agent tool instances
  
  constructor(private context: ToolContext) {}
  
  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.metadata.id)) {
      throw new Error(`Tool with id ${tool.metadata.id} already registered`);
    }
    
    this.tools.set(tool.metadata.id, tool);
    this.enabledTools.add(tool.metadata.id); // Enable by default
    
    // Create and cache the agent tool instance
    const agentTool = this.createAgentTool(tool);
    this.toolInstances.set(tool.metadata.id, agentTool);
  }
  
  /**
   * Unregister a tool
   */
  unregister(toolId: string): boolean {
    this.toolInstances.delete(toolId);
    this.enabledTools.delete(toolId);
    return this.tools.delete(toolId);
  }
  
  /**
   * Enable/disable a tool
   */
  setEnabled(toolId: string, enabled: boolean): void {
    if (!this.tools.has(toolId)) {
      throw new Error(`Tool ${toolId} not found`);
    }
    
    if (enabled) {
      this.enabledTools.add(toolId);
    } else {
      this.enabledTools.delete(toolId);
    }
  }
  
  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get enabled tools for agent
   */
  getEnabledAgentTools(): any[] {
    return Array.from(this.enabledTools)
      .map(id => this.toolInstances.get(id))
      .filter(Boolean);
  }
  
  /**
   * Get tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }
  
  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): Tool[] {
    return this.getTools().filter(tool => tool.metadata.category === category);
  }
  
  /**
   * Create agent tool from our tool definition
   */
  private createAgentTool(toolDef: Tool): any {
    return createAgentTool({
      name: toolDef.metadata.id,
      description: toolDef.metadata.description,
      parameters: toolDef.schema as any,
      needsApproval: async () => toolDef.metadata.requiresApproval,
      execute: async (args: any) => {
        // Validate before execution
        if (toolDef.validate) {
          const validation = await toolDef.validate(args, this.context);
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
          }
        }
        
        // Execute with context
        try {
          const result = await toolDef.execute(args, this.context);
          return JSON.stringify(result);
        } catch (error) {
          console.error(`Tool ${toolDef.metadata.id} execution failed:`, error);
          throw error;
        }
      }
    });
  }
}