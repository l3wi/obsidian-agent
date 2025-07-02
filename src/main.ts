import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';
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
}