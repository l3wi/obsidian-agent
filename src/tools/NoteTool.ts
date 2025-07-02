import { App, TFile, normalizePath } from 'obsidian';
import { ToolResponse, VaultOperation } from '../types';

export class NoteTool {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Create or edit a note based on the provided arguments
	 * @param args Array of arguments from the command parser
	 * @returns Tool response with success status and any approval requirements
	 */
	async execute(args: string[]): Promise<ToolResponse> {
		if (args.length === 0) {
			return {
				success: false,
				message: 'Please provide a note title. Usage: /note <title> [content]'
			};
		}

		// Parse title and content
		const title = args[0];
		const content = args.slice(1).join(' ') || '';

		// Normalize the file path
		const fileName = `${title}.md`;
		const filePath = normalizePath(fileName);

		try {
			// Check if file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			
			if (existingFile && existingFile instanceof TFile) {
				// File exists - prepare edit operation
				const currentContent = await this.app.vault.read(existingFile);
				const newContent = content || currentContent;

				const operation: VaultOperation = {
					type: 'update',
					path: filePath,
					content: newContent
				};

				return {
					success: true,
					message: `Ready to update note: ${title}`,
					requiresApproval: true,
					approvalData: {
						id: Date.now().toString(),
						type: 'edit',
						filePath,
						content: newContent,
						oldContent: currentContent,
						description: `Update existing note "${title}"`
					},
					data: operation
				};
			} else {
				// File doesn't exist - prepare create operation
				const initialContent = content || `# ${title}\n\n`;

				const operation: VaultOperation = {
					type: 'create',
					path: filePath,
					content: initialContent
				};

				return {
					success: true,
					message: `Ready to create note: ${title}`,
					requiresApproval: true,
					approvalData: {
						id: Date.now().toString(),
						type: 'create',
						filePath,
						content: initialContent,
						description: `Create new note "${title}"`
					},
					data: operation
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Error preparing note operation: ${error.message}`
			};
		}
	}

	/**
	 * Execute an approved vault operation
	 * @param operation The vault operation to execute
	 * @returns Success status
	 */
	async executeApprovedOperation(operation: VaultOperation): Promise<boolean> {
		try {
			switch (operation.type) {
				case 'create':
					await this.app.vault.create(operation.path, operation.content || '');
					break;
				case 'update':
					const file = this.app.vault.getAbstractFileByPath(operation.path);
					if (file instanceof TFile) {
						await this.app.vault.modify(file, operation.content || '');
					}
					break;
				default:
					return false;
			}
			return true;
		} catch (error) {
			console.error('Error executing vault operation:', error);
			return false;
		}
	}
}