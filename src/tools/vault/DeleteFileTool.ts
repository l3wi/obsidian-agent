import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { TFile, TFolder } from 'obsidian';
import { useUndoStore, createUndoableFileOperation, createUndoableFolderOperation } from '../../stores/undoStore';

export class DeleteFileTool implements Tool {
  metadata = {
    id: 'delete_file',
    name: 'Delete File',
    description: 'Delete a file or folder in the Obsidian vault (moves to trash)',
    category: 'vault' as const,
    icon: 'trash',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The path of the file or folder to delete'),
  });
  
  async validate(args: z.infer<typeof this.schema>, context: ToolContext) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if file exists
    const file = context.app.vault.getAbstractFileByPath(args.path);
    if (!file) {
      errors.push(`File not found: ${args.path}`);
    }
    
    // Check for dangerous paths
    if (args.path === '/' || args.path === '') {
      errors.push('Cannot delete root directory');
    }
    
    // Warning for important files
    if (args.path.includes('.obsidian')) {
      warnings.push('Warning: This appears to be a system file');
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
      const file = context.app.vault.getAbstractFileByPath(path);
      if (file) {
        // Handle file deletion
        if (file instanceof TFile) {
          // Read content for undo
          const content = await context.app.vault.read(file);
          
          // Delete the file
          await context.app.vault.trash(file, true);
          
          // Add to undo history
          const undoOperation = createUndoableFileOperation(
            context.app,
            'delete',
            path,
            content,
            undefined
          );
          useUndoStore.getState().addOperation(undoOperation);
        } else if (file instanceof TFolder) {
          // Delete the folder
          await context.app.vault.trash(file, true);
          
          // Add to undo history
          const undoOperation = createUndoableFolderOperation(
            context.app,
            'delete',
            path
          );
          useUndoStore.getState().addOperation(undoOperation);
        }
        
        return {
          success: true,
          message: `Successfully moved ${path} to trash`,
          path,
        };
      }
      return {
        success: false,
        message: `File not found: ${path}`,
        error: 'File not found',
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to delete file: ${error.message}`,
        error: error.message,
      };
    }
  }
}