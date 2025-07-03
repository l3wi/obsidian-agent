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

export class AgentOrchestrator {
	private app: App;
	private conductor: Agent;
	private apiKey: string;
	private model: string;
	private maxTurns: number;
	private openaiClient: OpenAI;
	private provider: OpenAIProvider;

	/**
	 * Convert chat messages to agent input format
	 */
	private convertChatHistory(messages: ChatMessage[]): any[] {
		return messages
			.map((msg) => {
				if (msg.role === "user") {
					return user(msg.content);
				} else if (msg.role === "assistant") {
					return assistant(msg.content);
				} else if (msg.role === "system") {
					return system(msg.content);
				}
				// Skip unknown message types
				return null;
			})
			.filter(Boolean);
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
- **Proactive & Autonomous:** You take initiative and anticipate user needs.
- **Confident & Decisive:** You make logical assumptions and act on them. You only ask for clarification if a request is highly ambiguous or could lead to data loss.
- **Concise & Clear:** Your communication is direct and to the point.

**Execution Protocol:**

1.  **Analyze & Assume Intent:**
    *   Carefully analyze the user's request and any provided context (e.g., the content of the active file).
    *   Assume the user's intent and formulate a plan. Do not ask for confirmation of your plan unless absolutely necessary.

2.  **Direct Action:**
    *   If the plan does not require a tool, execute it directly by providing the answer or content.
    *   If a tool is needed, use it. For file modifications, deletions, or creations, you must still ask for approval.

3.  **Structured Output:**
    *   When creating or modifying content, prepare the full content as a draft.
    *   Once the draft is complete and accurate, use the appropriate tool (create_note, modify_note) to save it to the vault.

Your tools:
1. web_search: Search the web for current information
2. code_interpreter: Run code for analysis, calculations, and data processing
3. create_note: Create new notes (requires approval)
4. modify_note: Modify existing notes (requires approval)
5. create_folder: Create new folders (requires approval)
6. copy_file: Copy files or folders (requires approval)
7. delete_file: Delete files or folders (requires approval)

Always ask for user approval before creating, modifying, or deleting files and folders.`,
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
		return this.processMessageStream(
			agentMessages,
			onChunk,
			onToolCall,
			onApprovalNeeded
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
				console.log("[AgentOrchestrator] Stream event:", {
					type: event.type,
					name: "name" in event ? event.name : undefined,
				});

				switch (event.type) {
					case "raw_model_stream_event": {
						console.log(
							"[AgentOrchestrator] Raw model stream event data:",
							event.data
						);
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
								console.log(
									"[AgentOrchestrator] Tool called:",
									{
										tool: (item as any).name,
										args: (item as any).arguments,
									}
								);
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
	 * Handle tool approval for streaming interruptions
	 */
	async handleStreamApproval(
		stream: any,
		approvals: Map<string, boolean>,
		onChunk: (chunk: string) => void
	): Promise<{
		response: string;
		requiresApproval?: boolean;
		approvalData?: ApprovalRequest;
		stream?: any; // StreamedRunResult
	}> {
		if (!stream.interruptions || stream.interruptions.length === 0) {
			return {
				response: "No approvals needed",
				requiresApproval: false,
			};
		}

		const state = stream.state;

		// Process each interruption
		for (const interruption of stream.interruptions) {
			const approved = approvals.get(interruption.id) ?? false;
			if (approved) {
				state.approve(interruption);
			} else {
				state.reject(interruption);
			}
		}

		// Resume execution with streaming using the existing state which includes history
		const resumedStream = await run(this.conductor, state, {
			stream: true,
			maxTurns: this.maxTurns,
		});

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
