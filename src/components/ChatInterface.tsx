import * as React from "react";
import {
	useRef,
	useEffect,
	forwardRef,
	useImperativeHandle,
} from "react";
import { ChatMessage, ToolResponse, MessageSegment } from "../types";
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
	useContextStore,
	useUndoStore
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
		const { currentTool, getToolHistory, clearPendingApprovals, getPendingApprovals, hasApprovalTools } = useToolStore();
		const { contextFiles, setContextFiles, removeContextFile } = useContextStore();
		const { startStreaming, updateStreamingContent, completeStreaming, handleToolCall } = useStreamingMessage();
		const { undo, redo, canUndo, canRedo } = useUndoStore();
		
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

				// Start streaming message
				startStreaming(assistantMessageId, null);

				// Get pending approvals for logging
				const pendingApprovals = getPendingApprovals();

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
						},
					);

				// Complete the assistant's response message with approval info if needed
				if (result.stream && result.stream.interruptions && result.stream.interruptions.length > 0) {
					// Get current content before tool call
					const currentMessage = messages.find(m => m.id === assistantMessageId);
					const preservedContent = currentMessage?.content || '';
					
					// Create segments for the message
					const segments: MessageSegment[] = [];
					
					// Add initial text segment if there's content
					if (preservedContent) {
						segments.push({
							id: `${assistantMessageId}-text-1`,
							type: 'text',
							content: preservedContent,
							timestamp: Date.now(),
						});
					}
					
					// Add tool approval segment
					segments.push({
						id: `${assistantMessageId}-approval-1`,
						type: 'tool-approval',
						content: '', // Content will be rendered by the approval component
						timestamp: Date.now(),
						metadata: {
							streamResult: result.stream,
							interruptions: result.stream.interruptions,
							approvalStatus: 'pending'
						}
					});
					
					// Update the existing message with segments and approval status
					updateMessage(assistantMessageId, {
						content: result.response,
						status: "complete",
						streamResult: result.stream,
						approvalStatus: "pending",
						segments: segments,
						preservedContent: preservedContent
					});
				} else {
					// Just complete the streaming message normally
					completeStreaming(assistantMessageId, result.response);
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
			// Find the message with the stream result
			const message = messages.find((m) => m.id === messageId);
			if (!message?.streamResult || !agentOrchestrator.current) return;

			// Update the approval status in the segment
			const updatedSegments = [...(message.segments || [])];
			const approvalSegmentIndex = updatedSegments.findIndex(
				s => s.type === 'tool-approval' && s.metadata?.approvalStatus === 'pending'
			);
			
			if (approvalSegmentIndex !== -1) {
				updatedSegments[approvalSegmentIndex] = {
					...updatedSegments[approvalSegmentIndex],
					metadata: {
						...updatedSegments[approvalSegmentIndex].metadata,
						approvalStatus: "approved"
					}
				};
			}

			// Update the message with approved status
			updateMessage(messageId, { 
				approvalStatus: "approved" as const,
				segments: updatedSegments
			});

			setProcessing(true);
			try {
				// Create a continuation segment for the resumed response
				const continuationSegmentId = `${messageId}-continuation-${Date.now()}`;
				const continuationSegment: MessageSegment = {
					id: continuationSegmentId,
					type: 'continuation',
					content: '',
					timestamp: Date.now(),
				};

				// Add the continuation segment
				const segmentsWithContinuation = [...updatedSegments, continuationSegment];
				updateMessage(messageId, {
					segments: segmentsWithContinuation,
					status: "streaming"
				});

				// Buffer for accumulating chunks
				let continuationContent = '';

				// Handle the approval with streaming
				const result =
					await agentOrchestrator.current.handleStreamApprovalWithHistory(
						message.streamResult,
						approvals,
						messages, // Pass full message history
						(chunk) => {
							// Accumulate chunks
							continuationContent += chunk;
							
							// Update the continuation segment content
							const updatedSegments = segmentsWithContinuation.map(seg => 
								seg.id === continuationSegmentId 
									? { ...seg, content: continuationContent }
									: seg
							);
							
							updateMessage(messageId, {
								segments: updatedSegments,
								content: message.preservedContent 
									? message.preservedContent + '\n\n' + continuationContent 
									: continuationContent
							});
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

				// Check if there are more interruptions
				if (result.stream && result.stream.interruptions && result.stream.interruptions.length > 0) {
					// Add another approval segment
					const newApprovalSegment: MessageSegment = {
						id: `${messageId}-approval-${Date.now()}`,
						type: 'tool-approval',
						content: '',
						timestamp: Date.now(),
						metadata: {
							streamResult: result.stream,
							interruptions: result.stream.interruptions,
							approvalStatus: 'pending'
						}
					};
					
					const finalSegments = [...segmentsWithContinuation, newApprovalSegment];
					
					updateMessage(messageId, {
						segments: finalSegments,
						status: "complete",
						approvalStatus: "pending",
						streamResult: result.stream,
						content: message.preservedContent 
							? message.preservedContent + '\n\n' + result.response 
							: result.response
					});
				} else {
					// Final update - mark as complete
					updateMessage(messageId, {
						status: "complete",
						content: message.preservedContent 
							? message.preservedContent + '\n\n' + result.response 
							: result.response
					});
				}
			} catch (error) {
				console.error("Error handling tool approval:", error);
				new Notice("Error processing tool approval");
				
				// Add error segment
				const errorSegment: MessageSegment = {
					id: `${messageId}-error-${Date.now()}`,
					type: 'text',
					content: `Error: ${error.message}`,
					timestamp: Date.now(),
				};
				
				updateMessage(messageId, {
					segments: [...updatedSegments, errorSegment],
					status: "error"
				});
			} finally {
				setProcessing(false);
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
					// Handle error
					const resultMessage: ChatMessage = {
						id: Date.now().toString(),
						role: "assistant",
						content: `Error handling approval: ${error.message}`,
						timestamp: Date.now(),
						status: "error",
					};
					addMessage(resultMessage);
				}
			}
		};

		const handleReject = async (messageId: string) => {
			// Find the message
			const message = messages.find((m) => m.id === messageId);
			if (!message) return;

			// Update the approval status in the segment
			const updatedSegments = [...(message.segments || [])];
			const approvalSegmentIndex = updatedSegments.findIndex(
				s => s.type === 'tool-approval' && s.metadata?.approvalStatus === 'pending'
			);
			
			if (approvalSegmentIndex !== -1) {
				updatedSegments[approvalSegmentIndex] = {
					...updatedSegments[approvalSegmentIndex],
					metadata: {
						...updatedSegments[approvalSegmentIndex].metadata,
						approvalStatus: "rejected"
					}
				};
			}

			// Add a rejection notice segment
			const rejectionSegment: MessageSegment = {
				id: `${messageId}-rejection-${Date.now()}`,
				type: 'text',
				content: 'Operation cancelled.',
				timestamp: Date.now(),
			};

			// Update the message with rejected status and segments
			updateMessage(messageId, { 
				approvalStatus: "rejected" as const,
				segments: [...updatedSegments, rejectionSegment],
				status: "complete"
			});
		};

		const handleClearChat = () => {
			clearMessages();
		};

		return (
			<div className="chat-assistant-interface">
				<div className="chat-header">
					<h3>Chat Assistant</h3>
					<div className="chat-header-actions">
						<button
							className="chat-action-button"
							onClick={() => undo()}
							disabled={!canUndo()}
							title="Undo last file operation"
						>
							↶ Undo
						</button>
						<button
							className="chat-action-button"
							onClick={() => redo()}
							disabled={!canRedo()}
							title="Redo last file operation"
						>
							↷ Redo
						</button>
						<button
							className="chat-clear-button"
							onClick={handleClearChat}
							title="Clear chat"
						>
							Clear
						</button>
					</div>
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