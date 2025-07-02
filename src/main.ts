import { Plugin, Notice, WorkspaceLeaf, Modal, Setting, App } from 'obsidian';
import { ChatAssistantSettings, DEFAULT_SETTINGS } from './types';
import { ChatAssistantSettingTab } from './settings/SettingsTab';
import { ChatView, CHAT_VIEW_TYPE } from './views/ChatView';

export default class ObsidianChatAssistant extends Plugin {
	settings: ChatAssistantSettings;

	async onload() {
		await this.loadSettings();

		// Register the chat view
		this.registerView(
			CHAT_VIEW_TYPE,
			(leaf) => new ChatView(leaf, this)
		);

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon(
			'message-square',
			'Open Chat Assistant',
			(evt: MouseEvent) => {
				this.activateChatView();
			}
		);
		ribbonIconEl.addClass('obsidian-chat-assistant-ribbon');

		// Add command to open chat
		this.addCommand({
			id: 'open-chat-assistant',
			name: 'Open Chat Assistant',
			callback: () => {
				this.activateChatView();
			}
		});

		// Add analyse command
		this.addCommand({
			id: 'analyse-documents',
			name: 'Analyse documents',
			callback: () => {
				this.handleAnalyseCommand();
			}
		});

		// Add research command
		this.addCommand({
			id: 'research-topic',
			name: 'Research topic',
			callback: () => {
				this.handleResearchCommand();
			}
		});

		// Add tidy command
		this.addCommand({
			id: 'tidy-files',
			name: 'Tidy files and folders',
			callback: () => {
				this.handleTidyCommand();
			}
		});

		// Add settings tab
		this.addSettingTab(new ChatAssistantSettingTab(this.app, this));

		// Show notice if API key is not set
		if (!this.settings.openaiApiKey) {
			new Notice('Chat Assistant: Please set your OpenAI API key in settings');
		}
	}

	onunload() {
		// Cleanup
		this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateChatView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(CHAT_VIEW_TYPE);

		if (leaves.length > 0) {
			// A chat view already exists, activate it
			leaf = leaves[0];
		} else {
			// Create a new leaf in the right sidebar
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
			} else {
				// If no right leaf exists, split the current leaf
				leaf = workspace.getLeaf('split', 'vertical');
			}
			
			await leaf.setViewState({ type: CHAT_VIEW_TYPE });
		}

		// Reveal the leaf
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async handleAnalyseCommand() {
		const modal = new CommandInputModal(this.app, 'Analyse Documents', 'Enter documents or folders to analyse:', async (input) => {
			// Activate chat view and send the analyse command
			await this.activateChatView();
			const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
			if (leaves.length > 0) {
				const chatView = leaves[0].view as ChatView;
				chatView.processCommand('analyse', input);
			}
		});
		modal.open();
	}

	async handleResearchCommand() {
		const modal = new CommandInputModal(this.app, 'Research Topic', 'Enter topic to research:', async (input) => {
			// Activate chat view and send the research command
			await this.activateChatView();
			const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
			if (leaves.length > 0) {
				const chatView = leaves[0].view as ChatView;
				chatView.processCommand('research', input);
			}
		});
		modal.open();
	}

	async handleTidyCommand() {
		const modal = new CommandInputModal(this.app, 'Tidy Files', 'Enter instructions for tidying files/folders:', async (input) => {
			// Activate chat view and send the tidy command
			await this.activateChatView();
			const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
			if (leaves.length > 0) {
				const chatView = leaves[0].view as ChatView;
				chatView.processCommand('tidy', input);
			}
		});
		modal.open();
	}
}

class CommandInputModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private placeholder: string,
		private onSubmit: (input: string) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: this.title });
		
		const inputContainer = contentEl.createDiv();
		const input = inputContainer.createEl('textarea', {
			attr: {
				placeholder: this.placeholder,
				rows: '4',
				style: 'width: 100%; margin: 10px 0;'
			}
		});
		
		const buttonContainer = contentEl.createDiv({ 
			attr: { style: 'display: flex; justify-content: flex-end; gap: 10px;' }
		});
		
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();
		
		const submitBtn = buttonContainer.createEl('button', { 
			text: 'Submit',
			cls: 'mod-cta'
		});
		submitBtn.onclick = () => {
			const value = input.value.trim();
			if (value) {
				this.onSubmit(value);
				this.close();
			}
		};
		
		// Focus input and allow Enter to submit
		input.focus();
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				submitBtn.click();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}