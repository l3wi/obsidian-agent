export class ToolCallIdGenerator {
  /**
   * Generate a unique ID for a tool call
   */
  static generate(toolName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${toolName}-${timestamp}-${random}`;
  }
  
  /**
   * Extract ID from various interruption formats
   */
  static extractFromInterruption(interruption: any): string | null {
    // Try multiple paths in order of preference
    const paths = [
      () => interruption.id,
      () => interruption.rawItem?.id,
      () => interruption.rawItem?.callId,
      () => interruption.rawItem?.providerData?.id,
      () => interruption.item?.id,
      () => interruption.callId,
    ];
    
    for (const path of paths) {
      try {
        const id = path();
        if (id && typeof id === 'string') {
          return id;
        }
      } catch {
        // Continue to next path
      }
    }
    
    // If no ID found, generate one based on tool name
    const toolName = this.extractToolName(interruption);
    if (toolName) {
      console.warn('No ID found in interruption, generating one', interruption);
      return this.generate(toolName);
    }
    
    return null;
  }
  
  /**
   * Extract tool name from interruption
   */
  static extractToolName(interruption: any): string | null {
    const paths = [
      () => interruption.rawItem?.name,
      () => interruption.item?.name,
      () => interruption.name,
      () => interruption.tool,
    ];
    
    for (const path of paths) {
      try {
        const name = path();
        if (name && typeof name === 'string') {
          return name;
        }
      } catch {
        // Continue to next path
      }
    }
    
    return null;
  }
  
  /**
   * Extract arguments from interruption
   */
  static extractArguments(interruption: any): any {
    const paths = [
      () => interruption.rawItem?.arguments,
      () => interruption.item?.arguments,
      () => interruption.arguments,
    ];
    
    for (const path of paths) {
      try {
        const args = path();
        if (args) {
          // Parse if string
          if (typeof args === 'string') {
            try {
              return JSON.parse(args);
            } catch {
              return { raw: args };
            }
          }
          return args;
        }
      } catch {
        // Continue to next path
      }
    }
    
    return {};
  }
}