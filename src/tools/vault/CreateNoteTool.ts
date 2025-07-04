import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { useUndoStore, createUndoableFileOperation } from '../../stores/undoStore';

export class CreateNoteTool implements Tool {
  metadata = {
    id: 'create_note',
    name: 'Create Note',
    description: 'Create a new note in the Obsidian vault',
    category: 'vault' as const,
    icon: 'file-plus',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The file path for the new note (e.g., "Notes/MyNote.md")'),
    content: z.string().describe('The content of the note in Markdown format'),
  });
  
  async validate(args: z.infer<typeof this.schema>, context: ToolContext) {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if file already exists
    const existingFile = context.app.vault.getAbstractFileByPath(args.path);
    if (existingFile) {
      errors.push(`File already exists at ${args.path}`);
    }
    
    // Check path validity
    if (!args.path.endsWith('.md')) {
      warnings.push('File path should end with .md extension');
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
      // Create parent folders if needed
      const parentFolder = path.substring(0, path.lastIndexOf('/'));
      if (parentFolder && !context.app.vault.getAbstractFileByPath(parentFolder)) {
        await context.app.vault.createFolder(parentFolder);
      }
      
      // Create the note
      await context.app.vault.create(path, content);
      
      // Add to undo history
      const undoOperation = createUndoableFileOperation(
        context.app,
        'create',
        path,
        undefined,
        content
      );
      useUndoStore.getState().addOperation(undoOperation);
      
      return {
        success: true,
        message: `Successfully created note at ${path}`,
        path,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create note: ${error.message}`,
        error: error.message,
      };
    }
  }
}