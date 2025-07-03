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

		// Model selection with detailed descriptions
		const modelDesc = new Setting(containerEl)
			.setName('AI Model')
			.setDesc('Select the OpenAI model to use');
		
		modelDesc.addDropdown((dropdown) => {
				dropdown
					.addOption('o3', 'O3 - Advanced Reasoning (Best for complex tasks)')
					.addOption('gpt-4.1', 'GPT-4.1 - Flagship (Excellent coding & instruction following)')
					.addOption('gpt-4.1-mini', 'GPT-4.1 Mini - Balanced (83% cheaper than GPT-4o)')
					.addOption('gpt-4.1-nano', 'GPT-4.1 Nano - Fast & Cheap (For simple tasks)')
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
						
						// Update model description
						updateModelDescription(value);
					});
				
				// Function to update model description
				const updateModelDescription = (model: string) => {
					let desc = '';
					switch (model) {
						case 'o3':
							desc = 'O3: Advanced reasoning with automatic tool usage. Best for complex multi-step problems. 200K-1M context. $2/$8 per M tokens.';
							break;
						case 'gpt-4.1':
							desc = 'GPT-4.1: Top performance for coding and instructions. 1M context window. $2/$8 per M tokens.';
							break;
						case 'gpt-4.1-mini':
							desc = 'GPT-4.1 Mini: Great balance of performance and cost. 1M context. $0.42/$1.68 per M tokens.';
							break;
						case 'gpt-4.1-nano':
							desc = 'GPT-4.1 Nano: Fastest and cheapest. Good for simple tasks. 1M context. $0.025/$0.40 per M tokens.';
							break;
					}
					modelDesc.setDesc(desc || 'Select the OpenAI model to use');
				};
				
				// Set initial description
				updateModelDescription(this.plugin.settings.model);
			});

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

		// Max turns setting
		new Setting(containerEl)
			.setName('Max Agent Turns')
			.setDesc('Maximum number of turns for the AI agent to take before stopping. Higher values may lead to longer processing times.')
			.addText((text) =>
				text
					.setPlaceholder('20')
					.setValue(String(this.plugin.settings.maxTurns))
					.onChange(async (value) => {
						const turns = parseInt(value, 10);
						if (!isNaN(turns) && turns > 0) {
							this.plugin.settings.maxTurns = turns;
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