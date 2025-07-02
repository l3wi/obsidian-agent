import { App, TFile, MetadataCache } from 'obsidian';
import { ToolResponse } from '../types';

interface SearchResult {
	file: TFile;
	matches: Array<{
		line: number;
		text: string;
		context: string;
	}>;
	score: number;
}

export class SearchTool {
	private app: App;
	private metadataCache: MetadataCache;

	constructor(app: App) {
		this.app = app;
		this.metadataCache = app.metadataCache;
	}

	/**
	 * Search the vault for notes containing the query
	 * @param args Array of arguments from the command parser
	 * @returns Tool response with search results
	 */
	async execute(args: string[]): Promise<ToolResponse> {
		if (args.length === 0) {
			return {
				success: false,
				message: 'Please provide a search query. Usage: /search <query>'
			};
		}

		const query = args.join(' ').toLowerCase();

		try {
			const results = await this.searchVault(query);

			if (results.length === 0) {
				return {
					success: true,
					message: `No results found for "${query}"`
				};
			}

			// Format results for display
			const formattedResults = this.formatSearchResults(results, query);

			return {
				success: true,
				message: formattedResults,
				data: results
			};
		} catch (error) {
			return {
				success: false,
				message: `Error searching vault: ${error.message}`
			};
		}
	}

	/**
	 * Search the vault for files matching the query
	 * @param query The search query
	 * @returns Array of search results
	 */
	private async searchVault(query: string): Promise<SearchResult[]> {
		const files = this.app.vault.getMarkdownFiles();
		const results: SearchResult[] = [];

		for (const file of files) {
			const result = await this.searchFile(file, query);
			if (result.matches.length > 0) {
				results.push(result);
			}
		}

		// Sort by relevance score
		results.sort((a, b) => b.score - a.score);

		// Return top 10 results
		return results.slice(0, 10);
	}

	/**
	 * Search a single file for the query
	 * @param file The file to search
	 * @param query The search query
	 * @returns Search result for the file
	 */
	private async searchFile(file: TFile, query: string): Promise<SearchResult> {
		const content = await this.app.vault.cachedRead(file);
		const lines = content.split('\n');
		const matches: SearchResult['matches'] = [];
		let score = 0;

		// Check file name
		if (file.basename.toLowerCase().includes(query)) {
			score += 10; // Higher score for title matches
		}

		// Check metadata (tags, aliases)
		const metadata = this.metadataCache.getFileCache(file);
		if (metadata) {
			// Check tags
			if (metadata.tags) {
				for (const tag of metadata.tags) {
					if (tag.tag.toLowerCase().includes(query)) {
						score += 5;
					}
				}
			}

			// Check frontmatter
			if (metadata.frontmatter) {
				const frontmatterStr = JSON.stringify(metadata.frontmatter).toLowerCase();
				if (frontmatterStr.includes(query)) {
					score += 3;
				}
			}
		}

		// Search content
		lines.forEach((line, lineNumber) => {
			const lowerLine = line.toLowerCase();
			if (lowerLine.includes(query)) {
				const index = lowerLine.indexOf(query);
				const start = Math.max(0, index - 30);
				const end = Math.min(line.length, index + query.length + 30);
				const context = line.substring(start, end);

				matches.push({
					line: lineNumber + 1,
					text: line.trim(),
					context: (start > 0 ? '...' : '') + context + (end < line.length ? '...' : '')
				});

				score += 1;
			}
		});

		return { file, matches, score };
	}

	/**
	 * Format search results for display
	 * @param results Array of search results
	 * @param query The original query
	 * @returns Formatted string for display
	 */
	private formatSearchResults(results: SearchResult[], query: string): string {
		const lines: string[] = [`Found ${results.length} results for "${query}":\n`];

		results.forEach((result, index) => {
			lines.push(`**${index + 1}. [[${result.file.basename}]]**`);
			
			// Show first few matches
			const matchesToShow = Math.min(2, result.matches.length);
			for (let i = 0; i < matchesToShow; i++) {
				const match = result.matches[i];
				lines.push(`   Line ${match.line}: ${match.context}`);
			}

			if (result.matches.length > matchesToShow) {
				lines.push(`   ... and ${result.matches.length - matchesToShow} more matches`);
			}

			lines.push(''); // Empty line between results
		});

		return lines.join('\n');
	}
}