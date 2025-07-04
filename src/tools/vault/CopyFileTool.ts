import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';

export class CopyFileTool implements Tool {
  metadata = {
    id: 'copy_file',
    name: 'Copy File',
    description: 'Copy a file or folder to a new location in the Obsidian vault',
    category: 'vault' as const,
    icon: 'copy',
    requiresApproval: true,
  };
  
  schema = z.object({
    sourcePath: z.string().describe('The path of the file or folder to copy'),
    destinationPath: z.string().describe('The path of the new file or folder'),
  });
  
  async validate(args: z.infer<typeof this.schema>, context: ToolContext) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if source exists
    const sourceFile = context.app.vault.getAbstractFileByPath(args.sourcePath);
    if (!sourceFile) {
      errors.push(`Source file not found: ${args.sourcePath}`);
    }
    
    // Check if destination already exists
    const destFile = context.app.vault.getAbstractFileByPath(args.destinationPath);
    if (destFile) {
      errors.push(`Destination already exists: ${args.destinationPath}`);
    }
    
    // Check for dangerous paths
    if (args.sourcePath.startsWith('.') || args.sourcePath.includes('..') ||
        args.destinationPath.startsWith('.') || args.destinationPath.includes('..')) {
      errors.push('Paths cannot contain relative references');
    }
    
    // Check if trying to copy into itself
    if (args.destinationPath.startsWith(args.sourcePath + '/')) {
      errors.push('Cannot copy a folder into itself');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  async execute(args: z.infer<typeof this.schema>, context: ToolContext) {
    const { sourcePath, destinationPath } = args;
    
    try {
      const file = context.app.vault.getAbstractFileByPath(sourcePath);
      if (file) {
        await context.app.vault.copy(file, destinationPath);
        return {
          success: true,
          message: `Successfully copied ${sourcePath} to ${destinationPath}`,
          sourcePath,
          destinationPath,
        };
      }
      return {
        success: false,
        message: `File not found: ${sourcePath}`,
        error: 'Source file not found',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to copy file: ${error.message}`,
        error: error.message,
      };
    }
  }
}