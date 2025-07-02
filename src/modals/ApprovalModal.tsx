import { App, Modal, Setting } from 'obsidian';
import { ApprovalRequest } from '../types';

export class ApprovalModal extends Modal {
	private approvalRequest: ApprovalRequest;
	private onApprove: () => void;
	private onReject: () => void;

	constructor(
		app: App,
		approvalRequest: ApprovalRequest,
		onApprove: () => void,
		onReject: () => void
	) {
		super(app);
		this.approvalRequest = approvalRequest;
		this.onApprove = onApprove;
		this.onReject = onReject;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add title
		contentEl.createEl('h2', { text: 'Approval Required' });

		// Add description
		contentEl.createEl('p', { 
			text: this.approvalRequest.description,
			cls: 'approval-description'
		});

		// Show file path if available
		if (this.approvalRequest.filePath) {
			new Setting(contentEl)
				.setName('File')
				.setDesc(this.approvalRequest.filePath);
		}

		// Show content diff for edits
		if (this.approvalRequest.type === 'edit' && this.approvalRequest.oldContent) {
			const diffContainer = contentEl.createDiv({ cls: 'approval-diff' });
			
			// Show old content
			if (this.approvalRequest.oldContent) {
				const oldSection = diffContainer.createDiv({ cls: 'diff-section' });
				oldSection.createEl('h4', { text: 'Current Content:' });
				const oldPre = oldSection.createEl('pre', { 
					cls: 'diff-content old-content'
				});
				oldPre.setText(this.truncateContent(this.approvalRequest.oldContent));
			}

			// Show new content
			const newSection = diffContainer.createDiv({ cls: 'diff-section' });
			newSection.createEl('h4', { text: 'New Content:' });
			const newPre = newSection.createEl('pre', { 
				cls: 'diff-content new-content'
			});
			newPre.setText(this.truncateContent(this.approvalRequest.content || ''));
		} else if (this.approvalRequest.content) {
			// Show content for create operations
			const contentSection = contentEl.createDiv({ cls: 'content-section' });
			contentSection.createEl('h4', { text: 'Content:' });
			const contentPre = contentSection.createEl('pre', { 
				cls: 'content-preview'
			});
			contentPre.setText(this.truncateContent(this.approvalRequest.content));
		}

		// Add action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'approval-buttons' });
		
		// Approve button
		const approveButton = buttonContainer.createEl('button', {
			text: 'Approve',
			cls: 'mod-cta'
		});
		approveButton.addEventListener('click', () => {
			this.onApprove();
			this.close();
		});

		// Reject button
		const rejectButton = buttonContainer.createEl('button', {
			text: 'Reject'
		});
		rejectButton.addEventListener('click', () => {
			this.onReject();
			this.close();
		});

		// Add CSS styles
		this.addStyles();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private truncateContent(content: string, maxLength: number = 500): string {
		if (content.length <= maxLength) {
			return content;
		}
		return content.substring(0, maxLength) + '\n... (truncated)';
	}

	private addStyles() {
		const style = document.createElement('style');
		style.textContent = `
			.approval-description {
				margin-bottom: 1em;
				color: var(--text-muted);
			}

			.approval-diff {
				margin: 1em 0;
			}

			.diff-section {
				margin-bottom: 1em;
			}

			.diff-section h4 {
				margin-bottom: 0.5em;
				font-size: 14px;
			}

			.diff-content,
			.content-preview {
				background-color: var(--background-secondary);
				padding: 10px;
				border-radius: 4px;
				font-size: 12px;
				max-height: 200px;
				overflow-y: auto;
				white-space: pre-wrap;
				word-wrap: break-word;
			}

			.old-content {
				border-left: 3px solid var(--text-error);
			}

			.new-content {
				border-left: 3px solid var(--interactive-success);
			}

			.approval-buttons {
				display: flex;
				justify-content: flex-end;
				gap: 10px;
				margin-top: 20px;
			}

			.approval-buttons button {
				padding: 8px 16px;
			}
		`;
		document.head.appendChild(style);
	}
}