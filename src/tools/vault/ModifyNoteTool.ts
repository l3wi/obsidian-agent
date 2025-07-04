import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { TFile } from 'obsidian';
import { useUndoStore, createUndoableFileOperation } from '../../stores/undoStore';

export class ModifyNoteTool implements Tool {
  metadata = {
    id: 'modify_note',
    name: 'Modify Note',
    description: 'Modify an existing note in the Obsidian vault',
    category: 'vault' as const,
    icon: 'file-edit',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The file path of the note to modify'),
    content: z.string().describe('The new content for the note'),
  });
  
  async validate(args: z.infer<typeof this.schema>, context: ToolContext) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if file exists
    const file = context.app.vault.getAbstractFileByPath(args.path);
    if (!file) {
      errors.push(`File not found: ${args.path}`);
    } else if (!(file instanceof TFile)) {
      errors.push(`Path is not a file: ${args.path}`);
    }
    
    // Check for dangerous paths
    if (args.path.startsWith('.') || args.path.includes('..')) {
      errors.push('Path cannot contain relative references');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  async execute(args: z.infer<typeof this.schema>, context: ToolContext) {
    const { path, content } = args;
    
    try {
      const file = context.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof TFile) {
        // Read old content for undo
        const oldContent = await context.app.vault.read(file);
        
        // Modify the file
        await context.app.vault.modify(file, content);
        
        // Add to undo history
        const undoOperation = createUndoableFileOperation(
          context.app,
          'modify',
          path,
          oldContent,
          content
        );
        useUndoStore.getState().addOperation(undoOperation);
        
        return {
          success: true,
          message: `Successfully modified note at ${path}`,
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
        message: `Failed to modify note: ${error.message}`,
        error: error.message,
      };
    }
  }
}