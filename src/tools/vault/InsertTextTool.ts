import { z } from 'zod/v3';
import { Tool, ToolMetadata, ToolContext } from '../types';
import { ToolResponse } from '../../types';
import { TFile } from 'obsidian';
import { useUndoStore } from '../../stores/undoStore';

export class InsertTextTool implements Tool {
	metadata: ToolMetadata = {
		id: 'insert_text',
		name: 'InsertText',
		description: 'Insert text at a specific position or after a specific heading in a note',
		category: 'vault',
		requiresApproval: true,
	};

	schema = z.object({
		path: z.string().describe('The path to the note file'),
		content: z.string().describe('The content to insert'),
		position: z.union([
			z.object({
				type: z.literal('line'),
				lineNumber: z.number().describe('Line number to insert at (1-based)')
			}),
			z.object({
				type: z.literal('heading'),
				heading: z.string().describe('Heading to insert after'),
				createIfMissing: z.boolean().default(false).describe('Create heading if it doesn\'t exist')
			}),
			z.object({
				type: z.literal('pattern'),
				pattern: z.string().describe('Pattern to search for and insert after'),
				occurrence: z.number().default(1).describe('Which occurrence to insert after')
			})
		]).describe('Where to insert the text')
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
			return { valid: false, error: 'Can only insert into markdown files' };
		}
		
		return { valid: true };
	}

	async execute(args: any, context: ToolContext): Promise<ToolResponse> {
		const { path, content, position } = args;
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
			const lines = currentContent.split('\n');
			
			let insertIndex = -1;
			let insertMessage = '';

			// Determine where to insert based on position type
			switch (position.type) {
				case 'line': {
					// Convert to 0-based index
					insertIndex = position.lineNumber - 1;
					if (insertIndex < 0 || insertIndex > lines.length) {
						return {
							success: false,
							message: `Invalid line number: ${position.lineNumber}. File has ${lines.length} lines.`
						};
					}
					insertMessage = `at line ${position.lineNumber}`;
					break;
				}
				
				case 'heading': {
					// Find the heading
					const headingRegex = new RegExp(`^#+\\s+${position.heading}\\s*$`, 'm');
					const headingLine = lines.findIndex((line: string) => headingRegex.test(line));
					
					if (headingLine === -1) {
						if (position.createIfMissing) {
							// Add heading at the end
							lines.push('', `## ${position.heading}`, '');
							insertIndex = lines.length;
							insertMessage = `after new heading "${position.heading}"`;
						} else {
							return {
								success: false,
								message: `Heading not found: "${position.heading}"`
							};
						}
					} else {
						// Find next heading or end of file
						let nextIndex = headingLine + 1;
						while (nextIndex < lines.length && !lines[nextIndex].match(/^#+\s/)) {
							nextIndex++;
						}
						insertIndex = nextIndex;
						insertMessage = `after heading "${position.heading}"`;
					}
					break;
				}
				
				case 'pattern': {
					// Find the pattern
					const pattern = new RegExp(position.pattern, 'g');
					let matches = [];
					let lineIndex = 0;
					
					for (const line of lines) {
						if (pattern.test(line)) {
							matches.push(lineIndex);
						}
						lineIndex++;
					}
					
					if (matches.length === 0) {
						return {
							success: false,
							message: `Pattern not found: "${position.pattern}"`
						};
					}
					
					if (position.occurrence > matches.length) {
						return {
							success: false,
							message: `Pattern found only ${matches.length} times, but occurrence ${position.occurrence} requested`
						};
					}
					
					insertIndex = matches[position.occurrence - 1] + 1;
					insertMessage = `after pattern "${position.pattern}" (occurrence ${position.occurrence})`;
					break;
				}
			}

			// Insert the content
			const contentLines = content.split('\n');
			lines.splice(insertIndex, 0, ...contentLines);
			
			const newContent = lines.join('\n');

			// Track operation for undo
			useUndoStore.getState().addOperation({
				id: `insert-${Date.now()}`,
				type: 'modify',
				timestamp: Date.now(),
				description: `Insert text in ${file.path}`,
				undo: async () => {
					await app.vault.modify(file, currentContent);
				},
				redo: async () => {
					await app.vault.modify(file, newContent);
				}
			});

			// Save the modified content
			await app.vault.modify(file, newContent);

			return {
				success: true,
				message: `Inserted ${contentLines.length} line(s) ${insertMessage} in ${path}`,
				data: {
					path,
					insertedAt: insertIndex + 1,
					linesInserted: contentLines.length
				}
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to insert text: ${error.message}`
			};
		}
	}
}