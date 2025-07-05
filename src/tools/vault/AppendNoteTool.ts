import { z } from 'zod/v3';
import { Tool, ToolMetadata, ToolContext } from '../types';
import { ToolResponse } from '../../types';
import { TFile } from 'obsidian';
import { useUndoStore } from '../../stores/undoStore';

export class AppendNoteTool implements Tool {
	metadata: ToolMetadata = {
		id: 'append_note',
		name: 'AppendNote',
		description: 'Append content to the end of an existing note',
		category: 'vault',
		requiresApproval: true,
	};

	schema = z.object({
		path: z.string().describe('The path to the note file'),
		content: z.string().describe('The content to append to the note'),
		newline: z.boolean().default(true).describe('Whether to add a newline before appending'),
	});

	async validate(args: any, context: ToolContext): Promise<{ valid: boolean; error?: string }> {
		const { path } = args;
		
		// Check if file exists
		const file = context.app.vault.getAbstractFileByPath(path);
		if (!file) {
			return { valid: false, error: `File not found: ${path}` };
		}
		
		if (!(file instanceof TFile)) {
			return { valid: false, error: `Path is not a file: ${path}` };
		}
		
		// Check if it's a markdown file
		if (!path.endsWith('.md')) {
			return { valid: false, error: 'Can only append to markdown files' };
		}
		
		return { valid: true };
	}

	async execute(args: any, context: ToolContext): Promise<ToolResponse> {
		const { path, content, newline } = args;
		const { app } = context;

		try {
			const file = app.vault.getAbstractFileByPath(path) as TFile;
			if (!file) {
				return {
					success: false,
					message: `File not found: ${path}`
				};
			}

			// Read current content
			const currentContent = await app.vault.read(file);
			
			// Prepare new content
			let newContent = currentContent;
			if (newline && currentContent.length > 0 && !currentContent.endsWith('\n')) {
				newContent += '\n';
			}
			newContent += content;

			// Track operation for undo
			useUndoStore.getState().addOperation({
				id: `append-${Date.now()}`,
				type: 'modify',
				timestamp: Date.now(),
				description: `Append to ${file.path}`,
				undo: async () => {
					await app.vault.modify(file, currentContent);
				},
				redo: async () => {
					await app.vault.modify(file, newContent);
				}
			});

			// Append content
			await app.vault.modify(file, newContent);

			// Count what was added
			const linesAdded = content.split('\n').length;

			return {
				success: true,
				message: `Appended ${linesAdded} line(s) to ${path}`,
				data: {
					path,
					linesAdded,
					totalLength: newContent.length
				}
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to append to note: ${error.message}`
			};
		}
	}
}