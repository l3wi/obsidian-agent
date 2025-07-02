import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ChatInterface } from '../components/ChatInterface';
import ObsidianChatAssistant from '../main';

export const CHAT_VIEW_TYPE = 'chat-assistant-view';

export class ChatView extends ItemView {
	plugin: ObsidianChatAssistant;
	root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianChatAssistant) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return CHAT_VIEW_TYPE;
	}

	getDisplayText() {
		return 'Chat Assistant';
	}

	getIcon() {
		return 'message-square';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('chat-assistant-container');

		// Create React root and render the chat interface
		const reactContainer = container.createDiv();
		this.root = createRoot(reactContainer);
		this.root.render(
			<React.StrictMode>
				<ChatInterface plugin={this.plugin} />
			</React.StrictMode>
		);
	}

	async onClose() {
		// Cleanup React
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}
}