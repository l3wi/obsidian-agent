import { z } from 'zod/v3';
import { Tool, ToolMetadata, ToolContext } from '../types';
import { ToolResponse } from '../../types';
import { TFile, TFolder, normalizePath } from 'obsidian';
import { useUndoStore } from '../../stores/undoStore';

export class MoveFileTool implements Tool {
	metadata: ToolMetadata = {
		id: 'move_file',
		name: 'MoveFile',
		description: 'Move or rename a file or folder to a new location',
		category: 'vault',
		requiresApproval: true,
	};

	schema = z.object({
		sourcePath: z.string().describe('The current path of the file or folder'),
		destinationPath: z.string().describe('The new path for the file or folder'),
		overwrite: z.boolean().default(false).describe('Whether to overwrite if destination exists'),
		createFolders: z.boolean().default(true).describe('Whether to create parent folders if they don\'t exist')
	});

	async validate(args: any, context: ToolContext): Promise<{ valid: boolean; error?: string }> {
		const { sourcePath, destinationPath, overwrite } = args;
		const { app } = context;
		
		// Check if source exists
		const source = app.vault.getAbstractFileByPath(sourcePath);
		if (!source) {
			return { valid: false, error: `Source not found: ${sourcePath}` };
		}
		
		// Check if destination already exists
		const destination = app.vault.getAbstractFileByPath(destinationPath);
		if (destination && !overwrite) {
			return { valid: false, error: `Destination already exists: ${destinationPath}. Set overwrite to true to replace.` };
		}
		
		// Validate destination path
		if (destinationPath.includes('..')) {
			return { valid: false, error: 'Relative paths with ".." are not allowed' };
		}
		
		// Prevent moving a folder into itself
		if (source instanceof TFolder && destinationPath.startsWith(sourcePath + '/')) {
			return { valid: false, error: 'Cannot move a folder into itself' };
		}
		
		return { valid: true };
	}

	async execute(args: any, context: ToolContext): Promise<ToolResponse> {
		const { sourcePath, destinationPath, overwrite, createFolders } = args;
		const { app } = context;

		try {
			const source = app.vault.getAbstractFileByPath(sourcePath);
			if (!source) {
				return {
					success: false,
					message: `Source not found: ${sourcePath}`
				};
			}

			const normalizedDestPath = normalizePath(destinationPath);
			
			// Check if destination exists
			const existingDestination = app.vault.getAbstractFileByPath(normalizedDestPath);
			let removedContent: string | null = null;
			
			if (existingDestination) {
				if (!overwrite) {
					return {
						success: false,
						message: `Destination already exists: ${normalizedDestPath}`
					};
				}
				
				// If overwriting a file, save its content for undo
				if (existingDestination instanceof TFile) {
					removedContent = await app.vault.read(existingDestination);
				}
				
				// Delete the existing destination
				await app.vault.delete(existingDestination);
			}

			// Create parent folders if needed
			if (createFolders) {
				const parentPath = normalizedDestPath.substring(0, normalizedDestPath.lastIndexOf('/'));
				if (parentPath && !app.vault.getAbstractFileByPath(parentPath)) {
					await this.createFolderRecursive(app, parentPath);
				}
			}

			// For undo tracking, we need to handle files and folders differently
			if (source instanceof TFile) {
				const content = await app.vault.read(source);
				
				// Track operation for undo
				useUndoStore.getState().addOperation({
					id: `move-${Date.now()}`,
					type: 'move',
					timestamp: Date.now(),
					description: `Move ${sourcePath} to ${normalizedDestPath}`,
					undo: async () => {
						// Restore original file
						await app.vault.create(sourcePath, content);
						// Delete moved file
						const movedFile = app.vault.getAbstractFileByPath(normalizedDestPath);
						if (movedFile) {
							await app.vault.delete(movedFile);
						}
						// Restore overwritten file if any
						if (removedContent !== null) {
							await app.vault.create(normalizedDestPath, removedContent);
						}
					},
					redo: async () => {
						// Re-create destination
						if (removedContent !== null) {
							const existing = app.vault.getAbstractFileByPath(normalizedDestPath);
							if (existing) {
								await app.vault.delete(existing);
							}
						}
						await app.vault.create(normalizedDestPath, content);
						// Delete source
						const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
						if (sourceFile) {
							await app.vault.delete(sourceFile);
						}
					}
				});
			}

			// Perform the move
			await app.vault.rename(source, normalizedDestPath);

			const operation = sourcePath === normalizedDestPath ? 'Renamed' : 'Moved';
			const itemType = source instanceof TFile ? 'file' : 'folder';

			return {
				success: true,
				message: `${operation} ${itemType} from ${sourcePath} to ${normalizedDestPath}`,
				data: {
					sourcePath,
					destinationPath: normalizedDestPath,
					type: itemType,
					overwritten: !!existingDestination
				}
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to move: ${error.message}`
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