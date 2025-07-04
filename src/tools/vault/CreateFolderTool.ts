import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { useUndoStore, createUndoableFolderOperation } from '../../stores/undoStore';

export class CreateFolderTool implements Tool {
  metadata = {
    id: 'create_folder',
    name: 'Create Folder',
    description: 'Create a new folder in the Obsidian vault',
    category: 'vault' as const,
    icon: 'folder-plus',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The path for the new folder (e.g., "Notes/My Folder")'),
  });
  
  async validate(args: z.infer<typeof this.schema>, context: ToolContext) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if folder already exists
    const existingFolder = context.app.vault.getAbstractFileByPath(args.path);
    if (existingFolder) {
      errors.push(`Folder already exists at ${args.path}`);
    }
    
    // Check for dangerous paths
    if (args.path.startsWith('.') || args.path.includes('..')) {
      errors.push('Path cannot contain relative references');
    }
    
    // Check for invalid characters
    if (args.path.includes('\\')) {
      errors.push('Path should use forward slashes (/) not backslashes');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  async execute(args: z.infer<typeof this.schema>, context: ToolContext) {
    const { path } = args;
    
    try {
      await context.app.vault.createFolder(path);
      
      // Add to undo history
      const undoOperation = createUndoableFolderOperation(
        context.app,
        'create',
        path
      );
      useUndoStore.getState().addOperation(undoOperation);
      
      return {
        success: true,
        message: `Successfully created folder at ${path}`,
        path,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create folder: ${error.message}`,
        error: error.message,
      };
    }
  }
}