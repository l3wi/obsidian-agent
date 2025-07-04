export interface ChatAssistantSettings {
	openaiApiKey: string;
	chatViewEnabled: boolean;
	approvalRequired: boolean;
	model: string;
	maxTokens: number;
	maxTurns: number;
}

export const DEFAULT_SETTINGS: ChatAssistantSettings = {
	openaiApiKey: '',
	chatViewEnabled: true,
	approvalRequired: true,
	model: 'gpt-4.1',
	maxTokens: 2000,
	maxTurns: 20
};

export interface MessageSegment {
	id: string;
	type: 'text' | 'tool-approval' | 'tool-result' | 'continuation';
	content: string;
	timestamp: number;
	metadata?: {
		toolName?: string;
		toolArgs?: any;
		approvalStatus?: 'pending' | 'approved' | 'rejected';
		streamResult?: any;
		interruptions?: any[];
	};
}

export interface ToolCallRecord {
	id: string;
	toolName: string;
	args: any;
	timestamp: number;
	status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	status?: 'pending' | 'streaming' | 'complete' | 'error';
	error?: string;
	approvalRequest?: ApprovalRequest;
	approvalStatus?: 'pending' | 'approved' | 'rejected';
	streamResult?: any; // StreamedRunResult from agents SDK
	segments?: MessageSegment[]; // Store multiple content segments
	toolCalls?: ToolCallRecord[]; // Store tool call history
	preservedContent?: string; // Content before tool interruption
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