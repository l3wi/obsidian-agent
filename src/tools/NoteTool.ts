import { App, TFile } from 'obsidian';
import { ToolResponse, ApprovalRequest, VaultOperation } from '../types';

export class NoteTool {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Execute a note command
	 * @param args Array of arguments from the command parser
	 * @returns Tool response with the result
	 */
	async execute(args: string[]): Promise<ToolResponse> {
		if (args.length < 2) {
			return {
				success: false,
				message: 'Invalid command. Usage: /note <create|update> <path> [content]'
			};
		}

		const operationType = args[0];
		const path = args[1];
		const content = args.slice(2).join(' ');

		switch (operationType) {
			case 'create':
				return this.prepareCreateNote(path, content);
			
			case 'update':
				return this.prepareUpdateNote(path, content);
			
			default:
				return {
					success: false,
					message: `Unknown note operation: ${operationType}`
				};
		}
	}

	/**
	 * Prepare to create a new note, requesting approval
	 * @param path The path for the new note
	 * @param content The content of the new note
	 * @returns Tool response with approval request
	 */
	private prepareCreateNote(path: string, content: string): ToolResponse {
		const operation: VaultOperation = {
			type: 'create',
			path,
			content
		};

		const approvalRequest: ApprovalRequest = {
			id: `note-create-${Date.now()}`,
			type: 'create',
			filePath: path,
			content: content,
			description: `Create a new note at "${path}" with the provided content.`
		};

		return {
			success: true,
			message: 'Requesting approval to create a new note.',
			requiresApproval: true,
			approvalData: approvalRequest,
			data: operation
		};
	}

	/**
	 * Prepare to update an existing note, requesting approval
	 * @param path The path of the note to update
	 * @param newContent The new content for the note
	 * @returns Tool response with approval request
	 */
	private async prepareUpdateNote(path: string, newContent: string): Promise<ToolResponse> {
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!file || !(file instanceof TFile)) {
			return {
				success: false,
				message: `Note not found at path: ${path}`
			};
		}

		const oldContent = await this.app.vault.read(file);

		const operation: VaultOperation = {
			type: 'update',
			path,
			content: newContent
		};

		const approvalRequest: ApprovalRequest = {
			id: `note-update-${Date.now()}`,
			type: 'edit',
			filePath: path,
			content: newContent,
			oldContent: oldContent,
			description: `Update the note at "${path}" with the new content.`
		};

		return {
			success: true,
			message: 'Requesting approval to update an existing note.',
			requiresApproval: true,
			approvalData: approvalRequest,
			data: operation
		};
	}

	/**
	 * Execute an approved vault operation
	 * @param operation The vault operation to execute
	 * @returns True if the operation was successful
	 */
	async executeApprovedOperation(operation: VaultOperation): Promise<boolean> {
		try {
			switch (operation.type) {
				case 'create':
					await this.app.vault.create(operation.path, operation.content || '');
					return true;
				
				case 'update':
					const file = this.app.vault.getAbstractFileByPath(operation.path);
					if (file && file instanceof TFile) {
						await this.app.vault.modify(file, operation.content || '');
						return true;
					}
					return false;
				
				default:
					return false;
			}
		} catch (error) {
			console.error(`Error executing approved operation:`, error);
			return false;
		}
	}
}
