export interface ChatAssistantSettings {
	openaiApiKey: string;
	chatViewEnabled: boolean;
	approvalRequired: boolean;
	model: string;
	maxTokens: number;
}

export const DEFAULT_SETTINGS: ChatAssistantSettings = {
	openaiApiKey: '',
	chatViewEnabled: true,
	approvalRequired: true,
	model: 'gpt-4-turbo-preview',
	maxTokens: 2000
};

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	status?: 'pending' | 'streaming' | 'complete' | 'error';
	error?: string;
}

export interface SlashCommand {
	command: string;
	args: string[];
	rawInput: string;
}

export interface ToolResponse {
	success: boolean;
	message: string;
	data?: any;
	requiresApproval?: boolean;
	approvalData?: ApprovalRequest;
}

export interface ApprovalRequest {
	id: string;
	type: 'create' | 'edit' | 'delete';
	filePath?: string;
	content?: string;
	oldContent?: string;
	description: string;
}

export interface VaultOperation {
	type: 'create' | 'read' | 'update' | 'delete';
	path: string;
	content?: string;
}

export type CommandHandler = (args: string[]) => Promise<ToolResponse>;