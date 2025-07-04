import { Tool, ToolContext } from '../types';
import { z } from 'zod/v3';
import { TFile } from 'obsidian';
import { useUndoStore, createUndoableFileOperation } from '../../stores/undoStore';

export class ModifyNoteTool implements Tool {
  metadata = {
    id: 'modify_note',
    name: 'Modify Note',
    description: 'Modify an existing note with options for full replacement or smart updates',
    category: 'vault' as const,
    icon: 'file-edit',
    requiresApproval: true,
  };
  
  schema = z.object({
    path: z.string().describe('The file path of the note to modify'),
    content: z.string().describe('The new content for the note'),
    mode: z.enum(['replace', 'smart', 'merge']).default('smart').describe(
      'Modification mode: replace (full replacement), smart (preserve structure), merge (combine intelligently)'
    ),
    section: z.string().optional().describe('Specific section to modify (for smart mode)'),
    preserveFrontmatter: z.boolean().default(true).describe('Whether to preserve YAML frontmatter'),
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
    const { path, content, mode = 'smart', section, preserveFrontmatter = true } = args;
    
    try {
      const file = context.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof TFile) {
        // Read old content for undo
        const oldContent = await context.app.vault.read(file);
        
        let newContent: string;
        
        switch (mode) {
          case 'replace':
            // Simple replacement
            newContent = content;
            break;
            
          case 'smart':
            // Smart update - preserve structure and update intelligently
            newContent = await this.smartUpdate(oldContent, content, section, preserveFrontmatter);
            break;
            
          case 'merge':
            // Merge new content with existing
            newContent = await this.mergeContent(oldContent, content, preserveFrontmatter);
            break;
            
          default:
            newContent = content;
        }
        
        // Modify the file
        await context.app.vault.modify(file, newContent);
        
        // Add to undo history
        const undoOperation = createUndoableFileOperation(
          context.app,
          'modify',
          path,
          oldContent,
          newContent
        );
        useUndoStore.getState().addOperation(undoOperation);
        
        const modeDesc = mode === 'replace' ? 'replaced' : mode === 'smart' ? 'smartly updated' : 'merged';
        
        return {
          success: true,
          message: `Successfully ${modeDesc} note at ${path}`,
          path,
          mode,
          changes: this.summarizeChanges(oldContent, newContent),
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
  
  private async smartUpdate(oldContent: string, newContent: string, section?: string, preserveFrontmatter = true): Promise<string> {
    const lines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Extract frontmatter if present
    let frontmatter = '';
    let contentStartIndex = 0;
    
    if (preserveFrontmatter && lines[0] === '---') {
      const endIndex = lines.findIndex((line, idx) => idx > 0 && line === '---');
      if (endIndex > 0) {
        frontmatter = lines.slice(0, endIndex + 1).join('\n');
        contentStartIndex = endIndex + 1;
      }
    }
    
    // If section is specified, update only that section
    if (section) {
      const sectionRegex = new RegExp(`^#+\\s+${section}\\s*$`, 'm');
      const sectionStart = lines.findIndex((line, idx) => idx >= contentStartIndex && sectionRegex.test(line));
      
      if (sectionStart !== -1) {
        // Find the next section of same or higher level
        const sectionLevel = lines[sectionStart].match(/^#+/)?.[0].length || 1;
        let sectionEnd = lines.length;
        
        for (let i = sectionStart + 1; i < lines.length; i++) {
          const match = lines[i].match(/^#+/);
          if (match && match[0].length <= sectionLevel) {
            sectionEnd = i;
            break;
          }
        }
        
        // Replace section content
        const updatedLines = [
          ...lines.slice(0, sectionStart + 1),
          ...newLines,
          ...lines.slice(sectionEnd)
        ];
        
        return updatedLines.join('\n');
      }
    }
    
    // Otherwise, intelligently merge content
    if (preserveFrontmatter && frontmatter) {
      return frontmatter + '\n' + newContent;
    }
    
    return newContent;
  }
  
  private async mergeContent(oldContent: string, newContent: string, preserveFrontmatter = true): Promise<string> {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Extract frontmatter from old content
    let frontmatter = '';
    let oldContentStart = 0;
    
    if (preserveFrontmatter && oldLines[0] === '---') {
      const endIndex = oldLines.findIndex((line, idx) => idx > 0 && line === '---');
      if (endIndex > 0) {
        frontmatter = oldLines.slice(0, endIndex + 1).join('\n');
        oldContentStart = endIndex + 1;
      }
    }
    
    // Extract headings from both contents
    const oldHeadings = this.extractHeadingStructure(oldLines.slice(oldContentStart));
    const newHeadings = this.extractHeadingStructure(newLines);
    
    // Merge based on heading structure
    const mergedLines: string[] = [];
    
    if (frontmatter) {
      mergedLines.push(...frontmatter.split('\n'));
    }
    
    // Add old content
    mergedLines.push(...oldLines.slice(oldContentStart));
    
    // Add new content with separator if it doesn't duplicate existing sections
    if (newContent.trim()) {
      // Check if new content has unique headings
      const hasUniqueContent = newHeadings.some(h => !oldHeadings.includes(h));
      
      if (hasUniqueContent || newHeadings.length === 0) {
        mergedLines.push('', '---', '', ...newLines);
      }
    }
    
    return mergedLines.join('\n');
  }
  
  private extractHeadingStructure(lines: string[]): string[] {
    return lines
      .filter(line => line.match(/^#+\s/))
      .map(line => line.replace(/^#+\s+/, '').trim());
  }
  
  private summarizeChanges(oldContent: string, newContent: string): any {
    const oldLines = oldContent.split('\n').length;
    const newLines = newContent.split('\n').length;
    const oldWords = oldContent.split(/\s+/).length;
    const newWords = newContent.split(/\s+/).length;
    
    return {
      linesAdded: Math.max(0, newLines - oldLines),
      linesRemoved: Math.max(0, oldLines - newLines),
      totalLines: newLines,
      wordsAdded: Math.max(0, newWords - oldWords),
      wordsRemoved: Math.max(0, oldWords - newWords),
      totalWords: newWords,
    };
  }
}