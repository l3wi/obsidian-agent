import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { useUndoStore, createUndoableFileOperation } from '../../stores/undoStore';
import { VaultAnalyzer } from '../../utils/VaultAnalyzer';

export class CreateNoteTool implements Tool {
  metadata = {
    id: 'create_note',
    name: 'Create Note',
    description: 'Create a new note in the Obsidian vault with smart file placement',
    category: 'vault' as const,
    icon: 'file-plus',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The file path for the new note (e.g., "Notes/MyNote.md")'),
    content: z.string().describe('The content of the note in Markdown format'),
    smartPlacement: z.boolean().default(true).describe('Use smart placement to suggest better location based on vault structure'),
    fileType: z.string().nullable().default(null).describe('Type of content (meeting, daily, task, project, etc.)'),
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
    const { path, content, smartPlacement = true, fileType } = args;
    let finalPath = path;
    let placementSuggestion: any = null;
    
    try {
      // Use smart placement if enabled
      if (smartPlacement) {
        const analyzer = new VaultAnalyzer(context.app);
        const fileName = path.split('/').pop() || path;
        
        // Get path suggestion
        const classification = await analyzer.suggestPath(fileName, content, fileType || undefined);
        
        // If confidence is high and path is different, use suggested path
        if (classification.confidence > 0.6 && classification.suggestedPath !== path) {
          placementSuggestion = {
            original: path,
            suggested: classification.suggestedPath,
            reasoning: classification.reasoning,
            confidence: classification.confidence,
            alternatives: classification.alternativePaths
          };
          
          // Use suggested path if it's significantly different
          const originalFolder = path.substring(0, path.lastIndexOf('/'));
          const suggestedFolder = classification.suggestedPath.substring(0, classification.suggestedPath.lastIndexOf('/'));
          
          if (originalFolder !== suggestedFolder || !originalFolder) {
            finalPath = classification.suggestedPath;
          }
        }
      }
      
      // Create parent folders if needed
      const parentFolder = finalPath.substring(0, finalPath.lastIndexOf('/'));
      if (parentFolder && !context.app.vault.getAbstractFileByPath(parentFolder)) {
        await this.createFolderRecursive(context.app, parentFolder);
      }
      
      // Create the note
      await context.app.vault.create(finalPath, content);
      
      // Add to undo history
      const undoOperation = createUndoableFileOperation(
        context.app,
        'create',
        finalPath,
        undefined,
        content
      );
      useUndoStore.getState().addOperation(undoOperation);
      
      // Build response message
      let message = `Successfully created note at ${finalPath}`;
      if (placementSuggestion && finalPath !== path) {
        message += `\n📍 Smart placement: Used suggested location (${(placementSuggestion.confidence * 100).toFixed(0)}% confidence)`;
        message += `\n   Reason: ${placementSuggestion.reasoning}`;
      }
      
      return {
        success: true,
        message,
        path: finalPath,
        placementSuggestion,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create note: ${error.message}`,
        error: error.message,
      };
    }
  }
  
  private async createFolderRecursive(app: any, path: string): Promise<void> {
    const parts = path.split('/');
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!app.vault.getAbstractFileByPath(currentPath)) {
        await app.vault.createFolder(currentPath);
      }
    }
  }
}