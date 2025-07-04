import { App, Notice } from 'obsidian';
import { ApprovalRequest, VaultOperation } from '../types';
import { ApprovalModal } from '../modals/ApprovalModal';

export class ApprovalManager {
	private app: App;
	private pendingApprovals: Map<string, ApprovalRequest>;
	private approvalRequired: boolean;

	constructor(app: App, approvalRequired: boolean = true) {
		this.app = app;
		this.pendingApprovals = new Map();
		this.approvalRequired = approvalRequired;
	}

	/**
	 * Set whether approval is required for operations
	 * @param required Whether approval is required
	 */
	setApprovalRequired(required: boolean) {
		this.approvalRequired = required;
	}

	/**
	 * Request approval for an operation
	 * @param request The approval request
	 * @param onApprove Callback when approved
	 * @param onReject Callback when rejected
	 * @returns Promise that resolves when the modal is closed
	 */
	async requestApproval(
		request: ApprovalRequest,
		onApprove: () => Promise<void>,
		onReject: () => void
	): Promise<void> {
		// If approval not required, auto-approve
		if (!this.approvalRequired) {
			await onApprove();
			return;
		}

		// Store the pending approval
		this.pendingApprovals.set(request.id, request);

		return new Promise((resolve) => {
			const modal = new ApprovalModal(
				this.app,
				request,
				async () => {
					// Remove from pending
					this.pendingApprovals.delete(request.id);
					
					try {
						await onApprove();
						new Notice('Operation approved and executed successfully');
					} catch (error) {
						new Notice(`Error executing operation: ${error.message}`);
					}
					
					resolve();
				},
				() => {
					// Remove from pending
					this.pendingApprovals.delete(request.id);
					
					onReject();
					new Notice('Operation rejected');
					
					resolve();
				}
			);

			modal.open();
		});
	}


	/**
	 * Get all pending approvals
	 * @returns Array of pending approval requests
	 */
	getPendingApprovals(): ApprovalRequest[] {
		return Array.from(this.pendingApprovals.values());
	}

	/**
	 * Clear all pending approvals
	 */
	clearPendingApprovals() {
		this.pendingApprovals.clear();
	}

	/**
	 * Check if there are pending approvals
	 * @returns True if there are pending approvals
	 */
	hasPendingApprovals(): boolean {
		return this.pendingApprovals.size > 0;
	}

	/**
	 * Execute an approved operation directly (used by chat interface)
	 * @param request The approval request containing operation details
	 * @returns Promise that resolves with the result
	 */
	async executeApprovedOperation(request: ApprovalRequest): Promise<{ success: boolean; message: string }> {
		try {
			const noteTool = new NoteTool(this.app);
			
			// Create a vault operation from the approval request
			const operation: VaultOperation = {
				type: request.type as any,
				path: request.filePath || '',
				content: request.content
			};

			const success = await noteTool.executeApprovedOperation(operation);
			
			return {
				success,
				message: success 
					? `Successfully ${request.type}d ${request.filePath || 'files'}` 
					: `Failed to ${request.type} ${request.filePath || 'files'}`
			};
		} catch (error) {
			return {
				success: false,
				message: `Error: ${error.message}`
			};
		}
	}
}
