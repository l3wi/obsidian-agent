import { z } from 'zod/v3';
import { Tool, ToolMetadata, ToolContext } from '../types';
import { ToolResponse } from '../../types';
import { VaultAnalyzer } from '../../utils/VaultAnalyzer';

export class AnalyzeVaultTool implements Tool {
	metadata: ToolMetadata = {
		id: 'analyze_vault',
		name: 'AnalyzeVault',
		description: 'Analyze the vault structure and suggest organization improvements',
		category: 'vault',
		requiresApproval: false,
	};

	schema = z.object({
		action: z.enum(['structure', 'suggest_path', 'find_similar', 'get_suggestions']).describe('The type of analysis to perform'),
		fileName: z.string().optional().describe('File name for path suggestion or similarity search'),
		content: z.string().optional().describe('File content for better path suggestion'),
		fileType: z.string().optional().describe('Type of content (meeting, daily, task, etc.)'),
		limit: z.number().default(5).describe('Number of results to return for similarity search')
	});

	async validate(args: any, context: ToolContext): Promise<{ valid: boolean; error?: string }> {
		const { action, fileName, content } = args;
		
		// Validate required parameters based on action
		if (action === 'suggest_path' && !fileName) {
			return { valid: false, error: 'fileName is required for suggest_path action' };
		}
		
		if (action === 'find_similar' && !fileName) {
			return { valid: false, error: 'fileName is required for find_similar action' };
		}
		
		return { valid: true };
	}

	async execute(args: any, context: ToolContext): Promise<ToolResponse> {
		const { action, fileName, content, fileType, limit } = args;
		const { app } = context;

		try {
			const analyzer = new VaultAnalyzer(app);

			switch (action) {
				case 'structure': {
					const structure = await analyzer.analyzeVault();
					
					// Format the structure data for readability
					const summary = [
						`📊 Vault Structure Analysis:`,
						``,
						`📁 Total Folders: ${structure.totalFolders}`,
						`📄 Total Files: ${structure.totalFiles}`,
						``,
						`📈 Files by Type:`,
						...Array.from(structure.filesByExtension.entries())
							.sort((a, b) => b[1] - a[1])
							.map(([ext, count]) => `  • .${ext}: ${count} files`),
						``,
						`🗂️ Main Folders:`,
						...structure.folderPatterns
							.sort((a, b) => b.fileCount - a.fileCount)
							.slice(0, 10)
							.map(fp => `  • ${fp.path} (${fp.type}): ${fp.fileCount} files`),
						``,
						`💡 Organization Insights:`,
						...structure.organizationInsights
							.map(insight => `  • ${insight.suggestion || insight.pattern}`)
					].join('\n');

					return {
						success: true,
						message: summary,
						data: structure
					};
				}

				case 'suggest_path': {
					const classification = await analyzer.suggestPath(
						fileName!,
						content || '',
						fileType
					);

					const message = [
						`📍 Suggested location for "${fileName}":`,
						``,
						`✅ Primary: ${classification.suggestedPath}`,
						`   Reason: ${classification.reasoning}`,
						`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`,
					];

					if (classification.alternativePaths && classification.alternativePaths.length > 0) {
						message.push(
							``,
							`🔄 Alternatives:`,
							...classification.alternativePaths.map(path => `   • ${path}`)
						);
					}

					return {
						success: true,
						message: message.join('\n'),
						data: classification
					};
				}

				case 'find_similar': {
					const similarFiles = analyzer.findSimilarFiles(fileName!, content, limit);

					if (similarFiles.length === 0) {
						return {
							success: true,
							message: `No similar files found for "${fileName}"`,
							data: { files: [] }
						};
					}

					const message = [
						`🔍 Similar files to "${fileName}":`,
						``,
						...similarFiles.map((file, index) => 
							`${index + 1}. ${file.path}`
						)
					].join('\n');

					return {
						success: true,
						message,
						data: { 
							files: similarFiles.map(f => ({
								path: f.path,
								name: f.basename,
								modified: f.stat.mtime
							}))
						}
					};
				}

				case 'get_suggestions': {
					const suggestions = analyzer.getOrganizationSuggestions();

					if (suggestions.length === 0) {
						return {
							success: true,
							message: '✅ Your vault organization looks good! No major issues found.',
							data: { suggestions: [] }
						};
					}

					const message = [
						`💡 Vault Organization Suggestions:`,
						``,
						...suggestions.map((suggestion, index) => 
							`${index + 1}. ${suggestion}`
						)
					].join('\n');

					return {
						success: true,
						message,
						data: { suggestions }
					};
				}

				default:
					return {
						success: false,
						message: `Unknown action: ${action}`
					};
			}
		} catch (error) {
			return {
				success: false,
				message: `Failed to analyze vault: ${error.message}`
			};
		}
	}
}