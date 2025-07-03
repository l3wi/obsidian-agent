import { App } from 'obsidian';
import { CommandParser } from '../commands/CommandParser';
import { NoteTool } from '../tools/NoteTool';
import { ApprovalManager } from '../managers/ApprovalManager';
import { SlashCommand, ToolResponse, VaultOperation } from '../types';

export class ToolRouter {
	private app: App;
	private noteTool: NoteTool;
	private approvalManager: ApprovalManager;

	constructor(app: App, approvalManager: ApprovalManager) {
		this.app = app;
		this.approvalManager = approvalManager;
		this.noteTool = new NoteTool(app);
	}

	/**
	 * Route a command to the appropriate tool
	 * @param commandString The raw command string from the user
	 * @returns Tool response with the result
	 */
	async routeCommand(commandString: string): Promise<ToolResponse> {
		// Parse the command
		const command = CommandParser.parse(commandString);
		
		if (!command) {
			return {
				success: false,
				message: 'Invalid command format. Commands should start with /'
			};
		}

		// Route to appropriate tool
		switch (command.command) {
			case 'note':
				return await this.handleNoteCommand(command);
			
			case 'search':
				return await this.handleSearchCommand(command);
			
			case 'help':
				return this.handleHelpCommand(command);
			
			case 'research':
				return {
					success: true,
					message: 'Web research will be available in Version 1 with Exa integration.'
				};
			
			default:
				return {
					success: false,
					message: `Unknown command: ${command.command}. Type /help for available commands.`
				};
		}
	}

	/**
	 * Handle the note command with approval flow
	 * @param command The parsed command
	 * @returns Tool response
	 */
	private async handleNoteCommand(command: SlashCommand): Promise<ToolResponse> {
		// Execute the note tool to prepare the operation
		const result = await this.noteTool.execute(command.args);

		// If the operation requires approval and has approval data
		if (result.requiresApproval && result.approvalData && result.data) {
			const operation = result.data as VaultOperation;
			
			// Request approval
			const approved = await this.approvalManager.executeWithApproval(
				operation,
				result.approvalData
			);

			if (approved) {
				return {
					success: true,
					message: `Successfully ${operation.type === 'create' ? 'created' : 'updated'} note: ${command.args[0]}`
				};
			} else {
				return {
					success: false,
					message: 'Operation cancelled by user'
				};
			}
		}

		return result;
	}

	/**
	 * Handle the search command
	 * @param command The parsed command
	 * @returns Tool response
	 */
	private async handleSearchCommand(command: SlashCommand): Promise<ToolResponse> {
		const query = command.args.join(' ');
		// @ts-ignore
		const searchPlugin = this.app.internalPlugins.plugins.search;
		if (!searchPlugin.enabled) {
			return {
				success: false,
				message: 'Search plugin is not enabled',
			};
		}
		await searchPlugin.instance.openGlobalSearch(query);
		return {
			success: true,
			message: `Searching for "${query}"...`,
		};
	}

	/**
	 * Handle the help command
	 * @param command The parsed command
	 * @returns Tool response
	 */
	private handleHelpCommand(command: SlashCommand): ToolResponse {
		if (command.args.length > 0) {
			// Get help for specific command
			const helpText = CommandParser.getCommandHelp(command.args[0]);
			
			if (helpText) {
				return {
					success: true,
					message: helpText
				};
			} else {
				return {
					success: false,
					message: `Unknown command: ${command.args[0]}`
				};
			}
		}

		// Get general help
		const commands = CommandParser.getAllCommands();
		const helpLines = ['Available commands:\n'];
        
        commands.forEach(cmd => {
            const helpText = CommandParser.getCommandHelp(cmd.command);
            if (helpText) {
                helpLines.push(helpText);
            }
        });

        return {
            success: true,
            message: helpLines.join('\n')
        };
	}

	/**
	 * Check if a string is a valid command
	 * @param input The input string
	 * @returns True if the input is a valid command
	 */
	isCommand(input: string): boolean {
		if (!input.startsWith('/')) {
			return false;
		}

		const command = CommandParser.parse(input);
		return command !== null && CommandParser.isValidCommand(command.command);
	}
}