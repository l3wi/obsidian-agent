import { App } from 'obsidian';
import { Agent } from '@openai/agents';
import { 
	CreateNoteTool,
	ModifyNoteTool,
	DeleteFileTool,
	CreateFolderTool,
	CopyFileTool,
	AppendNoteTool,
	InsertTextTool,
	SearchReplaceTool,
	MoveFileTool,
	AnalyzeVaultTool
} from '../tools/vault';
import { ToolRegistry } from '../tools/ToolRegistry';
import { VaultAnalyzer } from '../utils/VaultAnalyzer';

export interface LibrarianConfig {
	name?: string;
	description?: string;
	model?: string;
}

export class LibrarianAgent {
	private app: App;
	private agent: Agent<any>;
	private toolRegistry: ToolRegistry;
	private vaultAnalyzer: VaultAnalyzer;
	private config: LibrarianConfig;

	constructor(app: App, toolRegistry: ToolRegistry, config: LibrarianConfig = {}) {
		this.app = app;
		this.toolRegistry = toolRegistry;
		this.vaultAnalyzer = new VaultAnalyzer(app);
		this.config = {
			name: 'Librarian',
			description: 'Specialized agent for intelligent file operations and vault organization',
			model: 'gpt-4o',
			...config
		};

		// Initialize the agent with specialized instructions
		this.agent = this.createAgent();
		
		// Register specialized file operation tools
		this.registerTools();
	}

	private createAgent(): Agent<any> {
		const instructions = `You are the Librarian, a specialized agent responsible for all file operations in the Obsidian vault.

Your primary responsibilities:
1. **Intelligent File Placement**: Always analyze the vault structure before creating files and suggest appropriate locations
2. **Content Preservation**: When modifying files, preserve existing content and structure unless explicitly asked to replace
3. **Organization**: Maintain consistent folder structures and naming conventions
4. **Smart Operations**: Use the most appropriate tool for each task (append vs modify vs insert)

Key principles:
- ALWAYS use AnalyzeVault tool first when creating new files to understand the vault structure
- NEVER overwrite content unless explicitly instructed - use append, insert, or smart modify instead
- RESPECT existing organizational patterns - don't create new top-level folders without good reason
- MAINTAIN consistency in naming conventions (observe whether the vault uses spaces, dashes, or underscores)
- PRESERVE frontmatter and metadata when modifying files
- SUGGEST better locations if the user specifies a poor file location

File operation guidelines:
- For adding content to existing files: Use AppendNote for end additions, InsertText for specific positions
- For modifying files: Use ModifyNote with 'smart' or 'merge' mode to preserve content
- For new files: First analyze vault structure, then suggest appropriate location
- For moving files: Check for broken links and suggest updates
- For bulk operations: Plan carefully and confirm with user

When creating files:
1. First use AnalyzeVault with action: 'suggest_path' to get the best location
2. If the suggested path differs significantly from user request, explain why
3. Create parent folders if needed
4. Follow existing naming patterns

When modifying files:
1. Always read the current content first
2. Determine the best modification approach (append, insert, smart modify)
3. Preserve formatting, frontmatter, and structure
4. Explain what changes you're making

Remember: You are the guardian of the vault's organization. Make intelligent decisions that respect the existing structure while helping users maintain a well-organized knowledge base.`;

		return new Agent({
			name: this.config.name!,
			instructions,
			model: this.config.model,
			tools: this.getAgentTools(),
		});
	}

	private registerTools(): void {
		// Register all file operation tools with the tool registry
		const tools = [
			new CreateNoteTool(),
			new ModifyNoteTool(),
			new DeleteFileTool(),
			new CreateFolderTool(),
			new CopyFileTool(),
			new AppendNoteTool(),
			new InsertTextTool(),
			new SearchReplaceTool(),
			new MoveFileTool(),
			new AnalyzeVaultTool(),
		];

		tools.forEach(tool => {
			this.toolRegistry.register(tool);
		});
	}

	private getAgentTools(): any[] {
		// Get tool configurations for the agent
		const tools = [
			'create_note',
			'modify_note',
			'delete_file',
			'create_folder',
			'copy_file',
			'append_note',
			'insert_text',
			'search_replace',
			'move_file',
			'analyze_vault',
		];

		return tools.map(toolId => {
			const tool = this.toolRegistry.getTool(toolId);
			if (!tool) {
				throw new Error(`Tool not found: ${toolId}`);
			}

			return {
				name: tool.metadata.name,
				description: tool.metadata.description,
				parameters: tool.schema,
			};
		});
	}

	/**
	 * Get the agent instance for use in orchestration
	 */
	getAgent(): Agent<any> {
		return this.agent;
	}

	/**
	 * Process a file operation request
	 */
	async processFileOperation(operation: string, details: any): Promise<any> {
		// This method can be used for direct file operations if needed
		// The main processing will happen through the agent orchestrator
		
		// First, analyze the operation type
		const operationType = this.categorizeOperation(operation);
		
		// Get vault analysis for context
		const vaultStructure = await this.vaultAnalyzer.analyzeVault();
		
		// Prepare context for the operation
		const context = {
			operation: operationType,
			details,
			vaultInsights: vaultStructure.organizationInsights,
			suggestions: this.vaultAnalyzer.getOrganizationSuggestions(),
		};

		return context;
	}

	/**
	 * Categorize the type of file operation
	 */
	private categorizeOperation(operation: string): string {
		const lower = operation.toLowerCase();
		
		if (lower.includes('create') || lower.includes('new')) {
			return 'create';
		} else if (lower.includes('modify') || lower.includes('edit') || lower.includes('update')) {
			return 'modify';
		} else if (lower.includes('append') || lower.includes('add to')) {
			return 'append';
		} else if (lower.includes('move') || lower.includes('rename')) {
			return 'move';
		} else if (lower.includes('delete') || lower.includes('remove')) {
			return 'delete';
		} else if (lower.includes('organize') || lower.includes('structure')) {
			return 'organize';
		}
		
		return 'unknown';
	}

	/**
	 * Get suggestions for file placement
	 */
	async suggestFileLocation(fileName: string, content: string): Promise<{
		primary: string;
		alternatives: string[];
		reasoning: string;
	}> {
		const classification = await this.vaultAnalyzer.suggestPath(fileName, content);
		
		return {
			primary: classification.suggestedPath,
			alternatives: classification.alternativePaths || [],
			reasoning: classification.reasoning,
		};
	}

	/**
	 * Validate a file operation before execution
	 */
	async validateOperation(operation: any): Promise<{
		valid: boolean;
		warnings: string[];
		suggestions: string[];
	}> {
		const warnings: string[] = [];
		const suggestions: string[] = [];
		
		// Check for common issues
		if (operation.type === 'create' && operation.path) {
			// Check if file already exists
			const existing = this.app.vault.getAbstractFileByPath(operation.path);
			if (existing) {
				warnings.push(`File already exists at ${operation.path}`);
				suggestions.push('Consider using modify or append instead');
			}
			
			// Check if path follows conventions
			const vaultStructure = await this.vaultAnalyzer.analyzeVault();
			const hasSpaces = operation.path.includes(' ');
			const hasDashes = operation.path.includes('-');
			const hasUnderscores = operation.path.includes('_');
			
			// Check vault conventions
			const vaultUsesSpaces = vaultStructure.folderPatterns.some(fp => fp.path.includes(' '));
			const vaultUsesDashes = vaultStructure.folderPatterns.some(fp => fp.path.includes('-'));
			const vaultUsesUnderscores = vaultStructure.folderPatterns.some(fp => fp.path.includes('_'));
			
			if (hasSpaces && !vaultUsesSpaces) {
				suggestions.push('Consider using dashes or underscores instead of spaces');
			}
		}
		
		return {
			valid: warnings.length === 0,
			warnings,
			suggestions,
		};
	}
}