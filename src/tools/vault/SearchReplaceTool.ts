import { z } from 'zod/v3';
import { Tool, ToolMetadata, ToolContext } from '../types';
import { ToolResponse } from '../../types';
import { TFile } from 'obsidian';
import { useUndoStore } from '../../stores/undoStore';

export class SearchReplaceTool implements Tool {
	metadata: ToolMetadata = {
		id: 'search_replace',
		name: 'SearchReplace',
		description: 'Search and replace text in a note with options for case sensitivity and regex',
		category: 'vault',
		requiresApproval: true,
	};

	schema = z.object({
		path: z.string().describe('The path to the note file'),
		search: z.string().describe('The text or pattern to search for'),
		replace: z.string().describe('The replacement text'),
		options: z.object({
			regex: z.boolean().default(false).describe('Use regular expression for search'),
			caseSensitive: z.boolean().default(true).describe('Case sensitive search'),
			wholeWord: z.boolean().default(false).describe('Match whole words only'),
			replaceAll: z.boolean().default(true).describe('Replace all occurrences or just the first'),
			preserveCase: z.boolean().default(false).describe('Try to preserve the case of replaced text')
		}).default({})
	});

	async validate(args: any, context: ToolContext): Promise<{ valid: boolean; error?: string }> {
		const { path, search, options } = args;
		
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
			return { valid: false, error: 'Can only search/replace in markdown files' };
		}
		
		// Validate regex if provided
		if (options?.regex) {
			try {
				new RegExp(search);
			} catch (e) {
				return { valid: false, error: `Invalid regular expression: ${e.message}` };
			}
		}
		
		return { valid: true };
	}

	private preserveCase(original: string, replacement: string): string {
		// If original is all uppercase
		if (original === original.toUpperCase()) {
			return replacement.toUpperCase();
		}
		
		// If original is title case
		if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
			return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
		}
		
		// Otherwise return as-is
		return replacement;
	}

	async execute(args: any, context: ToolContext): Promise<ToolResponse> {
		const { path, search, replace, options = {} } = args;
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
			
			let searchPattern: RegExp;
			let replaceCount = 0;
			let newContent = currentContent;

			// Build search pattern
			if (options.regex) {
				const flags = options.caseSensitive ? 'g' : 'gi';
				searchPattern = new RegExp(search, flags);
			} else {
				let escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				
				if (options.wholeWord) {
					escapedSearch = `\\b${escapedSearch}\\b`;
				}
				
				const flags = options.caseSensitive ? 'g' : 'gi';
				searchPattern = new RegExp(escapedSearch, flags);
			}

			// Count matches first
			const matches = currentContent.match(searchPattern);
			if (!matches || matches.length === 0) {
				return {
					success: false,
					message: `No matches found for "${search}" in ${path}`
				};
			}

			// Perform replacement
			if (options.replaceAll) {
				newContent = currentContent.replace(searchPattern, (match: string) => {
					replaceCount++;
					return options.preserveCase ? this.preserveCase(match, replace) : replace;
				});
			} else {
				// Replace only first occurrence
				let replaced = false;
				newContent = currentContent.replace(searchPattern, (match: string) => {
					if (!replaced) {
						replaced = true;
						replaceCount++;
						return options.preserveCase ? this.preserveCase(match, replace) : replace;
					}
					return match;
				});
			}

			// Track operation for undo
			useUndoStore.getState().addOperation({
				id: `replace-${Date.now()}`,
				type: 'modify',
				timestamp: Date.now(),
				description: `Search/replace in ${file.path}`,
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
				message: `Replaced ${replaceCount} occurrence(s) of "${search}" with "${replace}" in ${path}`,
				data: {
					path,
					matchesFound: matches.length,
					replacementsMade: replaceCount,
					options
				}
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to search and replace: ${error.message}`
			};
		}
	}
}