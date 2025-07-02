import { Agent, run, webSearchTool, codeInterpreterTool } from '@openai/agents';
import { App } from 'obsidian';
import { ApprovalRequest } from '../types';

export class AgentOrchestrator {
	private app: App;
	private conductor: Agent;
	private apiKey: string;

	constructor(app: App, apiKey: string) {
		this.app = app;
		this.apiKey = apiKey;
		
		// Set the API key for OpenAI
		process.env.OPENAI_API_KEY = apiKey;
		
		// Initialize the conductor agent with OpenAI hosted tools
		this.conductor = new Agent({
			name: 'Conductor',
			model: 'gpt-4o',
			instructions: `You are Alex Chen, the Chief Orchestration Officer of this Obsidian assistant.

Your personality:
- Professional, organized, and strategic
- You excel at understanding user needs
- Clear, concise, and directive communication style

Your tools:
1. web_search: Search the web for current information
2. code_interpreter: Run code for analysis, calculations, and data processing

Guidelines:
- Always explain what you're doing and why
- Use web_search for current information and external research
- Use code_interpreter for data analysis, calculations, or creating visualizations
- Ask for clarification when requests are ambiguous
- Provide context when searching for information

Note: I cannot directly access or modify files in your Obsidian vault yet. Please describe what you'd like me to help with, and I'll provide guidance or create content that you can then save to your vault.`,
			tools: [
				webSearchTool(),
				codeInterpreterTool()
			],
			modelSettings: {
				temperature: 0.7,
				parallelToolCalls: true
			}
		});
	}

	/**
	 * Process a user message through the agent system
	 */
	async processMessage(message: string): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
	}> {
		try {
			// Run the message through the conductor agent
			const result = await run(this.conductor, message);
			
			// Parse the result to check for approval requirements
			const response = result.finalOutput || '';
			
			// Check if the response contains approval request markers
			if (response.includes('**Approval Required**')) {
				// Extract approval data from the response
				const approvalData = this.extractApprovalData(response);
				
				return {
					response,
					requiresApproval: true,
					approvalData
				};
			}
			
			return {
				response,
				requiresApproval: false
			};
		} catch (error) {
			console.error('Error processing message through agents:', error);
			throw error;
		}
	}

	/**
	 * Process a command from the command palette
	 */
	async processCommand(command: string, input: string): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
	}> {
		let enhancedMessage = '';
		
		switch (command) {
			case 'analyse':
				enhancedMessage = `Please analyze the following: ${input}. Search through my vault first, then provide comprehensive insights.`;
				break;
			case 'research':
				enhancedMessage = `Please research the following topic: ${input}. Use vault search first, then web search if needed to provide comprehensive information.`;
				break;
			case 'tidy':
				enhancedMessage = `Please help me organize my files: ${input}. First search for relevant files, then suggest organization improvements.`;
				break;
			default:
				enhancedMessage = input;
		}
		
		return this.processMessage(enhancedMessage);
	}

	/**
	 * Extract approval data from agent response
	 */
	private extractApprovalData(response: string): ApprovalRequest {
		// Simple extraction - in production, this would be more sophisticated
		const lines = response.split('\n');
		let action = '';
		let details = '';
		
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('**Action:**')) {
				action = lines[i].replace('**Action:**', '').trim();
			}
			if (lines[i].includes('**Details:**')) {
				// Collect all lines after Details until the next section
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].startsWith('**')) break;
					details += lines[j] + '\n';
				}
			}
		}
		
		// Try to parse details as JSON, fallback to string
		let parsedDetails: any = {};
		try {
			parsedDetails = JSON.parse(details.trim());
		} catch {
			parsedDetails = { description: details.trim() };
		}
		
		return {
			id: Date.now().toString(),
			type: this.inferOperationType(action),
			description: action,
			content: parsedDetails.content || details,
			filePath: parsedDetails.filePath || parsedDetails.path || 'Multiple files'
		};
	}

	/**
	 * Infer operation type from action description
	 */
	private inferOperationType(action: string): 'create' | 'edit' | 'delete' {
		const lower = action.toLowerCase();
		if (lower.includes('create') || lower.includes('new')) return 'create';
		if (lower.includes('delete') || lower.includes('remove')) return 'delete';
		return 'edit';
	}

	/**
	 * Handle approval response
	 */
	async handleApproval(approved: boolean, approvalData: ApprovalRequest): Promise<string> {
		if (approved) {
			// Send approval confirmation back to the agent
			const message = `The user has approved the following action: ${approvalData.description}. Please proceed with the implementation.`;
			const result = await this.processMessage(message);
			return result.response;
		} else {
			return 'The operation has been cancelled as requested.';
		}
	}
}