import {
	Agent,
	run,
	webSearchTool,
	codeInterpreterTool,
	OpenAIProvider,
	setDefaultModelProvider,
	tool,
	user,
	assistant,
	system,
} from "@openai/agents";
import { z } from "zod/v3";
import OpenAI from "openai";
import { App } from "obsidian";
import { ApprovalRequest, ChatMessage } from "../types";
import { ErrorFactory } from "../errors/ErrorFactory";
import { RetryHandler } from "../utils/RetryHandler";
import { CircuitBreaker, CircuitState } from "../utils/CircuitBreaker";
import { ChatAssistantError, ErrorCode } from "../errors/types";

export class AgentOrchestrator {
	private app: App;
	private conductor: Agent;
	private apiKey: string;
	private model: string;
	private maxTurns: number;
	private openaiClient: OpenAI;
	private provider: OpenAIProvider;
	private circuitBreaker: CircuitBreaker;

	/**
	 * Convert chat messages to agent input format
	 */
	private convertChatHistory(messages: ChatMessage[]): any[] {
		// Build a conversation context that includes assistant messages
		const conversationContext: any[] = [];
		
		// Add system messages and user messages directly
		// For assistant messages, we'll include them in a context summary
		let assistantContext = "";
		
		for (const msg of messages) {
			if (msg.role === "user") {
				// If we have accumulated assistant context, add it as a system message before the user message
				if (assistantContext) {
					conversationContext.push(system(`Previous assistant response: ${assistantContext}`));
					assistantContext = "";
				}
				conversationContext.push(user(msg.content));
			} else if (msg.role === "assistant") {
				// Accumulate assistant responses to add as context
				assistantContext = msg.content;
			} else if (msg.role === "system") {
				conversationContext.push(system(msg.content));
			}
		}
		
		// Add any remaining assistant context
		if (assistantContext) {
			conversationContext.push(system(`Previous assistant response: ${assistantContext}`));
		}
		
		return conversationContext;
	}

	constructor(app: App, apiKey: string, model = "gpt-4.1", maxTurns = 20) {
		this.app = app;
		this.apiKey = apiKey;
		this.model = model;
		this.maxTurns = maxTurns;

		console.log("[AgentOrchestrator] Initialized with:", {
			model,
			maxTurns,
		});

		// Initialize circuit breaker for API calls
		this.circuitBreaker = new CircuitBreaker({
			failureThreshold: 5,
			resetTimeout: 60000, // 1 minute
			monitoringPeriod: 300000, // 5 minutes
			onStateChange: (oldState, newState) => {
				console.log(`[AgentOrchestrator] Circuit breaker state changed: ${oldState} -> ${newState}`);
			}
		});

		// Create OpenAI client with browser support for Obsidian
		this.openaiClient = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true,
		});

		// Create provider with our configured client
		this.provider = new OpenAIProvider({
			openAIClient: this.openaiClient,
		});

		// Set as default provider for all agents
		setDefaultModelProvider(this.provider);

		// Create vault-specific tools
		const createNoteTool = tool({
			name: "create_note",
			description: "Create a new note in the Obsidian vault",
			parameters: z.object({
				path: z
					.string()
					.describe(
						'The file path for the new note (e.g., "Notes/MyNote.md")'
					),
				content: z
					.string()
					.describe("The content of the note in Markdown format"),
			}),
			needsApproval: async () => true, // Always require approval for creating notes
			execute: async ({ path, content }) => {
				// This will be executed after approval
				try {
					// Check if file already exists
					if (this.app.vault.getAbstractFileByPath(path)) {
						throw ErrorFactory.vaultFileExists(path);
					}
					
					const parentFolder = path.substring(
						0,
						path.lastIndexOf("/")
					);
					if (
						parentFolder &&
						!this.app.vault.getAbstractFileByPath(parentFolder)
					) {
						await this.app.vault.createFolder(parentFolder);
					}
					await this.app.vault.create(path, content);
					return `Successfully created note at ${path}`;
				} catch (error) {
					if (error instanceof ChatAssistantError) {
						return `Failed to create note: ${error.userMessage}`;
					}
					return `Failed to create note: ${error.message}`;
				}
			},
		});

		const modifyNoteTool = tool({
			name: "modify_note",
			description: "Modify an existing note in the Obsidian vault",
			parameters: z.object({
				path: z
					.string()
					.describe("The file path of the note to modify"),
				content: z.string().describe("The new content for the note"),
			}),
			needsApproval: async () => true, // Always require approval for modifying notes
			execute: async ({ path, content }) => {
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (file && "extension" in file) {
						// Check if it's a TFile
						await this.app.vault.process(
							file as any,
							() => content
						);
						return `Successfully modified note at ${path}`;
					}
					return `File not found: ${path}`;
				} catch (error) {
					return `Failed to modify note: ${error.message}`;
				}
			},
		});

		const createFolderTool = tool({
			name: "create_folder",
			description: "Create a new folder in the Obsidian vault",
			parameters: z.object({
				path: z
					.string()
					.describe(
						'The path for the new folder (e.g., "Notes/My Folder")'
					),
			}),
			needsApproval: async () => true,
			execute: async ({ path }) => {
				try {
					await this.app.vault.createFolder(path);
					return `Successfully created folder at ${path}`;
				} catch (error) {
					return `Failed to create folder: ${error.message}`;
				}
			},
		});

		const copyFileTool = tool({
			name: "copy_file",
			description:
				"Copy a file or folder to a new location in the Obsidian vault",
			parameters: z.object({
				sourcePath: z
					.string()
					.describe("The path of the file or folder to copy"),
				destinationPath: z
					.string()
					.describe("The path of the new file or folder"),
			}),
			needsApproval: async () => true,
			execute: async ({ sourcePath, destinationPath }) => {
				try {
					const file =
						this.app.vault.getAbstractFileByPath(sourcePath);
					if (file) {
						await this.app.vault.copy(file, destinationPath);
						return `Successfully copied ${sourcePath} to ${destinationPath}`;
					}
					return `File not found: ${sourcePath}`;
				} catch (error) {
					return `Failed to copy file: ${error.message}`;
				}
			},
		});

		const deleteFileTool = tool({
			name: "delete_file",
			description:
				"Delete a file or folder in the Obsidian vault (moves to trash)",
			parameters: z.object({
				path: z
					.string()
					.describe("The path of the file or folder to delete"),
			}),
			needsApproval: async () => true,
			execute: async ({ path }) => {
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (file) {
						await this.app.vault.trash(file, true);
						return `Successfully moved ${path} to trash`;
					}
					return `File not found: ${path}`;
				} catch (error) {
					return `Failed to delete file: ${error.message}`;
				}
			},
		});

		// Initialize the conductor agent with OpenAI hosted tools and vault tools
		this.conductor = new Agent({
			name: "Conductor",
			model: this.model,
			instructions: `You are Alex Chen, a highly efficient AI assistant for Obsidian.

Your personality:
- **Context-Aware:** You prioritize understanding and utilizing all available context before taking action.
- **Proactive & Autonomous:** You take initiative and anticipate user needs based on the current context.
- **Confident & Decisive:** You make logical assumptions and act on them. You only ask for clarification if a request is genuinely ambiguous.
- **Concise & Clear:** Your communication is direct and to the point.

**Execution Protocol:**

1.  **Context Analysis FIRST:**
    *   ALWAYS start by thoroughly analyzing ALL available context:
        - Recently opened files list
        - Current file name and folder path
        - Files provided as context
        - Content of any mentioned files
    *   When the user refers to "this", "the list", "add more", etc., assume they are referring to something in the current context.
    *   Look for existing patterns, structures, or content that the user might be referencing.

2.  **Understand Intent Through Context:**
    *   If the user says "add more items to the list", first check the current file or context files for existing lists.
    *   If the user mentions "competitors", "features", or any domain-specific terms, look for these in the current context first.
    *   Make intelligent assumptions based on the context rather than creating generic content.

3.  **Direct Action:**
    *   After understanding the context, execute the user's request.
    *   If modifying existing content, maintain its style, format, and specificity.
    *   If a tool is needed, use it immediately with confidence.

4.  **Structured Output:**
    *   When creating or modifying content, respect existing patterns and structures.
    *   Maintain consistency with the existing content's style and detail level.
    *   Use the appropriate tool (create_note, modify_note) to save changes to the vault.

Your tools:
1. web_search: Search the web for current information
2. code_interpreter: Run code for analysis, calculations, and data processing
3. create_note: Create new notes
4. modify_note: Modify existing notes
5. create_folder: Create new folders
6. copy_file: Copy files or folders
7. delete_file: Delete files or folders

Remember: ALWAYS analyze context before acting. The user's request likely relates to something already visible or recently accessed.`,
			tools: [
				webSearchTool(),
				codeInterpreterTool(),
				createNoteTool,
				modifyNoteTool,
				createFolderTool,
				copyFileTool,
				deleteFileTool,
			],
			modelSettings: {
				temperature: 0.7,
				parallelToolCalls: true,
			},
		});
	}

	/**
	 * Process messages with streaming, accepting chat history
	 */
	async processMessagesWithHistoryStream(
		messages: ChatMessage[],
		onChunk: (chunk: string) => void,
		onToolCall?: (toolName: string, args: any) => void,
		onApprovalNeeded?: (
			interruptions: any[],
			streamState: any
		) => Promise<void>
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
		stream?: any; // StreamedRunResult
	}> {
		const agentMessages = this.convertChatHistory(messages);
		
		console.log("[AgentOrchestrator] Processing messages with history:", {
			totalMessages: messages.length,
			messageRoles: messages.map(m => m.role),
			convertedMessages: agentMessages.length,
			hasAssistantContext: messages.some(m => m.role === 'assistant'),
			firstUserMessage: messages.find(m => m.role === 'user')?.content?.substring(0, 100)
		});
		
		// Wrap in retry handler with circuit breaker
		return RetryHandler.withRetry(
			async () => {
				return this.circuitBreaker.execute(async () => {
					try {
						return await this.processMessageStream(
							agentMessages,
							onChunk,
							onToolCall,
							onApprovalNeeded
						);
					} catch (error) {
						// Transform API errors to our error types
						if (error.status === 401) {
							throw ErrorFactory.invalidApiKey({ 
								endpoint: 'openai',
								model: this.model 
							});
						} else if (error.status === 429) {
							const retryAfter = error.headers?.['retry-after'] 
								? parseInt(error.headers['retry-after']) * 1000 
								: 60000;
							throw ErrorFactory.apiRateLimit(retryAfter, {
								endpoint: 'openai',
								model: this.model
							});
						} else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
							throw ErrorFactory.networkTimeout({
								endpoint: 'openai',
								model: this.model,
								originalError: error.message
							});
						}
						
						// Re-throw unknown errors
						throw error;
					}
				});
			},
			{
				maxAttempts: 3,
				onRetry: (attempt, error) => {
					console.log(`[AgentOrchestrator] Retry attempt ${attempt} after error:`, error);
				}
			}
		);
	}

	/**
	 * Process a user message through the agent system with streaming
	 */
	async processMessageStream(
		message: string | any[], // Can be a string or array of message history
		onChunk: (chunk: string) => void,
		onToolCall?: (toolName: string, args: any) => void,
		onApprovalNeeded?: (
			interruptions: any[],
			streamState: any
		) => Promise<void>
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
		stream?: any; // StreamedRunResult
	}> {
		try {
			let fullResponse = "";

			// Run the message through the conductor agent with streaming
			const streamResult = await run(this.conductor, message, {
				stream: true,
				maxTurns: this.maxTurns,
			});

			// Process the stream events
			for await (const event of streamResult) {
				// Removed verbose stream logging

				switch (event.type) {
					case "raw_model_stream_event": {
						const data = event.data;
						if (
							"type" in data &&
							data.type === "output_text_delta" &&
							"delta" in data
						) {
							onChunk(data.delta as string);
						}
						break;
					}
					case "run_item_stream_event": {
						if (event.name === "tool_called" && onToolCall) {
							const item = event.item;
							if ("name" in item && "arguments" in item) {
								onToolCall(
									(item as any).name,
									(item as any).arguments
								);
							}
						}
						break;
					}
					default:
						break;
				}
			}

			// Wait for stream completion
			await streamResult.completed;
			// The final output is in the streamResult.finalOutput
			fullResponse = streamResult.finalOutput as string;

			// Check for interruptions (tool approvals needed)
			if (
				streamResult.interruptions &&
				streamResult.interruptions.length > 0
			) {
				return {
					response: fullResponse,
					requiresApproval: true,
					approvalData: {
						id: Date.now().toString(),
						type: "create", // Will be determined by tool type
						description: "Tool approval required",
						content: JSON.stringify(streamResult.interruptions),
					},
					stream: streamResult,
				};
			}

			return {
				response: fullResponse,
				requiresApproval: false,
			};
		} catch (error) {
			console.error(
				"Error processing streaming message through agents:",
				error
			);
			
			// Check for common SDK errors
			if (error.message?.includes("Cannot read properties of undefined")) {
				throw ErrorFactory.toolValidationFailed('OpenAI SDK', 
					'Message format error - assistant messages in history are not currently supported', 
					{ originalError: error.message }
				);
			}
			
			throw error;
		}
	}

	/**
	 * Process a user message through the agent system
	 */
	async processMessage(message: string | any[]): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
	}> {
		try {
			// Run the message through the conductor agent
			const result = await run(this.conductor, message);

			// Parse the result to check for approval requirements
			const response = result.finalOutput || "";

			// Check if the response contains approval request markers
			if (response.includes("**Approval Required**")) {
				// Extract approval data from the response
				const approvalData = this.extractApprovalData(response);

				return {
					response,
					requiresApproval: true,
					approvalData,
				};
			}

			return {
				response,
				requiresApproval: false,
			};
		} catch (error) {
			console.error("Error processing message through agents:", error);
			throw error;
		}
	}

	/**
	 * Process a command from the command palette with streaming
	 */
	async processCommandStream(
		command: string,
		input: string,
		onChunk: (chunk: string) => void,
		onToolCall?: (toolName: string, args: any) => void
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
	}> {
		let enhancedMessage = "";

		switch (command) {
			case "analyse":
				enhancedMessage = `Please analyze the following: ${input}. Search through my vault first, then provide comprehensive insights.`;
				break;
			case "research":
				enhancedMessage = `Please research the following topic: ${input}. Use vault search first, then web search if needed to provide comprehensive information.`;
				break;
			case "tidy":
				enhancedMessage = `Please help me organize my files: ${input}. First search for relevant files, then suggest organization improvements.`;
				break;
			default:
				enhancedMessage = input;
		}

		return this.processMessageStream(enhancedMessage, onChunk, onToolCall);
	}

	/**
	 * Process a command from the command palette
	 */
	async processCommand(
		command: string,
		input: string
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
	}> {
		let enhancedMessage = "";

		switch (command) {
			case "analyse":
				enhancedMessage = `Please analyze the following: ${input}. Search through my vault first, then provide comprehensive insights.`;
				break;
			case "research":
				enhancedMessage = `Please research the following topic: ${input}. Use vault search first, then web search if needed to provide comprehensive information.`;
				break;
			case "tidy":
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
		const lines = response.split("\n");
		let action = "";
		let details = "";

		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes("**Action:**")) {
				action = lines[i].replace("**Action:**", "").trim();
			}
			if (lines[i].includes("**Details:**")) {
				// Collect all lines after Details until the next section
				for (let j = i + 1; j < lines.length; j++) {
					if (lines[j].startsWith("**")) break;
					details += lines[j] + "\n";
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
			filePath:
				parsedDetails.filePath ||
				parsedDetails.path ||
				"Multiple files",
		};
	}

	/**
	 * Infer operation type from action description
	 */
	private inferOperationType(action: string): "create" | "edit" | "delete" {
		const lower = action.toLowerCase();
		if (lower.includes("create") || lower.includes("new")) return "create";
		if (lower.includes("delete") || lower.includes("remove"))
			return "delete";
		return "edit";
	}

	/**
	 * Handle tool approval for streaming interruptions with full message history
	 */
	async handleStreamApprovalWithHistory(
		stream: any,
		approvals: Map<string, boolean>,
		messages: ChatMessage[],
		onChunk: (chunk: string) => void
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
		stream?: any; // StreamedRunResult
	}> {
		// Log the context we're working with
		console.log("[AgentOrchestrator] Handling stream approval with history:", {
			messageCount: messages.length,
			messageRoles: messages.map(m => m.role),
			approvalCount: approvals.size,
			hasStreamState: !!stream?.state
		});

		// Use the new method that includes message history
		return this.handleStreamApproval(stream, approvals, onChunk, messages);
	}

	/**
	 * Handle tool approval for streaming interruptions
	 */
	async handleStreamApproval(
		stream: any,
		approvals: Map<string, boolean>,
		onChunk: (chunk: string) => void,
		messages?: ChatMessage[]
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
		stream?: any; // StreamedRunResult
	}> {
		// Validate stream state
		if (!stream || !stream.state) {
			throw ErrorFactory.streamStateInvalid({
				hasStream: !!stream,
				hasState: !!stream?.state,
				hasInterruptions: !!stream?.interruptions
			});
		}
		
		if (!stream.interruptions || stream.interruptions.length === 0) {
			return {
				response: "No approvals needed",
				requiresApproval: false,
			};
		}

		const state = stream.state;

		// Log what's in the state before processing
		console.log('[AgentOrchestrator] Stream state inspection:', {
			hasHistory: !!state.history,
			historyLength: state.history?.length,
			hasMessages: !!state.messages,
			messagesLength: state.messages?.length,
			stateKeys: Object.keys(state),
			interruptionDetails: stream.interruptions.map((i: any) => ({
				name: i.rawItem?.name || i.name,
				args: i.rawItem?.arguments || i.arguments
			}))
		});

		// Process each interruption
		for (const interruption of stream.interruptions) {
			// Try different ID locations
			const id = interruption.id || 
				interruption.rawItem?.id || 
				interruption.rawItem?.callId ||
				interruption.rawItem?.providerData?.id;
			
			const approved = approvals.get(id) ?? false;
			const status = interruption.rawItem?.status || interruption.status;
			
			console.log('[AgentOrchestrator] Processing interruption approval:', {
				id,
				approved,
				interruption: interruption.rawItem?.name || interruption.name,
				arguments: interruption.rawItem?.arguments || interruption.arguments,
				status: status,
				isCompleted: status === 'completed'
			});
			
			// Even if completed, we still need to acknowledge the approval/rejection
			if (approved) {
				state.approve(interruption);
			} else {
				state.reject(interruption);
			}
		}

		try {
			// Log approved tools for debugging
			const approvedTools = [];
			for (const interruption of stream.interruptions) {
				const id = interruption.id || 
					interruption.rawItem?.id || 
					interruption.rawItem?.callId ||
					interruption.rawItem?.providerData?.id;
				
				if (approvals.get(id)) {
					const toolName = interruption.rawItem?.name || interruption.name;
					const args = interruption.rawItem?.arguments || interruption.arguments;
					approvedTools.push({
						tool: toolName,
						arguments: args
					});
				}
			}
			
			console.log("[AgentOrchestrator] Approved tools:", approvedTools);
			console.log("[AgentOrchestrator] Resuming with state after approvals");
			
			// Resume execution with the state
			// Note: The state object from the SDK already contains all necessary context
			const resumedStream = await RetryHandler.withRetry(
				async () => {
					try {
						return await run(this.conductor, state, {
							stream: true,
							maxTurns: this.maxTurns,
						});
					} catch (error) {
						// Check for structuredClone error
						if (error.message?.includes('structuredClone') || error.message?.includes('could not be cloned')) {
							console.error('[AgentOrchestrator] StructuredClone error detected:', error);
							console.error('[AgentOrchestrator] State type:', typeof state);
							console.error('[AgentOrchestrator] State keys:', Object.keys(state));
							// Try to identify what can't be cloned
							for (const key of Object.keys(state)) {
								const value = state[key];
								const valueType = typeof value;
								if (valueType === 'function' || (valueType === 'object' && value?.constructor?.name === 'AsyncFunction')) {
									console.error(`[AgentOrchestrator] Non-cloneable property found: ${key} (${valueType})`);
								}
							}
						}
						throw error;
					}
				},
				{
					maxAttempts: 2,
					retryableErrors: [ErrorCode.STREAM_RESUME_FAILED]
				}
			);

			let fullResponse = "";
			let currentText = "";

			// Process the resumed stream
			for await (const event of resumedStream) {
				if (event.type === "raw_model_stream_event") {
					const data = event.data;
					if (
						"type" in data &&
						data.type === "output_text_delta" &&
						"delta" in data
					) {
						onChunk(data.delta as string);
						currentText += data.delta as string;
					}
				}
			}

			await resumedStream.completed;
			// The final output is in the currentText we accumulated
			fullResponse = currentText;

			// Check for more interruptions
			if (
				resumedStream.interruptions &&
				resumedStream.interruptions.length > 0
			) {
				return {
					response: fullResponse,
					requiresApproval: true,
					approvalData: {
						id: Date.now().toString(),
						type: "create",
						description: "Additional tool approval required",
						content: JSON.stringify(resumedStream.interruptions),
					},
					stream: resumedStream,
				};
			}

			return {
				response: fullResponse,
				requiresApproval: false,
			};
		} catch (error) {
			throw ErrorFactory.streamResumeFailure(error as Error, {
				approvalCount: approvals.size,
				interruptionCount: stream.interruptions.length,
			});
		}
	}

	/**
	 * Handle approval response (legacy method for backward compatibility)
	 */
	async handleApproval(
		approved: boolean,
		approvalData: ApprovalRequest
	): Promise<string> {
		if (approved) {
			// Send approval confirmation back to the agent
			const message = `The user has approved the following action: ${approvalData.description}. Please proceed with the implementation.`;
			const result = await this.processMessage(message);
			return result.response;
		} else {
			return "The operation has been cancelled as requested.";
		}
	}
}
