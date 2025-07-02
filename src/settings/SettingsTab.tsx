import { App, PluginSettingTab, Setting } from 'obsidian';
import ObsidianChatAssistant from '../main';

export class ChatAssistantSettingTab extends PluginSettingTab {
	plugin: ObsidianChatAssistant;

	constructor(app: App, plugin: ObsidianChatAssistant) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Chat Assistant Settings' });

		// OpenAI API Key setting
		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key to enable the chat assistant')
			.addText((text) =>
				text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon('eye-off')
					.setTooltip('Show/Hide API Key')
					.onClick(() => {
						const inputEl = containerEl.querySelector(
							'.setting-item:nth-child(2) input'
						) as HTMLInputElement;
						if (inputEl) {
							inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
							button.setIcon(inputEl.type === 'password' ? 'eye-off' : 'eye');
						}
					})
			);

		// Model selection
		new Setting(containerEl)
			.setName('AI Model')
			.setDesc('Select the OpenAI model to use')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('gpt-4-turbo-preview', 'GPT-4 Turbo')
					.addOption('gpt-4', 'GPT-4')
					.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo')
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		// Max tokens setting
		new Setting(containerEl)
			.setName('Max Tokens')
			.setDesc('Maximum number of tokens for AI responses')
			.addText((text) =>
				text
					.setPlaceholder('2000')
					.setValue(String(this.plugin.settings.maxTokens))
					.onChange(async (value) => {
						const tokens = parseInt(value, 10);
						if (!isNaN(tokens) && tokens > 0) {
							this.plugin.settings.maxTokens = tokens;
							await this.plugin.saveSettings();
						}
					})
			);

		// Chat view enabled setting
		new Setting(containerEl)
			.setName('Enable Chat View')
			.setDesc('Enable or disable the chat assistant view')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.chatViewEnabled)
					.onChange(async (value) => {
						this.plugin.settings.chatViewEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		// Approval required setting
		new Setting(containerEl)
			.setName('Require Approval')
			.setDesc('Require approval before making changes to your vault')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.approvalRequired)
					.onChange(async (value) => {
						this.plugin.settings.approvalRequired = value;
						await this.plugin.saveSettings();
					})
			);

		// Add a divider
		containerEl.createEl('hr');

		// Add help section
		containerEl.createEl('h3', { text: 'Available Commands' });
		containerEl.createEl('p', { 
			text: 'Use these slash commands in the chat:',
			cls: 'setting-item-description'
		});
		
		const commandList = containerEl.createEl('ul', { cls: 'setting-item-description' });
		commandList.createEl('li', { text: '/note <title> - Create or edit a note' });
		commandList.createEl('li', { text: '/search <query> - Search your vault' });
		commandList.createEl('li', { text: '/research <topic> - Search the web (coming in v1)' });

		// Hide the API key input initially
		const apiKeyInput = containerEl.querySelector(
			'.setting-item:nth-child(2) input'
		) as HTMLInputElement;
		if (apiKeyInput) {
			apiKeyInput.type = 'password';
		}
	}
}