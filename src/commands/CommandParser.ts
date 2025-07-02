import { SlashCommand } from '../types';

export class CommandParser {
	/**
	 * Parse a slash command string into a structured command object
	 * @param input The raw input string (e.g., "/note My New Note")
	 * @returns Parsed command object or null if invalid
	 */
	static parse(input: string): SlashCommand | null {
		// Check if input starts with slash
		if (!input.startsWith('/')) {
			return null;
		}

		// Remove leading slash and trim
		const trimmed = input.slice(1).trim();
		
		// Split by spaces but preserve quoted strings
		const args = this.splitArgs(trimmed);
		
		if (args.length === 0) {
			return null;
		}

		return {
			command: args[0].toLowerCase(),
			args: args.slice(1),
			rawInput: input
		};
	}

	/**
	 * Split arguments while preserving quoted strings
	 * @param input The input string to split
	 * @returns Array of arguments
	 */
	private static splitArgs(input: string): string[] {
		const args: string[] = [];
		let current = '';
		let inQuotes = false;
		let quoteChar = '';

		for (let i = 0; i < input.length; i++) {
			const char = input[i];
			const nextChar = input[i + 1];

			if ((char === '"' || char === "'") && !inQuotes) {
				// Start of quoted string
				inQuotes = true;
				quoteChar = char;
			} else if (char === quoteChar && inQuotes) {
				// End of quoted string
				inQuotes = false;
				quoteChar = '';
			} else if (char === ' ' && !inQuotes) {
				// Space outside quotes - end of argument
				if (current.length > 0) {
					args.push(current);
					current = '';
				}
			} else {
				// Regular character
				current += char;
			}
		}

		// Add last argument if any
		if (current.length > 0) {
			args.push(current);
		}

		return args;
	}

	/**
	 * Validate if a command is supported
	 * @param command The command to validate
	 * @returns True if command is supported
	 */
	static isValidCommand(command: string): boolean {
		const validCommands = ['note', 'search', 'help', 'research'];
		return validCommands.includes(command.toLowerCase());
	}

	/**
	 * Get help text for a specific command
	 * @param command The command to get help for
	 * @returns Help text or null if command not found
	 */
	static getCommandHelp(command: string): string | null {
		const helpTexts: Record<string, string> = {
			note: '/note <title> [content] - Create or edit a note with the given title',
			search: '/search <query> - Search your vault for notes containing the query',
			help: '/help [command] - Show help for all commands or a specific command',
			research: '/research <topic> - Search the web for information (coming in v1)'
		};

		return helpTexts[command.toLowerCase()] || null;
	}

	/**
	 * Get all available commands with descriptions
	 * @returns Array of command info objects
	 */
	static getAllCommands(): Array<{ command: string; description: string }> {
		return [
			{ command: 'note', description: 'Create or edit a note' },
			{ command: 'search', description: 'Search your vault' },
			{ command: 'help', description: 'Show help information' },
			{ command: 'research', description: 'Search the web (coming in v1)' }
		];
	}
}