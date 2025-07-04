import * as React from "react";
import {
	useRef,
	useEffect,
	forwardRef,
	useImperativeHandle,
} from "react";
import { ChatMessage, ToolResponse } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

import ObsidianChatAssistant from "../main";
import { Notice } from "obsidian";
import { ApprovalManager } from "../managers/ApprovalManager";
import { AgentOrchestrator } from "../agents/AgentOrchestrator";

import { TFile } from "obsidian";
import { ContextBadges } from "./ContextBadges";
import { 
	useConversationStore, 
	useToolStore, 
	useStreamStore, 
	useContextStore 
} from "../stores";
import { useStreamingMessage } from "../hooks/useStreamingMessage";

interface ChatInterfaceProps {
	plugin: ObsidianChatAssistant;
	initialFiles?: TFile[];
}

export const ChatInterface = forwardRef<any, ChatInterfaceProps>(
	({ plugin, initialFiles }, ref) => {
		// Use stores instead of local state
		const { messages, addMessage, updateMessage, clearMessages, isProcessing, setProcessing } = useConversationStore();
		const { currentTool, getToolHistory, clearPendingApprovals } = useToolStore();
		const { contextFiles, setContextFiles, removeContextFile } = useContextStore();
		const { startStreaming, updateStreamingContent, completeStreaming, handleToolCall } = useStreamingMessage();
		
		const messagesEndRef = useRef<HTMLDivElement>(null);
		
		// Initialize context files if provided
		useEffect(() => {
			if (initialFiles && initialFiles.length > 0) {
				setContextFiles(initialFiles);
			}
		}, [initialFiles, setContextFiles]);

		// Initialize tool router and approval manager
		const approvalManager = useRef<ApprovalManager>(
			new ApprovalManager(plugin.app, plugin.settings.approvalRequired),
		);

		// Initialize agent orchestrator
		const agentOrchestrator = useRef<AgentOrchestrator | null>(null);

		useEffect(() => {
			if (plugin.settings.openaiApiKey) {
				agentOrchestrator.current = new AgentOrchestrator(
					plugin.app,
					plugin.settings.openaiApiKey,
					plugin.settings.model,
					plugin.settings.maxTurns,
				);
			}
		}, [
			plugin.settings.openaiApiKey,
			plugin.settings.model,
			plugin.settings.maxTurns,
		]);

		// Update approval manager when settings change
		useEffect(() => {
			approvalManager.current.setApprovalRequired(
				plugin.settings.approvalRequired,
			);
		}, [plugin.settings.approvalRequired]);

		const handleRemoveFileFromContext = (file: TFile) => {
			removeContextFile(file.path);
		};

		// Expose processCommand method to parent
		useImperativeHandle(ref, () => ({
			processCommand: async (command: string, input: string) => {
				// Create a user message showing the command
				const userMessage: ChatMessage = {
					id: Date.now().toString(),
					role: "user",
					content: `/${command} ${input}`,
					timestamp: Date.now(),
					status: "complete",
				};
				addMessage(userMessage);
				setProcessing(true);

				try {
					// Process the specific command
					let result;
					switch (command) {
						case "analyse":
							result = await processAnalyseCommand(input);
							break;
						case "research":
							result = await processResearchCommand(input);
							break;
						case "tidy":
							result = await processTidyCommand(input);
							break;
						default:
							result = {
								success: false,
								message: `Unknown command: ${command}`,
							};
					}

					const assistantMessage: ChatMessage = {
						id: (Date.now() + 1).toString(),
						role: "assistant",
						content: result.message,
						timestamp: Date.now(),
						status: result.success ? "complete" : "error",
						error: result.success ? undefined : result.message,
						approvalRequest: result.requiresApproval
							? result.approvalData
							: undefined,
						approvalStatus: result.requiresApproval
							? "pending"
							: undefined,
					};
					addMessage(assistantMessage);
				} catch (error) {
					console.error("Error processing command:", error);
					const errorMessage: ChatMessage = {
						id: (Date.now() + 1).toString(),
						role: "assistant",
						content: `Error: ${error.message}`,
						timestamp: Date.now(),
						status: "error",
						error: error.message,
					};
					addMessage(errorMessage);
				} finally {
					setProcessing(false);
				}
			},
		}));

		// Command processing functions
		const processAnalyseCommand = async (
			input: string,
		): Promise<ToolResponse> => {
			if (!agentOrchestrator.current) {
				return {
					success: false,
					message:
						"Please set your OpenAI API key in settings to use AI features.",
				};
			}

			try {
				const result =
					await agentOrchestrator.current.processCommandStream(
						"analyse",
						input,
						(chunk) => {
							// Could update a temporary message here if needed
						},
					);
				return {
					success: true,
					message: result.response,
					requiresApproval: result.requiresApproval,
					approvalData: result.approvalData,
				};
			} catch (error) {
				return {
					success: false,
					message: `Error: ${error.message}`,
				};
			}
		};

		const processResearchCommand = async (
			input: string,
		): Promise<ToolResponse> => {
			if (!agentOrchestrator.current) {
				return {
					success: false,
					message:
						"Please set your OpenAI API key in settings to use AI features.",
				};
			}

			try {
				const result =
					await agentOrchestrator.current.processCommandStream(
						"research",
						input,
						(chunk) => {
							// Could update a temporary message here if needed
						},
					);
				return {
					success: true,
					message: result.response,
					requiresApproval: result.requiresApproval,
					approvalData: result.approvalData,
				};
			} catch (error) {
				return {
					success: false,
					message: `Error: ${error.message}`,
				};
			}
		};

		const processTidyCommand = async (
			input: string,
		): Promise<ToolResponse> => {
			if (!agentOrchestrator.current) {
				return {
					success: false,
					message:
						"Please set your OpenAI API key in settings to use AI features.",
				};
			}

			try {
				const result =
					await agentOrchestrator.current.processCommandStream(
						"tidy",
						input,
						(chunk) => {
							// Could update a temporary message here if needed
						},
					);
				return {
					success: true,
					message: result.response,
					requiresApproval: result.requiresApproval,
					approvalData: result.approvalData,
				};
			} catch (error) {
				return {
					success: false,
					message: `Error: ${error.message}`,
				};
			}
		};

		const scrollToBottom = () => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		};

		useEffect(() => {
			scrollToBottom();
		}, [messages]);

		const handleSendMessage = async (content: string) => {
			if (!content.trim()) return;

			// Check if API key is set
			if (!plugin.settings.openaiApiKey) {
				new Notice("Please set your OpenAI API key in settings");
				return;
			}

			// Add user message
			const userMessage: ChatMessage = {
				id: Date.now().toString(),
				role: "user",
				content,
				timestamp: Date.now(),
				status: "complete",
			};

			// Build comprehensive context information
			const contextParts: string[] = [];

			// Add recently opened files
			const recentFiles = plugin.app.workspace.getLastOpenFiles();
			if (recentFiles.length > 0) {
				const recentFileNames = recentFiles
					.slice(0, 10) // Limit to 10 most recent
					.map(path => {
						const name = path.split('/').pop() || path;
						return `- ${name}`;
					})
					.join('\n');
				contextParts.push(`Recently opened files:\n${recentFileNames}`);
			}

			// Add current active file info
			const activeFile = plugin.app.workspace.getActiveFile();
			if (activeFile) {
				// Get folder path to root
				const folderPath = activeFile.parent?.path || '/';
				contextParts.push(`Current file: ${activeFile.name}\nFolder path: ${folderPath}`);
			}

			// Add context files
			if (contextFiles.length > 0) {
				const contextFilesList = contextFiles
					.map((f) => `- ${f.path}`)
					.join("\n");
				contextParts.push(`Files provided as context:\n${contextFilesList}`);
			}

			// Create a system message with all context
			const contextMessage: ChatMessage | null =
				contextParts.length > 0
					? {
							id: (Date.now() - 1).toString(),
							role: "system",
							content: contextParts.join('\n\n'),
							timestamp: Date.now(),
							status: "complete",
						}
					: null;

			const messagesWithContext = contextMessage
				? [contextMessage, ...messages, userMessage]
				: [...messages, userMessage];

			addMessage(userMessage);
			setProcessing(true);

			// Process the message
			try {
				// Clear any pending approvals from previous messages
				clearPendingApprovals();

				if (!agentOrchestrator.current) {
					const assistantMessage: ChatMessage = {
						id: (Date.now() + 1).toString(),
						role: "assistant",
						content:
							"Please set your OpenAI API key in settings to use chat features.",
						timestamp: Date.now(),
						status: "complete",
					};
					addMessage(assistantMessage);
					return;
				}

				// Create assistant message with streaming status
				const assistantMessageId = (Date.now() + 1).toString();

				// Get all messages including the current user message
				const allMessages = messagesWithContext;

				// Track tools that need approval
				const pendingApprovals: any[] = [];
				let hasApprovalTools = false;

				// Start streaming message
				startStreaming(assistantMessageId, null);

				// Process through agent orchestrator with streaming, including history
				const result =
					await agentOrchestrator.current.processMessagesWithHistoryStream(
						allMessages,
						(chunk) => {
							// Update message content as chunks arrive
							updateStreamingContent(assistantMessageId, chunk);
						},
						(toolName, args) => {
							// Handle tool calls
							handleToolCall(toolName, args);
							console.log(`Using tool: ${toolName}`, args);

							// Check if this tool needs approval
							const approvalTools = [
								"create_note",
								"modify_note",
								"delete_file",
								"create_folder",
								"copy_file",
							];
							if (approvalTools.includes(toolName)) {
								hasApprovalTools = true;
								pendingApprovals.push({
									id: Date.now().toString() + Math.random(),
									rawItem: {
										name: toolName,
										arguments: args,
									},
								});

								// Don't update the streaming message with approval info
								// It will be added as a separate message at the end
							}
						},
					);

				// First, complete the assistant's response message
				completeStreaming(assistantMessageId, result.response);

				console.log('[ChatInterface] Stream result:', {
					hasRequiresApproval: result.requiresApproval,
					hasStream: !!result.stream,
					hasInterruptions: !!result.stream?.interruptions,
					interruptionCount: result.stream?.interruptions?.length,
					hasApprovalData: !!result.approvalData,
					hasApprovalTools: hasApprovalTools,
					pendingApprovalsCount: pendingApprovals.length
				});

				// Check for SDK interruptions first
				if (result.stream?.interruptions && result.stream.interruptions.length > 0) {
					// Use the actual SDK interruptions
					const toolApprovalMessage: ChatMessage = {
						id: Date.now().toString() + "-tool-approval",
						role: "assistant",
						content: "", // Empty content for tool approval message
						timestamp: Date.now(),
						status: "complete",
						streamResult: result.stream,
						approvalStatus: "pending",
					};
					console.log('[ChatInterface] Creating tool approval message from SDK interruptions:', {
						messageId: toolApprovalMessage.id,
						approvalStatus: toolApprovalMessage.approvalStatus,
						interruptionCount: result.stream.interruptions.length,
						hasStreamResult: !!toolApprovalMessage.streamResult,
						interruptions: result.stream.interruptions
					});
					addMessage(toolApprovalMessage);
				} else if (hasApprovalTools && pendingApprovals.length > 0) {
					// Fallback to manually tracked approvals
					const toolApprovalMessage: ChatMessage = {
						id: Date.now().toString() + "-tool-approval",
						role: "assistant",
						content: "", // Empty content for tool approval message
						timestamp: Date.now(),
						status: "complete",
						streamResult: result.stream || {
							interruptions: pendingApprovals,
						},
						approvalStatus: "pending",
					};
					console.log('[ChatInterface] Creating tool approval message from manual tracking:', {
						messageId: toolApprovalMessage.id,
						approvalStatus: toolApprovalMessage.approvalStatus,
						interruptionCount: pendingApprovals.length,
						hasStreamResult: !!toolApprovalMessage.streamResult
					});
					addMessage(toolApprovalMessage);
				} else if (result.requiresApproval) {
					// Handle non-streaming approvals
					const approvalMessage: ChatMessage = {
						id: Date.now().toString() + "-approval",
						role: "assistant",
						content: "",
						timestamp: Date.now(),
						status: "complete",
						approvalRequest: result.approvalData,
						approvalStatus: "pending",
					};
					addMessage(approvalMessage);
				}
			} catch (error) {
				console.error("Error processing message:", error);
				const errorMessage: ChatMessage = {
					id: (Date.now() + 1).toString(),
					role: "assistant",
					content: `Error: ${error.message}`,
					timestamp: Date.now(),
					status: "error",
					error: error.message,
				};
				addMessage(errorMessage);
			} finally {
				setProcessing(false);
			}
		};

		const handleToolApproval = async (
			messageId: string,
			approvals: Map<string, boolean>,
		) => {
			console.log("[ChatInterface] handleToolApproval called with:", {
				messageId,
				approvalCount: approvals.size,
				approvalDetails: Array.from(approvals.entries())
			});

			// Update the message status while preserving streamResult
			updateMessage(messageId, { 
				approvalStatus: "approved" as const,
			});

			// Find the message with the stream result
			const message = messages.find((m) => m.id === messageId);
			console.log("[ChatInterface] Found message:", {
				hasMessage: !!message,
				hasStreamResult: !!message?.streamResult,
				hasInterruptions: !!message?.streamResult?.interruptions,
				interruptionCount: message?.streamResult?.interruptions?.length,
				messageContent: message?.content?.substring(0, 100)
			});

			if (message?.streamResult && agentOrchestrator.current) {
				setProcessing(true);
				
				// Create a new message for the resumed response
				const resumedMessageId = Date.now().toString();
				
				try {
					// Log the interruptions we're about to approve
					console.log("[ChatInterface] Stream interruptions:", 
						JSON.stringify(message.streamResult.interruptions, null, 2)
					);

					const resumedMessage: ChatMessage = {
						id: resumedMessageId,
						role: "assistant",
						content: "",
						timestamp: Date.now(),
						status: "streaming",
					};
					startStreaming(resumedMessageId, message.streamResult);

					console.log("[ChatInterface] Calling handleStreamApprovalWithHistory with:", {
						messageCount: messages.length,
						messageRoles: messages.map(m => m.role),
						lastUserMessage: messages.filter(m => m.role === 'user').pop()?.content?.substring(0, 100)
					});

					// Handle the approval with streaming
					// Pass the full conversation history to maintain context
					const result =
						await agentOrchestrator.current.handleStreamApprovalWithHistory(
							message.streamResult,
							approvals,
							messages, // Pass full message history
							(chunk) => {
								// Update message content as chunks arrive
								updateStreamingContent(resumedMessageId, chunk);
							},
						);

					// Refresh context if files were modified
					if (message.streamResult) {
						const modifiedFiles = Array.from(approvals.keys())
							.map((id) => {
								const interruption =
									message.streamResult!.interruptions.find(
										(i: any) => i.id === id,
									);
								// Handle different interruption structures
								const args = 
									interruption?.rawItem?.arguments ||
									interruption?.item?.arguments ||
									interruption?.arguments ||
									{};
								return args.path;
							})
							.filter(Boolean);

						if (modifiedFiles.length > 0) {
							const newFiles = await Promise.all(
								modifiedFiles.map(
									(path: string) =>
										plugin.app.vault.getAbstractFileByPath(
											path,
										) as TFile,
								),
							);
							const filteredFiles = contextFiles.filter(
								(f) => !modifiedFiles.includes(f.path)
							);
							setContextFiles([...filteredFiles, ...newFiles]);
						}
					}

					// Update final message
					completeStreaming(resumedMessageId, result.response);
					
					// Add approval message if needed
					if (result.requiresApproval) {
						updateMessage(resumedMessageId, {
							approvalRequest: result.approvalData,
							approvalStatus: "pending",
							streamResult: result.stream,
						});
					}
				} catch (error) {
					console.error("[ChatInterface] Error handling tool approval:", error);
					console.error("[ChatInterface] Error details:", {
						errorMessage: error.message,
						errorStack: error.stack,
						errorType: error.constructor.name
					});
					new Notice(`Error processing tool approval: ${error.message}`);
					
					// Update the resumed message with error
					updateMessage(resumedMessageId, {
						status: "error",
						error: error.message
					});
				} finally {
					setProcessing(false);
				}
			}
		};

		const handleApprove = async (messageId: string) => {
			// Update the message status
			updateMessage(messageId, { approvalStatus: "approved" as const });

			// Find the message and execute the approved action
			const message = messages.find((m) => m.id === messageId);
			if (message?.approvalRequest && agentOrchestrator.current) {
				try {
					const result =
						await agentOrchestrator.current.handleApproval(
							true,
							message.approvalRequest,
						);

					const resultMessage: ChatMessage = {
						id: Date.now().toString(),
						role: "assistant",
						content: result,
						timestamp: Date.now(),
						status: "complete",
					};
					addMessage(resultMessage);
				} catch (error) {
					// Fallback to approval manager
					const result =
						await approvalManager.current.executeApprovedOperation(
							message.approvalRequest,
						);

					const resultMessage: ChatMessage = {
						id: Date.now().toString(),
						role: "assistant",
						content: result.message,
						timestamp: Date.now(),
						status: result.success ? "complete" : "error",
					};
					addMessage(resultMessage);
				}
			}
		};

		const handleReject = async (messageId: string) => {
			// Update the message status while preserving streamResult
			updateMessage(messageId, { approvalStatus: "rejected" as const });

			// Add a follow-up message
			const resultMessage: ChatMessage = {
				id: Date.now().toString(),
				role: "assistant",
				content: "Operation cancelled.",
				timestamp: Date.now(),
				status: "complete",
			};
			addMessage(resultMessage);
		};

		const handleClearChat = () => {
			clearMessages();
		};

		return (
			<div className="chat-assistant-interface">
				<div className="chat-header">
					<h3>Chat Assistant</h3>
					<button
						className="chat-clear-button"
						onClick={handleClearChat}
						title="Clear chat"
					>
						Clear
					</button>
				</div>
				<ContextBadges
					files={contextFiles}
					onRemoveFile={handleRemoveFileFromContext}
				/>
				<div className="chat-messages">
					{messages.length === 0 && (
						<div className="chat-welcome">
							<p>Welcome to Obsidian Chat Assistant!</p>
							<p>
								I'm Alex, your AI conductor. I can help you
								with:
							</p>
							<ul>
								<li>
									<strong>Research</strong> - Search your
									vault and the web for information
								</li>
								<li>
									<strong>Analysis</strong> - Analyze
									documents and provide insights
								</li>
								<li>
									<strong>Organization</strong> - Create,
									edit, and organize your notes
								</li>
							</ul>
							<p>
								You can chat naturally with me or use the
								Command Palette (Cmd/Ctrl+P) for specific tasks.
							</p>
						</div>
					)}
					{messages.map((message) => (
						<MessageBubble
							key={message.id}
							message={message}
							onApprove={handleApprove}
							onReject={handleReject}
							onToolApproval={handleToolApproval}
							isThinking={message.status === "streaming"}
							toolName={
								message.status === "streaming"
									? currentTool || undefined
									: undefined
							}
							toolHistory={
								message.status === "streaming"
									? getToolHistory()
									: undefined
							}
						/>
					))}

					<div ref={messagesEndRef} />
				</div>
				<ChatInput
					onSendMessage={handleSendMessage}
					isProcessing={isProcessing}
				/>
			</div>
		);
	},
);
